import psycopg2
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)


conn = psycopg2.connect(
    host="localhost",
    database="post-supa",
    user="postgres",
    password=""
    )

cur = conn.cursor()

def get_all_items():
    """Get all items from the local PostgreSQL database"""
    try:
        cur.execute('SELECT "item_id", "name", "sku", "rate", "purchase rate", "stock on hand" FROM "public"."items";')
        rows = cur.fetchall()
        items = []
        for row in rows:
            item = {
                "item_id": row[0],
                "name": row[1],
                "sku": row[2],
                "rate": row[3],
                "purchase rate": row[4],
                "stock on hand": row[5],
            }
            items.append(item)
        print(items)
        return items
    except Exception as e:
        print(f"Error getting items: {e}")
        return []

get_all_items()

# def create_item(item):
#     """Create an item in the local PostgreSQL database"""
#     try:
#         # Generate a unique item_id (you can adjust this logic based on your requirements)
#         cur.execute('SELECT MAX("item_id") FROM "public"."items"')
#         max_id = cur.fetchone()[0]
#         new_id = 1 if max_id is None else max_id + 1
        
#         cur.execute('INSERT INTO "public"."items" ("item_id", "name", "sku", "rate", "purchase rate", "stock on hand") VALUES (%s, %s, %s, %s, %s, %s) RETURNING "item_id";', 
#                    (new_id, item["name"], item["sku"], item["rate"], item["purchase rate"], item["stock on hand"]))
#         conn.commit()
#         item_id = cur.fetchone()[0]
#         print(f"Item created with ID: {item_id}")
#         return item_id
#     except Exception as e:
#         print(f"Error creating item: {e}")
#         return None

# def delete_item(item_id):
#     """Delete an item from the local PostgreSQL database"""
#     try:
#         cur.execute('DELETE FROM "public"."items" WHERE "item_id" = %s;', (item_id,))
#         conn.commit()
#         print(f"Item deleted with ID: {item_id}")
#     except Exception as e:
#         print(f"Error deleting item: {e}")
#         return None

# def sync_with_database():
#     """Sync items with the local PostgreSQL database"""
#     try:
#         items = supabase.table("items").select().execute().get("data", [])
#         for item in items:
#             local_item = get_item_by_id(item["item_id"])
#             if local_item:
#                 # Update existing item
#                 update_item(item)
#             else:
#                 # Insert new item
#                 create_item(item)
#     except Exception as e:
#         print(f"Error syncing with database: {e}")