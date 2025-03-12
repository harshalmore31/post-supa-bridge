import psycopg2
import select
import json
from supabase import create_client
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
import threading

# Flask app initialization
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuration - Consider using environment variables instead of hardcoding
SUPABASE_URL = "https://wqvpqljcbnzdidydahfy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdnBxbGpjYm56ZGlkeWRhaGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkwNzE1ODgsImV4cCI6MjA1NDY0NzU4OH0.ctARuaOIdVrJxFwMmNduJeAAgGpIEVB5LqR7J4gUnbs"

LOCAL_DB = {
    "dbname": "post-supa",
    "user": "postgres",
    "host": "localhost",
    "port": "5432",
    "password": "" # Add your password!
}

# Connect to services
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_db_connection():
    """Create and return a database connection"""
    conn = psycopg2.connect(**LOCAL_DB)
    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    return conn

# Database operations
def get_all_items():
    """Get all items from the local PostgreSQL database"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT "item_id", "name", "sku", "rate", "purchase rate", "stock on hand" FROM "public"."Items_data";')
            rows = cur.fetchall()
            
            return [{
                "item_id": row[0],
                "name": row[1],
                "sku": row[2],
                "rate": float(row[3] or 0.0),
                "purchase rate": float(row[4] or 0.0),
                "stock on hand": int(row[5] or 0)
            } for row in rows]

def get_item_by_id(item_id):
    """Get a specific item by ID"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT "item_id", "name", "sku", "rate", "purchase rate", "stock on hand" FROM "public"."Items_data" WHERE item_id = %s;', (item_id,))
            row = cur.fetchone()
            
            if not row:
                return None
                
            return {
                "item_id": row[0],
                "name": row[1],
                "sku": row[2],
                "rate": float(row[3] or 0.0),
                "purchase rate": float(row[4] or 0.0),
                "stock on hand": int(row[5] or 0)
            }

def insert_item(item):
    """Insert a new item"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "public"."Items_data" ("name", "sku", "rate", "purchase rate", "stock on hand") VALUES (%s, %s, %s, %s, %s) RETURNING item_id;',
                (item["name"], item["sku"], item["rate"], item["purchase rate"], item["stock on hand"])
            )
            item_id = cur.fetchone()[0]
            item["item_id"] = item_id
            return item

def update_item(item_id, item):
    """Update an existing item"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE "public"."Items_data" SET "name" = %s, "sku" = %s, "rate" = %s, "purchase rate" = %s, "stock on hand" = %s WHERE item_id = %s RETURNING item_id;',
                (item["name"], item["sku"], item["rate"], item["purchase rate"], item["stock on hand"], item_id)
            )
            if cur.fetchone():
                item["item_id"] = item_id
                return item
            return None

def delete_item(item_id):
    """Delete an item"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM "public"."Items_data" WHERE item_id = %s RETURNING item_id;', (item_id,))
            return cur.fetchone() is not None

def sync_to_supabase(data):
    """Sync data with Supabase"""
    if "item_id" not in data:
        return

    data_to_send = {k: v for k, v in data.items() if k != 'TG_OP'}
    
    response = supabase.table("Items_data").select("*").eq("item_id", data_to_send["item_id"]).execute()
    
    if response.data:
        supabase.table("Items_data").update(data_to_send).eq("item_id", data_to_send["item_id"]).execute()
    else:
        supabase.table("Items_data").insert(data_to_send).execute()

def sync_delete_to_supabase(data):
    """Sync delete operations to Supabase"""
    if "item_id" in data:
        supabase.table("Items_data").delete().eq("item_id", data["item_id"]).execute()

# API routes
@app.route('/api/items', methods=['GET'])
def get_items():
    return jsonify(get_all_items())

@app.route('/api/items/<int:item_id>', methods=['GET'])
def get_item(item_id):
    item = get_item_by_id(item_id)
    return jsonify(item) if item else (jsonify({"error": "Item not found"}), 404)

@app.route('/api/items', methods=['POST'])
def create_item():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    item = insert_item(data)
    if item:
        socketio.emit('item_update', {'operation': 'INSERT', 'item': item})
        return jsonify(item), 201
    return jsonify({"error": "Failed to create item"}), 500

@app.route('/api/items/<int:item_id>', methods=['PUT'])
def update_item_endpoint(item_id):
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    updated_item = update_item(item_id, data)
    if updated_item:
        socketio.emit('item_update', {'operation': 'UPDATE', 'item': updated_item})
        return jsonify(updated_item)
    return jsonify({"error": "Item not found or update failed"}), 404

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item_endpoint(item_id):
    if delete_item(item_id):
        socketio.emit('item_update', {'operation': 'DELETE', 'item_id': item_id})
        return jsonify({"success": True})
    return jsonify({"error": "Item not found or delete failed"}), 404

def initial_data_load():
    """Load initial data if Supabase is empty"""
    response = supabase.table("Items_data").select("item_id", count='exact').execute()
    if response.count == 0:
        for item in get_all_items():
            sync_to_supabase(item)

def db_listener_thread():
    """Thread to listen for PostgreSQL notifications"""
    listen_conn = get_db_connection()
    listen_cur = listen_conn.cursor()
    listen_cur.execute("LISTEN items_data_channel;")
    
    try:
        while True:
            if select.select([listen_conn], [], [], 5) != ([], [], []):
                listen_conn.poll()
                while listen_conn.notifies:
                    notify = listen_conn.notifies.pop(0)
                    data = json.loads(notify.payload)
                    
                    if 'TG_OP' in data:
                        if data['TG_OP'] == 'DELETE':
                            sync_delete_to_supabase(data)
                            socketio.emit('item_update', {'operation': 'DELETE', 'item_id': data['item_id']})
                        elif 'item_id' in data:
                            sync_to_supabase(data)
                            item = get_item_by_id(data['item_id'])
                            if item:
                                socketio.emit('item_update', {'operation': data['TG_OP'], 'item': item})
    finally:
        listen_cur.close()
        listen_conn.close()

if __name__ == '__main__':
    initial_data_load()
    threading.Thread(target=db_listener_thread, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
