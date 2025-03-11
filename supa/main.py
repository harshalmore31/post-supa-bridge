import database_operations as db
from api import app, socketio

# --- Main Application Startup ---
if __name__ == '__main__':
    # Perform initial data load check
    db.initial_data_load()
    
    # Start database listener thread
    db.start_db_listener(socketio)
    
    # Start Flask-SocketIO server
    socketio.run(app, host='0.0.0.0', port=5000)