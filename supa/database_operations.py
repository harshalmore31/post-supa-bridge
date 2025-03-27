import psycopg2
import os
import json
import select
import threading
from supabase import create_client, Client
from dotenv import load_dotenv
from flask_socketio import SocketIO
from dotenv import load_dotenv


# Load environment variables
load_dotenv()

# Supabase Credentials
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# PostgreSQL Connection
def get_postgres_connection():
    """Get a connection to PostgreSQL database"""
    return psycopg2.connect(
        host="localhost",
        database="post-supa",
        user="postgres",
        password=""
    )
    

# Core CRUD operations
def get_all_items():
    """Get all items from the local PostgreSQL database"""
    conn = get_postgres_connection()
    cur = conn.cursor()
    try:
        cur.execute('SELECT "item_id", "name", "sku", "rate", "purchase rate", "stock on hand" FROM "public"."items";')
        rows = cur.fetchall()
        items = []
        for row in rows:
            item = {
                "item_id": int(row[0]) if row[0] is not None else 0,
                "name": row[1] if row[1] is not None else "",
                "sku": row[2] if row[2] is not None else "",
                "rate": row[3] if row[3] is not None else "",
                "purchase rate": row[4] if row[4] is not None else "",
                "stock on hand": int(row[5]) if row[5] is not None else 0
            }
            items.append(item)
        return items
    except Exception as e:
        print(f"Error getting items: {e}")
        return []
    finally:
        cur.close()
        conn.close()

def get_item_by_id(item_id):
    """Get a specific item by ID from the local PostgreSQL database"""
    conn = get_postgres_connection()
    cur = conn.cursor()
    try:
        cur.execute('SELECT "item_id", "name", "sku", "rate", "purchase rate", "stock on hand" FROM "public"."items" WHERE item_id = %s;', (item_id,))
        row = cur.fetchone()
        if row:
            item = {
                "item_id": int(row[0]) if row[0] is not None else 0,
                "name": row[1] if row[1] is not None else "",
                "sku": row[2] if row[2] is not None else "",
                "rate": row[3] if row[3] is not None else "",
                "purchase rate": row[4] if row[4] is not None else "",
                "stock on hand": int(row[5]) if row[5] is not None else 0
            }
            return item
        return None
    except Exception as e:
        print(f"Error getting item by ID: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def insert_item(item):
    """Insert a new item into the PostgreSQL database"""
    conn = get_postgres_connection()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute(
            'INSERT INTO "public"."items" ("name", "sku", "rate", "purchase rate", "stock on hand") VALUES (%s, %s, %s, %s, %s) RETURNING item_id;',
            (item["name"], item["sku"], item["rate"], item["purchase rate"], item["stock on hand"])
        )
        
        item_id = cur.fetchone()[0]
        item["item_id"] = item_id
        return item
    except Exception as e:
        print(f"Error inserting item: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def update_item(item_id, item):
    """Update an existing item in the PostgreSQL database"""
    conn = get_postgres_connection()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute(
            'UPDATE "public"."items" SET "name" = %s, "sku" = %s, "rate" = %s, "purchase rate" = %s, "stock on hand" = %s WHERE item_id = %s RETURNING item_id;',
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
    finally:
        cur.close()
        conn.close()

def delete_item(item_id):
    """Delete an item from the PostgreSQL database"""
    conn = get_postgres_connection()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute('DELETE FROM "public"."items" WHERE item_id = %s RETURNING item_id;', (item_id,))
        deleted_id = cur.fetchone()
        return deleted_id is not None
    except Exception as e:
        print(f"Error deleting item: {e}")
        return False
    finally:
        cur.close()
        conn.close()

# Supabase synchronization
def sync_to_supabase(data):
    """Sync data with Supabase"""
    try:
        if "item_id" not in data:
            print("Invalid data, skipping...")
            return

        # Create a copy of the data dictionary and remove TG_OP
        data_to_send = data.copy()
        if 'TG_OP' in data_to_send:
            del data_to_send['TG_OP']

        response = supabase.table("items").select("*").eq("item_id", data_to_send["item_id"]).execute()

        if response.data:
            supabase.table("items").update(data_to_send).eq("item_id", data_to_send["item_id"]).execute()
            print(f"Updated item_id: {data_to_send['item_id']} in Supabase")
        else:
            supabase.table("items").insert(data_to_send).execute()
            print(f"Inserted item_id: {data_to_send['item_id']} into Supabase")

    except Exception as e:
        print(f"Error syncing to Supabase: {e}")

def sync_delete_to_supabase(data):
    """Sync delete operations to Supabase"""
    try:
        if "item_id" not in data:
            print("Invalid data, skipping delete...")
            return

        supabase.table("items").delete().eq("item_id", data["item_id"]).execute()
        print(f"Deleted item_id: {data['item_id']} from Supabase")

    except Exception as e:
        print(f"Error syncing delete to Supabase: {e}")

# Initial Data Load
def initial_data_load():
    """Check if initial data load is needed and perform if necessary"""
    print("Checking if initial data load is needed...")
    # Check if Supabase table has any data
    response = supabase.table("items").select("item_id", count='exact').execute()

    if response.count == 0:  # If count is 0, the table is empty
        print("Performing initial data load...")
        items = get_all_items()
        for item in items:
            sync_to_supabase(item)
        print("Initial data load complete.")
    else:
        print("Initial data already exists in Supabase. Skipping initial load.")

# Database Change Listener
def start_db_listener(socketio):
    """Start a thread to listen for PostgreSQL notifications"""
    listener_thread = threading.Thread(
        target=db_listener_thread, 
        args=(socketio,), 
        daemon=True
    )
    listener_thread.start()
    return listener_thread

def db_listener_thread(socketio):
    """Thread to listen for PostgreSQL notifications"""
    listen_conn = get_postgres_connection()
    listen_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    listen_cur = listen_conn.cursor()
    listen_cur.execute("LISTEN items_channel;")
    print("Listening for changes on items...")
    
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
                
                if notify.channel == 'items_channel':
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