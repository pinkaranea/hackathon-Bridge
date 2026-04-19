from flask import Flask, request, jsonify, render_template
import json
import os
from datetime import datetime

app = Flask(__name__)

DB_FILE = 'database.json'

def load_db():
    if not os.path.exists(DB_FILE):
        return {} 
    with open(DB_FILE, 'r') as f:
        try:
            return json.load(f)
        except Exception:
            return {}

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/scan', methods=['GET'])
def scan_card():
    uid = request.args.get('uid')
    if not uid:
        return jsonify({"error": "missing uid"}), 400

    db = load_db()

    if uid not in db:
        db[uid] = {"scans": 1, "level": "ROOKIE", "last_seen": datetime.now().strftime("%H:%M:%S")}
        status = "new user"
    else:
        db[uid]["scans"] += 1
        db[uid]["last_seen"] = datetime.now().strftime("%H:%M:%S")
        
        if db[uid]["scans"] >= 5:
            db[uid]["level"] = "VIP GOLD"
        elif db[uid]["scans"] >= 3:
            db[uid]["level"] = "SILVER"
            
        status = f"returning! current level: {db[uid]['level']}"

    save_db(db)
    print(f"[scan] card: {uid} | {status} | scans: {db[uid]['scans']}")
    
    return jsonify({"message": "saved", "uid": uid, "level": db[uid]["level"]}), 200

@app.route('/api/stats', methods=['GET'])
def get_stats():
    return jsonify(load_db()), 200

@app.route('/api/link_wallet', methods=['POST'])
def link_wallet():
    data = request.json
    uid = data.get('uid')
    wallet = data.get('wallet')

    if not uid or not wallet:
        return jsonify({"error": "missing data"}), 400

    try:
        #load database
        db = load_db()

        #if card exists, attach wallet address
        if uid in db:
            db[uid]['wallet_address'] = wallet
            
            #save to database
            save_db(db)
                
            print(f"[link] card {uid} -> wallet {wallet}")
            return jsonify({"status": "success", "message": "saved to database"})
        else:
            return jsonify({"error": "card not found in database"}), 404

    except Exception as e:
        print(f"[error] server error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("\n==============================================")
    print("bridge server starting")
    print("listening for gateway requests (esp32)...")
    print("==============================================\n")
    app.run(host='0.0.0.0', port=5000, debug=True)