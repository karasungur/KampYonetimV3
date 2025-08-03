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
import requests
from datetime import datetime
from threading import Thread, Lock
import queue
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
import zipfile
import base64
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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
trained_models = {}  # {camp_day_id: {'name': str, 'date': str, 'model_path': str, 'face_count': int}}
processing_queue = queue.Queue()
current_requests = {}
request_lock = Lock()
api_connection_status = {'connected': False, 'last_check': None}

def init_face_analysis():
    """Yüz analizi sistemini başlat"""
    global face_app
    try:
        face_app = FaceAnalysis(providers=['CPUExecutionProvider'])
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        return True
    except Exception as e:
        print(f"Yüz analizi başlatma hatası: {str(e)}")
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
            
            # Fotoğraf dosyalarını bul
            image_files = []
            for root, dirs, files in os.walk(self.photos_folder):
                for file in files:
                    if file.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
                        image_files.append(os.path.join(root, file))
            
            if not image_files:
                self.error.emit("Klasörde hiç fotoğraf bulunamadı")
                return
            
            total_files = len(image_files)
            face_database = {}
            total_faces = 0
            
            self.progress.emit(f"Fotoğraflar analiz ediliyor... ({total_files} dosya)", 10)
            
            for idx, image_path in enumerate(image_files):
                try:
                    # Resmi oku
                    img = cv2.imread(image_path)
                    if img is None:
                        continue
                    
                    # Yüzleri tespit et
                    faces = face_app.get(img) if face_app else None
                    
                    if faces:
                        face_database[image_path] = {
                            'faces': [],
                            'timestamp': datetime.now().isoformat()
                        }
                        
                        for face in faces:
                            face_data = {
                                'bbox': face.bbox.tolist(),
                                'embedding': face.embedding.tolist(),
                                'landmark_2d_106': face.landmark_2d_106.tolist() if hasattr(face, 'landmark_2d_106') else None
                            }
                            face_database[image_path]['faces'].append(face_data)
                            total_faces += 1
                    
                    # İlerleme güncelle
                    progress = 10 + int((idx + 1) / total_files * 80)
                    self.progress.emit(f"İşlenen: {idx + 1}/{total_files} - {total_faces} yüz tespit edildi", progress)
                    
                except Exception as e:
                    print(f"Fotoğraf işleme hatası - {image_path}: {str(e)}")
                    continue
            
            if total_faces == 0:
                self.error.emit("Hiç yüz tespit edilemedi")
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
            self.error.emit(f"Model eğitimi hatası: {str(e)}")

class PhotoMatchingWorker(QThread):
    """Fotoğraf eşleştirme worker thread'i"""
    progress = pyqtSignal(str, int, str)  # message, percentage, tc_number
    finished = pyqtSignal(str, list)  # tc_number, matched_photos
    error = pyqtSignal(str, str)  # tc_number, error_message
    
    def __init__(self, tc_number, reference_embeddings, email, selected_models):
        super().__init__()
        self.tc_number = tc_number
        self.reference_embeddings = reference_embeddings
        self.email = email
        self.selected_models = selected_models
    
    def run(self):
        try:
            self.progress.emit(f"Eşleştirme başlıyor", 0, self.tc_number)
            
            matched_photos = []
            total_photos = 0
            processed = 0
            
            # Seçilen modellerdeki tüm fotoğrafları birleştir
            all_photos = {}
            for model_id in self.selected_models:
                model_file = f"./models/{model_id}/face_database.pkl"
                if os.path.exists(model_file):
                    try:
                        with open(model_file, 'rb') as f:
                            model_data = pickle.load(f)
                        for photo_path, photo_data in model_data.items():
                            all_photos[photo_path] = photo_data
                        self.progress.emit(f"Model yüklendi: {model_id}", 0, self.tc_number)
                    except Exception as e:
                        print(f"Model yükleme hatası - {model_id}: {str(e)}")
            
            total_photos = len(all_photos)
            if total_photos == 0:
                self.error.emit(self.tc_number, "Seçilen modellerde fotoğraf bulunamadı")
                return
            
            for photo_path, photo_data in all_photos.items():
                try:
                    for face_data in photo_data['faces']:
                        photo_embedding = np.array(face_data['embedding'])
                        
                        # Her referans embedding ile karşılaştır
                        for ref_embedding in self.reference_embeddings:
                            similarity = self.calculate_similarity(ref_embedding, photo_embedding)
                            
                            if similarity > CONFIG['SIMILARITY_THRESHOLD']:
                                matched_photos.append({
                                    'photo_path': photo_path,
                                    'similarity': float(similarity),
                                    'bbox': face_data['bbox']
                                })
                                break
                    
                    processed += 1
                    progress = int((processed / total_photos) * 100)
                    self.progress.emit(f"Eşleştirme: {processed}/{total_photos}", 
                                     progress, self.tc_number)
                    
                except Exception as e:
                    print(f"Eşleştirme hatası - {photo_path}: {str(e)}")
                    continue
            
            # Eşleşmeleri benzerlik skoruna göre sırala
            matched_photos.sort(key=lambda x: x['similarity'], reverse=True)
            
            self.finished.emit(self.tc_number, matched_photos)
            
        except Exception as e:
            self.error.emit(self.tc_number, f"Eşleştirme hatası: {str(e)}")
    
    def calculate_similarity(self, embedding1, embedding2):
        """Cosine similarity hesapla"""
        cos_sim = np.dot(embedding1, embedding2) / (
            np.linalg.norm(embedding1) * np.linalg.norm(embedding2)
        )
        return cos_sim

class EmailSender(QThread):
    """E-posta gönderme worker thread'i"""
    progress = pyqtSignal(str, str)  # tc_number, message
    finished = pyqtSignal(str, bool)  # tc_number, success
    
    def __init__(self, tc_number, email, matched_photos):
        super().__init__()
        self.tc_number = tc_number
        self.email = email
        self.matched_photos = matched_photos
    
    def run(self):
        try:
            self.progress.emit(self.tc_number, "E-posta hazırlanıyor...")
            
            # ZIP dosyası oluştur
            zip_path = f"./temp/{self.tc_number}_photos.zip"
            os.makedirs("./temp", exist_ok=True)
            
            with zipfile.ZipFile(zip_path, 'w') as zip_file:
                for idx, match in enumerate(self.matched_photos[:20]):  # İlk 20 fotoğraf
                    photo_path = match['photo_path']
                    if os.path.exists(photo_path):
                        filename = f"{idx+1:02d}_{os.path.basename(photo_path)}"
                        zip_file.write(photo_path, filename)
            
            # E-posta gönder
            self.progress.emit(self.tc_number, "E-posta gönderiliyor...")
            
            msg = MIMEMultipart()
            msg['From'] = CONFIG['EMAIL_FROM']
            msg['To'] = self.email
            msg['Subject'] = f"AK Parti Gençlik Kolları Kamp Fotoğraflarınız - {self.tc_number}"
            
            body = f"""
Sayın Katılımcımız,

AK Parti Gençlik Kolları İrade, İstikamet ve İstişare Kampı fotoğraflarınız hazır!

Tespit edilen fotoğraf sayısı: {len(self.matched_photos)}
TC Kimlik No: {self.tc_number}

Fotoğraflarınız ekte ZIP dosyası olarak gönderilmiştir.

Saygılarımızla,
AK Parti Gençlik Kolları Genel Sekreterliği
            """
            
            msg.attach(MIMEText(body, 'plain', 'utf-8'))
            
            # ZIP dosyasını ekle
            with open(zip_path, "rb") as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
                encoders.encode_base64(part)
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename= {self.tc_number}_photos.zip'
                )
                msg.attach(part)
            
            # SMTP ile gönder
            server = smtplib.SMTP(CONFIG['SMTP_SERVER'], CONFIG['SMTP_PORT'])
            server.starttls()
            server.login(CONFIG['EMAIL_FROM'], CONFIG['EMAIL_PASSWORD'])
            server.send_message(msg)
            server.quit()
            
            # Geçici dosyayı sil
            os.remove(zip_path)
            
            self.finished.emit(self.tc_number, True)
            
        except Exception as e:
            self.finished.emit(self.tc_number, False)
            print(f"E-posta gönderme hatası: {str(e)}")

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
                'api_connection': api_connection_status['connected']
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
        
        # Başlık
        title = QLabel("Model Eğitimi")
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setStyleSheet(f"color: {AK_COLORS['BLUE']}; margin-bottom: 10px;")
        layout.addWidget(title)
        
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
        
        # Başlık
        title = QLabel("İstek İşleme")
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setStyleSheet(f"color: {AK_COLORS['BLUE']}; margin-bottom: 10px;")
        layout.addWidget(title)
        
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
            # Referans fotoğrafları işle
            reference_embeddings = []
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
                self.requests_table.setItem(table_row, 2, QTableWidgetItem("Hata: Yüz tespit edilemedi"))
                return
            
            # Eşleştirme worker'ını başlat
            matching_worker = PhotoMatchingWorker(
                tc_number, 
                reference_embeddings, 
                request_data['email'], 
                request_data['selectedModels']
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
        
        email_worker = EmailSender(tc_number, email, matched_photos)
        email_worker.progress.connect(
            lambda tc, msg: self.update_email_progress(tc, msg, table_row)
        )
        email_worker.finished.connect(
            lambda tc, success: self.email_finished(tc, success, table_row)
        )
        
        email_worker.start()
    
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
        
        # Worker'ı temizle
        if tc_number in self.active_workers:
            del self.active_workers[tc_number]

class MainWindow(QMainWindow):
    """Ana pencere - İki bölümlü tasarım"""
    
    def __init__(self):
        super().__init__()
        self.setup_ui()
        self.setup_api_server()
        
        # Otomatik API kontrol timer'ı
        self.api_timer = QTimer()
        self.api_timer.timeout.connect(self.periodic_api_check)
        self.api_timer.start(30000)  # 30 saniyede bir kontrol
    
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
    
    def setup_api_server(self):
        """Python API server'ını kur"""
        self.api_server = PythonAPIServer(self)
        self.api_server.start_server()
    
    def process_photo_request(self, request_data):
        """Web'den gelen fotoğraf işleme isteğini karşıla"""
        self.processing_section.process_photo_request(request_data)
    
    def periodic_api_check(self):
        """Periyodik API durumu kontrolü"""
        self.processing_section.check_api_status()

def main():
    """Ana fonksiyon"""
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
    
    # Ana pencereyi göster
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()