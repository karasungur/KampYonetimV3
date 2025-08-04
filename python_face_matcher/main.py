#!/usr/bin/env python3
"""
AK Parti Gençlik Kolları Kamp Fotoğraf Eşleştirme Sistemi
İki Bölümlü Yönetim Arayüzü: Model Eğitimi ve İstek İşleme
"""

import sys
import os
import time
import traceback
import warnings
import numpy as np
import cv2
import torch
import shutil
import pickle
import json
import gc
import io
import requests
from datetime import datetime, timedelta
from threading import Thread, Lock
import queue
import urllib.parse
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
import zipfile
import base64
from dotenv import load_dotenv
import logging
import psutil
import gc
import platform

# Google Drive API imports
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials
from google.oauth2 import service_account

# Load environment variables
load_dotenv()

# Detaylı hata ayıklama sistemi kurulumu
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - [%(threadName)s] - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('debug.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

def log_memory_usage(context=""):
    """Bellek kullanımını logla"""
    try:
        process = psutil.Process()
        memory_info = process.memory_info()
        memory_mb = memory_info.rss / 1024 / 1024
        logger.info(f"🧠 BELLEK [{context}]: {memory_mb:.1f} MB (RSS: {memory_info.rss:,} bytes)")
        return memory_mb
    except Exception as e:
        logger.warning(f"Bellek ölçüm hatası [{context}]: {str(e)}")
        return 0

def log_system_info():
    """Sistem bilgilerini logla"""
    try:
        logger.info(f"💻 SİSTEM BİLGİSİ:")
        logger.info(f"   Platform: {platform.platform()}")
        logger.info(f"   Python: {platform.python_version()}")
        logger.info(f"   İşlemci: {platform.processor()}")
        
        # CPU ve Bellek bilgisi
        cpu_count = psutil.cpu_count()
        memory = psutil.virtual_memory()
        logger.info(f"   CPU Çekirdek: {cpu_count}")
        logger.info(f"   RAM: {memory.total / 1024**3:.1f} GB (Kullanılabilir: {memory.available / 1024**3:.1f} GB)")
        
        # PyTorch ve CUDA bilgisi
        logger.info(f"   PyTorch: {torch.__version__}")
        logger.info(f"   CUDA: {'Evet' if torch.cuda.is_available() else 'Hayır'}")
        if torch.cuda.is_available():
            logger.info(f"   GPU: {torch.cuda.get_device_name(0)}")
            
    except Exception as e:
        logger.warning(f"Sistem bilgisi alınamadı: {str(e)}")

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QVBoxLayout, QHBoxLayout, QWidget, 
    QLabel, QPushButton, QListWidget, QListWidgetItem, QProgressBar,
    QGroupBox, QTextEdit, QFrame, QScrollArea,
    QGridLayout, QTableWidget, QTableWidgetItem,
    QHeaderView, QSizePolicy, QFileDialog, QMessageBox, QSplitter
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt5.QtGui import QFont, QPalette, QColor

from flask import Flask, request, jsonify
from insightface.app import FaceAnalysis

# Uyarıları bastır
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning)

# Konfigürasyon
CONFIG = {
    'WEB_API_URL': os.getenv('WEB_API_URL', 'https://your-replit-app.replit.app'),
    'PYTHON_API_PORT': int(os.getenv('PYTHON_API_PORT', 8080)),
    'EMAIL_FROM': os.getenv('EMAIL_FROM', 'kamp@akparti.org.tr'),
    'EMAIL_PASSWORD': os.getenv('EMAIL_PASSWORD', 'your_email_password'),
    'SMTP_SERVER': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
    'SMTP_PORT': int(os.getenv('SMTP_PORT', 587)),
    'SIMILARITY_THRESHOLD': float(os.getenv('SIMILARITY_THRESHOLD', '0.6')),
    'MAX_CONCURRENT_REQUESTS': int(os.getenv('MAX_CONCURRENT_REQUESTS', '3'))
}

# AK Parti renk şeması
AK_COLORS = {
    'YELLOW': '#F59E0B',
    'BLUE': '#1E88E5',
    'WHITE': '#FFFFFF',
    'GRAY': '#6B7280',
    'LIGHT_GRAY': '#F9FAFB',
    'SUCCESS': '#10B981',
    'ERROR': '#EF4444'
}

# Global değişkenler
face_app = None
device_info = {'type': 'CPU', 'name': 'CPU Only', 'cuda_available': False}
trained_models = {}  # {camp_day_id: {'name': str, 'date': str, 'model_path': str, 'face_count': int}}
processing_queue = queue.Queue()
current_requests = {}
request_lock = Lock()
api_connection_status = {'connected': False, 'last_check': None}

def check_device_capabilities():
    """Device yeteneklerini kontrol et (GPU/CPU)"""
    global device_info
    
    # CUDA availability kontrolü
    cuda_available = torch.cuda.is_available()
    
    if cuda_available:
        device_count = torch.cuda.device_count()
        gpu_name = torch.cuda.get_device_name(0) if device_count > 0 else "Unknown GPU"
        device_info = {
            'type': 'GPU',
            'name': gpu_name,
            'cuda_available': True,
            'device_count': device_count,
            'memory': f"{torch.cuda.get_device_properties(0).total_memory // 1024**3} GB" if device_count > 0 else "Unknown"
        }
        print(f"✅ GPU Tespit Edildi: {gpu_name}")
        print(f"   PyTorch GPU Desteği: Aktif")
        print(f"   GPU Belleği: {device_info['memory']}")
    else:
        device_info = {
            'type': 'CPU',
            'name': 'CPU Only',
            'cuda_available': False
        }
        print("⚠️  GPU Bulunamadı - CPU Modu Kullanılacak")
    
    return device_info

def init_face_analysis():
    """Yüz analizi sistemini başlat"""
    global face_app, device_info
    
    try:
        # Device kontrolü
        check_device_capabilities()
        
        # Provider listesi oluştur
        providers = []
        if device_info['cuda_available']:
            providers.append('CUDAExecutionProvider')
            providers.append('CPUExecutionProvider')  # Fallback
            print("🚀 GPU Modunda Başlatılıyor...")
        else:
            providers.append('CPUExecutionProvider')
            print("💻 CPU Modunda Başlatılıyor...")
        
        # FaceAnalysis başlat (orijinal GUI ile aynı şekilde)
        try:
            face_app = FaceAnalysis(name='buffalo_l', providers=providers)
            # GPU kullanılıyorsa ctx_id=0 (GPU), değilse ctx_id=-1 (CPU)
            ctx_id = 0 if device_info['cuda_available'] else -1
            face_app.prepare(ctx_id=ctx_id, det_size=(640, 640))
        except Exception:
            face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
            face_app.prepare(ctx_id=-1, det_size=(640, 640))
            device_info['type'] = 'CPU (Fallback)'
        
        print(f"✅ Yüz Analizi Sistemi Hazır - {device_info['type']} ({device_info['name']})")
        return True
        
    except Exception as e:
        print(f"❌ Yüz analizi başlatma hatası: {str(e)}")
        return False

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
            model_file = os.path.join(model_dir, "face_database.pkl")
            info_file = os.path.join(model_dir, "model_info.json")
            
            if os.path.exists(model_file) and os.path.exists(info_file):
                try:
                    with open(info_file, 'r', encoding='utf-8') as f:
                        model_info = json.load(f)
                    trained_models[item] = model_info
                except Exception as e:
                    print(f"Model info yükleme hatası - {item}: {str(e)}")

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
            return True
        else:
            api_connection_status = {
                'connected': False,
                'last_check': datetime.now()
            }
            return False
    except Exception as e:
        api_connection_status = {
            'connected': False,
            'last_check': datetime.now()
        }
        return False

def sync_models_to_web():
    """Eğitilmiş modelleri web API'ye gönder"""
    try:
        model_list = []
        for model_id, model_info in trained_models.items():
            model_list.append({
                'id': model_id,
                'name': model_info['name'],
                'trainedAt': model_info['date'],
                'faceCount': model_info['face_count']
            })
        
        response = requests.post(
            f"{CONFIG['WEB_API_URL']}/api/python/sync-models",
            json={'models': model_list},
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        print(f"Model senkronizasyon hatası: {str(e)}")
        return False

class ModelTrainingWorker(QThread):
    """Model eğitimi worker thread'i"""
    progress = pyqtSignal(str, int)  # message, percentage
    finished = pyqtSignal(str, dict)  # model_id, model_info
    error = pyqtSignal(str)
    
    def __init__(self, model_id, model_name, photos_folder):
        super().__init__()
        self.model_id = model_id
        self.model_name = model_name
        self.photos_folder = photos_folder
    
    def run(self):
        try:
            self.progress.emit(f"Model eğitimi başlıyor: {self.model_name}", 0)
            
            # Fotoğraf dosyalarını bul (tüm alt klasörler dahil)
            image_files = []
            valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp')
            skipped_files = []
            
            print(f"📁 Klasör taranıyor: {self.photos_folder}")
            
            # Tüm alt klasörleri dahil ederek recursive arama
            for root, dirs, files in os.walk(self.photos_folder):
                print(f"  📂 Alt klasör: {root} ({len(files)} dosya)")
                for file in files:
                    if file.lower().endswith(valid_extensions):
                        file_path = os.path.join(root, file)
                        
                        # Dosya var mı ve okunabilir mi kontrol et
                        if os.path.exists(file_path) and os.path.isfile(file_path):
                            try:
                                # Dosya boyutu kontrolü (minimum 1KB)
                                if os.path.getsize(file_path) > 1024:
                                    image_files.append(file_path)
                                else:
                                    skipped_files.append(f"{file} (Çok küçük)")
                            except (OSError, UnicodeDecodeError) as e:
                                skipped_files.append(f"{file} (Erişim hatası)")
                        else:
                            skipped_files.append(f"{file} (Bulunamadı)")
            
            if skipped_files:
                print(f"⚠️  Atlanan dosyalar ({len(skipped_files)} adet):")
                for skip in skipped_files[:5]:  # İlk 5 tanesi
                    print(f"    - {skip}")
                if len(skipped_files) > 5:
                    print(f"    ... ve {len(skipped_files) - 5} dosya daha")
            
            print(f"✅ Toplam geçerli fotoğraf: {len(image_files)} adet")
            
            if not image_files:
                self.error.emit(f"Klasörde hiç geçerli fotoğraf bulunamadı!\n\nKontrol edilenler:\n- Desteklenen formatlar: JPG, PNG, BMP, TIFF, WEBP\n- Minimum dosya boyutu: 1KB\n- Alt klasörler dahil {len(skipped_files)} dosya atlendı")
                return
            
            total_files = len(image_files)
            face_database = {}
            total_faces = 0
            
            self.progress.emit(f"Fotoğraflar analiz ediliyor... ({total_files} dosya)", 10)
            
            for idx, image_path in enumerate(image_files):
                try:
                    filename = os.path.basename(image_path)
                    
                    # Güvenli dosya okuma (encoding sorunlarını çöz)
                    try:
                        # Dosyayı binary modda oku ve OpenCV'ye geç
                        with open(image_path, 'rb') as f:
                            file_bytes = f.read()
                        
                        # Bytes'tan numpy array'e çevir
                        nparr = np.frombuffer(file_bytes, np.uint8)
                        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        
                        if img is None:
                            print(f"⚠️  Okunamayan resim: {filename}")
                            continue
                        
                        # Resim boyutu kontrolü
                        height, width = img.shape[:2]
                        if height < 50 or width < 50:
                            print(f"⚠️  Çok küçük resim: {filename} ({width}x{height})")
                            continue
                            
                    except Exception as e:
                        print(f"❌ Dosya okuma hatası - {filename}: {str(e)}")
                        continue
                    
                    # Yüzleri tespit et
                    try:
                        faces = face_app.get(img) if face_app else None
                    except Exception as e:
                        print(f"❌ Yüz tespit hatası - {filename}: {str(e)}")
                        continue
                    
                    if faces and len(faces) > 0:
                        print(f"✅ {filename}: {len(faces)} yüz tespit edildi")
                        
                        # Orijinal GUI formatında kaydet - her yüz için ayrı key
                        for face_idx, face in enumerate(faces):
                            try:
                                embedding = face.normed_embedding.astype('float32')
                                
                                # Orijinal GUI key formatı
                                key = f"{image_path}||face_{face_idx}"
                                face_database[key] = {
                                    'embedding': embedding,
                                    'path': image_path,
                                    'bbox': face.bbox,
                                    'kps': face.kps
                                }
                                total_faces += 1
                            except Exception as e:
                                print(f"⚠️  Yüz verisi işleme hatası - {filename}: {str(e)}")
                                continue
                    else:
                        # Sessizce geç, çünkü her fotoğrafta yüz olmayabilir
                        pass
                    
                    # İlerleme güncelle
                    progress = 10 + int((idx + 1) / total_files * 80)
                    self.progress.emit(f"İşlenen: {idx + 1}/{total_files} - {total_faces} yüz tespit edildi", progress)
                    
                except Exception as e:
                    print(f"❌ Genel hata - {os.path.basename(image_path)}: {str(e)}")
                    continue
            
            # Sonuçları değerlendirme
            total_photos_with_faces = len(face_database)
            
            print(f"\n📊 Eğitim Özeti:")
            print(f"  📁 Taranan dosya: {total_files}")
            print(f"  🖼️ Yüzlü fotoğraf: {total_photos_with_faces}")
            print(f"  👤 Toplam yüz: {total_faces}")
            
            if total_faces == 0:
                error_msg = f"Hiç yüz tespit edilemedi!\n\n" + \
                           f"Olasi Nedenler:\n" + \
                           f"- Fotoğraf kalitesi düşük (bulanık, karşıt düşük)\n" + \
                           f"- Yüz açısı uygun değil (profil yerine önden)\n" + \
                           f"- Aydınlatma yetersiz (karartılmış)\n" + \
                           f"- Resim boyutu çok küçük\n" + \
                           f"- Dosya formatı desteklenmiyor\n\n" + \
                           f"Tarama Detayları:\n" + \
                           f"- İncelenen dosya: {total_files}\n" + \
                           f"- Atlanan dosya: {len(skipped_files)}"
                self.error.emit(error_msg)
                return
            
            # Model dosyalarını kaydet
            self.progress.emit("Model kaydediliyor...", 90)
            
            model_dir = f"./models/{self.model_id}"
            os.makedirs(model_dir, exist_ok=True)
            
            # Face database'i kaydet
            model_file = os.path.join(model_dir, "face_database.pkl")
            with open(model_file, 'wb') as f:
                pickle.dump(face_database, f)
            
            # Model bilgilerini kaydet
            model_info = {
                'name': self.model_name,
                'date': datetime.now().isoformat(),
                'face_count': total_faces,
                'photo_count': len(face_database),
                'model_path': model_file
            }
            
            info_file = os.path.join(model_dir, "model_info.json")
            with open(info_file, 'w', encoding='utf-8') as f:
                json.dump(model_info, f, ensure_ascii=False, indent=2)
            
            self.progress.emit("Model başarıyla eğitildi", 100)
            self.finished.emit(self.model_id, model_info)
            
        except Exception as e:
            print(f"❌ Kritik hata: {str(e)}")
            import traceback
            traceback.print_exc()
            self.error.emit(f"Model eğitimi hatası: {str(e)}\n\nDetaylar konsola yazdırıldı.")

class PhotoMatchingWorker(QThread):
    """Fotoğraf eşleştirme worker thread'i - Memory-safe implementation with debugging"""
    progress = pyqtSignal(str, int, str)  # message, percentage, tc_number
    finished = pyqtSignal(str, list)  # tc_number, matched_photos
    error = pyqtSignal(str, str)  # tc_number, error_message
    
    def __init__(self, tc_number, reference_embeddings, email, selected_models):
        super().__init__()
        self.tc_number = tc_number
        self.reference_embeddings = [np.array(emb, dtype=np.float32) for emb in reference_embeddings]  # Pre-convert to numpy
        self.email = email
        self.selected_models = selected_models
        self._should_stop = False
        self.start_time = None
        self.debug_counter = 0
        
        # Başlangıç logları
        logger.info(f"🚀 EŞLEŞTIRME BAŞLAT - TC: {tc_number}")
        logger.info(f"   📧 Email: {email}")
        logger.info(f"   🤖 Seçilen modeller: {selected_models}")
        logger.info(f"   📊 Referans embedding sayısı: {len(reference_embeddings)}")
        log_memory_usage("PhotoMatchingWorker __init__")
    
    def run(self):
        # Initialize variables at the start to ensure they exist for cleanup
        matched_photos = []
        all_photos = {}
        processed = 0
        total_photos = 0
        self.start_time = time.time()
        
        try:
            logger.info(f"🔄 EŞLEŞTIRME RUN BAŞLADI - TC: {self.tc_number}")
            log_memory_usage("Run başlangıcı")
            log_system_info()
            
            self.progress.emit(f"Eşleştirme başlıyor", 0, self.tc_number)
            
            # Seçilen modellerdeki tüm fotoğrafları birleştir
            logger.info(f"📁 MODEL YÜKLEME BAŞLADI - {len(self.selected_models)} model")
            
            for idx, model_id in enumerate(self.selected_models):
                if self._should_stop:
                    logger.info(f"⛔ DURDURMA İSTEĞİ - Model yükleme iptal edildi")
                    return
                    
                model_file = f"./models/{model_id}/face_database.pkl"
                logger.info(f"📂 Model yükleniyor [{idx+1}/{len(self.selected_models)}]: {model_id}")
                
                if os.path.exists(model_file):
                    try:
                        file_size = os.path.getsize(model_file) / 1024 / 1024  # MB
                        logger.info(f"   📏 Dosya boyutu: {file_size:.1f} MB")
                        
                        with open(model_file, 'rb') as f:
                            model_data = pickle.load(f)
                        
                        model_photo_count = 0
                        model_face_count = len(model_data)
                        logger.info(f"   👤 Model'de {model_face_count} yüz verisi var")
                        
                        # Memory-efficient processing
                        for key_idx, (key, photo_data) in enumerate(model_data.items()):
                            if self._should_stop:
                                logger.info(f"⛔ DURDURMA İSTEĞİ - Model işleme iptal edildi")
                                return
                                
                            try:
                                # Orijinal GUI key formatı: "path||face_N"
                                if '||face_' in key:
                                    photo_path = photo_data['path']
                                    if photo_path not in all_photos:
                                        all_photos[photo_path] = []
                                        model_photo_count += 1
                                    # Pre-convert embedding to numpy with proper dtype
                                    photo_data_copy = photo_data.copy()
                                    photo_data_copy['embedding'] = np.array(photo_data['embedding'], dtype=np.float32)
                                    all_photos[photo_path].append(photo_data_copy)
                                else:
                                    # Fallback - eski format
                                    all_photos[key] = [photo_data] if isinstance(photo_data, dict) else photo_data
                                    model_photo_count += 1
                                    
                                # Her 1000 yüzde bir bellek durumu logla
                                if key_idx > 0 and key_idx % 1000 == 0:
                                    log_memory_usage(f"Model işleme - {key_idx}/{model_face_count}")
                                    
                            except Exception as e:
                                logger.error(f"❌ Yüz verisi işleme hatası - Key: {key[:50]}...: {str(e)}")
                                continue
                        
                        # Clear model_data immediately to free memory
                        del model_data
                        gc.collect()  # Force garbage collection
                        
                        logger.info(f"✅ Model yüklendi: {model_id} - {model_photo_count} fotoğraf")
                        log_memory_usage(f"Model {model_id} yüklendi")
                        
                        self.progress.emit(f"Model yüklendi: {model_id}", 10, self.tc_number)
                    except Exception as e:
                        logger.error(f"❌ Model yükleme hatası - {model_id}: {str(e)}")
                        logger.error(f"   Stack trace: {traceback.format_exc()}")
                else:
                    logger.warning(f"⚠️ Model dosyası bulunamadı: {model_file}")
            
            total_photos = len(all_photos)
            logger.info(f"📊 TOPLAM FOTOĞRAF: {total_photos}")
            log_memory_usage("Tüm modeller yüklendi")
            
            if total_photos == 0:
                logger.error(f"❌ Hiç fotoğraf bulunamadı - TC: {self.tc_number}")
                self.error.emit(self.tc_number, "Seçilen modellerde fotoğraf bulunamadı")
                return
            
            processed = 0
            progress_update_interval = max(1, total_photos // 20)  # Maximum 20 progress updates
            logger.info(f"🔄 EŞLEŞTIRME BAŞLIYOR - {total_photos} fotoğraf işlenecek")
            
            for photo_idx, (photo_path, face_list) in enumerate(all_photos.items()):
                if self._should_stop:
                    logger.info(f"⛔ DURDURMA İSTEĞİ - Eşleştirme iptal edildi [{processed}/{total_photos}]")
                    break
                    
                try:
                    best_similarity = 0.0
                    best_face_data = None
                    
                    # Her 100 fotoğrafta bir detaylı log
                    if photo_idx % 100 == 0:
                        logger.info(f"🔍 Fotoğraf işleniyor [{photo_idx+1}/{total_photos}]: {os.path.basename(photo_path)}")
                        log_memory_usage(f"Fotoğraf {photo_idx+1}/{total_photos}")
                    
                    # Find best matching face in this photo
                    for face_idx, face_data in enumerate(face_list):
                        try:
                            photo_embedding = face_data['embedding']  # Already converted to numpy
                            
                            # Check against all reference embeddings
                            for ref_idx, ref_embedding in enumerate(self.reference_embeddings):
                                try:
                                    similarity = self.calculate_similarity(ref_embedding, photo_embedding)
                                    
                                    if similarity > best_similarity and similarity > CONFIG['SIMILARITY_THRESHOLD']:
                                        best_similarity = similarity
                                        best_face_data = face_data
                                        
                                except Exception as e:
                                    logger.warning(f"⚠️ Similarity hesaplama hatası [foto:{photo_idx}, yüz:{face_idx}, ref:{ref_idx}]: {str(e)}")
                                    continue
                                    
                        except Exception as e:
                            logger.warning(f"⚠️ Yüz verisi hatası [foto:{photo_idx}, yüz:{face_idx}]: {str(e)}")
                            continue
                    
                    # Add best match if found
                    if best_face_data is not None:
                        try:
                            matched_photos.append({
                                'photo_path': photo_path,
                                'similarity': float(best_similarity),
                                'bbox': best_face_data['bbox'].tolist() if hasattr(best_face_data['bbox'], 'tolist') else best_face_data['bbox']
                            })
                            
                            # İlk 5 eşleşmeyi logla
                            if len(matched_photos) <= 5:
                                logger.info(f"✅ Eşleşme bulundu #{len(matched_photos)}: {os.path.basename(photo_path)} (Benzerlik: {best_similarity:.3f})")
                                
                        except Exception as e:
                            logger.error(f"❌ Eşleşme kaydetme hatası - {photo_path}: {str(e)}")
                    
                    processed += 1
                    
                    # Update progress less frequently to avoid signal spam
                    if processed % progress_update_interval == 0 or processed == total_photos:
                        progress = int((processed / total_photos) * 100)
                        elapsed_time = time.time() - self.start_time
                        
                        logger.info(f"📈 İLERLEME: {processed}/{total_photos} ({progress}%) - {elapsed_time:.1f}s - {len(matched_photos)} eşleşme")
                        
                        # %95'den sonra her adımı logla (crash risk yüksek)
                        if progress >= 95:
                            log_memory_usage(f"Kritik nokta - {processed}/{total_photos}")
                            logger.info(f"🚨 KRİTİK NOKTA: %{progress} - Kalan: {total_photos - processed} fotoğraf")
                        
                        self.progress.emit(f"Eşleştirme: {processed}/{total_photos}", 
                                         progress, self.tc_number)
                    
                except Exception as e:
                    logger.error(f"❌ Fotoğraf eşleştirme hatası - {photo_path}: {str(e)}")
                    logger.error(f"   Stack trace: {traceback.format_exc()}")
                    processed += 1
                    continue
            
            # Clear all_photos to free memory before sorting
            logger.info(f"🧹 Bellek temizleniyor - all_photos siliniyor")
            del all_photos
            gc.collect()  # Force garbage collection
            log_memory_usage("all_photos silindi")
            
            if not self._should_stop and matched_photos:
                logger.info(f"📊 SONUÇ HAZIRLAMA: {len(matched_photos)} eşleşme bulundu")
                
                # Memory-efficient sorting
                try:
                    logger.info(f"🔀 Sonuçlar sıralanıyor...")
                    matched_photos.sort(key=lambda x: x['similarity'], reverse=True)
                    
                    # En iyi 3 sonucu logla
                    for i, match in enumerate(matched_photos[:3]):
                        logger.info(f"   #{i+1}: {os.path.basename(match['photo_path'])} (Benzerlik: {match['similarity']:.3f})")
                    
                    elapsed_time = time.time() - self.start_time
                    logger.info(f"🎉 EŞLEŞTIRME TAMAMLANDI - {elapsed_time:.1f}s - TC: {self.tc_number}")
                    log_memory_usage("Eşleştirme tamamlandı")
                    
                    self.progress.emit("Eşleştirme tamamlandı", 100, self.tc_number)
                    self.finished.emit(self.tc_number, matched_photos)
                    
                except Exception as e:
                    logger.error(f"❌ Sonuç sıralama hatası: {str(e)}")
                    logger.error(f"   Stack trace: {traceback.format_exc()}")
                    self.error.emit(self.tc_number, f"Sonuç sıralama hatası: {str(e)}")
            elif not self._should_stop:
                elapsed_time = time.time() - self.start_time
                logger.info(f"ℹ️ Eşleşme bulunamadı - {elapsed_time:.1f}s - TC: {self.tc_number}")
                self.finished.emit(self.tc_number, [])
            
        except Exception as e:
            elapsed_time = time.time() - self.start_time if self.start_time else 0
            logger.error(f"💥 KRİTİK HATA - TC: {self.tc_number} - {elapsed_time:.1f}s")
            logger.error(f"   Hata mesajı: {str(e)}")
            logger.error(f"   İşlenen fotoğraf: {processed}/{total_photos if 'total_photos' in locals() else 'bilinmiyor'}")
            logger.error(f"   Bulunan eşleşme: {len(matched_photos) if 'matched_photos' in locals() else 'bilinmiyor'}")
            logger.error(f"   Stack trace: {traceback.format_exc()}")
            log_memory_usage("Kritik hata anında")
            
            # Sistem durumu
            try:
                process = psutil.Process()
                logger.error(f"   CPU kullanımı: {process.cpu_percent()}%")
                logger.error(f"   Bellek kullanımı: {process.memory_percent():.1f}%")
            except:
                pass
            
            self.error.emit(self.tc_number, f"Eşleştirme hatası: {str(e)}")
        finally:
            # Cleanup reference embeddings to free memory
            logger.info(f"🧹 CLEANUP BAŞLADI - TC: {self.tc_number}")
            try:
                if hasattr(self, 'reference_embeddings'):
                    del self.reference_embeddings
                    logger.info(f"   ✅ reference_embeddings silindi")
                gc.collect()
                log_memory_usage("Cleanup sonrası")
                logger.info(f"🏁 CLEANUP TAMAMLANDI - TC: {self.tc_number}")
            except Exception as cleanup_error:
                logger.error(f"❌ Cleanup hatası: {str(cleanup_error)}")
    
    def stop(self):
        """Worker'ı güvenli şekilde durdur"""
        logger.info(f"🛑 DURDURMA İSTEĞİ - TC: {self.tc_number}")
        self._should_stop = True
    
    def calculate_similarity(self, embedding1, embedding2):
        """Memory-safe dot product similarity hesapla (normalize edilmiş vektörler için)"""
        try:
            # Debug counter'ı artır
            self.debug_counter += 1
            
            # Her 10000 hesaplamada bir debug
            if self.debug_counter % 10000 == 0:
                logger.debug(f"🔢 Similarity hesaplaması: {self.debug_counter}")
            
            # Ensure both are float32 numpy arrays for consistency
            if not isinstance(embedding1, np.ndarray):
                embedding1 = np.array(embedding1, dtype=np.float32)
            if not isinstance(embedding2, np.ndarray):
                embedding2 = np.array(embedding2, dtype=np.float32)
            
            # Use optimized dot product
            similarity = float(np.dot(embedding1, embedding2))
            return similarity
        except Exception as e:
            print(f"Similarity calculation error: {str(e)}")
            return 0.0

class GoogleDriveSender(QThread):
    """Google Drive ile fotoğraf gönderme worker thread'i"""
    progress = pyqtSignal(str, str)  # tc_number, message
    finished = pyqtSignal(str, bool)  # tc_number, success
    
    def __init__(self, tc_number, email, matched_photos):
        super().__init__()
        self.tc_number = tc_number
        self.email = email
        self.matched_photos = matched_photos
        self.uploaded_photos = []  # Yüklenen fotoğrafların listesi
    
    def get_drive_service(self):
        """Google Drive API servisini başlat"""
        try:
            # Service account key dosyası yolu
            service_account_file = os.getenv('GOOGLE_SERVICE_ACCOUNT_FILE', 'service-account-key.json')
            
            if not os.path.exists(service_account_file):
                raise Exception(f"Google Drive servis hesabı dosyası bulunamadı: {service_account_file}")
            
            # Credentials yükle
            credentials = service_account.Credentials.from_service_account_file(
                service_account_file,
                scopes=['https://www.googleapis.com/auth/drive']
            )
            
            # Drive servisi oluştur
            service = build('drive', 'v3', credentials=credentials)
            return service
            
        except Exception as e:
            logger.error(f"Google Drive servisi başlatılamadı: {str(e)}")
            raise e
    
    def create_drive_folder(self, service, folder_name, parent_folder_id=None):
        """Google Drive'da klasör oluştur"""
        try:
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            if parent_folder_id:
                folder_metadata['parents'] = [parent_folder_id]
            
            folder = service.files().create(body=folder_metadata, fields='id').execute()
            return folder.get('id')
            
        except Exception as e:
            logger.error(f"Klasör oluşturma hatası: {str(e)}")
            return None
    
    def upload_to_google_drive(self, photo_path, photo_index):
        """Fotoğrafı Google Drive'a yükle ve paylaşım linki döndür"""
        try:
            # Google Drive servisi
            service = self.get_drive_service()
            
            # Dosya adı ve yolu hazırla
            original_name = os.path.basename(photo_path)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            drive_filename = f"{timestamp}_{photo_index:03d}_{original_name}"
            
            logger.info(f"📤 Google Drive'a yükleniyor: {drive_filename}")
            
            # Ana klasörü kontrol et/oluştur
            main_folder_name = f"AKParti_Kamp_Fotograflari"
            query = f"name='{main_folder_name}' and mimeType='application/vnd.google-apps.folder'"
            results = service.files().list(q=query, fields='files(id, name)').execute()
            items = results.get('files', [])
            
            if items:
                main_folder_id = items[0]['id']
                logger.info(f"📁 Ana klasör bulundu: {main_folder_id}")
            else:
                main_folder_id = self.create_drive_folder(service, main_folder_name)
                logger.info(f"📁 Ana klasör oluşturuldu: {main_folder_id}")
            
            # TC numarası klasörünü kontrol et/oluştur
            tc_folder_name = f"TC_{self.tc_number}"
            query = f"name='{tc_folder_name}' and '{main_folder_id}' in parents and mimeType='application/vnd.google-apps.folder'"
            results = service.files().list(q=query, fields='files(id, name)').execute()
            items = results.get('files', [])
            
            if items:
                tc_folder_id = items[0]['id']
                logger.info(f"📁 TC klasörü bulundu: {tc_folder_id}")
            else:
                tc_folder_id = self.create_drive_folder(service, tc_folder_name, main_folder_id)
                logger.info(f"📁 TC klasörü oluşturuldu: {tc_folder_id}")
            
            # Dosyayı yükle
            file_metadata = {
                'name': drive_filename,
                'parents': [tc_folder_id]
            }
            
            media = MediaFileUpload(photo_path, mimetype='image/jpeg')
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,webViewLink,webContentLink'
            ).execute()
            
            file_id = file.get('id')
            
            # Dosyayı herkese açık yap
            permission = {
                'type': 'anyone',
                'role': 'reader'
            }
            service.permissions().create(
                fileId=file_id,
                body=permission
            ).execute()
            
            # İndirme linki oluştur
            download_link = f"https://drive.google.com/uc?id={file_id}&export=download"
            view_link = file.get('webViewLink')
            
            logger.info(f"✅ Google Drive'a yüklendi: {original_name}")
            return {
                'original_name': original_name,
                'download_url': download_link,
                'view_url': view_link,
                'file_id': file_id,
                'upload_success': True
            }
            
        except Exception as e:
            logger.error(f"❌ Google Drive yükleme hatası [{photo_index}]: {str(e)}")
            return {
                'original_name': os.path.basename(photo_path) if os.path.exists(photo_path) else 'unknown',
                'download_url': None,
                'view_url': None,
                'file_id': None,
                'upload_success': False,
                'error': str(e)
            }
    
    def run(self):
        try:
            logger.info(f"☁️ GOOGLE DRIVE GÖNDERİMİ BAŞLADI - TC: {self.tc_number}")
            logger.info(f"   📊 Eşleşen fotoğraf: {len(self.matched_photos)}")
            log_memory_usage("Google Drive başlangıç")
            
            self.progress.emit(self.tc_number, "Fotoğraflar Google Drive'a yükleniyor...")
            
            # Tüm fotoğrafları Google Drive'a yükle
            successful_uploads = []
            failed_uploads = []
            
            for idx, match in enumerate(self.matched_photos):
                try:
                    photo_path = match['photo_path']
                    logger.info(f"📤 Fotoğraf yükleniyor [{idx+1}/{len(self.matched_photos)}]: {os.path.basename(photo_path)}")
                    
                    # İlerleme bildirimi
                    self.progress.emit(self.tc_number, f"Yükleniyor ({idx+1}/{len(self.matched_photos)}): {os.path.basename(photo_path)}")
                    
                    # Dosya varlığı kontrolü
                    if not os.path.exists(photo_path):
                        logger.warning(f"⚠️ Dosya bulunamadı: {photo_path}")
                        failed_uploads.append({
                            'original_name': os.path.basename(photo_path),
                            'error': 'Dosya bulunamadı'
                        })
                        continue
                    
                    # Fotoğrafı Google Drive'a yükle
                    upload_result = self.upload_to_google_drive(photo_path, idx + 1)
                    
                    if upload_result['upload_success']:
                        successful_uploads.append(upload_result)
                        logger.info(f"✅ Başarılı [{idx+1}/{len(self.matched_photos)}]: {upload_result['original_name']}")
                    else:
                        failed_uploads.append(upload_result)
                        logger.error(f"❌ Başarısız [{idx+1}/{len(self.matched_photos)}]: {upload_result.get('error', 'Bilinmeyen hata')}")
                    
                    # Her 5 fotoğrafta bellek durumu
                    if idx % 5 == 0:
                        log_memory_usage(f"Google Drive yükleme - {idx+1}/{len(self.matched_photos)}")
                        
                except Exception as photo_error:
                    logger.error(f"❌ Fotoğraf yükleme hatası [{idx+1}]: {str(photo_error)}")
                    failed_uploads.append({
                        'original_name': os.path.basename(match.get('photo_path', 'unknown')),
                        'error': str(photo_error)
                    })
                    continue
            
            logger.info(f"📊 Yükleme özeti: {len(successful_uploads)} başarılı, {len(failed_uploads)} başarısız")
            
            if not successful_uploads:
                raise Exception("Hiçbir fotoğraf yüklenemedi")
            
            # E-posta ile Google Drive linklerini gönder
            self.progress.emit(self.tc_number, "Google Drive linkleri e-posta ile gönderiliyor...")
            logger.info(f"📨 E-posta hazırlanıyor: {self.email}")
            
            try:
                msg = MIMEMultipart()
                msg['From'] = CONFIG['EMAIL_FROM']
                msg['To'] = self.email
                msg['Subject'] = f"AK Parti Gençlik Kolları Kamp Fotoğraflarınız - {self.tc_number}"
                
                # E-posta içeriği hazırla
                photo_links = ""
                for idx, photo in enumerate(successful_uploads):
                    photo_links += f"{idx+1:2d}. {photo['original_name']}\n    İndirme linki: {photo['download_url']}\n    Görüntüleme linki: {photo['view_url']}\n\n"
                
                failed_info = ""
                if failed_uploads:
                    failed_info = f"\n\n⚠️ Yüklenemeyen fotoğraflar ({len(failed_uploads)} adet):\n"
                    for failed in failed_uploads[:5]:  # Sadece ilk 5'ini göster
                        failed_info += f"   • {failed['original_name']} - {failed.get('error', 'Bilinmeyen hata')}\n"
                    if len(failed_uploads) > 5:
                        failed_info += f"   • ... ve {len(failed_uploads) - 5} fotoğraf daha\n"
                
                body = f"""
Sayın Katılımcımız,

AK Parti Gençlik Kolları İrade, İstikamet ve İstişare Kampı fotoğraflarınız hazır!

📊 ÖZET:
   • Tespit edilen fotoğraf sayısı: {len(self.matched_photos)}
   • Başarıyla yüklenen: {len(successful_uploads)}
   • TC Kimlik No: {self.tc_number}

🔗 FOTOĞRAF İNDİRME LİNKLERİ:

{photo_links}
💡 İPUCU: 
   • İndirme linkine tıklayarak fotoğrafı doğrudan indirebilirsiniz
   • Görüntüleme linkine tıklayarak Google Drive'da görebilirsiniz
   • Linkler kalıcı olarak aktif kalacaktır{failed_info}

Saygılarımızla,
AK Parti Gençlik Kolları Genel Sekreterliği
                """
                
                msg.attach(MIMEText(body, 'plain', 'utf-8'))
                logger.info(f"📝 E-posta metni hazırlandı ({len(successful_uploads)} Google Drive linki)")
                
                # SMTP güvenli gönderim
                logger.info(f"📤 SMTP bağlantısı kuruluyor: {CONFIG['SMTP_SERVER']}:{CONFIG['SMTP_PORT']}")
                
                server = None
                try:
                    server = smtplib.SMTP(CONFIG['SMTP_SERVER'], CONFIG['SMTP_PORT'])
                    server.starttls()
                    server.login(CONFIG['EMAIL_FROM'], CONFIG['EMAIL_PASSWORD'])
                    
                    logger.info(f"📧 E-posta gönderiliyor...")
                    server.send_message(msg)
                    logger.info(f"✅ E-posta başarıyla gönderildi")
                    
                except Exception as smtp_error:
                    logger.error(f"❌ SMTP gönderim hatası: {str(smtp_error)}")
                    raise Exception(f"E-posta gönderim hatası: {str(smtp_error)}")
                finally:
                    if server:
                        try:
                            server.quit()
                        except:
                            pass
                
            except Exception as email_error:
                logger.error(f"❌ E-posta hazırlama hatası: {str(email_error)}")
                raise email_error
            
            log_memory_usage("Google Drive tamamlandı")
            logger.info(f"🎉 GOOGLE DRIVE GÖNDERİMİ TAMAMLANDI - TC: {self.tc_number}")
            self.finished.emit(self.tc_number, True)
            
        except Exception as e:
            # Kritik hata durumunda detaylı log
            logger.error(f"💥 GOOGLE DRIVE KRİTİK HATA - TC: {self.tc_number}")
            logger.error(f"   Hata mesajı: {str(e)}")
            logger.error(f"   Stack trace: {traceback.format_exc()}")
            log_memory_usage("Google Drive hata anında")
            
            self.finished.emit(self.tc_number, False)
            print(f"Google Drive gönderme hatası: {str(e)}")
            
        finally:
            # Final cleanup
            try:
                gc.collect()
                logger.info(f"🧹 Google Drive worker cleanup tamamlandı - TC: {self.tc_number}")
            except:
                pass

class PythonAPIServer:
    """Python API Server - Web'den gelen istekleri karşılar"""
    
    def __init__(self, main_window):
        self.main_window = main_window
        self.app = Flask(__name__)
        self.setup_routes()
    
    def setup_routes(self):
        """API rotalarını kur"""
        
        @self.app.route('/api/health', methods=['GET'])
        def health_check():
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'trained_models': len(trained_models),
                'api_connection': api_connection_status['connected'],
                'device': device_info
            })
        
        @self.app.route('/api/process-photo-request', methods=['POST'])
        def process_photo_request():
            try:
                data = request.get_json()
                tc_number = data.get('tcNumber')
                email = data.get('email')
                reference_photos = data.get('referencePhotos', [])
                selected_models = data.get('selectedModels', [])
                
                if not tc_number or not email:
                    return jsonify({'error': 'TC number and email required'}), 400
                
                if not selected_models:
                    return jsonify({'error': 'En az bir model seçmelisiniz'}), 400
                
                # İsteği ana pencereye ilet
                self.main_window.process_photo_request({
                    'tcNumber': tc_number,
                    'email': email,
                    'referencePhotos': reference_photos,
                    'selectedModels': selected_models,
                    'timestamp': datetime.now().isoformat()
                })
                
                return jsonify({
                    'message': 'Request received successfully',
                    'tcNumber': tc_number
                })
                
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/process-photos', methods=['POST'])
        def process_photos():
            """Web sitesinden gelen fotoğraf işleme istekleri"""
            try:
                data = request.get_json()
                tc_number = data.get('tcNumber')
                email = data.get('email')
                selected_camp_days = data.get('selectedCampDays', [])
                uploaded_files_count = data.get('uploadedFilesCount', 0)
                
                if not tc_number or not email:
                    return jsonify({'error': 'TC kimlik numarası ve e-posta gerekli'}), 400
                
                if not selected_camp_days:
                    return jsonify({'error': 'En az bir kamp günü seçmelisiniz'}), 400
                
                # Seçilen kamp günlerini model isimlerine çevir
                selected_models = []
                for camp_day_id in selected_camp_days:
                    if camp_day_id in trained_models:
                        selected_models.append(camp_day_id)
                
                if not selected_models:
                    return jsonify({'error': 'Seçilen kamp günleri için eğitilmiş model bulunamadı'}), 400
                
                # İsteği ana pencereye ilet
                self.main_window.process_photo_request({
                    'tcNumber': tc_number,
                    'email': email,
                    'selectedModels': selected_models,
                    'selectedCampDays': selected_camp_days,
                    'uploadedFilesCount': uploaded_files_count,
                    'timestamp': datetime.now().isoformat(),
                    'source': 'web_api'
                })
                
                print(f"📩 Web'den fotoğraf işleme isteği alındı: {tc_number} ({len(selected_models)} model)")
                
                return jsonify({
                    'message': 'Fotoğraf işleme isteği başarıyla alındı',
                    'tcNumber': tc_number,
                    'selectedModelsCount': len(selected_models),
                    'status': 'processing'
                })
                
            except Exception as e:
                print(f"❌ Fotoğraf işleme isteği hatası: {str(e)}")
                return jsonify({'error': str(e)}), 500
    
    def start_server(self):
        """API server'ı başlat"""
        try:
            server_thread = Thread(
                target=lambda: self.app.run(
                    host='0.0.0.0', 
                    port=CONFIG['PYTHON_API_PORT'], 
                    debug=False
                ),
                daemon=True
            )
            server_thread.start()
            print(f"Python API Server başlatıldı - Port: {CONFIG['PYTHON_API_PORT']}")
        except Exception as e:
            print(f"API Server başlatma hatası: {str(e)}")

class ModelTrainingSection(QWidget):
    """Model Eğitimi Bölümü"""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
        self.refresh_models()
    
    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        
        # Başlık ve sistem bilgisi
        header_layout = QHBoxLayout()
        
        title = QLabel("Model Eğitimi")
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setStyleSheet(f"color: {AK_COLORS['BLUE']}; margin-bottom: 10px;")
        header_layout.addWidget(title)
        
        # Device bilgisi
        device_label = QLabel(f"🖥️ {device_info['type']}: {device_info['name']}")
        device_label.setFont(QFont("Segoe UI", 11))
        if device_info['cuda_available']:
            device_label.setStyleSheet(f"color: {AK_COLORS['SUCCESS']}; font-weight: bold;")
        else:
            device_label.setStyleSheet(f"color: {AK_COLORS['WARNING']}; font-weight: bold;")
        header_layout.addStretch()
        header_layout.addWidget(device_label)
        
        layout.addLayout(header_layout)
        
        # Yeni model eğitimi grubu
        train_group = QGroupBox("Yeni Model Eğit")
        train_group.setStyleSheet(f"""
            QGroupBox {{
                font-weight: bold;
                border: 2px solid {AK_COLORS['GRAY']};
                border-radius: 8px;
                margin-top: 10px;
                padding-top: 10px;
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 10px 0 10px;
            }}
        """)
        train_layout = QVBoxLayout(train_group)
        
        # Model adı
        self.model_name_input = QTextEdit()
        self.model_name_input.setMaximumHeight(60)
        self.model_name_input.setPlaceholderText("Model adını girin (örn: 1. Gün - Açılış)")
        self.model_name_input.setStyleSheet("border: 1px solid #ddd; border-radius: 4px; padding: 8px;")
        train_layout.addWidget(QLabel("Model Adı:"))
        train_layout.addWidget(self.model_name_input)
        
        # Fotoğraf klasörü seçimi
        folder_layout = QHBoxLayout()
        self.folder_path_label = QLabel("Fotoğraf klasörü seçilmedi")
        self.folder_path_label.setStyleSheet("color: #666; font-style: italic;")
        self.select_folder_btn = QPushButton("Klasör Seç")
        self.select_folder_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {AK_COLORS['BLUE']};
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #1565C0;
            }}
        """)
        self.select_folder_btn.clicked.connect(self.select_folder)
        
        folder_layout.addWidget(self.folder_path_label, 1)
        folder_layout.addWidget(self.select_folder_btn)
        train_layout.addWidget(QLabel("Fotoğraf Klasörü:"))
        train_layout.addLayout(folder_layout)
        
        # Eğitim butonu
        self.train_btn = QPushButton("Model Eğit")
        self.train_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {AK_COLORS['YELLOW']};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 12px;
                font-size: 14px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #D97706;
            }}
            QPushButton:disabled {{
                background-color: #ddd;
                color: #999;
            }}
        """)
        self.train_btn.clicked.connect(self.start_training)
        train_layout.addWidget(self.train_btn)
        
        # İlerleme çubuğu
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setStyleSheet(f"""
            QProgressBar {{
                border: 1px solid {AK_COLORS['GRAY']};
                border-radius: 4px;
                text-align: center;
            }}
            QProgressBar::chunk {{
                background-color: {AK_COLORS['SUCCESS']};
                border-radius: 3px;
            }}
        """)
        train_layout.addWidget(self.progress_bar)
        
        layout.addWidget(train_group)
        
        # Eğitilmiş modeller listesi
        models_group = QGroupBox("Eğitilmiş Modeller")
        models_group.setStyleSheet(f"""
            QGroupBox {{
                font-weight: bold;
                border: 2px solid {AK_COLORS['GRAY']};
                border-radius: 8px;
                margin-top: 10px;
                padding-top: 10px;
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 10px 0 10px;
            }}
        """)
        models_layout = QVBoxLayout(models_group)
        
        # Modeller tablosu
        self.models_table = QTableWidget()
        self.models_table.setColumnCount(4)
        self.models_table.setHorizontalHeaderLabels(["Model Adı", "Eğitim Tarihi", "Yüz Sayısı", "İşlemler"])
        header = self.models_table.horizontalHeader()
        if header:
            header.setStretchLastSection(True)
        self.models_table.setAlternatingRowColors(True)
        self.models_table.setStyleSheet("""
            QTableWidget {
                gridline-color: #ddd;
                background-color: white;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            QTableWidget::item {
                padding: 8px;
                border-bottom: 1px solid #eee;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
            }
            QHeaderView::section {
                background-color: #f5f5f5;
                padding: 8px;
                border: none;
                border-bottom: 2px solid #ddd;
                font-weight: bold;
            }
        """)
        models_layout.addWidget(self.models_table)
        
        # Senkronizasyon butonu
        self.sync_btn = QPushButton("Modelleri Web'e Senkronize Et")
        self.sync_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {AK_COLORS['BLUE']};
                color: white;
                border: none;
                border-radius: 6px;
                padding: 10px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #1565C0;
            }}
        """)
        self.sync_btn.clicked.connect(self.sync_models)
        models_layout.addWidget(self.sync_btn)
        
        layout.addWidget(models_group)
        
        # Alt kısma boşluk ekle
        layout.addStretch()
        
        self.selected_folder = None
    
    def select_folder(self):
        """Fotoğraf klasörü seç"""
        folder = QFileDialog.getExistingDirectory(self, "Fotoğraf Klasörü Seçin")
        if folder:
            self.selected_folder = folder
            self.folder_path_label.setText(f"Seçili: {folder}")
            self.folder_path_label.setStyleSheet("color: #333;")
    
    def start_training(self):
        """Model eğitimini başlat"""
        model_name = self.model_name_input.toPlainText().strip()
        if not model_name:
            QMessageBox.warning(self, "Uyarı", "Lütfen model adını girin")
            return
        
        if not self.selected_folder:
            QMessageBox.warning(self, "Uyarı", "Lütfen fotoğraf klasörünü seçin")
            return
        
        # Model ID oluştur
        model_id = f"model_{int(time.time())}"
        
        # UI'yi güncelle
        self.train_btn.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        
        # Worker thread başlat
        self.training_worker = ModelTrainingWorker(model_id, model_name, self.selected_folder)
        self.training_worker.progress.connect(self.update_training_progress)
        self.training_worker.finished.connect(self.training_finished)
        self.training_worker.error.connect(self.training_error)
        self.training_worker.start()
    
    def update_training_progress(self, message, percentage):
        """Eğitim ilerlemesini güncelle"""
        self.progress_bar.setValue(percentage)
        self.progress_bar.setFormat(f"{message} ({percentage}%)")
    
    def training_finished(self, model_id, model_info):
        """Eğitim tamamlandı"""
        global trained_models
        trained_models[model_id] = model_info
        
        self.train_btn.setEnabled(True)
        self.progress_bar.setVisible(False)
        self.model_name_input.clear()
        self.selected_folder = None
        self.folder_path_label.setText("Fotoğraf klasörü seçilmedi")
        self.folder_path_label.setStyleSheet("color: #666; font-style: italic;")
        
        self.refresh_models()
        QMessageBox.information(self, "Başarılı", f"Model başarıyla eğitildi!\n\nYüz sayısı: {model_info['face_count']}\nFotoğraf sayısı: {model_info['photo_count']}")
    
    def training_error(self, error_message):
        """Eğitim hatası"""
        self.train_btn.setEnabled(True)
        self.progress_bar.setVisible(False)
        QMessageBox.critical(self, "Hata", f"Model eğitimi başarısız:\n{error_message}")
    
    def refresh_models(self):
        """Modeller tablosunu yenile"""
        self.models_table.setRowCount(len(trained_models))
        
        for row, (model_id, model_info) in enumerate(trained_models.items()):
            # Model adı
            self.models_table.setItem(row, 0, QTableWidgetItem(model_info['name']))
            
            # Eğitim tarihi
            date_obj = datetime.fromisoformat(model_info['date'])
            date_str = date_obj.strftime("%d.%m.%Y %H:%M")
            self.models_table.setItem(row, 1, QTableWidgetItem(date_str))
            
            # Yüz sayısı
            self.models_table.setItem(row, 2, QTableWidgetItem(str(model_info['face_count'])))
            
            # İşlemler butonu
            delete_btn = QPushButton("Sil")
            delete_btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {AK_COLORS['ERROR']};
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 4px 8px;
                    font-size: 12px;
                }}
                QPushButton:hover {{
                    background-color: #DC2626;
                }}
            """)
            delete_btn.clicked.connect(lambda checked, mid=model_id: self.delete_model(mid))
            self.models_table.setCellWidget(row, 3, delete_btn)
    
    def delete_model(self, model_id):
        """Model sil"""
        reply = QMessageBox.question(self, "Model Sil", 
                                   f"'{trained_models[model_id]['name']}' modelini silmek istediğinizden emin misiniz?",
                                   QMessageBox.Yes | QMessageBox.No)
        
        if reply == QMessageBox.Yes:
            try:
                # Model klasörünü sil
                model_dir = f"./models/{model_id}"
                if os.path.exists(model_dir):
                    shutil.rmtree(model_dir)
                
                # Global listeden sil
                del trained_models[model_id]
                
                self.refresh_models()
                QMessageBox.information(self, "Başarılı", "Model başarıyla silindi")
            except Exception as e:
                QMessageBox.critical(self, "Hata", f"Model silinirken hata oluştu:\n{str(e)}")
    
    def sync_models(self):
        """Modelleri web'e senkronize et"""
        if not trained_models:
            QMessageBox.warning(self, "Uyarı", "Senkronize edilecek model bulunamadı")
            return
        
        if sync_models_to_web():
            QMessageBox.information(self, "Başarılı", f"{len(trained_models)} model web API'ye başarıyla senkronize edildi")
        else:
            QMessageBox.critical(self, "Hata", "Model senkronizasyonu başarısız. Web API bağlantısını kontrol edin.")

class RequestProcessingSection(QWidget):
    """İstek İşleme Bölümü"""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
        self.active_workers = {}
    
    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        
        # Başlık ve sistem bilgisi
        header_layout = QHBoxLayout()
        
        title = QLabel("İstek İşleme")
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setStyleSheet(f"color: {AK_COLORS['BLUE']}; margin-bottom: 10px;")
        header_layout.addWidget(title)
        
        # Processing info
        if device_info['cuda_available']:
            processing_info = f"⚡ GPU Hızlandırma Aktif"
            color = AK_COLORS['SUCCESS']
        else:
            processing_info = f"💻 CPU İşleme Modu"
            color = AK_COLORS['WARNING']
        
        processing_label = QLabel(processing_info)
        processing_label.setFont(QFont("Segoe UI", 11))
        processing_label.setStyleSheet(f"color: {color}; font-weight: bold;")
        header_layout.addStretch()
        header_layout.addWidget(processing_label)
        
        layout.addLayout(header_layout)
        
        # API durum bilgisi
        status_frame = QFrame()
        status_frame.setStyleSheet(f"""
            QFrame {{
                border: 1px solid {AK_COLORS['GRAY']};
                border-radius: 8px;
                background-color: {AK_COLORS['LIGHT_GRAY']};
                padding: 10px;
            }}
        """)
        status_layout = QHBoxLayout(status_frame)
        
        self.api_status_label = QLabel("API Durumu Kontrol Ediliyor...")
        self.api_status_label.setFont(QFont("Segoe UI", 12))
        status_layout.addWidget(self.api_status_label)
        
        self.refresh_btn = QPushButton("Yenile")
        self.refresh_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {AK_COLORS['BLUE']};
                color: white;
                border: none;
                border-radius: 4px;
                padding: 6px 12px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #1565C0;
            }}
        """)
        self.refresh_btn.clicked.connect(self.check_api_status)
        status_layout.addWidget(self.refresh_btn)
        
        layout.addWidget(status_frame)
        
        # İşlem durumu
        processing_group = QGroupBox("Aktif İşlemler")
        processing_group.setStyleSheet(f"""
            QGroupBox {{
                font-weight: bold;
                border: 2px solid {AK_COLORS['GRAY']};
                border-radius: 8px;
                margin-top: 10px;
                padding-top: 10px;
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 10px 0 10px;
            }}
        """)
        processing_layout = QVBoxLayout(processing_group)
        
        # İşlemler tablosu
        self.requests_table = QTableWidget()
        self.requests_table.setColumnCount(5)
        self.requests_table.setHorizontalHeaderLabels(["TC No", "E-posta", "Durum", "İlerleme", "Tarih"])
        header = self.requests_table.horizontalHeader()
        if header:
            header.setStretchLastSection(True)
        self.requests_table.setAlternatingRowColors(True)
        self.requests_table.setStyleSheet("""
            QTableWidget {
                gridline-color: #ddd;
                background-color: white;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            QTableWidget::item {
                padding: 8px;
                border-bottom: 1px solid #eee;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
            }
            QHeaderView::section {
                background-color: #f5f5f5;
                padding: 8px;
                border: none;
                border-bottom: 2px solid #ddd;
                font-weight: bold;
            }
        """)
        processing_layout.addWidget(self.requests_table)
        
        layout.addWidget(processing_group)
        
        # İstatistikler
        stats_group = QGroupBox("İstatistikler")
        stats_group.setStyleSheet(f"""
            QGroupBox {{
                font-weight: bold;
                border: 2px solid {AK_COLORS['GRAY']};
                border-radius: 8px;
                margin-top: 10px;
                padding-top: 10px;
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 10px 0 10px;
            }}
        """)
        stats_layout = QHBoxLayout(stats_group)
        
        self.total_requests_label = QLabel("Toplam İstek: 0")
        self.completed_requests_label = QLabel("Tamamlanan: 0")
        self.failed_requests_label = QLabel("Başarısız: 0")
        
        for label in [self.total_requests_label, self.completed_requests_label, self.failed_requests_label]:
            label.setFont(QFont("Segoe UI", 12))
            label.setStyleSheet("padding: 5px;")
            stats_layout.addWidget(label)
        
        layout.addWidget(stats_group)
        
        # Alt kısma boşluk ekle
        layout.addStretch()
        
        # API durumunu kontrol et
        self.check_api_status()
    
    def check_api_status(self):
        """API bağlantı durumunu kontrol et"""
        if test_api_connection():
            self.api_status_label.setText("✅ Web API Bağlantısı Aktif")
            self.api_status_label.setStyleSheet(f"color: {AK_COLORS['SUCCESS']};")
        else:
            self.api_status_label.setText("❌ Web API Bağlantısı Yok")
            self.api_status_label.setStyleSheet(f"color: {AK_COLORS['ERROR']};")
    
    def process_photo_request(self, request_data):
        """Fotoğraf işleme isteğini başlat"""
        tc_number = request_data['tcNumber']
        
        # İsteği tabloya ekle
        row = self.requests_table.rowCount()
        self.requests_table.insertRow(row)
        
        self.requests_table.setItem(row, 0, QTableWidgetItem(tc_number))
        self.requests_table.setItem(row, 1, QTableWidgetItem(request_data['email']))
        self.requests_table.setItem(row, 2, QTableWidgetItem("Başlıyor..."))
        
        progress_bar = QProgressBar()
        progress_bar.setStyleSheet(f"""
            QProgressBar {{
                border: 1px solid {AK_COLORS['GRAY']};
                border-radius: 4px;
                text-align: center;
            }}
            QProgressBar::chunk {{
                background-color: {AK_COLORS['YELLOW']};
                border-radius: 3px;
            }}
        """)
        self.requests_table.setCellWidget(row, 3, progress_bar)
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.requests_table.setItem(row, 4, QTableWidgetItem(timestamp))
        
        # İşlemi başlat
        self.start_photo_matching(tc_number, request_data, progress_bar, row)
    
    def start_photo_matching(self, tc_number, request_data, progress_bar, table_row):
        """Fotoğraf eşleştirme işlemini başlat"""
        try:
            # Web'den gelen yüz verilerini işle
            reference_embeddings = []
            
            # Yeni format: faceData (web'den gelen embedding verileri)
            if 'faceData' in request_data and request_data['faceData']:
                for face_item in request_data['faceData']:
                    try:
                        if 'embedding' in face_item and face_item['embedding']:
                            embedding = np.array(face_item['embedding'], dtype=np.float32)
                            reference_embeddings.append(embedding)
                            print(f"✅ Web'den embedding verisi alındı (boyut: {len(embedding)})")
                    except Exception as e:
                        print(f"Web embedding işleme hatası: {str(e)}")
            
            # Eski format: referencePhotos (base64 fotoğraflar) - uyumluluk için
            elif 'referencePhotos' in request_data:
                for photo_b64 in request_data['referencePhotos']:
                    try:
                        # Base64'ten resme çevir
                        image_data = base64.b64decode(photo_b64.split(',')[1])  # data:image/jpeg;base64,... formatından
                        nparr = np.frombuffer(image_data, np.uint8)
                        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        
                        # Yüz tespiti
                        faces = face_app.get(img) if face_app else None
                        if faces:
                            for face in faces:
                                reference_embeddings.append(face.embedding)
                    except Exception as e:
                        print(f"Referans fotoğraf işleme hatası: {str(e)}")
            
            if not reference_embeddings:
                self.requests_table.setItem(table_row, 2, QTableWidgetItem("Hata: Yüz verisi bulunamadı"))
                print("❌ Hiç embedding verisi bulunamadı")
                return
                
            print(f"✅ Toplam {len(reference_embeddings)} yüz embedding'i hazır")
            
            # Eşleştirme worker'ını başlat - selectedCampDays kullan
            selected_models = request_data.get('selectedCampDays', request_data.get('selectedModels', []))
            matching_worker = PhotoMatchingWorker(
                tc_number, 
                reference_embeddings, 
                request_data['email'], 
                selected_models
            )
            
            matching_worker.progress.connect(
                lambda msg, pct, tc: self.update_matching_progress(tc, msg, pct, progress_bar, table_row)
            )
            matching_worker.finished.connect(
                lambda tc, photos: self.matching_finished(tc, photos, table_row)
            )
            matching_worker.error.connect(
                lambda tc, error: self.matching_error(tc, error, table_row)
            )
            
            self.active_workers[tc_number] = matching_worker
            matching_worker.start()
            
        except Exception as e:
            self.requests_table.setItem(table_row, 2, QTableWidgetItem(f"Hata: {str(e)}"))
    
    def update_matching_progress(self, tc_number, message, percentage, progress_bar, table_row):
        """Eşleştirme ilerlemesini güncelle"""
        progress_bar.setValue(percentage)
        self.requests_table.setItem(table_row, 2, QTableWidgetItem(message))
    
    def matching_finished(self, tc_number, matched_photos, table_row):
        """Eşleştirme tamamlandı - E-posta göndermeye başla"""
        if not matched_photos:
            self.requests_table.setItem(table_row, 2, QTableWidgetItem("Eşleşme bulunamadı"))
            return
        
        self.requests_table.setItem(table_row, 2, QTableWidgetItem(f"{len(matched_photos)} fotoğraf bulundu - E-posta gönderiliyor"))
        
        # E-posta worker'ını başlat
        email = None
        # Worker'dan email'i al
        for tc, worker in self.active_workers.items():
            if tc == tc_number:
                email = worker.email
                break
        
        if not email:
            self.requests_table.setItem(table_row, 2, QTableWidgetItem("❌ E-posta adresi bulunamadı"))
            return
        
        email_worker = GoogleDriveSender(tc_number, email, matched_photos)
        email_worker.progress.connect(
            lambda tc, msg: self.update_email_progress(tc, msg, table_row)
        )
        email_worker.finished.connect(
            lambda tc, success: self.email_finished(tc, success, table_row)
        )
        
        email_worker.start()
        
        # Matching worker'ını temizle
        if tc_number in self.active_workers:
            worker = self.active_workers[tc_number]
            if hasattr(worker, 'stop'):
                worker.stop()
            del self.active_workers[tc_number]
    
    def update_email_progress(self, tc_number, message, table_row):
        """E-posta gönderme ilerlemesini güncelle"""
        self.requests_table.setItem(table_row, 2, QTableWidgetItem(message))
    
    def email_finished(self, tc_number, success, table_row):
        """E-posta gönderimi tamamlandı"""
        if success:
            self.requests_table.setItem(table_row, 2, QTableWidgetItem("✅ Tamamlandı"))
            progress_bar = self.requests_table.cellWidget(table_row, 3)
            if progress_bar:
                progress_bar.setValue(100)
        else:
            self.requests_table.setItem(table_row, 2, QTableWidgetItem("❌ E-posta hatası"))
        
        # Worker'ı temizle
        if tc_number in self.active_workers:
            del self.active_workers[tc_number]
    
    def matching_error(self, tc_number, error_message, table_row):
        """Eşleştirme hatası"""
        self.requests_table.setItem(table_row, 2, QTableWidgetItem(f"❌ Hata: {error_message}"))
        
        # Worker'ı güvenli durdur ve temizle
        if tc_number in self.active_workers:
            worker = self.active_workers[tc_number]
            if hasattr(worker, 'stop'):
                worker.stop()
            del self.active_workers[tc_number]
    
    def stop_all_workers(self):
        """Tüm aktif worker'ları güvenli durdur"""
        for tc_number, worker in list(self.active_workers.items()):
            try:
                if hasattr(worker, 'stop'):
                    worker.stop()
                if worker.isRunning():
                    worker.quit()
                    worker.wait(3000)  # 3 saniye bekle
                    if worker.isRunning():
                        worker.terminate()  # Force terminate if still running
            except Exception as e:
                print(f"Worker durdurma hatası - {tc_number}: {str(e)}")
        
        self.active_workers.clear()
        print("✅ Tüm worker'lar güvenli durduruldu")

class MainWindow(QMainWindow):
    """Ana pencere - İki bölümlü tasarım"""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
        self.setup_database_connection()
        
        # Otomatik istek kontrol timer'ı
        self.request_timer = QTimer()
        self.request_timer.timeout.connect(self.check_new_requests)
        self.request_timer.start(10000)  # 10 saniyede bir kontrol
        
        self.processed_requests = set()  # İşlenmiş istekleri takip et
        
        # Reference to request processing section for cleanup
        self.request_section = None
    
    def closeEvent(self, a0):
        """Uygulama kapatılırken güvenli cleanup"""
        print("🔄 Uygulama kapatılıyor - Aktif işlemler durduruluyor...")
        
        try:
            # Timer'ı durdur
            if hasattr(self, 'request_timer') and self.request_timer:
                self.request_timer.stop()
            
            # Request section'daki worker'ları durdur
            if self.request_section and hasattr(self.request_section, 'stop_all_workers'):
                self.request_section.stop_all_workers()
            
            print("✅ Güvenli cleanup tamamlandı")
            
        except Exception as e:
            print(f"⚠️ Cleanup sırasında hata: {str(e)}")
        
        if a0:
            a0.accept()
    
    def setup_ui(self):
        """Ana arayüzü kur"""
        self.setWindowTitle("AK Parti Gençlik Kolları - Kamp Fotoğraf Sistemi")
        self.setMinimumSize(1400, 800)
        
        # Merkezi widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Ana layout - yatay bölünmüş
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(1)
        
        # Splitter - iki bölüm
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setStyleSheet("""
            QSplitter::handle {
                background-color: #ddd;
                width: 2px;
            }
            QSplitter::handle:hover {
                background-color: #bbb;
            }
        """)
        
        # Sol bölüm - Model Eğitimi
        self.training_section = ModelTrainingSection()
        training_frame = QFrame()
        training_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {AK_COLORS['WHITE']};
                border-right: 1px solid #ddd;
            }}
        """)
        training_layout = QVBoxLayout(training_frame)
        training_layout.setContentsMargins(0, 0, 0, 0)
        training_layout.addWidget(self.training_section)
        
        # Sağ bölüm - İstek İşleme
        self.processing_section = RequestProcessingSection()
        self.request_section = self.processing_section  # Reference for cleanup
        processing_frame = QFrame()
        processing_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {AK_COLORS['WHITE']};
            }}
        """)
        processing_layout = QVBoxLayout(processing_frame)
        processing_layout.setContentsMargins(0, 0, 0, 0)
        processing_layout.addWidget(self.processing_section)
        
        # Splitter'a ekle
        splitter.addWidget(training_frame)
        splitter.addWidget(processing_frame)
        splitter.setSizes([700, 700])  # Eşit boyutlarda başlat
        
        main_layout.addWidget(splitter)
        
        # Pencereyi maksimize et
        self.showMaximized()
    
    def setup_database_connection(self):
        """Veritabanı bağlantısını kur"""
        # Web API'den veritabanı bilgilerini al
        self.db_config = {
            'web_api_url': CONFIG.get('WEB_API_URL', 'http://localhost:5000')
        }
        print(f"📊 Veritabanı bağlantısı kuruldu: {self.db_config['web_api_url']}")
    
    def process_photo_request(self, request_data):
        """Fotoğraf işleme isteğini işle"""
        self.processing_section.process_photo_request(request_data)
    
    def check_new_requests(self):
        """Yeni fotoğraf isteklerini kontrol et"""
        try:
            # Web API'den yeni istekleri al (Python GUI endpoint'i)
            response = requests.get(
                f"{self.db_config['web_api_url']}/api/python/photo-requests", 
                headers={'Authorization': 'Bearer python-gui-token'}, 
                timeout=5
            )
            if response.status_code == 200:
                requests_data = response.json()
                
                for request_item in requests_data:
                    request_id = request_item['id']
                    
                    # Bu istek daha önce işlenmiş mi?
                    if request_id not in self.processed_requests:
                        self.processed_requests.add(request_id)
                        
                        # İsteği işleme kuyruğuna ekle
                        photo_request = {
                            'tcNumber': request_item['tcNumber'],
                            'email': request_item['email'],
                            'faceData': request_item.get('faceData', []),  # Web'den gelen yüz verileri
                            'selectedModels': [],  # Kamp günlerinden çevirece
                            'selectedCampDays': request_item.get('selectedCampDays', []),
                            'timestamp': request_item['createdAt'],
                            'source': 'web_database'
                        }
                        
                        print(f"✨ Yeni istek web veritabanından alındı: {request_item['tcNumber']}")
                        print(f"📊 Debug - Alınan veri:")
                        print(f"   - TC: {request_item['tcNumber']}")
                        print(f"   - Email: {request_item['email']}")
                        print(f"   - Face Data: {len(request_item.get('faceData', []))} adet")
                        print(f"   - Raw Face Data: {request_item.get('faceData', 'YOK')}")
                        self.process_photo_request(photo_request)
                        
        except Exception as e:
            print(f"⚠️ Veritabanı kontrolü hatası: {str(e)}")

# API server sınıfları kaldırıldı - sadece GUI kullanılacak

def main():
    """Ana fonksiyon"""
    # Konsol parametresi kontrolü
    console_mode = '--console' in sys.argv or '-c' in sys.argv
    
    if console_mode:
        print("💻 Konsol parametresi tespit edildi")
        print("📝 Konsol bilgileri gösteriliyor...")
        
    print("🎯 AK Parti Gençlik Kolları Fotoğraf Eşleştirme Sistemi")
    print("🔧 GUI modu başlatılıyor...")
    
    # PyQt5 uygulamasını başlat
    app = QApplication(sys.argv)
    
    # AK Parti temasını uygula
    app.setStyle('Fusion')
    palette = QPalette()
    palette.setColor(QPalette.Window, QColor(255, 255, 255))
    palette.setColor(QPalette.WindowText, QColor(31, 41, 55))
    palette.setColor(QPalette.Base, QColor(255, 255, 255))
    palette.setColor(QPalette.AlternateBase, QColor(249, 250, 251))
    palette.setColor(QPalette.ToolTipBase, QColor(255, 255, 255))
    palette.setColor(QPalette.ToolTipText, QColor(31, 41, 55))
    palette.setColor(QPalette.Text, QColor(31, 41, 55))
    palette.setColor(QPalette.Button, QColor(255, 255, 255))
    palette.setColor(QPalette.ButtonText, QColor(31, 41, 55))
    palette.setColor(QPalette.BrightText, QColor(239, 68, 68))
    palette.setColor(QPalette.Link, QColor(30, 136, 229))
    palette.setColor(QPalette.Highlight, QColor(245, 158, 11))
    palette.setColor(QPalette.HighlightedText, QColor(255, 255, 255))
    app.setPalette(palette)
    
    # Font ayarla
    font = QFont("Segoe UI", 10)
    app.setFont(font)
    
    # Yüz analizi sistemini başlat
    if not init_face_analysis():
        QMessageBox.critical(None, "Hata", "Yüz analizi sistemi başlatılamadı!")
        sys.exit(1)
    
    # Eğitilmiş modelleri yükle
    load_trained_models()
    
    if console_mode:
        print(f"📁 Eğitilmiş modeller yüklendi: {len(trained_models)} adet")
        print("✅ Sistem hazır - GUI açılıyor...")
    
    # Ana pencereyi göster
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()