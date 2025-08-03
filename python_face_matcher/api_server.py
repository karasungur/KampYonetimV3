#!/usr/bin/env python3
"""
Basitleştirilmiş API Server - Web sitesi için fotoğraf işleme API'si
Sadece temel fonksiyonları içerir, yüz tanıma özellikleri sonra eklenecek
"""

import os
import sys
import json
import requests
from datetime import datetime
from flask import Flask, request, jsonify

# Konfigürasyon
CONFIG = {
    'WEB_API_URL': os.getenv('WEB_API_URL', 'https://your-replit-app.replit.app'),
    'PYTHON_API_PORT': int(os.getenv('PYTHON_API_PORT', 8080)),
    'SIMILARITY_THRESHOLD': float(os.getenv('SIMILARITY_THRESHOLD', '0.6'))
}

# Global değişkenler
trained_models = {}
api_connection_status = {'connected': False, 'last_check': None}
processing_requests = {}

def load_trained_models():
    """Eğitilmiş modelleri yükle"""
    global trained_models
    models_dir = "./models"
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)
        return
    
    trained_models = {}
    for item in os.listdir(models_dir):
        model_dir = os.path.join(models_dir, item)
        if os.path.isdir(model_dir):
            info_file = os.path.join(model_dir, "model_info.json")
            
            if os.path.exists(info_file):
                try:
                    with open(info_file, 'r', encoding='utf-8') as f:
                        model_info = json.load(f)
                    trained_models[item] = model_info
                    print(f"✅ Model yüklendi: {item} - {model_info.get('name', 'Adsız')}")
                except Exception as e:
                    print(f"⚠️  Model info yükleme hatası - {item}: {str(e)}")

def test_api_connection():
    """Web API bağlantısını test et"""
    global api_connection_status
    try:
        response = requests.get(f"{CONFIG['WEB_API_URL']}/api/camp-days", timeout=5)
        if response.status_code == 200:
            api_connection_status = {
                'connected': True,
                'last_check': datetime.now()
            }
            print(f"✅ Web API bağlantısı başarılı: {CONFIG['WEB_API_URL']}")
            return True
        else:
            api_connection_status = {
                'connected': False,
                'last_check': datetime.now()
            }
            print(f"⚠️  Web API bağlantı hatası: {response.status_code}")
            return False
    except Exception as e:
        api_connection_status = {
            'connected': False,
            'last_check': datetime.now()
        }
        print(f"⚠️  Web API'ye bağlanılamadı: {str(e)}")
        return False

# Flask uygulaması oluştur
app = Flask(__name__)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Sistem durumu kontrolü"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'trained_models': len(trained_models),
        'api_connection': api_connection_status['connected'],
        'python_version': sys.version,
        'config': {
            'web_api_url': CONFIG['WEB_API_URL'],
            'port': CONFIG['PYTHON_API_PORT']
        }
    })

@app.route('/api/models', methods=['GET'])
def get_models():
    """Eğitilmiş modelleri listele"""
    model_list = []
    for model_id, model_info in trained_models.items():
        model_list.append({
            'id': model_id,
            'name': model_info['name'],
            'trainedAt': model_info['date'],
            'faceCount': model_info['face_count']
        })
    return jsonify(model_list)

@app.route('/api/process-photos', methods=['POST'])
def process_photos():
    """Web sitesinden gelen fotoğraf işleme istekleri"""
    try:
        data = request.get_json()
        tc_number = data.get('tcNumber')
        email = data.get('email')
        selected_camp_days = data.get('selectedCampDays', [])
        uploaded_files_count = data.get('uploadedFilesCount', 0)
        
        if not tc_number or not email:
            return jsonify({'error': 'TC number and email required'}), 400
        
        # Convert camp day IDs to model names
        selected_models = []
        for camp_day_id in selected_camp_days:
            if camp_day_id in trained_models:
                selected_models.append(camp_day_id)
        
        if not selected_models:
            return jsonify({'error': 'Seçilen kamp günleri için eğitilmiş model bulunamadı'}), 400
        
        # İsteği işleme kuyruğuna ekle
        request_id = f"{tc_number}_{int(datetime.now().timestamp())}"
        processing_requests[request_id] = {
            'tcNumber': tc_number,
            'email': email,
            'selectedModels': selected_models,
            'selectedCampDays': selected_camp_days,
            'uploadedFilesCount': uploaded_files_count,
            'timestamp': datetime.now().isoformat(),
            'status': 'queued',
            'source': 'web_api'
        }
        
        print(f"✨ Yeni fotoğraf isteği alındı: {tc_number}")
        print(f"   E-posta: {email}")
        print(f"   Seçilen modeller: {len(selected_models)} adet")
        print(f"   Yüklenen dosya: {uploaded_files_count} adet")
        
        return jsonify({
            'message': 'Fotoğraf işleme isteği başarıyla alındı',
            'tcNumber': tc_number,
            'selectedModelsCount': len(selected_models),
            'requestId': request_id,
            'status': 'processing'
        })
        
    except Exception as e:
        print(f"❌ API hatası: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/status/<request_id>', methods=['GET'])
def get_request_status(request_id):
    """İstek durumunu kontrol et"""
    if request_id in processing_requests:
        return jsonify(processing_requests[request_id])
    else:
        return jsonify({'error': 'Request not found'}), 404

@app.route('/api/queue', methods=['GET'])
def get_queue():
    """İşleme kuyruğunu göster"""
    return jsonify({
        'total_requests': len(processing_requests),
        'requests': list(processing_requests.values())
    })

if __name__ == '__main__':
    print("🚀 Basitleştirilmiş Python API Server başlatılıyor...")
    
    # Eğitilmiş modelleri yükle
    load_trained_models()
    print(f"📁 Yüklenen model sayısı: {len(trained_models)}")
    
    # Web API bağlantısını test et
    test_api_connection()
    
    print(f"🌐 API Server başlatılıyor:")
    print(f"   Port: {CONFIG['PYTHON_API_PORT']}")
    print(f"   URL: http://localhost:{CONFIG['PYTHON_API_PORT']}")
    print(f"   Web API: {CONFIG['WEB_API_URL']}")
    
    # Flask sunucusunu başlat
    app.run(
        host='0.0.0.0',
        port=CONFIG['PYTHON_API_PORT'],
        debug=False,
        threaded=True
    )