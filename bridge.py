from flask import Flask, request, jsonify
import json
import os
from datetime import datetime

app = Flask(__name__)

#database immitation
DB_FILE = 'database.json'

def load_db():
    if not os.path.exists(DB_FILE):
        return {} 
    with open(DB_FILE, 'r') as f:
        try:
            return json.load(f)
        except:
            return {}

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)

#main end point - receiving data from esp
@app.route('/api/scan', methods=['GET'])
def scan_card():
    uid = request.args.get('uid')
    
    if not uid:
        return jsonify({"error": "No UID"}), 400

    db = load_db()

    #"game" logic
    if uid not in db:
        db[uid] = {"scans": 1, "level": "ROOKIE", "last_seen": datetime.now().strftime("%H:%M:%S")}
        status = "New user"
    else:
        db[uid]["scans"] += 1
        db[uid]["last_seen"] = datetime.now().strftime("%H:%M:%S")
        
        #lvl up
        if db[uid]["scans"] >= 5:
            db[uid]["level"] = "VIP GOLD"
        elif db[uid]["scans"] >= 3:
            db[uid]["level"] = "SILVER"
            
        status = f"Welcome back! Current level: {db[uid]['level']}"

    save_db(db)
    
    #log
    print(f"[SCAN] Your card: {uid} | {status} | Scanned {db[uid]['scans']} times")
    
    #return code 200 to esp32
    return jsonify({"message": "Saved", "uid": uid, "level": db[uid]["level"]}), 200

# TO DO: endpoint for frontend
@app.route('/api/stats', methods=['GET'])
def get_stats():
    return jsonify(load_db()), 200

if __name__ == '__main__':
    print("Waiting for information from esp32...")
    #pc connection
    app.run(host='0.0.0.0', port=5000, debug=True)