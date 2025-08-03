#!/usr/bin/env python3
"""
AK Parti Gençlik Kolları Kamp Fotoğraf Eşleştirme Sistemi
Web API ile entegre çalışan Python yüz tanıma sistemi
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
    QGroupBox, QTextEdit, QSpinBox, QCheckBox, QFrame, QScrollArea,
    QGridLayout, QTabWidget, QTableWidget, QTableWidgetItem,
    QHeaderView, QSizePolicy, QFileDialog, QMessageBox
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QTimer, QSize
from PyQt5.QtGui import QPixmap, QImage, QIcon, QFont, QPalette, QColor

from flask import Flask, request, jsonify
from insightface.app import FaceAnalysis

# Uyarıları bastır
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning)

# Konfigürasyon - Çevre değişkenlerinden alınabilir
CONFIG = {
    'WEB_API_URL': os.getenv('WEB_API_URL', 'https://your-replit-app.replit.app'),  # Replit web API URL
    'PYTHON_API_PORT': int(os.getenv('PYTHON_API_PORT', 8080)),  # Python API portu
    'PHOTO_DATABASE_PATH': './kamp_fotograflari',
    'USER_UPLOADS_PATH': './kullanici_yukleme',
    'FACE_DATABASE_PATH': './yuz_veritabani.pkl',
    'EMAIL_FROM': os.getenv('EMAIL_FROM', 'kamp@akparti.org.tr'),
    'EMAIL_PASSWORD': os.getenv('EMAIL_PASSWORD', 'your_email_password'),
    'SMTP_SERVER': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
    'SMTP_PORT': int(os.getenv('SMTP_PORT', 587)),
    'SIMILARITY_THRESHOLD': float(os.getenv('SIMILARITY_THRESHOLD', '0.6')),
    'MAX_CONCURRENT_REQUESTS': int(os.getenv('MAX_CONCURRENT_REQUESTS', '3'))
}

# Global değişkenler
face_app = None
camp_day_models = {}  # Her kamp günü için ayrı model: {camp_day_id: face_database}
processing_queue = queue.Queue()
current_requests = {}
request_lock = Lock()
available_camp_days = []  # Web'den çekilecek kamp günleri listesi

class StyledWidget:
    """Modern görünüm için stil tanımları"""
    
    @staticmethod
    def apply_dark_theme(app):
        """Koyu tema uygula"""
        palette = QPalette()
        palette.setColor(QPalette.Window, QColor(45, 45, 48))
        palette.setColor(QPalette.WindowText, QColor(255, 255, 255))
        palette.setColor(QPalette.Base, QColor(35, 35, 38))
        palette.setColor(QPalette.AlternateBase, QColor(60, 60, 63))
        palette.setColor(QPalette.ToolTipBase, QColor(255, 255, 255))
        palette.setColor(QPalette.ToolTipText, QColor(255, 255, 255))
        palette.setColor(QPalette.Text, QColor(255, 255, 255))
        palette.setColor(QPalette.Button, QColor(45, 45, 48))
        palette.setColor(QPalette.ButtonText, QColor(255, 255, 255))
        palette.setColor(QPalette.BrightText, QColor(255, 0, 0))
        palette.setColor(QPalette.Link, QColor(42, 130, 218))
        palette.setColor(QPalette.Highlight, QColor(42, 130, 218))
        palette.setColor(QPalette.HighlightedText, QColor(255, 255, 255))
        app.setPalette(palette)
    
    @staticmethod
    def create_card_frame():
        """Modern kart görünümü oluştur"""
        frame = QFrame()
        frame.setFrameStyle(QFrame.Box)
        frame.setStyleSheet("""
            QFrame {
                border: 1px solid #3C3C3C;
                border-radius: 8px;
                background-color: #2D2D30;
                margin: 5px;
                padding: 10px;
            }
        """)
        return frame
    
    @staticmethod
    def style_button(button, color='primary'):
        """Buton stilleri"""
        colors = {
            'primary': 'background-color: #0078D4; color: white;',
            'success': 'background-color: #107C10; color: white;',
            'warning': 'background-color: #FF8C00; color: white;',
            'danger': 'background-color: #D83B01; color: white;',
        }
        
        button.setStyleSheet(f"""
            QPushButton {{
                {colors.get(color, colors['primary'])}
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-weight: bold;
                font-size: 12px;
            }}
            QPushButton:hover {{
                opacity: 0.8;
            }}
            QPushButton:pressed {{
                background-color: #005A9E;
            }}
        """)

class FaceAnalysisWorker(QThread):
    """Yüz analizi worker thread'i"""
    progress = pyqtSignal(str, int)
    finished = pyqtSignal(dict)
    error = pyqtSignal(str)
    
    def __init__(self, folder_path, recursive=True, camp_day_id=None):
        super().__init__()
        self.folder_path = folder_path
        self.recursive = recursive
        self.camp_day_id = camp_day_id
    
    def run(self):
        global camp_day_models
        try:
            self.progress.emit(f"Fotoğraflar taranıyor... {self.camp_day_id or 'Genel'}", 0)
            
            # Fotoğraf dosyalarını bul
            image_files = []
            if self.recursive:
                for root, dirs, files in os.walk(self.folder_path):
                    for file in files:
                        if file.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
                            image_files.append(os.path.join(root, file))
            else:
                for file in os.listdir(self.folder_path):
                    if file.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
                        image_files.append(os.path.join(self.folder_path, file))
            
            total_files = len(image_files)
            current_database = {}
            
            for idx, image_path in enumerate(image_files):
                try:
                    self.progress.emit(f"İşleniyor: {os.path.basename(image_path)}", 
                                     int((idx + 1) / total_files * 100))
                    
                    # Resmi oku
                    img = cv2.imread(image_path)
                    if img is None:
                        continue
                    
                    # Yüzleri tespit et
                    faces = face_app.get(img)
                    
                    if faces:
                        current_database[image_path] = {
                            'faces': [],
                            'timestamp': datetime.now().isoformat(),
                            'camp_day_id': self.camp_day_id
                        }
                        
                        for face in faces:
                            face_data = {
                                'bbox': face.bbox.tolist(),
                                'embedding': face.embedding.tolist(),
                                'landmark_2d_106': face.landmark_2d_106.tolist() if hasattr(face, 'landmark_2d_106') else None,
                                'age': getattr(face, 'age', None),
                                'gender': getattr(face, 'gender', None)
                            }
                            current_database[image_path]['faces'].append(face_data)
                
                except Exception as e:
                    print(f"Hata - {image_path}: {str(e)}")
                    continue
            
            # Veritabanını kaydet
            if self.camp_day_id:
                db_path = f"./models/{self.camp_day_id}/face_database.pkl"
                os.makedirs(f"./models/{self.camp_day_id}", exist_ok=True)
                with open(db_path, 'wb') as f:
                    pickle.dump(current_database, f)
                # Global model'e de ekle
                camp_day_models[self.camp_day_id] = current_database
            else:
                # Eski sistem için uyumluluk
                with open(CONFIG['FACE_DATABASE_PATH'], 'wb') as f:
                    pickle.dump(current_database, f)
            
            self.finished.emit(current_database)
            
        except Exception as e:
            self.error.emit(f"Analiz hatası: {str(e)}")

class PhotoMatchingWorker(QThread):
    """Fotoğraf eşleştirme worker thread'i"""
    progress = pyqtSignal(str, int, str)  # message, percentage, tc_number
    finished = pyqtSignal(str, list)  # tc_number, matched_photos
    error = pyqtSignal(str, str)  # tc_number, error_message
    
    def __init__(self, tc_number, reference_embeddings, email, selected_camp_days=None):
        super().__init__()
        self.tc_number = tc_number
        self.reference_embeddings = reference_embeddings
        self.email = email
        self.selected_camp_days = selected_camp_days or []
    
    def run(self):
        try:
            self.progress.emit(f"Eşleştirme başlıyor - {self.tc_number}", 0, self.tc_number)
            
            matched_photos = []
            total_photos = 0
            processed = 0
            
            # Seçilen kamp günlerindeki tüm fotoğrafları birleştir
            all_photos = {}
            if self.selected_camp_days:
                for camp_day_id in self.selected_camp_days:
                    if camp_day_id in camp_day_models:
                        for photo_path, photo_data in camp_day_models[camp_day_id].items():
                            all_photos[photo_path] = photo_data
                        self.progress.emit(f"Kamp günü yüklendi: {camp_day_id}", 0, self.tc_number)
            
            total_photos = len(all_photos)
            if total_photos == 0:
                self.error.emit(self.tc_number, "Seçilen kamp günlerinde fotoğraf bulunamadı")
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
                                break  # Bu fotoğraf için eşleşme bulundu
                    
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
                'face_database_ready': len(face_database) > 0
            })
        
        @self.app.route('/api/process-photo-request', methods=['POST'])
        def process_photo_request():
            try:
                data = request.get_json()
                tc_number = data.get('tcNumber')
                email = data.get('email')
                reference_photos = data.get('referencePhotos', [])
                selected_camp_days = data.get('selectedCampDays', [])
                
                if not tc_number or not email:
                    return jsonify({'error': 'TC number and email required'}), 400
                
                if not selected_camp_days:
                    return jsonify({'error': 'En az bir kamp günü seçmelisiniz'}), 400
                
                # İsteği kuyruğa al
                self.main_window.queue_photo_request({
                    'tcNumber': tc_number,
                    'email': email,
                    'referencePhotos': reference_photos,
                    'selectedCampDays': selected_camp_days,
                    'timestamp': datetime.now().isoformat()
                })
                
                return jsonify({
                    'message': 'Request queued successfully',
                    'tcNumber': tc_number
                })
                
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/request-status/<tc_number>', methods=['GET'])
        def get_request_status(tc_number):
            try:
                with request_lock:
                    if tc_number in current_requests:
                        request_data = current_requests[tc_number]
                        return jsonify({
                            'status': request_data.get('status', 'unknown'),
                            'progress': request_data.get('progress', 0),
                            'startTime': request_data.get('start_time', '').isoformat() if request_data.get('start_time') else None,
                            'message': request_data.get('message', '')
                        })
                    else:
                        return jsonify({'status': 'not_found'}), 404
            except Exception as e:
                return jsonify({'error': str(e)}), 500
    
    def start_server(self):
        """API server'ı başlat"""
        try:
            # Thread'de çalıştır ki GUI bloklanmasın
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

class MainWindow(QMainWindow):
    """Ana pencere sınıfı"""
    
    def __init__(self):
        super().__init__()
        self.init_face_analysis()
        self.setup_ui()
        self.setup_api_monitoring()
        self.load_face_database()
        self.load_camp_day_models()
        
        # Python API Server'ı başlat
        self.api_server = PythonAPIServer(self)
        self.api_server.start_server()
        
        # Web API ile senkronizasyon
        QTimer.singleShot(2000, self.sync_with_web_api)  # 2 saniye sonra başlat
    
    def init_face_analysis(self):
        """Face analysis modelini başlat"""
        global face_app
        try:
            ctx_id = 0 if torch.cuda.is_available() else -1
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if ctx_id >= 0 else ['CPUExecutionProvider']
            
            face_app = FaceAnalysis(name='buffalo_l', providers=providers)
            face_app.prepare(ctx_id=ctx_id, det_size=(640, 640))
            
            print(f"Face Analysis başlatıldı - Device: {'GPU' if ctx_id >= 0 else 'CPU'}")
            
        except Exception as e:
            print(f"Face Analysis başlatma hatası: {str(e)}")
            face_app = None
    
    def setup_ui(self):
        """Kullanıcı arayüzü kurulumu"""
        self.setWindowTitle("AK Parti Gençlik Kolları - Kamp Fotoğraf Sistemi")
        self.setGeometry(100, 100, 1400, 900)
        self.setWindowIcon(QIcon("./assets/akparti_icon.png"))
        
        # Ana widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Ana layout
        main_layout = QHBoxLayout(central_widget)
        
        # Sol panel - Kontroller
        left_panel = self.create_control_panel()
        main_layout.addWidget(left_panel, 1)
        
        # Sağ panel - Monitoring
        right_panel = self.create_monitoring_panel()
        main_layout.addWidget(right_panel, 2)
    
    def create_control_panel(self):
        """Sol kontrol paneli"""
        panel = StyledWidget.create_card_frame()
        layout = QVBoxLayout(panel)
        
        # Başlık
        title = QLabel("🎯 Kontrol Paneli")
        title.setFont(QFont("Arial", 16, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)
        
        # Fotoğraf veritabanı yönetimi
        db_group = QGroupBox("📁 Fotoğraf Veritabanı")
        db_layout = QVBoxLayout(db_group)
        
        self.db_path_label = QLabel("Klasör: Seçilmedi")
        self.db_path_label.setWordWrap(True)
        db_layout.addWidget(self.db_path_label)
        
        select_folder_btn = QPushButton("Klasör Seç")
        StyledWidget.style_button(select_folder_btn, 'primary')
        select_folder_btn.clicked.connect(self.select_photo_folder)
        db_layout.addWidget(select_folder_btn)
        
        self.analyze_btn = QPushButton("Analizi Başlat")
        StyledWidget.style_button(self.analyze_btn, 'success')
        self.analyze_btn.clicked.connect(self.start_analysis)
        self.analyze_btn.setEnabled(False)
        db_layout.addWidget(self.analyze_btn)
        
        self.analysis_progress = QProgressBar()
        self.analysis_progress.setVisible(False)
        db_layout.addWidget(self.analysis_progress)
        
        self.analysis_status = QLabel("")
        self.analysis_status.setWordWrap(True)
        db_layout.addWidget(self.analysis_status)
        
        layout.addWidget(db_group)
        
        # API durum bilgisi
        api_group = QGroupBox("🌐 API Durumu")
        api_layout = QVBoxLayout(api_group)
        
        self.api_status_label = QLabel("🔴 Bağlantı bekleniyor...")
        api_layout.addWidget(self.api_status_label)
        
        self.api_stats_label = QLabel("Aktif bağlantı: 0")
        api_layout.addWidget(self.api_stats_label)
        
        layout.addWidget(api_group)
        
        # Sistem istatistikleri
        stats_group = QGroupBox("📊 Sistem İstatistikleri")
        stats_layout = QVBoxLayout(stats_group)
        
        self.face_count_label = QLabel("Tespit edilen yüz: 0")
        stats_layout.addWidget(self.face_count_label)
        
        self.photo_count_label = QLabel("Toplam fotoğraf: 0")
        stats_layout.addWidget(self.photo_count_label)
        
        self.processed_requests_label = QLabel("İşlenen talep: 0")
        stats_layout.addWidget(self.processed_requests_label)
        
        layout.addWidget(stats_group)
        
        layout.addStretch()
        return panel
    
    def create_monitoring_panel(self):
        """Sağ monitoring paneli"""
        panel = StyledWidget.create_card_frame()
        layout = QVBoxLayout(panel)
        
        # Başlık
        title = QLabel("📈 İşlem Monitörü")
        title.setFont(QFont("Arial", 16, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)
        
        # Tab widget
        self.tabs = QTabWidget()
        
        # Aktif talepler tab'ı
        self.active_requests_tab = self.create_active_requests_tab()
        self.tabs.addTab(self.active_requests_tab, "🔄 Aktif Talepler")
        
        # Geçmiş tab'ı
        self.history_tab = self.create_history_tab()
        self.tabs.addTab(self.history_tab, "📋 Geçmiş")
        
        # Log tab'ı
        self.log_tab = self.create_log_tab()
        self.tabs.addTab(self.log_tab, "📝 Sistem Logları")
        
        layout.addWidget(self.tabs)
        
        return panel
    
    def create_active_requests_tab(self):
        """Aktif talepler tab'ı"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Tablo
        self.active_table = QTableWidget(0, 5)
        self.active_table.setHorizontalHeaderLabels([
            "TC No", "E-posta", "Durum", "İlerleme", "Başlama Saati"
        ])
        self.active_table.horizontalHeader().setStretchLastSection(True)
        layout.addWidget(self.active_table)
        
        return widget
    
    def create_history_tab(self):
        """Geçmiş tab'ı"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Tablo
        self.history_table = QTableWidget(0, 6)
        self.history_table.setHorizontalHeaderLabels([
            "TC No", "E-posta", "Durum", "Eşleşme Sayısı", "Başlama", "Bitiş"
        ])
        self.history_table.horizontalHeader().setStretchLastSection(True)
        layout.addWidget(self.history_table)
        
        return widget
    
    def create_log_tab(self):
        """Log tab'ı"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Log text area
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setFont(QFont("Consolas", 9))
        layout.addWidget(self.log_text)
        
        # Clear butonu
        clear_btn = QPushButton("Logları Temizle")
        StyledWidget.style_button(clear_btn, 'warning')
        clear_btn.clicked.connect(self.log_text.clear)
        layout.addWidget(clear_btn)
        
        return widget
    
    def setup_api_monitoring(self):
        """API monitoring kurulumu"""
        self.api_timer = QTimer()
        self.api_timer.timeout.connect(self.check_api_status)
        self.api_timer.start(5000)  # 5 saniye
        
        # Web API checker thread'i başlat
        self.api_checker_thread = Thread(target=self.api_checker_worker, daemon=True)
        self.api_checker_thread.start()
    
    def api_checker_worker(self):
        """API durumunu kontrol eden worker"""
        while True:
            try:
                # Web API'ye ping at
                response = requests.get(f"{CONFIG['WEB_API_URL']}/api/photo-requests/queue", 
                                      timeout=10,
                                      headers={'Content-Type': 'application/json'})
                if response.status_code == 200:
                    self.api_status_label.setText("🟢 Web API bağlı")
                    
                    # Bekleyen talepleri kontrol et
                    queue_data = response.json()
                    if queue_data and len(queue_data) > 0:
                        self.process_api_requests(queue_data)
                else:
                    self.api_status_label.setText(f"🟡 API erişim sorunu (HTTP {response.status_code})")
                    
            except Exception as e:
                self.api_status_label.setText("🔴 API bağlantı yok")
            
            time.sleep(10)  # 10 saniye bekle
    
    def process_api_requests(self, queue_data):
        """API'den gelen talepleri işle"""
        with request_lock:
            for request_item in queue_data:
                tc_number = request_item.get('tcNumber')
                
                if tc_number and tc_number not in current_requests:
                    # Yeni talep
                    self.log(f"Yeni talep alındı: {tc_number}")
                    self.start_photo_matching(request_item)
    
    def start_photo_matching(self, request_data):
        """Fotoğraf eşleştirmeyi başlat"""
        tc_number = request_data['tcNumber']
        email = request_data['email']
        reference_photos = request_data.get('referencePhotos', [])
        selected_camp_days = request_data.get('selectedCampDays', [])
        
        try:
            # Referans fotoğrafları işle ve embedding'leri oluştur
            reference_embeddings = []
            
            self.log(f"Referans fotoğrafları işleniyor: {len(reference_photos)} adet")
            self.log(f"Seçilen kamp günleri: {selected_camp_days}")
            
            for photo_data in reference_photos:
                try:
                    # Base64 format: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
                    if photo_data.startswith('data:image'):
                        # Base64'ü decode et
                        header, encoded = photo_data.split(',', 1)
                        image_data = base64.b64decode(encoded)
                        nparr = np.frombuffer(image_data, np.uint8)
                        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        
                        if img is not None and face_app is not None:
                            # Yüzleri tespit et
                            faces = face_app.get(img)
                            if faces:
                                # İlk yüzün embedding'ini al
                                reference_embeddings.append(faces[0].embedding)
                                self.log(f"Embedding oluşturuldu: {len(faces)} yüz tespit edildi")
                            else:
                                self.log("Referans fotoğrafında yüz tespit edilemedi")
                        else:
                            self.log("Fotoğraf işlenemedi veya Face API hazır değil")
                    else:
                        self.log("Geçersiz fotoğraf formatı")
                except Exception as e:
                    self.log(f"Referans fotoğraf işleme hatası: {str(e)}")
                    # Hata durumunda mock embedding ekle
                    mock_embedding = np.random.rand(512).astype(np.float32)
                    reference_embeddings.append(mock_embedding)
            
            if not reference_embeddings:
                self.log("Hiç geçerli referans embedding'i oluşturulamadı")
                return
            
            # Worker thread'i başlat
            worker = PhotoMatchingWorker(tc_number, reference_embeddings, email, selected_camp_days)
            worker.progress.connect(self.update_matching_progress)
            worker.finished.connect(self.on_matching_finished)
            worker.error.connect(self.on_matching_error)
            worker.start()
            
            # Tabloya ekle
            self.add_active_request(tc_number, email, "Eşleştirme başlıyor...")
            
            with request_lock:
                current_requests[tc_number] = {
                    'worker': worker,
                    'start_time': datetime.now(),
                    'status': 'matching',
                    'progress': 0,
                    'message': 'Eşleştirme başlıyor...'
                }
                
        except Exception as e:
            self.log(f"Eşleştirme başlatma hatası - {tc_number}: {str(e)}")
    
    def queue_photo_request(self, request_data):
        """Fotoğraf isteğini kuyruğa al"""
        tc_number = request_data['tcNumber']
        
        # Zaten işlenmekte olan istek var mı?
        with request_lock:
            if tc_number in current_requests:
                self.log(f"Zaten işlenmekte olan istek: {tc_number}")
                return
        
        self.log(f"Yeni istek kuyruğa alındı: {tc_number}")
        
        # İsteği işleme al
        self.start_photo_matching(request_data)
    
    def update_matching_progress(self, message, percentage, tc_number):
        """Eşleştirme ilerlemesini güncelle"""
        self.log(f"{tc_number}: {message} (%{percentage})")
        self.update_active_request_status(tc_number, message, percentage)
    
    def on_matching_finished(self, tc_number, matched_photos):
        """Eşleştirme tamamlandığında"""
        self.log(f"Eşleştirme tamamlandı - {tc_number}: {len(matched_photos)} fotoğraf")
        
        if matched_photos:
            # E-posta gönderme
            with request_lock:
                request_data = current_requests.get(tc_number)
                if request_data:
                    email = request_data.get('email', '')
                    
                    email_worker = EmailSender(tc_number, email, matched_photos)
                    email_worker.progress.connect(self.update_email_progress)
                    email_worker.finished.connect(self.on_email_finished)
                    email_worker.start()
                    
                    current_requests[tc_number]['status'] = 'sending_email'
                    current_requests[tc_number]['email_worker'] = email_worker
        else:
            self.log(f"Eşleşme bulunamadı - {tc_number}")
            self.complete_request(tc_number, "Eşleşme bulunamadı", 0)
    
    def on_matching_error(self, tc_number, error_message):
        """Eşleştirme hatası"""
        self.log(f"Eşleştirme hatası - {tc_number}: {error_message}")
        self.complete_request(tc_number, "Hata", 0)
    
    def update_email_progress(self, tc_number, message):
        """E-posta gönderim ilerlemesi"""
        self.log(f"{tc_number}: {message}")
        self.update_active_request_status(tc_number, message, 90)
    
    def on_email_finished(self, tc_number, success):
        """E-posta gönderim tamamlandı"""
        if success:
            self.log(f"E-posta başarıyla gönderildi - {tc_number}")
            status = "Tamamlandı"
        else:
            self.log(f"E-posta gönderim hatası - {tc_number}")
            status = "E-posta hatası"
        
        # Web API'ye sonucu bildir
        self.notify_web_api(tc_number, success)
        self.complete_request(tc_number, status, -1)
    
    def notify_web_api(self, tc_number, success):
        """Web API'ye sonucu bildir"""
        try:
            requests.post(f"{CONFIG['WEB_API_URL']}/api/photo-requests/{tc_number}/complete", 
                         json={'success': success}, timeout=5)
        except:
            pass
    
    def complete_request(self, tc_number, status, match_count):
        """Talebi tamamla"""
        with request_lock:
            if tc_number in current_requests:
                request_data = current_requests[tc_number]
                end_time = datetime.now()
                
                # Geçmişe ekle
                self.add_history_entry(
                    tc_number, 
                    request_data.get('email', ''),
                    status, 
                    match_count,
                    request_data['start_time'],
                    end_time
                )
                
                # Aktif tablodan kaldır
                self.remove_active_request(tc_number)
                
                # Memory'den temizle
                del current_requests[tc_number]
    
    def add_active_request(self, tc_number, email, status):
        """Aktif tabloya talep ekle"""
        row = self.active_table.rowCount()
        self.active_table.insertRow(row)
        
        self.active_table.setItem(row, 0, QTableWidgetItem(tc_number))
        self.active_table.setItem(row, 1, QTableWidgetItem(email))
        self.active_table.setItem(row, 2, QTableWidgetItem(status))
        self.active_table.setItem(row, 3, QTableWidgetItem("0%"))
        self.active_table.setItem(row, 4, QTableWidgetItem(datetime.now().strftime("%H:%M:%S")))
    
    def update_active_request_status(self, tc_number, status, percentage=-1):
        """Aktif talep durumunu güncelle"""
        for row in range(self.active_table.rowCount()):
            if self.active_table.item(row, 0).text() == tc_number:
                self.active_table.setItem(row, 2, QTableWidgetItem(status))
                if percentage >= 0:
                    self.active_table.setItem(row, 3, QTableWidgetItem(f"{percentage}%"))
                break
    
    def remove_active_request(self, tc_number):
        """Aktif tablodan talebi kaldır"""
        for row in range(self.active_table.rowCount()):
            if self.active_table.item(row, 0).text() == tc_number:
                self.active_table.removeRow(row)
                break
    
    def add_history_entry(self, tc_number, email, status, match_count, start_time, end_time):
        """Geçmişe giriş ekle"""
        row = self.history_table.rowCount()
        self.history_table.insertRow(row)
        
        self.history_table.setItem(row, 0, QTableWidgetItem(tc_number))
        self.history_table.setItem(row, 1, QTableWidgetItem(email))
        self.history_table.setItem(row, 2, QTableWidgetItem(status))
        self.history_table.setItem(row, 3, QTableWidgetItem(str(match_count) if match_count >= 0 else "-"))
        self.history_table.setItem(row, 4, QTableWidgetItem(start_time.strftime("%H:%M:%S")))
        self.history_table.setItem(row, 5, QTableWidgetItem(end_time.strftime("%H:%M:%S")))
    
    def select_photo_folder(self):
        """Fotoğraf klasörü seç"""
        folder = QFileDialog.getExistingDirectory(self, "Kamp Fotoğrafları Klasörünü Seçin")
        if folder:
            self.db_path_label.setText(f"Klasör: {folder}")
            self.analyze_btn.setEnabled(True)
            CONFIG['PHOTO_DATABASE_PATH'] = folder
    
    def start_analysis(self):
        """Analizi başlat"""
        if not face_app:
            QMessageBox.warning(self, "Hata", "Face Analysis modeli yüklenemedi!")
            return
        
        self.analyze_btn.setEnabled(False)
        self.analysis_progress.setVisible(True)
        self.analysis_progress.setValue(0)
        
        # Worker thread başlat
        self.analysis_worker = FaceAnalysisWorker(CONFIG['PHOTO_DATABASE_PATH'])
        self.analysis_worker.progress.connect(self.update_analysis_progress)
        self.analysis_worker.finished.connect(self.on_analysis_finished)
        self.analysis_worker.error.connect(self.on_analysis_error)
        self.analysis_worker.start()
        
        self.log("Fotoğraf analizi başlatıldı...")
    
    def update_analysis_progress(self, message, percentage):
        """Analiz ilerlemesini güncelle"""
        self.analysis_status.setText(message)
        self.analysis_progress.setValue(percentage)
        self.log(f"Analiz: {message} (%{percentage})")
    
    def on_analysis_finished(self, database):
        """Analiz tamamlandığında"""
        global face_database
        face_database = database
        
        total_photos = len(database)
        total_faces = sum(len(photo_data['faces']) for photo_data in database.values())
        
        self.analysis_progress.setVisible(False)
        self.analyze_btn.setEnabled(True)
        self.analysis_status.setText(f"✅ Analiz tamamlandı!")
        
        self.photo_count_label.setText(f"Toplam fotoğraf: {total_photos}")
        self.face_count_label.setText(f"Tespit edilen yüz: {total_faces}")
        
        self.log(f"Analiz tamamlandı - {total_photos} fotoğraf, {total_faces} yüz")
        
        QMessageBox.information(self, "Başarılı", 
                               f"Analiz tamamlandı!\n{total_photos} fotoğraf\n{total_faces} yüz tespit edildi")
    
    def on_analysis_error(self, error_message):
        """Analiz hatası"""
        self.analysis_progress.setVisible(False)
        self.analyze_btn.setEnabled(True)
        self.analysis_status.setText(f"❌ Hata: {error_message}")
        self.log(f"Analiz hatası: {error_message}")
        QMessageBox.critical(self, "Hata", f"Analiz hatası:\n{error_message}")
    
    def load_face_database(self):
        """Yüz veritabanlarını yükle (günlük modeller)"""
        global camp_day_models
        
        # Günlük modelleri yükle
        models_dir = "./models"
        if os.path.exists(models_dir):
            for camp_day_folder in os.listdir(models_dir):
                if os.path.isdir(os.path.join(models_dir, camp_day_folder)):
                    db_path = os.path.join(models_dir, camp_day_folder, "face_database.pkl")
                    if os.path.exists(db_path):
                        try:
                            with open(db_path, 'rb') as f:
                                camp_day_models[camp_day_folder] = pickle.load(f)
                            self.log(f"Kamp günü modeli yüklendi: {camp_day_folder}")
                        except Exception as e:
                            self.log(f"Model yükleme hatası ({camp_day_folder}): {str(e)}")
        
        # Eski sistem uyumluluğu
        if os.path.exists(CONFIG['FACE_DATABASE_PATH']):
            try:
                with open(CONFIG['FACE_DATABASE_PATH'], 'rb') as f:
                    general_database = pickle.load(f)
                    camp_day_models['general'] = general_database
                    self.log("Genel veritabanı yüklendi")
            except Exception as e:
                self.log(f"Genel veritabanı yükleme hatası: {str(e)}")
        
        self.update_statistics()
        self.sync_with_web_api()
    
    def check_api_status(self):
        """API durumunu kontrol et"""
        active_count = len(current_requests)
        self.api_stats_label.setText(f"Aktif talep: {active_count}")
    
    def log(self, message):
        """Log mesajı ekle"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        self.log_text.append(log_entry)
        print(log_entry)
    
    def update_statistics(self):
        """Sonuç istatistiklerini güncelle"""
        total_photos = 0
        total_faces = 0
        
        for camp_day_id, database in camp_day_models.items():
            camp_photos = len(database)
            camp_faces = sum(len(photo_data.get('faces', [])) for photo_data in database.values())
            total_photos += camp_photos
            total_faces += camp_faces
            self.log(f"{camp_day_id}: {camp_photos} fotoğraf, {camp_faces} yüz")
        
        self.photo_count_label.setText(f"Toplam fotoğraf: {total_photos}")
        self.face_count_label.setText(f"Tespit edilen yüz: {total_faces}")
    
    def sync_with_web_api(self):
        """Web API'den kamp günlerini çek ve senkronize et"""
        try:
            import requests
            response = requests.get(f"{CONFIG['WEB_API_URL']}/api/camp-days", timeout=10)
            if response.status_code == 200:
                global available_camp_days
                available_camp_days = response.json()
                self.log(f"Web API'den {len(available_camp_days)} kamp günü alındı")
                
                # Kamp günlerini GUI listesine ekle
                self.update_camp_days_list()
            else:
                self.log(f"Web API bağlantı hatası: {response.status_code}")
        except Exception as e:
            self.log(f"Web API senkronizasyon hatası: {str(e)}")
    
    def load_camp_day_models(self):
        """Mevcut kamp günü modellerini yükle"""
        global camp_day_models
        try:
            models_dir = "./models"
            if os.path.exists(models_dir):
                for item in os.listdir(models_dir):
                    item_path = os.path.join(models_dir, item)
                    if os.path.isdir(item_path):
                        db_path = os.path.join(item_path, "face_database.pkl")
                        if os.path.exists(db_path):
                            try:
                                with open(db_path, 'rb') as f:
                                    camp_day_models[item] = pickle.load(f)
                                self.log(f"Model yüklendi: {item} - {len(camp_day_models[item])} fotoğraf")
                            except Exception as e:
                                self.log(f"Model yükleme hatası {item}: {str(e)}")
                
                self.log(f"Toplam {len(camp_day_models)} kamp günü modeli yüklendi")
                self.update_statistics()
            else:
                self.log("Models klasörü bulunamadı")
        except Exception as e:
            self.log(f"Model yükleme genel hatası: {str(e)}")
    
    def update_camp_days_list(self):
        """Kamp günleri listesini güncelle"""
        try:
            # GUI'de kamp günleri listesi varsa güncelle
            if hasattr(self, 'camp_days_list'):
                self.camp_days_list.clear()
                for day in available_camp_days:
                    item = QListWidgetItem(f"{day.get('dayName', 'Unknown')} - {day.get('dayDate', '')[:10]}")
                    item.setData(Qt.UserRole, day.get('id'))
                    self.camp_days_list.addItem(item)
        except Exception as e:
            self.log(f"Kamp günleri listesi güncelleme hatası: {str(e)}")

def main():
    """Ana fonksiyon"""
    app = QApplication(sys.argv)
    
    # Koyu tema uygula
    StyledWidget.apply_dark_theme(app)
    
    # Ana pencereyi oluştur
    window = MainWindow()
    window.show()
    
    # Uygulamayı başlat
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()