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
from datetime import datetime
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QFileDialog, QMessageBox,
    QPushButton, QLabel, QVBoxLayout, QHBoxLayout,
    QWidget, QListWidget, QListWidgetItem, QAbstractItemView,
    QProgressBar, QGroupBox, QTextEdit, QSizePolicy, QFrame,
    QLineEdit
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QSize, QTimer
from PyQt5.QtGui import QPixmap, QImage, QIcon, QFont
try:
    from insightface.app import FaceAnalysis
except ImportError:
    FaceAnalysis = None

# Uyarıları bastır
warnings.filterwarnings("ignore", category=FutureWarning, message=".*rcond parameter.*")
warnings.filterwarnings("ignore", category=RuntimeWarning)

class TrainingWorker(QThread):
    """Yüz veritabanı eğitimi için worker thread"""
    progress = pyqtSignal(str, int)  # mesaj, yüzde
    log_message = pyqtSignal(str)
    finished = pyqtSignal(dict, str, str)  # face_database, folder_path, model_name
    error = pyqtSignal(str)

    def __init__(self, folder_path, model_name, recursive=True):
        super().__init__()
        self.folder_path = folder_path
        self.model_name = model_name
        self.recursive = recursive
        self.face_app = None
        
    def run(self):
        try:
            self.log_message.emit("🚀 Eğitim süreci başlatılıyor...")
            self.progress.emit("Face Recognition modeli yükleniyor...", 5)
            
            # GPU/CPU kontrolü ve FaceAnalysis başlatma
            try:
                ctx_id = 0 if torch.cuda.is_available() else -1
            except:
                ctx_id = -1
            device_type = "GPU (CUDA)" if ctx_id >= 0 else "CPU"
            
            self.log_message.emit(f"💻 Cihaz türü: {device_type}")
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if ctx_id >= 0 else ['CPUExecutionProvider']
            
            try:
                self.face_app = FaceAnalysis(name='buffalo_l', providers=providers)
                self.face_app.prepare(ctx_id=ctx_id, det_size=(640, 640))
                self.log_message.emit("✅ Face Recognition modeli başarıyla yüklendi")
            except Exception as e:
                self.log_message.emit("⚠️ GPU başlatılamadı, CPU'ya geçiliyor...")
                self.face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
                self.face_app.prepare(ctx_id=-1, det_size=(640, 640))
                
            self.progress.emit("Eğitim verisi taranıyor...", 10)
            
            # Klasördeki tüm resimleri bul
            files = []
            if self.recursive:
                for root, _, fs in os.walk(self.folder_path):
                    for f in fs:
                        if f.lower().endswith(('.jpg', '.png', '.jpeg', '.bmp', '.tiff')):
                            files.append(os.path.join(root, f))
            else:
                for f in os.listdir(self.folder_path):
                    if f.lower().endswith(('.jpg', '.png', '.jpeg', '.bmp', '.tiff')):
                        files.append(os.path.join(self.folder_path, f))

            total_files = len(files)
            self.log_message.emit(f"📁 Toplam {total_files} resim dosyası bulundu")
            
            if total_files == 0:
                self.error.emit("Seçilen klasörde hiç resim dosyası bulunamadı!")
                return
                
            self.progress.emit("Yüz tespiti ve encoding başlıyor...", 15)
            
            face_database = {}
            processed_files = 0
            total_faces = 0
            failed_files = 0

            for idx, file_path in enumerate(files):
                try:
                    # İlerleme güncelleme
                    progress_percent = 15 + int((idx / total_files) * 70)
                    file_name = os.path.basename(file_path)
                    self.progress.emit(f"İşleniyor: {file_name}", progress_percent)
                    
                    # Resmi yükle
                    with open(file_path, 'rb') as f:
                        img_data = np.frombuffer(f.read(), np.uint8)
                    img = cv2.imdecode(img_data, cv2.IMREAD_COLOR)
                    
                    if img is None:
                        self.log_message.emit(f"❌ Resim okunamadı: {file_name}")
                        failed_files += 1
                        continue

                    # BGR'den RGB'ye çevir
                    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

                    # Yüz tespiti ve embedding extraction
                    faces = self.face_app.get(rgb)
                    
                    if not faces:
                        self.log_message.emit(f"👤 Yüz bulunamadı: {file_name}")
                        continue

                    # Her yüz için embedding kaydet
                    file_faces = 0
                    for face_idx, face in enumerate(faces):
                        embedding = face.normed_embedding.astype('float32')
                        
                        # Models klasörüne uyumlu relative path oluştur
                        relative_path = os.path.relpath(file_path, self.folder_path)
                        # Windows backslash'leri forward slash'e çevir (cross-platform)
                        relative_path = relative_path.replace('\\', '/')
                        
                        # Benzersiz anahtar oluştur (relative path ile)
                        key = f"{relative_path}||face_{face_idx}"
                        face_database[key] = {
                            'embedding': embedding,
                            'path': relative_path,  # Relative path kaydet
                            'bbox': face.bbox.tolist(),
                            'kps': face.kps.tolist() if hasattr(face, 'kps') else None,
                            'confidence': getattr(face, 'det_score', 0.9)
                        }
                        file_faces += 1
                        total_faces += 1
                    
                    if file_faces > 0:
                        file_name = os.path.basename(file_path)
                        self.log_message.emit(f"✅ {file_name}: {file_faces} yüz kaydedildi")
                        processed_files += 1
                    
                except Exception as e:
                    file_name = os.path.basename(file_path) 
                    self.log_message.emit(f"❌ Hata ({file_name}): {str(e)}")
                    failed_files += 1
                    continue

            # Eğitim tamamlandı
            self.progress.emit("Eğitim sonuçları kaydediliyor...", 90)
            
            # İstatistikler
            self.log_message.emit("=" * 50)
            self.log_message.emit("📊 EĞİTİM SONUÇLARI:")
            self.log_message.emit(f"✅ Başarıyla işlenen dosya: {processed_files}")
            self.log_message.emit(f"❌ Başarısız dosya: {failed_files}")
            self.log_message.emit(f"👥 Toplam tespit edilen yüz: {total_faces}")
            self.log_message.emit(f"💾 Veritabanı boyutu: {len(face_database)} kayıt")
            self.log_message.emit("=" * 50)
            
            if len(face_database) == 0:
                self.error.emit("Hiç yüz tespit edilemedi! Lütfen farklı resimler deneyin.")
                return
                
            self.progress.emit("Eğitim tamamlandı!", 100)
            self.finished.emit(face_database, self.folder_path, self.model_name)
            
        except Exception as e:
            self.error.emit(f"Eğitim sırasında kritik hata: {str(e)}\n{traceback.format_exc()}")


class FaceTrainingGUI(QMainWindow):
    """Yüz Tanıma Eğitim Aracı Ana Penceresi"""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle('🤖 AI Yüz Tanıma Eğitim Aracı v2.0')
        self.setMinimumSize(800, 600)
        self.resize(1000, 700)
        
        # Değişkenler
        self.face_database = {}
        self.training_folder = None
        self.model_name = None
        self.training_worker = None
        
        self.init_ui()
        self.setStyleSheet(self.get_stylesheet())
        
    def init_ui(self):
        """Kullanıcı arayüzünü oluştur"""
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        
        main_layout = QVBoxLayout(main_widget)
        main_layout.setSpacing(15)
        main_layout.setContentsMargins(20, 20, 20, 20)
        
        # Başlık
        title_label = QLabel("🤖 AI Yüz Tanıma Eğitim Aracı")
        title_label.setObjectName("title")
        main_layout.addWidget(title_label)
        
        subtitle_label = QLabel("Fotoğraflarınızdan AI yüz tanıma veritabanı oluşturun")
        subtitle_label.setObjectName("subtitle")
        main_layout.addWidget(subtitle_label)
        
        # Ayırıcı
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setFrameShadow(QFrame.Sunken)
        main_layout.addWidget(line)
        
        # Model adı girişi
        model_group = QGroupBox("🏷️ Model Bilgileri")
        model_layout = QVBoxLayout()
        
        model_name_layout = QHBoxLayout()
        model_name_layout.addWidget(QLabel("Model Adı:"))
        self.model_name_input = QLineEdit()
        self.model_name_input.setPlaceholderText("örn: akparti_genclik_2025")
        self.model_name_input.textChanged.connect(self.validate_inputs)
        model_name_layout.addWidget(self.model_name_input)
        model_layout.addLayout(model_name_layout)
        
        model_group.setLayout(model_layout)
        main_layout.addWidget(model_group)
        
        # Eğitim klasörü seçimi
        folder_group = QGroupBox("📁 Eğitim Veri Klasörü")
        folder_layout = QVBoxLayout()
        
        folder_button_layout = QHBoxLayout()
        self.btn_select_folder = QPushButton("📂 Eğitim Klasörü Seç")
        self.btn_select_folder.setObjectName("primary")
        self.btn_select_folder.clicked.connect(self.select_training_folder)
        folder_button_layout.addWidget(self.btn_select_folder)
        
        self.label_folder_path = QLabel("Henüz klasör seçilmedi")
        self.label_folder_path.setObjectName("folder_path")
        folder_button_layout.addWidget(self.label_folder_path)
        folder_button_layout.addStretch()
        
        folder_layout.addLayout(folder_button_layout)
        folder_group.setLayout(folder_layout)
        main_layout.addWidget(folder_group)
        
        # Eğitim başlatma
        training_group = QGroupBox("🚀 Model Eğitimi")
        training_layout = QVBoxLayout()
        
        training_button_layout = QHBoxLayout()
        self.btn_start_training = QPushButton("🎯 Eğitimi Başlat")
        self.btn_start_training.setObjectName("start_training")
        self.btn_start_training.setEnabled(False)
        self.btn_start_training.clicked.connect(self.start_training)
        training_button_layout.addWidget(self.btn_start_training)
        
        self.btn_stop_training = QPushButton("⏹️ Eğitimi Durdur")
        self.btn_stop_training.setObjectName("stop_training")
        self.btn_stop_training.setEnabled(False)
        self.btn_stop_training.clicked.connect(self.stop_training)
        training_button_layout.addWidget(self.btn_stop_training)
        
        training_button_layout.addStretch()
        training_layout.addLayout(training_button_layout)
        
        # İlerleme çubuğu
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setObjectName("progress")
        training_layout.addWidget(self.progress_bar)
        
        # Durum etiketi
        self.status_label = QLabel("Eğitim başlatmak için klasör seçin ve 'Eğitimi Başlat' butonuna tıklayın")
        self.status_label.setObjectName("status")
        training_layout.addWidget(self.status_label)
        
        training_group.setLayout(training_layout)
        main_layout.addWidget(training_group)
        
        # Log alanı
        log_group = QGroupBox("📝 Eğitim Günlüğü")
        log_layout = QVBoxLayout()
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setObjectName("log")
        self.log_text.setMaximumHeight(200)
        log_layout.addWidget(self.log_text)
        
        log_group.setLayout(log_layout)
        main_layout.addWidget(log_group)
        
        # Durum çubuğu
        status_bar = self.statusBar()
        if status_bar:
            status_bar.showMessage("Hazır - Eğitim için klasör seçin")
        
    def get_stylesheet(self):
        """Modern ve temiz stil"""
        return """
        QMainWindow {
            background-color: #f8f9fa;
        }
        
        QLabel#title {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            padding: 10px 0px;
        }
        
        QLabel#subtitle {
            font-size: 14px;
            color: #7f8c8d;
            padding-bottom: 10px;
        }
        
        QLabel#folder_path {
            font-style: italic;
            color: #34495e;
            padding: 8px;
            background-color: #ecf0f1;
            border-radius: 4px;
        }
        
        QLabel#status {
            font-weight: bold;
            color: #2980b9;
            padding: 5px;
        }
        
        QPushButton#primary {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 6px;
        }
        
        QPushButton#primary:hover {
            background-color: #2980b9;
        }
        
        QPushButton#primary:pressed {
            background-color: #21618c;
        }
        
        QPushButton#start_training {
            background-color: #27ae60;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 8px;
        }
        
        QPushButton#start_training:hover {
            background-color: #229954;
        }
        
        QPushButton#start_training:disabled {
            background-color: #bdc3c7;
            color: #7f8c8d;
        }
        
        QPushButton#stop_training {
            background-color: #e74c3c;
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 8px;
        }
        
        QPushButton#stop_training:hover {
            background-color: #c0392b;
        }
        
        QPushButton#stop_training:disabled {
            background-color: #bdc3c7;
            color: #7f8c8d;
        }
        
        QProgressBar#progress {
            border: 2px solid #bdc3c7;
            border-radius: 8px;
            text-align: center;
            font-weight: bold;
            font-size: 14px;
        }
        
        QProgressBar#progress::chunk {
            background-color: #27ae60;
            border-radius: 6px;
        }
        
        QTextEdit#log {
            background-color: #2c3e50;
            color: #ecf0f1;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 11px;
            border: 1px solid #34495e;
            border-radius: 6px;
        }
        
        QGroupBox {
            font-weight: bold;
            font-size: 14px;
            color: #2c3e50;
            border: 2px solid #bdc3c7;
            border-radius: 8px;
            margin-top: 1ex;
            padding-top: 10px;
        }
        
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
        }
        """
        
    def select_training_folder(self):
        """Eğitim klasörü seçme"""
        folder = QFileDialog.getExistingDirectory(
            self, 
            "Eğitim için fotoğraf klasörü seçin",
            options=QFileDialog.ShowDirsOnly | QFileDialog.DontResolveSymlinks
        )
        
        if folder:
            self.training_folder = folder
            self.label_folder_path.setText(f"📁 {folder}")
            self.validate_inputs()
            status_bar = self.statusBar()
            if status_bar:
                status_bar.showMessage(f"Klasör seçildi: {os.path.basename(folder)}")
            self.log_message(f"🎯 Eğitim klasörü seçildi: {folder}")
            
            # Klasördeki dosya sayısını kontrol et
            self.check_folder_contents(folder)
    
    def validate_inputs(self):
        """Girişleri kontrol et ve butonları etkinleştir"""
        model_name = self.model_name_input.text().strip()
        has_folder = bool(self.training_folder)
        
        # Model adı kontrolleri
        if model_name and has_folder:
            # Geçerli karakterler kontrol et
            if model_name.replace('_', '').replace('-', '').replace('.', '').isalnum():
                self.btn_start_training.setEnabled(True)
                self.model_name = model_name
            else:
                self.btn_start_training.setEnabled(False)
                if len(model_name) > 0:
                    self.log_message("⚠️ Model adı sadece harf, rakam, _, - ve . içerebilir")
        else:
            self.btn_start_training.setEnabled(False)
    
    def check_folder_contents(self, folder):
        """Klasör içeriğini kontrol et"""
        try:
            image_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff')
            image_count = 0
            
            for root, _, files in os.walk(folder):
                for file in files:
                    if file.lower().endswith(image_extensions):
                        image_count += 1
            
            self.log_message(f"📊 Klasörde {image_count} resim dosyası bulundu")
            
            if image_count == 0:
                QMessageBox.warning(
                    self, 
                    "Uyarı", 
                    "Seçilen klasörde hiç resim dosyası bulunamadı!\n\n"
                    "Desteklenen formatlar: JPG, JPEG, PNG, BMP, TIFF"
                )
                self.btn_start_training.setEnabled(False)
            elif image_count < 10:
                QMessageBox.information(
                    self,
                    "Bilgi",
                    f"Klasörde {image_count} resim bulundu.\n\n"
                    "Daha iyi sonuçlar için en az 10-20 resim önerilir."
                )
                
        except Exception as e:
            self.log_message(f"❌ Klasör kontrolü hatası: {str(e)}")
    
    def start_training(self):
        """Eğitimi başlat"""
        if not self.training_folder or not self.model_name:
            QMessageBox.warning(self, "Hata", "Model adı ve eğitim klasörü gerekli!")
            return
        
        # Models klasöründe aynı isimde model var mı kontrol et
        models_dir = "models"
        model_path = os.path.join(models_dir, self.model_name)
        if os.path.exists(model_path):
            reply = QMessageBox.question(
                self,
                "Model Mevcut",
                f"'{self.model_name}' adında bir model zaten mevcut.\n\n"
                f"Üzerine yazmak istiyor musunuz?",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            if reply != QMessageBox.Yes:
                return
        
        # Kullanıcıdan onay al
        reply = QMessageBox.question(
            self,
            "Eğitimi Başlat",
            f"Eğitim başlatılacak:\n\n"
            f"🏷️ Model Adı: {self.model_name}\n"
            f"📁 Klasör: {self.training_folder}\n"
            f"📂 Hedef: models/{self.model_name}/\n"
            f"🔄 Alt klasörler dahil edilecek\n"
            f"⚡ GPU/CPU otomatik seçilecek\n\n"
            f"Eğitimi başlatmak istiyor musunuz?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.Yes
        )
        
        if reply != QMessageBox.Yes:
            return
        
        # UI durumunu güncelle
        self.btn_start_training.setEnabled(False)
        self.btn_stop_training.setEnabled(True)
        self.btn_select_folder.setEnabled(False)
        self.progress_bar.setValue(0)
        self.log_text.clear()
        
        # Worker thread başlat
        self.training_worker = TrainingWorker(self.training_folder, self.model_name, recursive=True)
        self.training_worker.progress.connect(self.update_progress)
        self.training_worker.log_message.connect(self.log_message)
        self.training_worker.finished.connect(self.training_finished)
        self.training_worker.error.connect(self.training_error)
        self.training_worker.start()
        
        status_bar = self.statusBar()
        if status_bar:
            status_bar.showMessage("Eğitim devam ediyor...")
        
    def stop_training(self):
        """Eğitimi durdur"""
        if self.training_worker and self.training_worker.isRunning():
            reply = QMessageBox.question(
                self,
                "Eğitimi Durdur",
                "Eğitim durdurulacak. Devam etmek istiyor musunuz?",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                self.training_worker.terminate()
                self.training_worker.wait()
                self.reset_ui()
                self.log_message("⏹️ Eğitim kullanıcı tarafından durduruldu")
                status_bar = self.statusBar()
                if status_bar:
                    status_bar.showMessage("Eğitim durduruldu")
    
    def update_progress(self, message, progress):
        """İlerleme güncelleme"""
        self.progress_bar.setValue(progress)
        self.status_label.setText(message)
        
    def log_message(self, message):
        """Log mesajı ekle"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted_message = f"[{timestamp}] {message}"
        self.log_text.append(formatted_message)
        
        # Otomatik scroll
        cursor = self.log_text.textCursor()
        cursor.movePosition(cursor.End)
        self.log_text.setTextCursor(cursor)
        
        # Uygulama güncellemesi
        QApplication.processEvents()
    
    def training_finished(self, face_database, training_folder, model_name):
        """Eğitim tamamlandı - models klasörü yapısında kaydet"""
        try:
            self.face_database = face_database
            self.log_message("💾 Models klasöründe model oluşturuluyor...")
            
            # Models klasörünü oluştur
            models_dir = "models"
            if not os.path.exists(models_dir):
                os.makedirs(models_dir)
                
            model_dir = os.path.join(models_dir, model_name)
            
            # Model klasörünü temizle/oluştur
            if os.path.exists(model_dir):
                shutil.rmtree(model_dir)
            os.makedirs(model_dir)
            self.log_message(f"📂 Model klasörü oluşturuldu: models/{model_name}/")
            
            # Eğitim verilerini kopyala
            folder_name = os.path.basename(training_folder.rstrip(os.sep))
            dest_folder = os.path.join(model_dir, folder_name)
            shutil.copytree(training_folder, dest_folder)
            self.log_message(f"✅ Eğitim verileri kopyalandı: {folder_name}")
            
            # Models klasörü uyumlu PKL dosyasını kaydet
            database_path = os.path.join(model_dir, "face_database.pkl")
            with open(database_path, 'wb') as f:
                pickle.dump(face_database, f)
            self.log_message(f"💾 PKL veritabanı kaydedildi: models/{model_name}/face_database.pkl")
            
            # JSON metadata oluştur
            metadata = {
                "name": model_name,
                "created_at": datetime.now().isoformat(),
                "total_faces": len(face_database),
                "source_folder": os.path.basename(training_folder),
                "status": "completed",
                "description": f"InsightFace Buffalo_L modeli - {len(face_database)} yüz",
                "type": "face_recognition",
                "algorithm": "InsightFace Buffalo_L",
                "threshold": 0.5,
                "files": {
                    "database": "face_database.pkl",
                    "photos": folder_name
                }
            }
            
            metadata_path = os.path.join(model_dir, "model_info.json")
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            self.log_message(f"📄 Model metadata kaydedildi: model_info.json")
            
            # Bilgi dosyası oluştur
            self.create_model_info_file(model_dir, training_folder, model_name, len(face_database))
            
            # UI'yi resetle
            self.reset_ui()
            
            # Başarı mesajı
            QMessageBox.information(
                self,
                "🎉 Model Hazır!",
                f"✅ Model başarıyla oluşturuldu!\n\n"
                f"🏷️ Model: {model_name}\n"
                f"📂 Konum: models/{model_name}/\n"
                f"👥 Toplam yüz: {len(face_database)}\n"
                f"📄 Veritabanı: face_database.pkl\n"
                f"📊 Metadata: model_info.json\n\n"
                f"🌐 Model web arayüzünden kullanıma hazır!\n"
                f"Genel sekreterlik otomatik algılayacak."
            )
            
            status_bar = self.statusBar()
            if status_bar:
                status_bar.showMessage("Model başarıyla oluşturuldu!")
            
        except Exception as e:
            self.training_error(f"Model oluşturma hatası: {str(e)}")
    
    def create_model_info_file(self, model_dir, training_folder, model_name, face_count):
        """Model bilgi dosyası oluştur"""
        try:
            info_file = os.path.join(model_dir, "README.txt")
            with open(info_file, 'w', encoding='utf-8') as f:
                f.write(f"AI Yüz Tanıma Modeli: {model_name}\n")
                f.write("=" * 50 + "\n\n")
                f.write(f"Model Adı: {model_name}\n")
                f.write(f"Oluşturma Tarihi: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Kaynak Klasör: {training_folder}\n")
                f.write(f"Toplam Yüz: {face_count}\n")
                f.write(f"Algoritma: InsightFace Buffalo_L\n")
                f.write(f"Threshold: 0.5\n\n")
                f.write("📁 DOSYA YAPISI:\n")
                f.write(f"- face_database.pkl   (PKL veritabanı)\n")
                f.write(f"- model_info.json     (JSON metadata)\n")
                f.write(f"- {os.path.basename(training_folder)}/         (Eğitim fotoğrafları)\n")
                f.write(f"- README.txt          (Bu dosya)\n\n")
                f.write("🌐 WEB ARAYÜZÜ KULLANIMI:\n")
                f.write("- Model otomatik olarak web arayüzünde görünecek\n")
                f.write("- Genel sekreterlik model_info.json'dan bilgileri okuyacak\n")
                f.write("- Model adı girme gereksiz - JSON'dan alınacak\n")
                f.write("- Direkt kullanıma hazır!\n")
                
            self.log_message("📄 Model bilgi dosyası oluşturuldu: README.txt")
            
        except Exception as e:
            self.log_message(f"❌ Bilgi dosyası oluşturma hatası: {str(e)}")
    
    def training_error(self, error_message):
        """Eğitim hatası"""
        self.log_message(f"❌ HATA: {error_message}")
        self.reset_ui()
        
        QMessageBox.critical(
            self,
            "Eğitim Hatası",
            f"Eğitim sırasında hata oluştu:\n\n{error_message}"
        )
        
        status_bar = self.statusBar()
        if status_bar:
            status_bar.showMessage("Eğitim hatası!")
    
    def reset_ui(self):
        """UI'yi başlangıç durumuna getir"""
        self.validate_inputs()  # Model adı ve klasör kontrolü yap
        self.btn_stop_training.setEnabled(False)
        self.btn_select_folder.setEnabled(True)
        self.model_name_input.setEnabled(True)
        self.progress_bar.setValue(0)
        self.status_label.setText("Model oluşturmaya hazır")
    
    def closeEvent(self, a0):
        """Pencere kapatılırken"""
        if self.training_worker and self.training_worker.isRunning():
            reply = QMessageBox.question(
                self,
                "Çıkış",
                "Eğitim devam ediyor. Yine de çıkmak istiyor musunuz?",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                self.training_worker.terminate()
                self.training_worker.wait()
                a0.accept()
            else:
                a0.ignore()
        else:
            a0.accept()


def main():
    """Ana fonksiyon"""
    app = QApplication(sys.argv)
    app.setApplicationName("AI Yüz Tanıma Eğitim Aracı")
    app.setApplicationVersion("2.0")
    
    # Uygulama ikonu (varsa)
    try:
        app.setWindowIcon(QIcon("icon.png"))
    except:
        pass
    
    # Ana pencereyi oluştur ve göster
    window = FaceTrainingGUI()
    window.show()
    
    # Uygulamayı çalıştır
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()