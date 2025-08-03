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

# AK Parti renk şeması (HSL değerleri)
AK_COLORS = {
    'YELLOW': '#F59E0B',        # hsl(37, 100%, 47%) - AK Parti sarısı
    'YELLOW_DARK': '#D97706',   # hsl(37, 100%, 38%) - Koyu sarı
    'BLUE': '#1E88E5',          # hsl(209, 100%, 40%) - AK Parti mavisi
    'BLUE_DARK': '#1565C0',     # hsl(209, 100%, 35%) - Koyu mavi
    'TEXT': '#1F2937',          # hsl(12, 8%, 14%) - Ana metin
    'GRAY': '#6B7280',          # hsl(0, 0%, 40%) - Gri metin
    'LIGHT_GRAY': '#F3F4F6',    # hsl(0, 0%, 96%) - Açık gri
    'WHITE': '#FFFFFF',
    'BLACK': '#000000',
    'SUCCESS': '#10B981',
    'ERROR': '#EF4444',
    'WARNING': '#F59E0B'
}

# Global değişkenler
face_app = None
camp_day_models = {}  # Her kamp günü için ayrı model: {camp_day_id: face_database}
processing_queue = queue.Queue()
current_requests = {}
request_lock = Lock()
available_camp_days = []  # Web'den çekilecek kamp günleri listesi
api_connection_status = {'connected': False, 'last_check': None, 'error': None}

def fetch_camp_days_from_api():
    """Web API'den kamp günlerini çek"""
    global available_camp_days, api_connection_status
    try:
        response = requests.get(f"{CONFIG['WEB_API_URL']}/api/camp-days", timeout=10)
        if response.status_code == 200:
            camp_days_data = response.json()
            available_camp_days = camp_days_data
            api_connection_status = {
                'connected': True,
                'last_check': datetime.now(),
                'error': None
            }
            print(f"Kamp günleri başarıyla yüklendi: {len(available_camp_days)} gün")
            return True
        else:
            api_connection_status = {
                'connected': False,
                'last_check': datetime.now(),
                'error': f"HTTP {response.status_code}"
            }
            return False
    except Exception as e:
        api_connection_status = {
            'connected': False,
            'last_check': datetime.now(),
            'error': str(e)
        }
        print(f"Kamp günleri yüklenirken hata: {str(e)}")
        return False

def test_api_connection():
    """API bağlantısını test et"""
    try:
        response = requests.get(f"{CONFIG['WEB_API_URL']}/api/python/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            api_connection_status.update({
                'connected': True,
                'last_check': datetime.now(),
                'error': None,
                'queue_size': data.get('queueSize', 0),
                'processing': data.get('processing', 0)
            })
            return True
        else:
            api_connection_status.update({
                'connected': False,
                'last_check': datetime.now(),
                'error': f"HTTP {response.status_code}"
            })
            return False
    except Exception as e:
        api_connection_status.update({
            'connected': False,
            'last_check': datetime.now(),
            'error': str(e)
        })
        return False

class StyledWidget:
    """AK Parti tasarımına uygun modern görünüm"""
    
    @staticmethod
    def apply_ak_theme(app):
        """AK Parti tema uygula"""
        palette = QPalette()
        # Açık tema (AK Parti web sitesi gibi)
        palette.setColor(QPalette.Window, QColor(255, 255, 255))  # Beyaz arkaplan
        palette.setColor(QPalette.WindowText, QColor(31, 41, 55))  # Ana metin
        palette.setColor(QPalette.Base, QColor(255, 255, 255))  # Input arkaplanı
        palette.setColor(QPalette.AlternateBase, QColor(243, 244, 246))  # Açık gri
        palette.setColor(QPalette.ToolTipBase, QColor(255, 255, 255))
        palette.setColor(QPalette.ToolTipText, QColor(31, 41, 55))
        palette.setColor(QPalette.Text, QColor(31, 41, 55))
        palette.setColor(QPalette.Button, QColor(255, 255, 255))
        palette.setColor(QPalette.ButtonText, QColor(31, 41, 55))
        palette.setColor(QPalette.BrightText, QColor(239, 68, 68))  # Hata rengi
        palette.setColor(QPalette.Link, QColor(30, 136, 229))  # AK mavi
        palette.setColor(QPalette.Highlight, QColor(245, 158, 11))  # AK sarı
        palette.setColor(QPalette.HighlightedText, QColor(255, 255, 255))
        app.setPalette(palette)
    
    @staticmethod
    def create_card_frame():
        """Modern kart görünümü oluştur (AK Parti stili)"""
        frame = QFrame()
        frame.setFrameStyle(QFrame.Box)
        frame.setStyleSheet(f"""
            QFrame {{
                border: 1px solid #E5E7EB;
                border-radius: 12px;
                background-color: {AK_COLORS['WHITE']};
                margin: 8px;
                padding: 16px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }}
        """)
        return frame
    
    @staticmethod
    def style_button(button, color='primary'):
        """AK Parti stili butonlar"""
        colors = {
            'primary': f'background-color: {AK_COLORS["YELLOW"]}; color: white;',
            'secondary': f'background-color: {AK_COLORS["BLUE"]}; color: white;',
            'success': f'background-color: {AK_COLORS["SUCCESS"]}; color: white;',
            'warning': f'background-color: {AK_COLORS["WARNING"]}; color: white;',
            'danger': f'background-color: {AK_COLORS["ERROR"]}; color: white;',
            'outline': f'background-color: transparent; color: {AK_COLORS["YELLOW"]}; border: 2px solid {AK_COLORS["YELLOW"]};',
        }
        
        hover_colors = {
            'primary': AK_COLORS['YELLOW_DARK'],
            'secondary': AK_COLORS['BLUE_DARK'],
            'success': '#059669',
            'warning': '#D97706',
            'danger': '#DC2626',
            'outline': AK_COLORS['YELLOW_DARK'],
        }
        
        button.setStyleSheet(f"""
            QPushButton {{
                {colors.get(color, colors['primary'])}
                border: none;
                border-radius: 8px;
                padding: 12px 24px;
                font-weight: 600;
                font-size: 14px;
                font-family: 'Segoe UI', Arial, sans-serif;
                min-height: 20px;
            }}
            QPushButton:hover {{
                background-color: {hover_colors.get(color, hover_colors['primary'])};
                transform: translateY(-1px);
            }}
            QPushButton:pressed {{
                transform: translateY(0px);
            }}
            QPushButton:disabled {{
                background-color: #D1D5DB;
                color: #9CA3AF;
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
                    faces = face_app.get(img) if face_app else None
                    
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

class MainWindow(QMainWindow):
    """Ana pencere sınıfı - AK Parti stili arayüz"""
    
    def __init__(self):
        super().__init__()
        self.processed_requests_count = 0
        self.init_face_analysis()
        self.setup_ui()
        self.setup_api_monitoring()
        self.load_face_database()
        self.load_camp_day_models()
        
        # İlk yükleme
        QTimer.singleShot(2000, self.initial_setup)  # 2 saniye sonra başlat
    
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
        """Kullanıcı arayüzü kurulumu - AK Parti stili - Basitleştirilmiş"""
        self.setWindowTitle("AK Parti Gençlik Kolları - Kamp Fotoğraf Sistemi")
        self.setGeometry(100, 100, 1400, 900)
        self.setWindowIcon(QIcon("./assets/akparti_icon.png"))
        
        # Ana widget
        central_widget = QWidget()
        central_widget.setStyleSheet(f"background-color: {AK_COLORS['LIGHT_GRAY']};")
        self.setCentralWidget(central_widget)
        
        # Ana layout - Dikey
        main_layout = QVBoxLayout(central_widget)
        main_layout.setSpacing(0)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        # Başlık çubuğu
        header = self.create_header()
        main_layout.addWidget(header)
        
        # İçerik alanı - Yatay
        content_widget = QWidget()
        content_layout = QHBoxLayout(content_widget)
        content_layout.setSpacing(16)
        content_layout.setContentsMargins(16, 16, 16, 16)
        
        # Sol panel - Temizlenmiş kontroller
        left_panel = self.create_simplified_control_panel()
        content_layout.addWidget(left_panel, 1)
        
        # Sağ panel - Monitoring
        right_panel = self.create_monitoring_panel()
        content_layout.addWidget(right_panel, 2)
        
        main_layout.addWidget(content_widget)
    
    def create_header(self):
        """AK Parti stili başlık çubuğu"""
        header = QFrame()
        header.setFixedHeight(80)
        header.setStyleSheet(f"""
            QFrame {{
                background: linear-gradient(135deg, {AK_COLORS['YELLOW']} 0%, {AK_COLORS['BLUE']} 100%);
                border: none;
                border-bottom: 3px solid {AK_COLORS['YELLOW_DARK']};
            }}
        """)
        
        layout = QHBoxLayout(header)
        layout.setContentsMargins(20, 10, 20, 10)
        
        # Logo ve başlık container'ı
        title_container = QWidget()
        title_container_layout = QVBoxLayout(title_container)
        title_container_layout.setContentsMargins(0, 0, 0, 0)
        title_container_layout.setSpacing(0)
        
        # Ana başlık
        title = QLabel("🏛️ AK Parti Gençlik Kolları")
        title.setFont(QFont("Arial", 18, QFont.Bold))
        title.setStyleSheet("color: white; font-weight: bold;")
        title_container_layout.addWidget(title)
        
        # Alt başlık
        subtitle = QLabel("Kamp Fotoğraf Yüz Tanıma Sistemi")
        subtitle.setFont(QFont("Arial", 12))
        subtitle.setStyleSheet("color: white; margin-top: 5px;")
        title_container_layout.addWidget(subtitle)
        
        layout.addWidget(title_container)
        layout.addStretch()
        
        # Sağ taraf - API durum indikatörü
        self.header_api_status = QLabel("🔄 Bağlantı kontrol ediliyor...")
        self.header_api_status.setFont(QFont("Arial", 10))
        self.header_api_status.setStyleSheet("color: white; padding: 5px;")
        layout.addWidget(self.header_api_status)
        
        return header
    
    def create_simplified_control_panel(self):
        """Basitleştirilmiş sol kontrol paneli"""
        panel = StyledWidget.create_card_frame()
        layout = QVBoxLayout(panel)
        
        # Başlık
        title = QLabel("🎯 Sistem Kontrol Paneli")
        title.setFont(QFont("Arial", 16, QFont.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        # API Bağlantı Durumu - Üstte ve net
        api_group = QGroupBox("🌐 Web API Bağlantı Durumu")
        api_layout = QVBoxLayout(api_group)
        
        self.api_status_label = QLabel("🔄 Bağlantı kontrol ediliyor...")
        self.api_status_label.setFont(QFont("Arial", 12, QFont.Bold))
        api_layout.addWidget(self.api_status_label)
        
        # Bağlantı test butonu
        test_connection_btn = QPushButton("🔄 Bağlantıyı Test Et")
        StyledWidget.style_button(test_connection_btn, 'secondary')
        test_connection_btn.clicked.connect(self.test_api_connection_ui)
        api_layout.addWidget(test_connection_btn)
        
        layout.addWidget(api_group)
        
        # Kamp Günleri - Net gösterim
        camp_days_group = QGroupBox("📅 Mevcut Kamp Günleri")
        camp_days_layout = QVBoxLayout(camp_days_group)
        
        # Durum etiketi
        self.camp_status_label = QLabel("📊 Kamp günleri yükleniyor...")
        self.camp_status_label.setFont(QFont("Arial", 10))
        camp_days_layout.addWidget(self.camp_status_label)
        
        # Kamp günleri listesi
        self.camp_days_list = QListWidget()
        self.camp_days_list.setMaximumHeight(150)
        self.camp_days_list.setStyleSheet(f"""
            QListWidget {{
                border: 1px solid {AK_COLORS['GRAY']};
                border-radius: 8px;
                background-color: white;
                padding: 5px;
                font-size: 12px;
            }}
            QListWidget::item {{
                padding: 8px;
                margin: 2px;
                border-radius: 6px;
            }}
            QListWidget::item:selected {{
                background-color: {AK_COLORS['YELLOW']};
                color: white;
            }}
        """)
        camp_days_layout.addWidget(self.camp_days_list)
        
        # Yenileme butonu
        refresh_camp_days_btn = QPushButton("🔄 Kamp Günlerini Yenile")
        StyledWidget.style_button(refresh_camp_days_btn, 'primary')
        refresh_camp_days_btn.clicked.connect(self.fetch_camp_days_ui)
        camp_days_layout.addWidget(refresh_camp_days_btn)
        
        layout.addWidget(camp_days_group)
        
        # Fotoğraf Veritabanı Yönetimi
        db_group = QGroupBox("📁 Fotoğraf Veritabanı")
        db_layout = QVBoxLayout(db_group)
        
        self.db_path_label = QLabel("Klasör: Henüz seçilmedi")
        self.db_path_label.setWordWrap(True)
        self.db_path_label.setFont(QFont("Arial", 9))
        db_layout.addWidget(self.db_path_label)
        
        select_folder_btn = QPushButton("📂 Fotoğraf Klasörü Seç")
        StyledWidget.style_button(select_folder_btn, 'outline')
        select_folder_btn.clicked.connect(self.select_photo_folder)
        db_layout.addWidget(select_folder_btn)
        
        self.analyze_btn = QPushButton("🔍 Analizi Başlat")
        StyledWidget.style_button(self.analyze_btn, 'success')
        self.analyze_btn.clicked.connect(self.start_analysis)
        self.analyze_btn.setEnabled(False)
        db_layout.addWidget(self.analyze_btn)
        
        self.analysis_progress = QProgressBar()
        self.analysis_progress.setVisible(False)
        db_layout.addWidget(self.analysis_progress)
        
        self.analysis_status = QLabel("")
        self.analysis_status.setWordWrap(True)
        self.analysis_status.setFont(QFont("Arial", 9))
        db_layout.addWidget(self.analysis_status)
        
        layout.addWidget(db_group)
        
        # Sistem İstatistikleri - Kompakt
        stats_group = QGroupBox("📊 Sistem İstatistikleri")
        stats_layout = QVBoxLayout(stats_group)
        
        self.face_count_label = QLabel("👤 Tespit edilen yüz: 0")
        self.face_count_label.setFont(QFont("Arial", 10))
        stats_layout.addWidget(self.face_count_label)
        
        self.photo_count_label = QLabel("📷 Toplam fotoğraf: 0")
        self.photo_count_label.setFont(QFont("Arial", 10))
        stats_layout.addWidget(self.photo_count_label)
        
        self.processed_requests_label = QLabel("✅ İşlenen talep: 0")
        self.processed_requests_label.setFont(QFont("Arial", 10))
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
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
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
        if self.active_table.horizontalHeader():
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
        if self.history_table.horizontalHeader():
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
        clear_btn = QPushButton("🗑️ Logları Temizle")
        StyledWidget.style_button(clear_btn, 'warning')
        clear_btn.clicked.connect(self.log_text.clear)
        layout.addWidget(clear_btn)
        
        return widget
    
    def setup_api_monitoring(self):
        """API monitoring kurulumu - Basitleştirilmiş"""
        # Sadece kamp günleri için timer
        self.camp_days_timer = QTimer()
        self.camp_days_timer.timeout.connect(self.fetch_camp_days_ui)
        self.camp_days_timer.start(60000)  # 60 saniyede bir güncelle
        
        # API test için ayrı timer - daha seyrek
        self.api_timer = QTimer()
        self.api_timer.timeout.connect(self.test_api_connection_ui)
        self.api_timer.start(30000)  # 30 saniyede bir test et
    
    def test_api_connection_ui(self):
        """UI için API bağlantı testi - Basitleştirilmiş"""
        try:
            success = test_api_connection()
            if success:
                status_text = "🟢 Web API Bağlı ve Hazır"
                self.header_api_status.setText(status_text)
                self.api_status_label.setText(status_text)
                self.log("Web API bağlantısı başarılı")
            else:
                status_text = "🔴 Web API Bağlantı Sorunu"
                self.header_api_status.setText(status_text)
                self.api_status_label.setText(status_text)
                self.log("Web API bağlantısı başarısız")
        except Exception as e:
            error_text = f"🔴 Bağlantı Hatası"
            self.header_api_status.setText(error_text)
            self.api_status_label.setText(error_text)
            self.log(f"API bağlantı hatası: {str(e)}")
    
    def fetch_camp_days_ui(self):
        """UI için kamp günlerini çek"""
        try:
            success = fetch_camp_days_from_api()
            if success:
                self.update_camp_days_list()
                self.log(f"Kamp günleri güncellendi: {len(available_camp_days)} gün")
            else:
                self.log("Kamp günleri yüklenemedi")
                self.update_camp_days_list()  # Boş listeyi güncelle
        except Exception as e:
            self.log(f"Kamp günleri yükleme hatası: {str(e)}")
            self.update_camp_days_list()  # Boş listeyi güncelle
    
    def update_camp_days_list(self):
        """Kamp günleri listesini güncelle"""
        try:
            self.camp_days_list.clear()
            
            if not available_camp_days:
                # Boş durum - Net mesaj
                item = QListWidgetItem("📭 Henüz kamp günü eklenmemiş")
                item.setData(Qt.ItemDataRole.UserRole, None)
                item.setFont(QFont("Arial", 10, QFont.Italic))
                self.camp_days_list.addItem(item)
                self.camp_status_label.setText("⚠️ Web sunucusunda kamp günü bulunamadı")
                return
            
            # Mevcut kamp günlerini listele
            for camp_day in available_camp_days:
                camp_id = camp_day.get('id', 'unknown')
                camp_name = camp_day.get('name', f'Kamp Günü {camp_id[:8]}')
                camp_date = camp_day.get('date', 'Tarih bilinmiyor')
                
                item_text = f"📅 {camp_name} ({camp_date})"
                item = QListWidgetItem(item_text)
                item.setData(Qt.ItemDataRole.UserRole, camp_id)
                
                # Model durumunu kontrol et
                if camp_id in camp_day_models:
                    item.setToolTip(f"✅ Model hazır: {len(camp_day_models[camp_id])} fotoğraf")
                else:
                    item.setToolTip("⚠️ Model yüklenmemiş")
                
                self.camp_days_list.addItem(item)
            
            # Durum güncelle
            model_count = len(camp_day_models)
            total_camps = len(available_camp_days)
            self.camp_status_label.setText(f"✅ {len(available_camp_days)} kamp günü mevcut | {model_count}/{total_camps} model hazır")
            
        except Exception as e:
            self.log(f"Kamp günleri liste güncelleme hatası: {str(e)}")
            self.camp_status_label.setText("❌ Liste güncelleme hatası")
    
    def initial_setup(self):
        """İlk kurulum işlemleri"""
        self.test_api_connection_ui()
        self.fetch_camp_days_ui()
        self.log("🚀 AK Parti Fotoğraf Sistemi başlatıldı ve hazır!")
    
    def log(self, message):
        """Log mesajı ekle"""
        try:
            if hasattr(self, 'log_text') and self.log_text:
                timestamp = datetime.now().strftime("%H:%M:%S")
                self.log_text.append(f"[{timestamp}] {message}")
                # Scroll to bottom
                cursor = self.log_text.textCursor()
                cursor.movePosition(cursor.End)
                self.log_text.setTextCursor(cursor)
            else:
                print(f"Log: {message}")
        except Exception as e:
            print(f"Log hatası: {e} - Mesaj: {message}")
    
    def select_photo_folder(self):
        """Fotoğraf klasörü seç"""
        folder = QFileDialog.getExistingDirectory(self, "Fotoğraf Klasörü Seçin")
        if folder:
            self.photo_folder = folder
            self.db_path_label.setText(f"Klasör: {folder}")
            self.analyze_btn.setEnabled(True)
            self.log(f"📁 Fotoğraf klasörü seçildi: {folder}")
    
    def start_analysis(self):
        """Fotoğraf analizi başlat"""
        if not hasattr(self, 'photo_folder'):
            QMessageBox.warning(self, "Uyarı", "Önce bir fotoğraf klasörü seçin!")
            return
        
        self.log("🔍 Fotoğraf analizi başlatılıyor...")
        self.analysis_progress.setVisible(True)
        self.analyze_btn.setEnabled(False)
        
        # Worker thread başlat
        self.analysis_worker = FaceAnalysisWorker(self.photo_folder)
        self.analysis_worker.progress.connect(self.update_analysis_progress)
        self.analysis_worker.finished.connect(self.analysis_finished)
        self.analysis_worker.error.connect(self.analysis_error)
        self.analysis_worker.start()
    
    def update_analysis_progress(self, message, progress):
        """Analiz ilerlemesini güncelle"""
        self.analysis_status.setText(message)
        self.analysis_progress.setValue(progress)
        self.log(f"İlerleme: {progress}% - {message}")
    
    def analysis_finished(self, result):
        """Analiz tamamlandı"""
        self.analysis_progress.setVisible(False)
        self.analyze_btn.setEnabled(True)
        
        face_count = sum(len(data.get('faces', [])) for data in result.values())
        photo_count = len(result)
        
        self.face_count_label.setText(f"👤 Tespit edilen yüz: {face_count}")
        self.photo_count_label.setText(f"📷 Toplam fotoğraf: {photo_count}")
        
        self.log(f"✅ Analiz tamamlandı! {photo_count} fotoğraf, {face_count} yüz tespit edildi")
        
        QMessageBox.information(self, "Başarılı", 
                               f"Analiz tamamlandı!\n\n"
                               f"📷 Fotoğraf: {photo_count}\n"
                               f"👤 Yüz: {face_count}")
    
    def analysis_error(self, error):
        """Analiz hatası"""
        self.analysis_progress.setVisible(False)
        self.analyze_btn.setEnabled(True)
        self.log(f"❌ Analiz hatası: {error}")
        QMessageBox.critical(self, "Hata", f"Analiz sırasında hata oluştu:\n{error}")
    
    def load_face_database(self):
        """Yüz veritabanını yükle"""
        try:
            if os.path.exists(CONFIG['FACE_DATABASE_PATH']):
                with open(CONFIG['FACE_DATABASE_PATH'], 'rb') as f:
                    global face_database
                    face_database = pickle.load(f)
                self.log(f"📚 Yüz veritabanı yüklendi: {len(face_database)} kayıt")
            else:
                self.log("📂 Yüz veritabanı bulunamadı, yeni oluşturulacak")
        except Exception as e:
            self.log(f"❌ Yüz veritabanı yükleme hatası: {str(e)}")
    
    def load_camp_day_models(self):
        """Kamp günü modellerini yükle"""
        try:
            models_dir = "./models"
            if os.path.exists(models_dir):
                for camp_day_dir in os.listdir(models_dir):
                    model_path = os.path.join(models_dir, camp_day_dir, "face_database.pkl")
                    if os.path.exists(model_path):
                        with open(model_path, 'rb') as f:
                            camp_day_models[camp_day_dir] = pickle.load(f)
                self.log(f"🧠 Kamp günü modelleri yüklendi: {len(camp_day_models)} model")
            else:
                self.log("📁 Model dizini bulunamadı")
        except Exception as e:
            self.log(f"❌ Kamp günü modelleri yükleme hatası: {str(e)}")
    
    def add_active_request(self, tc_number, email, status):
        """Aktif talep tablosuna ekle"""
        try:
            row = self.active_table.rowCount()
            self.active_table.insertRow(row)
            
            self.active_table.setItem(row, 0, QTableWidgetItem(tc_number))
            self.active_table.setItem(row, 1, QTableWidgetItem(email))
            self.active_table.setItem(row, 2, QTableWidgetItem(status))
            self.active_table.setItem(row, 3, QTableWidgetItem("0%"))
            self.active_table.setItem(row, 4, QTableWidgetItem(datetime.now().strftime("%H:%M:%S")))
        except Exception as e:
            self.log(f"❌ Aktif talep ekleme hatası: {str(e)}")

def main():
    """Ana fonksiyon"""
    app = QApplication(sys.argv)
    
    # AK Parti tema uygula
    StyledWidget.apply_ak_theme(app)
    
    # Ana pencereyi oluştur
    window = MainWindow()
    window.show()
    
    # Uygulamayı başlat
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()