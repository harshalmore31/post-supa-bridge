import database_operations as db
from api import app, socketio


if __name__ == '__main__':
    db.initial_data_load()
    db.start_db_listener(socketio)
    socketio.run(app, host='0.0.0.0', port=5000)