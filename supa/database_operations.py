import psycopg2
import os
import re
import json
import select
import threading
from supabase import create_client, Client
from dotenv import load_dotenv
from flask_socketio import SocketIO
from upstash_redis import Redis  # Added for Redis cache
from datetime import datetime  # Added for timestamping

# Load environment variables
load_dotenv()

# Supabase Credentials
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Upstash Redis Credentials
UPSTASH_URL: str = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_TOKEN: str = os.getenv("UPSTASH_REDIS_REST_TOKEN")

# Redis client initialization
redis_client = None
if UPSTASH_URL and UPSTASH_TOKEN:
    try:
        redis_client = Redis(url=UPSTASH_URL, token=UPSTASH_TOKEN)
        # Test connection
        redis_client.ping()
        print("Successfully connected to Upstash Redis.")
    except Exception as e:
        print(f"WARNING: Failed to connect to Upstash Redis: {e}. Redis caching will be disabled.")
        redis_client = None
else:
    print("WARNING: Upstash Redis URL or Token not configured. Redis caching will be disabled.")

# Helper functions for data processing
def get_stock_level_py(stock_quantity_str):
    stock = 0
    try:
        stock = int(stock_quantity_str) if stock_quantity_str is not None else 0
    except ValueError:  # Handle cases where 'stock on hand' might not be a number
        pass
    if stock <= 10: return 'low'
    if stock <= 30: return 'medium'
    return 'high'

def parse_currency_value_py(value_str):
    if value_str is None: return 0.0
    s = str(value_str).strip()

    # Use regex to find and remove "Rs." or "Rs " prefix, including optional space and dot
    # This regex looks for "Rs" followed by an optional dot and an optional space, at the beginning.
    s = re.sub(r'^[Rr][Ss]\.?\s*', '', s) # Case-insensitive for Rs

    # Now remove commas
    s = s.replace(',', '')
    
    try:
        return float(s)
    except ValueError:
        print(f"Warning: Could not parse currency value from original '{value_str}' (processed as '{s}')")
        return 0.0

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

def get_all_items_from_pg():
    """Get all items from the local PostgreSQL database with column names"""
    conn = get_postgres_connection()
    cur = conn.cursor()
    items_list = []
    try:
        cur.execute('SELECT "item_id", "name", "sku", "rate", "purchase rate", "stock on hand" FROM "public"."items";')
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        for row in rows:
            items_list.append({
                "item_id": str(row[0]) if row[0] is not None else "0",  # Treat item_id as a string
                "name": row[1] if row[1] is not None else "",
                "sku": row[2] if row[2] is not None else "",
                "rate": parse_currency_value_py(row[3]),
                "purchase rate": parse_currency_value_py(row[4]),
                "stock on hand": int(row[5]) if row[5] is not None else 0
            })
    except Exception as e:
        print(f"Error getting all items from PG: {e}")
    finally:
        cur.close()
        conn.close()
    return items_list

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

# Redis caching functionality
def update_redis_cache_and_stats():
    """Fetches all items from PG, processes them, and updates Redis cache."""
    if not redis_client:
        print("Redis client not available. Skipping cache update.")
        return

    print("Updating Redis cache...")
    all_pg_items = get_all_items_from_pg()  # Fetch fresh from PostgreSQL

    # Process items for consistency
    processed_items_for_cache = []
    for item_pg in all_pg_items:
        processed_items_for_cache.append({
            "item_id": int(item_pg.get("item_id")) if item_pg.get("item_id") is not None else None,
            "name": str(item_pg.get("name", 'Unknown Item')),
            "sku": str(item_pg.get("sku", 'N/A')).replace("(", "").replace(")", ""),
            "rate": parse_currency_value_py(item_pg.get("rate")),
            "purchase rate": parse_currency_value_py(item_pg.get("purchase rate")),
            "stock on hand": int(item_pg.get("stock on hand", 0))
        })
    
    # Cache the full list of processed items
    ALL_ITEMS_CACHE_KEY = "cache:all_inventory_items"
    try:
        redis_client.set(ALL_ITEMS_CACHE_KEY, json.dumps(processed_items_for_cache))  # Add TTL of 1 hour
        print(f"Cached {len(processed_items_for_cache)} items to '{ALL_ITEMS_CACHE_KEY}'.")
    except Exception as e:
        print(f"Error caching items to Redis: {e}")

    # Calculate and cache stats
    total_products = len(processed_items_for_cache)
    total_value = 0
    low_stock_count = 0

    for item in processed_items_for_cache:
        rate = item.get("rate", 0.0)
        stock = item.get("stock on hand", 0)
        total_value += rate * stock
        if get_stock_level_py(str(stock)) == 'low':
            low_stock_count += 1
    
    current_timestamp_iso = datetime.utcnow().isoformat() + "Z"  # ISO 8601 format, UTC

    stats_data = {
        "totalProducts": total_products,
        "totalValue": total_value,
        "lowStockCount": low_stock_count,
        "cacheLastUpdated": current_timestamp_iso 
    }
    STATS_CACHE_KEY = "cache:inventory_stats"
    try:
        redis_client.set(STATS_CACHE_KEY, json.dumps(stats_data), ex=3600)  # Add TTL of 1 hour
        print(f"Redis stats cache updated at {current_timestamp_iso}. Stats: {stats_data}")
    except Exception as e:
        print(f"Error caching stats to Redis: {e}")

# Initial Data Load
def initial_data_load_to_redis_and_supabase():
    """Perform initial data load to Supabase and Redis if needed."""
    print("Checking if initial data load to Supabase & Redis is needed...")
    
    # Check Supabase
    response_supabase = supabase.table("items").select("item_id", count='exact').execute()
    if response_supabase.count == 0:
        print("Supabase is empty. Performing initial data load to Supabase...")
        items_pg = get_all_items_from_pg()
        for item in items_pg:
            sync_to_supabase(item)
        print("Initial data load to Supabase complete.")
    else:
        print("Data already exists in Supabase. Skipping initial Supabase load.")

    # Always update Redis cache on startup to ensure it's fresh
    print("Performing initial/startup update of Redis cache...")
    update_redis_cache_and_stats()

# For backward compatibility
def initial_data_load():
    """Legacy function that calls the updated version"""
    initial_data_load_to_redis_and_supabase()

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

def db_listener_thread(socketio_instance=None):
    """Thread to listen for PostgreSQL notifications"""
    listen_conn = get_postgres_connection()
    listen_conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    listen_cur = listen_conn.cursor()
    listen_cur.execute("LISTEN items_channel;")
    print("Python listener: Listening for changes on PostgreSQL items...")
    
    try:
        while True:
            if select.select([listen_conn], [], [], 5) == ([], [], []):
                # Timeout occurred, just continue
                continue
                
            listen_conn.poll()
            while listen_conn.notifies:
                notify = listen_conn.notifies.pop(0)
                print(f"🔔 Python listener: PG Change detected: {notify.payload}")
                payload_data = json.loads(notify.payload)
                tg_op = payload_data.get('TG_OP')
                item_id_from_payload = payload_data.get('item_id')

                if notify.channel == 'items_channel':
                    if 'TG_OP' in payload_data:
                        # Process for Supabase sync
                        if tg_op == 'DELETE':
                            sync_delete_to_supabase(payload_data)
                            # Notify WebSocket clients if socketio_instance is available
                            if socketio_instance:
                                socketio_instance.emit('item_update', {'operation': 'DELETE', 'item_id': item_id_from_payload})
                        else:  # INSERT or UPDATE
                            if item_id_from_payload:
                                # Get the full item and sync to Supabase
                                full_item_data = get_item_by_id(item_id_from_payload)
                                if full_item_data:
                                    sync_to_supabase(full_item_data)
                                    # Notify WebSocket clients if socketio_instance is available
                                    if socketio_instance:
                                        socketio_instance.emit('item_update', {'operation': tg_op, 'item': full_item_data})
                    
                    # After Supabase sync, update Redis cache regardless of operation type
                    update_redis_cache_and_stats()
    except Exception as e:
        print(f"Error in Python listener thread: {e}")
    finally:
        if listen_cur:
            listen_cur.close()
        if listen_conn:
            listen_conn.close()
        print("Python listener: Stopped.")