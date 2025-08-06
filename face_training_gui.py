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
from datetime import datetime
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QFileDialog, QMessageBox,
    QPushButton, QLabel, QVBoxLayout, QHBoxLayout,
    QWidget, QListWidget, QListWidgetItem, QAbstractItemView,
    QProgressBar, QGroupBox, QTextEdit, QSizePolicy, QFrame
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
    finished = pyqtSignal(dict, str)  # face_database, folder_path
    error = pyqtSignal(str)

    def __init__(self, folder_path, recursive=True):
        super().__init__()
        self.folder_path = folder_path
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
            self.finished.emit(face_database, self.folder_path)
            
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
            self.btn_start_training.setEnabled(True)
            status_bar = self.statusBar()
            if status_bar:
                status_bar.showMessage(f"Klasör seçildi: {os.path.basename(folder)}")
            self.log_message(f"🎯 Eğitim klasörü seçildi: {folder}")
            
            # Klasördeki dosya sayısını kontrol et
            self.check_folder_contents(folder)
    
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
        if not self.training_folder:
            QMessageBox.warning(self, "Hata", "Önce eğitim klasörü seçmelisiniz!")
            return
        
        # Kullanıcıdan onay al
        reply = QMessageBox.question(
            self,
            "Eğitimi Başlat",
            f"Eğitim başlatılacak:\n\n"
            f"📁 Klasör: {self.training_folder}\n"
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
        self.training_worker = TrainingWorker(self.training_folder, recursive=True)
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
    
    def training_finished(self, face_database, training_folder):
        """Eğitim tamamlandığında"""
        self.face_database = face_database
        
        try:
            # Önce training package oluştur ve fotoğrafları kopyala
            package_dir = "training_package"
            folder_name = os.path.basename(training_folder)
            
            # Training package klasörü oluştur
            if os.path.exists(package_dir):
                shutil.rmtree(package_dir)
            os.makedirs(package_dir)
            self.log_message(f"📦 Training package klasörü oluşturuldu: {package_dir}")
            
            # Eğitim klasörünü kopyala
            dest_folder = os.path.join(package_dir, folder_name)
            shutil.copytree(training_folder, dest_folder)
            self.log_message(f"✅ Eğitim klasörü kopyalandı: {folder_name}")
            
            # Path'ler zaten relative, sadece folder_name ekle
            self.log_message("🔄 Models klasörüne uyumlu path'ler hazırlanıyor...")
            updated_face_database = {}
            
            for key, face_data in face_database.items():
                # face_data['path'] zaten relative (denemelik/foto.jpg gibi)
                relative_path = face_data['path']
                
                # Key'i de güncelle (relative path zaten var)
                updated_face_database[key] = face_data
            
            self.log_message(f"✅ {len(updated_face_database)} kayıt models klasörü için hazırlandı")
            
            # Models klasörü uyumlu PKL dosyasını kaydet
            database_path = os.path.join(package_dir, "face_database.pkl")
            with open(database_path, 'wb') as f:
                pickle.dump(updated_face_database, f)
            
            self.log_message(f"💾 Models klasörü uyumlu veritabanı kaydedildi: {database_path}")
            
            # Bilgi dosyası oluştur
            self.create_info_file(package_dir, training_folder, folder_name, len(updated_face_database))
            
            # UI'yi resetle
            self.reset_ui()
            
            # Başarı mesajı
            QMessageBox.information(
                self,
                "🎉 Eğitim Tamamlandı!",
                f"✅ Models klasörü uyumlu veritabanı oluşturuldu!\n\n"
                f"📄 Veritabanı: training_package/face_database.pkl\n"
                f"📦 Paket: training_package/\n"
                f"👥 Toplam yüz: {len(updated_face_database)}\n"
                f"📁 Fotoğraflar: training_package/{folder_name}/\n\n"
                f"🦬 PKL dosyası artık relative path'ler kullanıyor!\n"
                f"Models klasörüne yüklemeye hazır - mapper gereksiz!"
            )
            
            status_bar = self.statusBar()
            if status_bar:
                status_bar.showMessage("Eğitim başarıyla tamamlandı!")
            
        except Exception as e:
            self.training_error(f"Dosya kaydetme hatası: {str(e)}")
    
    def create_info_file(self, package_dir, training_folder, folder_name, face_count):
        """Bilgi dosyası oluştur"""
        try:
            info_file = os.path.join(package_dir, "training_info.txt")
            with open(info_file, 'w', encoding='utf-8') as f:
                f.write("AI Yüz Tanıma Eğitim Paketi\n")
                f.write("=" * 40 + "\n\n")
                f.write(f"Eğitim Tarihi: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Kaynak Klasör: {training_folder}\n")
                f.write(f"Toplam Yüz: {face_count}\n")
                f.write(f"Veritabanı Dosyası: face_database.pkl\n")
                f.write(f"Eğitim Verisi: {folder_name}/\n\n")
                f.write("📝 ÖNEMLI NOTLAR:\n")
                f.write("- face_database.pkl MODELS KLASÖRÜNE UYUMLU oluşturuldu\n")
                f.write("- Path'ler relative format: denemelik/foto.jpg||face_0\n")
                f.write("- Windows absolute path'leri temizlendi\n")
                f.write("- Google Drive'dan direkt yüklenebilir\n")
                f.write("- Ayrı path mapper gereksiz - direkt çalışır\n")
                f.write("- Bu paket Replit models/ klasörüne uyumlu\n")
                
            self.log_message("📄 Bilgi dosyası oluşturuldu: training_info.txt")
            
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
        self.btn_start_training.setEnabled(bool(self.training_folder))
        self.btn_stop_training.setEnabled(False)
        self.btn_select_folder.setEnabled(True)
        self.progress_bar.setValue(0)
        self.status_label.setText("Eğitim için hazır")
    
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