from flask import Flask, request, jsonify
from flask_cors import CORS
from Crypto.Cipher import AES
from dotenv import load_dotenv
from flask_socketio import SocketIO, emit
import base64
import json
import os

load_dotenv()

app = Flask(__name__)
# Allow all origins with CORS
CORS(app, resources={r"/*": {"origins": "*"}})

# Update SocketIO configuration to allow all origins
socketio = SocketIO(app,
                   cors_allowed_origins="*",
                   ping_timeout=60,
                   ping_interval=25,
                   async_mode='gevent')

# Store events temporarily in memory
events = []

def generate_aes_decrypt(data_encrypt, client_id, client_secret):
    aes_key = client_secret.encode('utf-8')

    # Ensure the IV is 16 bytes long
    iv = client_id.encode('utf-8')
    iv = iv[:16] if len(iv) >= 16 else iv.ljust(16, b'\0')

    cipher = AES.new(aes_key, AES.MODE_CBC, iv)
    decrypted_data = cipher.decrypt(base64.b64decode(data_encrypt))

    # Handle padding
    padding_len = decrypted_data[-1]
    return decrypted_data[:-padding_len].decode('utf-8')

@app.route('/api/webhook', methods=['POST'])
def webhook():
    print("Webhook received")
    data = request.get_json()
    print("JSON data received:", data)

    encrypted_data = data.get('dataEncrypt')
    client_id = os.getenv('CLIENT_ID')
    client_secret = os.getenv('CLIENT_SECRET')

    try:
        decrypted_data = generate_aes_decrypt(encrypted_data, client_id, client_secret)
        print("Decrypted Data:", decrypted_data)

        try:
            decrypted_json = json.loads(decrypted_data)
            print("Parsed JSON:", decrypted_json)

            if 'status' not in decrypted_json:
                print("Missing 'status' in payload:", decrypted_json)
                return jsonify({"message": "Invalid payload structure - missing status"}), 400

            # Handle talking avatar response specifically
            if decrypted_json.get('type') == 'avatar' and decrypted_json['status'] == 3:
                print("Talking Avatar generation completed, emitting result")
                socketio.emit('message', {
                    'data': {
                        'type': 'avatar',
                        'status': 3,
                        'url': decrypted_json.get('url'),
                        'message': 'Avatar generation completed successfully'
                    }
                })
            else:
                # Handle other status updates
                socketio.emit('message', {'data': decrypted_json, 'type': 'status_update'})

            return jsonify({
                "message": "Webhook received and processed successfully",
                "decrypted_data": decrypted_json
            }), 200

        except json.JSONDecodeError as je:
            print(f"JSON parsing error: {je}")
            return jsonify({"message": "Invalid JSON format in decrypted data"}), 400

    except Exception as e:
        print(f"Error processing webhook: {e}")
        return jsonify({"message": f"Error processing webhook: {str(e)}"}), 400


@socketio.on('connect')
def handle_connect():
    print("Client connected")
    emit('message', {'data': 'Connected to server', 'type': 'info'})

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=3007)
