from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from dotenv import load_dotenv
import database_operations as db

# Load environment variables
load_dotenv()

# Flask app initialization
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")

# --- API Routes ---
@app.route('/api/items', methods=['GET'])
def get_items():
    """API endpoint to get all items"""
    items = db.get_all_items()
    return jsonify(items)

@app.route('/api/items/<int:item_id>', methods=['GET'])
def get_item(item_id):
    """API endpoint to get a specific item"""
    item = db.get_item_by_id(item_id)
    if item:
        return jsonify(item)
    return jsonify({"error": "Item not found"}), 404

@app.route('/api/items', methods=['POST'])
def create_item():
    """API endpoint to create a new item"""
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    item = db.insert_item(data)
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
    
    updated_item = db.update_item(item_id, data)
    if updated_item:
        # Emit WebSocket event
        socketio.emit('item_update', {'operation': 'UPDATE', 'item': updated_item})
        return jsonify(updated_item)
    return jsonify({"error": "Item not found or update failed"}), 404

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item_endpoint(item_id):
    """API endpoint to delete an item"""
    success = db.delete_item(item_id)
    if success:
        # Emit WebSocket event
        socketio.emit('item_update', {'operation': 'DELETE', 'item_id': item_id})
        return jsonify({"success": True})
    return jsonify({"error": "Item not found or delete failed"}), 404