#!/usr/bin/env python3
"""
Buffalo-S Lite Compatible Face Training GUI
Buffalo-S modeli ile 512D embeddings kullanarak yüz tanıma eğitimi
"""
import sys
import os
import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import cv2
import numpy as np
from PIL import Image, ImageTk
import threading
import queue
import traceback
from pathlib import Path

# InsightFace imports
try:
    from insightface import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    print("⚠️ InsightFace not available - simulation mode")
    INSIGHTFACE_AVAILABLE = False

class BuffaloSFaceTrainingGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Buffalo-S Lite Yüz Tanıma Eğitim GUI")
        self.root.geometry("900x700")
        
        # Buffalo-S model
        self.face_analysis = None
        self.model_loaded = False
        
        # Training data
        self.training_data = {}  # {person_name: [embeddings]}
        self.face_database = {}
        
        # GUI components
        self.create_widgets()
        
        # Load Buffalo-S model in background
        self.load_model_async()
    
    def create_widgets(self):
        """GUI bileşenlerini oluştur"""
        
        # Main notebook
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Model Status Frame
        status_frame = ttk.Frame(notebook)
        notebook.add(status_frame, text="Model Durumu")
        
        self.status_label = ttk.Label(status_frame, 
                                     text="Buffalo-S Lite model yükleniyor...", 
                                     font=("Arial", 12))
        self.status_label.pack(pady=20)
        
        self.progress_bar = ttk.Progressbar(status_frame, mode='indeterminate')
        self.progress_bar.pack(pady=10, padx=50, fill=tk.X)
        self.progress_bar.start()
        
        # Training Frame
        training_frame = ttk.Frame(notebook)
        notebook.add(training_frame, text="Eğitim")
        
        # Person name entry
        ttk.Label(training_frame, text="Kişi Adı:").pack(pady=5)
        self.person_name_var = tk.StringVar()
        ttk.Entry(training_frame, textvariable=self.person_name_var, width=30).pack(pady=5)
        
        # Buttons
        button_frame = ttk.Frame(training_frame)
        button_frame.pack(pady=10)
        
        ttk.Button(button_frame, text="Fotoğraf Klasörü Seç", 
                  command=self.select_photos_folder).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Kişi Ekle", 
                  command=self.add_person).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Model Kaydet", 
                  command=self.save_model).pack(side=tk.LEFT, padx=5)
        
        # Training progress
        self.training_progress = ttk.Progressbar(training_frame, mode='determinate')
        self.training_progress.pack(pady=10, padx=20, fill=tk.X)
        
        self.training_status = ttk.Label(training_frame, text="")
        self.training_status.pack(pady=5)
        
        # Results Frame
        results_frame = ttk.Frame(notebook)
        notebook.add(results_frame, text="Sonuçlar")
        
        # Trained people list
        ttk.Label(results_frame, text="Eğitimli Kişiler:").pack(pady=5)
        
        self.people_listbox = tk.Listbox(results_frame, height=10)
        self.people_listbox.pack(pady=10, padx=20, fill=tk.BOTH, expand=True)
        
        # Test frame
        test_frame = ttk.Frame(results_frame)
        test_frame.pack(pady=10)
        
        ttk.Button(test_frame, text="Test Fotoğrafı Seç", 
                  command=self.test_recognition).pack(side=tk.LEFT, padx=5)
        ttk.Button(test_frame, text="Veritabanını Temizle", 
                  command=self.clear_database).pack(side=tk.LEFT, padx=5)
        
        # Test result
        self.test_result_label = ttk.Label(results_frame, text="", font=("Arial", 12))
        self.test_result_label.pack(pady=10)
    
    def load_model_async(self):
        """Buffalo-S modelini arka planda yükle"""
        def load_model():
            try:
                if INSIGHTFACE_AVAILABLE:
                    self.root.after(0, lambda: self.status_label.config(
                        text="Buffalo-S modeli yükleniyor..."
                    ))
                    
                    # Buffalo-S modeli yükle
                    self.face_analysis = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider'])
                    self.face_analysis.prepare(ctx_id=-1, det_size=(640, 640))
                    
                    self.model_loaded = True
                    self.root.after(0, self.model_loaded_callback)
                else:
                    # Simulation mode
                    self.model_loaded = True
                    self.root.after(0, lambda: self.status_label.config(
                        text="⚠️ Simülasyon modu - InsightFace kurulumu gerekli",
                        foreground="orange"
                    ))
                    self.root.after(0, lambda: self.progress_bar.stop())
                    
            except Exception as e:
                error_msg = f"Model yükleme hatası: {str(e)}"
                self.root.after(0, lambda: self.status_label.config(
                    text=error_msg, foreground="red"
                ))
                self.root.after(0, lambda: self.progress_bar.stop())
                print(f"Model loading error: {e}")
        
        thread = threading.Thread(target=load_model)
        thread.daemon = True
        thread.start()
    
    def model_loaded_callback(self):
        """Model yüklendiğinde çağrılır"""
        self.status_label.config(
            text="✅ Buffalo-S Lite model hazır!", 
            foreground="green"
        )
        self.progress_bar.stop()
    
    def select_photos_folder(self):
        """Fotoğraf klasörü seç"""
        if not self.model_loaded:
            messagebox.showwarning("Uyarı", "Model henüz yüklenmedi!")
            return
            
        person_name = self.person_name_var.get().strip()
        if not person_name:
            messagebox.showwarning("Uyarı", "Kişi adını girin!")
            return
        
        folder_path = filedialog.askdirectory(title="Fotoğraf klasörü seçin")
        if folder_path:
            self.process_photos_async(person_name, folder_path)
    
    def process_photos_async(self, person_name, folder_path):
        """Fotoğrafları işle"""
        def process():
            try:
                image_files = []
                for ext in ['*.jpg', '*.jpeg', '*.png', '*.bmp']:
                    image_files.extend(Path(folder_path).glob(ext))
                    image_files.extend(Path(folder_path).glob(ext.upper()))
                
                if not image_files:
                    self.root.after(0, lambda: messagebox.showinfo(
                        "Bilgi", "Klasörde görüntü dosyası bulunamadı!"
                    ))
                    return
                
                embeddings = []
                total_files = len(image_files)
                
                for i, img_path in enumerate(image_files):
                    progress = int((i / total_files) * 100)
                    self.root.after(0, lambda p=progress: self.training_progress.config(value=p))
                    self.root.after(0, lambda: self.training_status.config(
                        text=f"İşleniyor: {i+1}/{total_files}"
                    ))
                    
                    try:
                        # Görüntüyü yükle
                        img = cv2.imread(str(img_path))
                        if img is None:
                            continue
                            
                        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                        
                        if INSIGHTFACE_AVAILABLE and self.face_analysis:
                            # Gerçek Buffalo-S embedding
                            faces = self.face_analysis.get(rgb_img)
                            if faces:
                                # En yüksek confidence'lı yüzü al
                                best_face = max(faces, key=lambda x: x.det_score)
                                embedding = best_face.normed_embedding.astype('float32')
                                embeddings.append(embedding.tolist())
                        else:
                            # Simulation embedding (hash-based DEĞİL, neural network simülasyonu)
                            embedding = self.generate_neural_simulation_embedding(rgb_img)
                            embeddings.append(embedding)
                            
                    except Exception as e:
                        print(f"Error processing {img_path}: {e}")
                        continue
                
                if embeddings:
                    self.training_data[person_name] = embeddings
                    self.root.after(0, lambda: self.update_people_list())
                    self.root.after(0, lambda: self.training_status.config(
                        text=f"✅ {person_name}: {len(embeddings)} embedding oluşturuldu"
                    ))
                    self.root.after(0, lambda: messagebox.showinfo(
                        "Başarılı", 
                        f"{person_name} için {len(embeddings)} embedding oluşturuldu!"
                    ))
                else:
                    self.root.after(0, lambda: messagebox.showwarning(
                        "Uyarı", "Hiçbir yüz tespit edilemedi!"
                    ))
                
                self.root.after(0, lambda: self.training_progress.config(value=0))
                
            except Exception as e:
                error_msg = f"Fotoğraf işleme hatası: {str(e)}"
                self.root.after(0, lambda: messagebox.showerror("Hata", error_msg))
        
        thread = threading.Thread(target=process)
        thread.daemon = True
        thread.start()
    
    def generate_neural_simulation_embedding(self, rgb_img):
        """Neural network simülasyon embedding (hash-based DEĞİL)"""
        # Görüntüyü 112x112'ye resize et
        resized = cv2.resize(rgb_img, (112, 112))
        
        # Convolutional feature extraction simulation
        features = []
        
        # Multiple kernel convolutions
        kernels = [
            np.array([[-1,-1,-1], [0,0,0], [1,1,1]]) / 3,  # Horizontal edge
            np.array([[-1,0,1], [-1,0,1], [-1,0,1]]) / 3,  # Vertical edge  
            np.array([[1,1,1], [1,-8,1], [1,1,1]]) / 9,    # Laplacian
            np.array([[0,-1,0], [-1,4,-1], [0,-1,0]]) / 4   # High pass
        ]
        
        for kernel in kernels:
            # Her kanal için convolution
            for c in range(3):
                filtered = cv2.filter2D(resized[:,:,c].astype('float32'), -1, kernel)
                
                # Regional pooling
                for y in range(0, 112, 14):
                    for x in range(0, 112, 14):
                        region = filtered[y:y+14, x:x+14]
                        features.extend([
                            np.mean(region),
                            np.std(region),
                            np.max(region),
                            np.min(region)
                        ])
        
        # Ensure 512 dimensions
        while len(features) < 512:
            idx = len(features) % len(features) if features else 0
            features.append(features[idx] * 0.1 if features else 0.1)
        
        features = features[:512]
        
        # L2 normalize
        features = np.array(features, dtype='float32')
        norm = np.linalg.norm(features)
        if norm > 0:
            features = features / norm
            
        return features.tolist()
    
    def add_person(self):
        """Kişi ekle"""
        person_name = self.person_name_var.get().strip()
        if not person_name:
            messagebox.showwarning("Uyarı", "Kişi adını girin!")
            return
            
        if person_name not in self.training_data:
            messagebox.showwarning("Uyarı", "Önce fotoğrafları işleyin!")
            return
        
        # Face database'e ekle
        self.face_database[person_name] = {
            "embeddings": self.training_data[person_name],
            "count": len(self.training_data[person_name]),
            "model": "Buffalo-S Lite" if INSIGHTFACE_AVAILABLE else "Neural Simulation"
        }
        
        messagebox.showinfo("Başarılı", f"{person_name} veritabanına eklendi!")
        self.update_people_list()
        self.person_name_var.set("")
    
    def update_people_list(self):
        """Kişi listesini güncelle"""
        self.people_listbox.delete(0, tk.END)
        for name, data in self.face_database.items():
            self.people_listbox.insert(tk.END, 
                f"{name} ({data['count']} embedding - {data['model']})")
    
    def save_model(self):
        """Modeli kaydet"""
        if not self.face_database:
            messagebox.showwarning("Uyarı", "Kaydedilecek veri yok!")
            return
        
        file_path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json")],
            title="Model kaydet"
        )
        
        if file_path:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(self.face_database, f, indent=2, ensure_ascii=False)
                messagebox.showinfo("Başarılı", "Model kaydedildi!")
            except Exception as e:
                messagebox.showerror("Hata", f"Model kaydedilemedi: {e}")
    
    def test_recognition(self):
        """Tanıma testi"""
        if not self.face_database:
            messagebox.showwarning("Uyarı", "Test edilecek model yok!")
            return
        
        file_path = filedialog.askopenfilename(
            filetypes=[("Image files", "*.jpg *.jpeg *.png *.bmp")],
            title="Test fotoğrafı seçin"
        )
        
        if file_path:
            self.test_photo_async(file_path)
    
    def test_photo_async(self, file_path):
        """Test fotoğrafını işle"""
        def test():
            try:
                img = cv2.imread(file_path)
                if img is None:
                    self.root.after(0, lambda: messagebox.showerror("Hata", "Görüntü yüklenemedi!"))
                    return
                
                rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                if INSIGHTFACE_AVAILABLE and self.face_analysis:
                    faces = self.face_analysis.get(rgb_img)
                    if not faces:
                        self.root.after(0, lambda: self.test_result_label.config(
                            text="❌ Yüz tespit edilemedi", foreground="red"))
                        return
                    
                    test_embedding = faces[0].normed_embedding.astype('float32').tolist()
                else:
                    test_embedding = self.generate_neural_simulation_embedding(rgb_img)
                
                # En yakın eşleşmeyi bul
                best_match = None
                best_similarity = -1
                
                for person_name, data in self.face_database.items():
                    for stored_embedding in data['embeddings']:
                        similarity = self.cosine_similarity(test_embedding, stored_embedding)
                        if similarity > best_similarity:
                            best_similarity = similarity
                            best_match = person_name
                
                if best_match and best_similarity > 0.6:  # Eşik değeri
                    result_text = f"✅ Tanındı: {best_match}\nBenzerlik: {best_similarity:.3f}"
                    color = "green"
                else:
                    result_text = f"❌ Tanınamadı\nEn yakın: {best_match} ({best_similarity:.3f})"
                    color = "red"
                
                self.root.after(0, lambda: self.test_result_label.config(
                    text=result_text, foreground=color))
                
            except Exception as e:
                error_msg = f"Test hatası: {str(e)}"
                self.root.after(0, lambda: messagebox.showerror("Hata", error_msg))
        
        thread = threading.Thread(target=test)
        thread.daemon = True
        thread.start()
    
    def cosine_similarity(self, vec1, vec2):
        """Cosine similarity hesapla"""
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0
        
        return dot_product / (norm1 * norm2)
    
    def clear_database(self):
        """Veritabanını temizle"""
        if messagebox.askyesno("Onay", "Tüm eğitim verilerini silmek istediğinizden emin misiniz?"):
            self.face_database.clear()
            self.training_data.clear()
            self.update_people_list()
            self.test_result_label.config(text="")
            messagebox.showinfo("Başarılı", "Veritabanı temizlendi!")

def main():
    root = tk.Tk()
    app = BuffaloSFaceTrainingGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()