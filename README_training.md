# 🤖 AI Yüz Tanıma Eğitim Aracı

Bu araç, fotoğraflarınızdan yapay zeka destekli yüz tanıma veritabanı oluşturmanızı sağlar.

## 🚀 Özellikler

- **Modern GUI**: PyQt5 ile kullanıcı dostu arayüz
- **GPU Desteği**: CUDA destekli hızlandırma (mevcut ise)
- **Toplu İşlem**: Klasör ve alt klasörlerdeki tüm resimleri işler
- **Gerçek Zamanlı Takip**: İlerleme çubuğu ve detaylı log
- **Otomatik Paketleme**: Eğitim sonrası training_package/ klasörü oluşturur
- **Çoklu Format**: JPG, PNG, BMP, TIFF formatlarını destekler

## 📋 Gereksinimler

### Sistem Gereksinimleri
- Python 3.8+
- Windows/Linux/macOS
- En az 4GB RAM
- GPU (önerilen, zorunlu değil)

### Python Kütüphaneleri
```bash
pip install -r requirements_training.txt
```

## 🛠️ Kurulum

1. **Depoyu klonlayın veya dosyaları indirin**
2. **Gereksinimleri kurun:**
   ```bash
   pip install -r requirements_training.txt
   ```
3. **Programı çalıştırın:**
   ```bash
   python face_training_gui.py
   ```

## 📖 Kullanım Kılavuzu

### 1. Eğitim Klasörü Seçme
- "📂 Eğitim Klasörü Seç" butonuna tıklayın
- Yüz fotoğraflarının bulunduğu klasörü seçin
- Alt klasörler otomatik dahil edilir

### 2. Eğitimi Başlatma
- "🎯 Eğitimi Başlat" butonuna tıklayın
- Sistem otomatik olarak GPU/CPU'yu tespit eder
- İlerleme çubuğu ve log alanında süreci takip edin

### 3. Sonuçları Alma
Eğitim tamamlandığında şu dosyalar oluşturulur:
- `face_database.pkl` - Yüz veritabanı
- `training_package/` - Tüm eğitim paketi
  - `face_database.pkl`
  - `[eğitim_klasörünüz]/` - Orijinal fotoğraflar
  - `training_info.txt` - Eğitim bilgileri

## 🎯 En İyi Sonuçlar İçin

### Fotoğraf Kalitesi
- **Çözünürlük**: En az 640x480 piksel
- **Aydınlatma**: İyi aydınlatılmış, gölgesiz
- **Açı**: Frontal pozisyon (yüz kameraya bakıyor)
- **Netlik**: Bulanık olmayan, keskin fotoğraflar

### Veri Çeşitliliği
- Farklı ifadeler (gülümseyen, ciddi, vb.)
- Farklı açılar (hafif sol/sağ dönük)
- Farklı aydınlatma koşulları
- Kişi başına en az 10-20 fotoğraf

### Dosya Organizasyonu
```
eğitim_klasörü/
├── kişi1/
│   ├── foto1.jpg
│   ├── foto2.jpg
│   └── ...
├── kişi2/
│   ├── foto1.jpg
│   └── ...
└── genel_fotoğraflar/
    ├── grup1.jpg
    └── ...
```

## ⚡ Performans İpuçları

### GPU Kullanımı
- NVIDIA GPU'su varsa CUDA kurulu olmalı
- CUDA 11.x veya 12.x sürümleri desteklenir
- GPU belleği yeterli değilse otomatik CPU'ya geçer

### Bellek Optimizasyonu
- Çok büyük fotoğraflar otomatik yeniden boyutlandırılır
- Toplu işlem için sistem belleğinizi dikkate alın
- 1000+ fotoğraf için en az 8GB RAM önerilir

## 🐛 Sorun Giderme

### Yaygın Hatalar

**"ModuleNotFoundError: No module named 'insightface'"**
```bash
pip install insightface
```

**"CUDA out of memory"**
- GPU belleği yetersiz, CPU kullanılacak
- Daha az fotoğrafla test edin
- GPU'yu başka programlar kullanıyor olabilir

**"No faces detected"**
- Fotoğraf kalitesini kontrol edin
- Yüzlerin net görünebildiğinden emin olun
- Farklı fotoğraflar deneyin

### Log Takibi
- Detaylı hata mesajları log alanında görünür
- Sorun yaşarsanız log mesajlarını kopyalayın
- GitHub Issues'da sorun bildirin

## 📊 Çıktı Formatı

### face_database.pkl İçeriği
```python
{
    "dosya_yolu||face_0": {
        "embedding": [512 boyutlu vektör],
        "path": "fotoğraf_yolu",
        "bbox": [x1, y1, x2, y2],
        "kps": [[x, y], ...],  # 5 nokta yüz işaretleri
        "confidence": 0.95
    },
    ...
}
```

## 🔧 Geliştirici Notları

### Teknik Detaylar
- **Model**: InsightFace buffalo_l
- **Embedding Boyutu**: 512 boyut
- **Tespit Algoritması**: RetinaFace
- **Threading**: QThread ile GUI bloklanmaz

### Özelleştirme
- Model parametreleri `TrainingWorker.__init__` içinde
- GUI stilleri `get_stylesheet()` metodunda
- Dosya formatları `check_folder_contents()` içinde

## 📄 Lisans

Bu proje MIT lisansı altında yayımlanmıştır.

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Push edin (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📞 Destek

Sorularınız için:
- GitHub Issues kullanın
- E-posta: [e-posta adresiniz]
- Discord: [Discord sunucunuz]

---

**💡 İpucu**: Bu araç eğitim amaçlıdır. Ticari kullanım için uygun lisansları kontrol edin.