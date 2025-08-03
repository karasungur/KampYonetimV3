#!/usr/bin/env python3
"""
Basit test server - Python ortamının çalışıp çalışmadığını test eder
"""

import os
import sys
from flask import Flask, jsonify
from datetime import datetime

app = Flask(__name__)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'message': 'Python Flask API çalışıyor',
        'python_version': sys.version
    })

@app.route('/api/test', methods=['GET'])
def test():
    return jsonify({
        'message': 'Test endpoint çalışıyor',
        'working_directory': os.getcwd()
    })

if __name__ == '__main__':
    print("🧪 Test Flask server başlatılıyor...")
    app.run(host='0.0.0.0', port=8080, debug=False)