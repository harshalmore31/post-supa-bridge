import psycopg2
import select
import json
from supabase import create_client, Client
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
import threading
import time

# Flask app initialization
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")

# Supabase Credentials (REPLACE WITH YOUR VALUES)
SUPABASE_URL = "https://wqvpqljcbnzdidydahfy.supabase.co"  # Replace
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnBxbGpjYm56ZGlkeWRhaGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkwNzE1ODgsImV4cCI6MjA1NDY0NzU4OH0.ctARuaOIdVrJxFwMmNduJeAAgGpIEVB5LqR7J4gUnbs"  # Replace

# PostgreSQL Connection (REPLACE WITH YOUR VALUES)
LOCAL_DB = {
    "dbname": "post-supa",
    "user": "postgres",
    "host": "localhost",
    "port": "5432",
    "password": "" # Add your password!
}

# Connect to Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Connect to Local PostgreSQL
conn = psycopg2.connect(**LOCAL_DB)
conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()

def get_all_items():
    """Get all items from the local PostgreSQL database"""
    try:
        cur.execute('SELECT "item_id", "name", "sku", "rate", "purchase rate", "stock on hand" FROM "public"."Items_data";')
        rows = cur.fetchall()
        items = []
        for row in rows:
            item = {
                "item_id": row[0],
                "name": row[1],
                "sku": row[2],
                "rate": float(row[3]) if row[3] is not None else 0.0,
                "purchase rate": float(row[4]) if row[4] is not None else 0.0,
                "stock on hand": int(row[5]) if row[5] is not None else 0
            }
            items.append(item)
        return items
    except Exception as e:
        print(f"Error getting items: {e}")
        return []

def get_item_by_id(item_id):
    """Get a specific item by ID from the local PostgreSQL database"""
    try:
        cur.execute('SELECT "item_id", "name", "sku", "rate", "purchase rate", "stock on hand" FROM "public"."Items_data" WHERE item_id = %s;', (item_id,))
        row = cur.fetchone()
        if row:
            item = {
                "item_id": row[0],
                "name": row[1],
                "sku": row[2],
                "rate": float(row[3]) if row[3] is not None else 0.0,
                "purchase rate": float(row[4]) if row[4] is not None else 0.0,
                "stock on hand": int(row[5]) if row[5] is not None else 0
            }
            return item
        return None
    except Exception as e:
        print(f"Error getting item by ID: {e}")
        return None

def insert_item(item):
    """Insert a new item into the PostgreSQL database"""
    try:
        # Use column names consistently
        cur.execute(
            'INSERT INTO "public"."Items_data" ("name", "sku", "rate", "purchase rate", "stock on hand") VALUES (%s, %s, %s, %s, %s) RETURNING item_id;',
            (item["name"], item["sku"], item["rate"], item["purchase rate"], item["stock on hand"])
        )
        
        item_id = cur.fetchone()[0]
        item["item_id"] = item_id
        return item
    except Exception as e:
        print(f"Error inserting item: {e}")
        return None

def update_item(item_id, item):
    """Update an existing item in the PostgreSQL database"""
    try:
        cur.execute(
            'UPDATE "public"."Items_data" SET "name" = %s, "sku" = %s, "rate" = %s, "purchase rate" = %s, "stock on hand" = %s WHERE item_id = %s RETURNING item_id;',
            (item["name"], item["sku"], item["rate"], item["purchase rate"], item["stock on hand"], item_id)
        )
        
        updated_id = cur.fetchone()
        if updated_id:
            item["item_id"] = item_id
            return item
        return None
    except Exception as e:
        print(f"Error updating item: {e}")
        return None

def delete_item(item_id):
    """Delete an item from the PostgreSQL database"""
    try:
        cur.execute('DELETE FROM "public"."Items_data" WHERE item_id = %s RETURNING item_id;', (item_id,))
        deleted_id = cur.fetchone()
        return deleted_id is not None
    except Exception as e:
        print(f"Error deleting item: {e}")
        return False

def sync_to_supabase(data):
    """ Sync data with Supabase """
    try:
        if "item_id" not in data:
            print("Invalid data, skipping...")
            return

        # Create a *copy* of the data dictionary and remove TG_OP
        data_to_send = data.copy()  # IMPORTANT: Create a copy!
        if 'TG_OP' in data_to_send:  # Check if it exists before deleting
            del data_to_send['TG_OP']

        response = supabase.table("Items_data").select("*").eq("item_id", data_to_send["item_id"]).execute()

        if response.data:
            supabase.table("Items_data").update(data_to_send).eq("item_id", data_to_send["item_id"]).execute()
            print(f"Updated item_id: {data_to_send['item_id']} in Supabase")
        else:
            supabase.table("Items_data").insert(data_to_send).execute()
            print(f"Inserted item_id: {data_to_send['item_id']} into Supabase")

    except Exception as e:
        print(f"Error syncing to Supabase: {e}")

def sync_delete_to_supabase(data):
    """Sync delete operations to Supabase"""
    try:
        if "item_id" not in data:
            print("Invalid data, skipping delete...")
            return

        supabase.table("Items_data").delete().eq("item_id", data["item_id"]).execute()
        print(f"Deleted item_id: {data['item_id']} from Supabase")

    except Exception as e:
        print(f"Error syncing delete to Supabase: {e}")

# --- API Routes ---
@app.route('/api/items', methods=['GET'])
def get_items():
    """API endpoint to get all items"""
    items = get_all_items()
    return jsonify(items)

@app.route('/api/items/<int:item_id>', methods=['GET'])
def get_item(item_id):
    """API endpoint to get a specific item"""
    item = get_item_by_id(item_id)
    if item:
        return jsonify(item)
    return jsonify({"error": "Item not found"}), 404

@app.route('/api/items', methods=['POST'])
def create_item():
    """API endpoint to create a new item"""
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    item = insert_item(data)
    if item:
        # Emit WebSocket event
        socketio.emit('item_update', {'operation': 'INSERT', 'item': item})
        return jsonify(item), 201
    return jsonify({"error": "Failed to create item"}), 500

@app.route('/api/items/<int:item_id>', methods=['PUT'])
def update_item_endpoint(item_id):
    """API endpoint to update an existing item"""
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    updated_item = update_item(item_id, data)
    if updated_item:
        # Emit WebSocket event
        socketio.emit('item_update', {'operation': 'UPDATE', 'item': updated_item})
        return jsonify(updated_item)
    return jsonify({"error": "Item not found or update failed"}), 404

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item_endpoint(item_id):
    """API endpoint to delete an item"""
    success = delete_item(item_id)
    if success:
        # Emit WebSocket event
        socketio.emit('item_update', {'operation': 'DELETE', 'item_id': item_id})
        return jsonify({"success": True})
    return jsonify({"error": "Item not found or delete failed"}), 404

# --- Initial Data Load (Conditional) ---
def initial_data_load():
    print("Checking if initial data load is needed...")
    # Check if Supabase table has any data
    response = supabase.table("Items_data").select("item_id", count='exact').execute()

    if response.count == 0:  # If count is 0, the table is empty
        print("Performing initial data load...")
        items = get_all_items()
        for item in items:
            sync_to_supabase(item)
        print("Initial data load complete.")
    else:
        print("Initial data already exists in Supabase. Skipping initial load.")

# --- Database Change Listener Thread ---
def db_listener_thread():
    """Thread to listen for PostgreSQL notifications"""
    listen_conn = psycopg2.connect(**LOCAL_DB)
    listen_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    listen_cur = listen_conn.cursor()
    listen_cur.execute("LISTEN items_data_channel;")
    print("Listening for changes on items_data...")
    
    try:
        while True:
            if select.select([listen_conn], [], [], 5) == ([], [], []):
                # Timeout occurred, just continue
                continue
                
            listen_conn.poll()
            while listen_conn.notifies:
                notify = listen_conn.notifies.pop(0)
                print(f"🔔 Change detected: {notify.payload}")
                data = json.loads(notify.payload)
                
                if notify.channel == 'items_data_channel':
                    if 'TG_OP' in data:
                        # Process for Supabase sync
                        if data['TG_OP'] == 'DELETE':
                            sync_delete_to_supabase(data)
                            # Notify WebSocket clients
                            socketio.emit('item_update', {'operation': 'DELETE', 'item_id': data['item_id']})
                        else:
                            sync_to_supabase(data)
                            # For INSERT/UPDATE, get the full item and send to WebSocket clients
                            if 'item_id' in data:
                                item = get_item_by_id(data['item_id'])
                                if item:
                                    socketio.emit('item_update', {'operation': data['TG_OP'], 'item': item})
                    else:
                        print(f"Invalid JSON: {notify.payload}")
    except Exception as e:
        print(f"Error in listener thread: {e}")
    finally:
        listen_cur.close()
        listen_conn.close()

# --- Main Application Startup ---
if __name__ == '__main__':
    # Perform initial data load check
    initial_data_load()
    
    # Start database listener thread
    listener_thread = threading.Thread(target=db_listener_thread, daemon=True)
    listener_thread.start()
    
    # Start Flask-SocketIO server
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)