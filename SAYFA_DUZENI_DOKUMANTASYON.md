# AK Parti Gençlik Kolları İstişare Kampı - Sayfa Düzeni Yönetim Sistemi Dökümantasyonu

## İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Kurulum ve Yapılandırma](#kurulum-ve-yapılandırma)
3. [Yeni Özellikler](#yeni-özellikler)
4. [Kullanım Kılavuzu](#kullanım-kılavuzu)
5. [API Referansı](#api-referansı)
6. [Veritabanı Şeması](#veritabanı-şeması)
7. [Sorun Giderme](#sorun-giderme)

## Genel Bakış

Bu güncelleme ile sisteme şu yeni özellikler eklenmiştir:

### ✅ Dinamik İçerik Yükleme
- Ana menüde "Ekibimiz", "Sosyal Medya" ve "Program Akışı" butonları tıklandığında sadece ilgili bölümün içeriği gösterilir
- Diğer bölümler gizli tutulur
- Smooth animasyonlar ve geçiş efektleri

### ✅ Kapsamlı Sayfa Düzeni Yönetimi
- Masaüstü ve mobil arkaplan görsellerini yönetme
- Site metinlerini ve konumlarını düzenleme
- Buton sıralaması ve konumlandırma
- Sürükle-bırak arayüzü
- Gerçek zamanlı önizleme

### ✅ Dosya Yönetim Sistemi
- Güvenli resim yükleme (JPEG, PNG, GIF, WebP)
- 10MB'a kadar dosya desteği
- Dosya önizleme ve yönetimi

## Kurulum ve Yapılandırma

### Mevcut Sistem Üzerinde Güncelleme

Sistem mevcut veritabanınızı koruyarak güncellenir. Yeni tablolar otomatik olarak oluşturulur.

#### 1. Veritabanı Güncellemesi

```bash
npm run db:push
```

Bu komut aşağıdaki yeni tabloları oluşturacaktır:
- `uploaded_files`: Yüklenen dosyalar
- `page_layouts`: Sayfa düzenleri
- `page_elements`: Sayfa öğeleri

#### 2. Dosya Yükleme Klasörü

Sistem otomatik olarak `public/uploads` klasörünü oluşturur. Manuel oluşturmak isterseniz:

```bash
mkdir -p public/uploads
chmod 755 public/uploads
```

#### 3. Ortam Değişkenleri

Mevcut `.env` dosyanıza ek yapılandırma gerekmez. Sistem mevcut değişkenleri kullanır:

```env
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

#### 4. Sunucu Başlatma

```bash
npm run dev
```

veya production için:

```bash
npm run build
npm start
```

### Yeni Kullanıcı Yetkileri

Sadece **Genel Sekreterlik** rolündeki kullanıcılar yeni sayfa düzeni yönetim paneline erişebilir.

## Yeni Özellikler

### 1. Dinamik İçerik Yükleme

Ana menüde butonlar artık akıllı şekilde çalışır:

- **Program Akışı**: Tıklandığında program etkinlikleri gösterilir
- **Sosyal Medya**: Sosyal medya hesapları listelenir
- **Ekibimiz**: Ekip üyeleri ve iletişim bilgileri görüntülenir

Her bölüm için:
- Animasyonlu açılma/kapanma
- İçerik sayısı göstergesi
- Kolay kapatma butonu

### 2. Sayfa Düzeni Yönetim Paneli

**Erişim**: Genel Sekreterlik Paneli → Sayfa Düzeni

#### Özellikler:
- **3 Sekmeli Arayüz**:
  - Düzen Yönetimi
  - Dosya Yönetimi  
  - Önizleme

- **Sürükle-Bırak Editör**:
  - Öğeleri fare ile sürükleme
  - Gerçek zamanlı konum güncelleme
  - Sınır kontrolü

- **Öğe Tipleri**:
  - Metin
  - Buton
  - Logo
  - Slogan

### 3. Dosya Yönetim Sistemi

- **Desteklenen Formatlar**: JPEG, PNG, GIF, WebP
- **Maksimum Boyut**: 10MB
- **Güvenlik**: Sadece resim dosyaları kabul edilir
- **Otomatik İsimlendirme**: Çakışma önleme sistemi

## Kullanım Kılavuzu

### Ana Menü Dinamik İçerik

1. Ana sayfaya gidin
2. "Program Akışı", "Sosyal Medya" veya "Ekibimiz" butonuna tıklayın
3. İlgili içerik aşağıda açılacaktır
4. "×" butonuna tıklayarak kapatabilirsiniz
5. Başka bir butona tıklayarak farklı içerik görüntüleyebilirsiniz

### Sayfa Düzeni Yönetimi

#### Yeni Düzen Oluşturma

1. **Genel Sekreterlik Paneli** → **Sayfa Düzeni**'ne gidin
2. **"Yeni Düzen"** butonuna tıklayın
3. Düzen otomatik oluşturulur ve listeye eklenir

#### Arkaplan Resmi Ayarlama

1. **Dosya Yönetimi** sekmesine gidin
2. **"Dosya Yükle"** butonuna tıklayın
3. Resmi seçin ve yükleyin
4. **Düzen Yönetimi** sekmesine dönün
5. Düzeni seçin ve arkaplan resmi ayarlayın

#### Öğe Ekleme ve Düzenleme

1. Düzen seçildikten sonra **"Öğe Ekle"** butonuna tıklayın
2. Öğe tipini seçin (Metin, Buton, Logo, Slogan)
3. İçerik ve stil özelliklerini ayarlayın
4. **"Kaydet"** butonuna tıklayın

#### Sürükle-Bırak Kullanımı

1. **Önizleme** sekmesine gidin
2. Öğelerin üzerine gelin
3. Mouse ile tutup istediğiniz yere sürükleyin
4. Bıraktığınızda konum otomatik kaydedilir

## API Referansı

### Dosya Yükleme

```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Dosya: <image_file>
```

**Yanıt:**
```json
{
  "id": "uuid",
  "fileName": "generated_filename.jpg",
  "originalName": "original_filename.jpg",
  "filePath": "/uploads/generated_filename.jpg",
  "fileSize": 102400,
  "createdAt": "2025-01-29T..."
}
```

### Sayfa Düzenleri

#### Düzen Listesi
```http
GET /api/page-layouts
Authorization: Bearer <token>
```

#### Yeni Düzen Oluşturma
```http
POST /api/page-layouts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Düzen Adı",
  "backgroundColor": "#f8f9fa",
  "backgroundPosition": "center center",
  "backgroundSize": "cover"
}
```

#### Düzen Güncelleme
```http
PUT /api/page-layouts/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "backgroundImageDesktop": "/uploads/desktop_bg.jpg",
  "backgroundImageMobile": "/uploads/mobile_bg.jpg",
  "isActive": true
}
```

### Sayfa Öğeleri

#### Öğe Oluşturma
```http
POST /api/page-elements
Authorization: Bearer <token>
Content-Type: application/json

{
  "layoutId": "layout_uuid",
  "type": "text",
  "content": "Örnek Metin",
  "elementKey": "header_title",
  "positionX": 100,
  "positionY": 50,
  "width": 200,
  "height": 50,
  "fontSize": "24px",
  "color": "#000000",
  "deviceType": "both"
}
```

#### Öğe Konum Güncelleme
```http
PUT /api/page-elements/:id/position
Authorization: Bearer <token>
Content-Type: application/json

{
  "positionX": 150,
  "positionY": 75
}
```

## Veritabanı Şeması

### uploaded_files tablosu
```sql
CREATE TABLE uploaded_files (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR NOT NULL,
  original_name VARCHAR NOT NULL,
  mime_type VARCHAR NOT NULL,
  file_size INTEGER NOT NULL,
  file_path VARCHAR NOT NULL,
  uploaded_by VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### page_layouts tablosu
```sql
CREATE TABLE page_layouts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  background_image_desktop VARCHAR,
  background_image_mobile VARCHAR,
  background_position VARCHAR DEFAULT 'center center',
  background_size VARCHAR DEFAULT 'cover',
  background_color VARCHAR DEFAULT '#f8f9fa',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### page_elements tablosu
```sql
CREATE TABLE page_elements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id VARCHAR NOT NULL REFERENCES page_layouts(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL CHECK (type IN ('text', 'button', 'logo', 'slogan')),
  content TEXT NOT NULL,
  element_key VARCHAR NOT NULL,
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  font_size VARCHAR DEFAULT '16px',
  font_weight VARCHAR DEFAULT 'normal',
  color VARCHAR DEFAULT '#000000',
  background_color VARCHAR,
  border_radius VARCHAR DEFAULT '8px',
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  device_type VARCHAR DEFAULT 'both' CHECK (device_type IN ('desktop', 'mobile', 'both')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Sorun Giderme

### Yaygın Problemler

#### 1. Dosya Yüklenmiyor
**Sebep**: Dosya formatı desteklenmiyor veya boyut çok büyük
**Çözüm**: 
- Sadece JPEG, PNG, GIF, WebP formatları kullanın
- Dosya boyutunu 10MB altına indirin

#### 2. Sürükle-Bırak Çalışmıyor
**Sebep**: JavaScript hatası veya tarayıcı uyumsuzluğu
**Çözüm**:
- Tarayıcıyı yenileyin
- Chrome veya Firefox kullanın
- Konsol hatalarını kontrol edin

#### 3. Sayfa Düzeni Görünmüyor
**Sebep**: Düzen aktif değil
**Çözüm**:
- Düzen listesinden düzeni seçin
- "Aktif Yap" butonuna tıklayın

#### 4. API Hatası
**Sebep**: Yetki veya bağlantı problemi
**Çözüm**:
- Giriş yapıp yapmadığınızı kontrol edin
- Genel Sekreterlik yetkisine sahip olduğunuzdan emin olun
- Ağ bağlantısını kontrol edin

### Log Kontrolü

Hata durumunda browser konsolunu kontrol edin:
1. F12 tuşuna basın
2. "Console" sekmesine gidin
3. Kırmızı hata mesajlarını kontrol edin

### Performans İpuçları

- **Dosya Boyutu**: Büyük resimler sayfa yükleme süresini artırır
- **Öğe Sayısı**: Çok fazla öğe performansı etkileyebilir
- **Tarayıcı Önbelleği**: Değişiklikler görünmüyorsa sayfayı yenileyin

### Güvenlik Notları

- Sadece güvendiğiniz resim dosyalarını yükleyin
- Dosya yükleme yetkisi sadece Genel Sekreterlik rolündedir
- Yüklenen dosyalar public klasöründe saklanır

## Teknik Destek

Herhangi bir sorun yaşandığında:

1. Önce bu dokümantasyondaki çözümleri deneyin
2. Tarayıcı konsolundaki hata mesajlarını kontrol edin
3. Sistemi yeniden başlatmayı deneyin: `npm run dev`
4. Veritabanı bağlantısını kontrol edin

### Sistem Gereksinimleri

- **Node.js**: 18+ sürümü
- **PostgreSQL**: 12+ sürümü
- **Tarayıcı**: Chrome 90+, Firefox 88+, Safari 14+
- **RAM**: En az 512MB boş alan
- **Disk**: Yüklenen dosyalar için ek alan

---

*Bu dökümantasyon AK Parti Gençlik Kolları İstişare Kampı Yönetim Sistemi v2.0 için hazırlanmıştır.*
*Son güncelleme: 29 Ocak 2025*