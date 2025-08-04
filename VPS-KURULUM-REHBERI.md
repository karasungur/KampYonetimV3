# AK Parti GK İstişare Kampı - VPS Sunucu Kurulum Rehberi

## 🚀 VPS Sunucuya Kurulum Adımları

### ⚙️ Sistem Gereksinimleri
- **İşletim Sistemi**: Ubuntu 20.04 LTS veya üzeri (önerilen)
- **RAM**: Minimum 2GB, önerilen 4GB
- **Disk**: Minimum 20GB boş alan
- **CPU**: 2 çekirdek önerilen
- **Port**: 80, 443, 5000 portları açık olmalı

---

## 📋 1. SUNUCUYA BAĞLANMA VE İLK AYARLAR

### 🔑 Sizin VPS Bağlantı Bilgileriniz:
- **IP Adresi**: 2.59.117.53
- **Port**: 22
- **Kullanıcı Adı**: virtcon-W6tcX6pk
- **Şifre**: Xn5ty6iJxnexMBXR

### 💻 Adım 1: Sunucuya Bağlanın

**Windows'ta Git Bash açın ve şu komutu yazın:**
```bash
ssh virtcon-W6tcX6pk@2.59.117.53
```

**Bağlantı sırasında karşılaşacağınız durumlar:**

1. **İlk bağlantıda** şu mesaj çıkacak:
   ```
   The authenticity of host '2.59.117.53 (2.59.117.53)' can't be established.
   Are you sure you want to continue connecting (yes/no)?
   ```
   **Cevap**: `yes` yazın ve Enter'a basın

2. **Şifre sorulduğunda**:
   ```
   virtcon-W6tcX6pk@2.59.117.53's password:
   ```
   **Şifreyi yazın**: `Xn5ty6iJxnexMBXR` (yazarken görünmez, normal!)

3. **Başarılı bağlantı sonrası** şuna benzer görünecek:
   ```
   root@akkamp:~#
   ```

### 🔄 Adım 2: Sistemi Güncelleyin

**Aşağıdaki komutları sırasıyla çalıştırın:**

```bash
# 1. Paket listesini güncelle (1-2 dakika sürer)
sudo apt update

# 2. Sistemi güncelle (5-10 dakika sürebilir)
sudo apt upgrade -y
```

**⚠️ Önemli**: Upgrade sırasında sorular sorulabilir, hepsine **Y** veya **Yes** deyin.

### 🛠️ Adım 3: Gerekli Araçları Kurun

**Bu araçlar kurulumda kullanılacak:**

```bash
# Temel araçları kur (2-3 dakika sürer)
sudo apt install -y git nano curl wget unzip build-essential software-properties-common

# Kurulumları kontrol edin
echo "=== KURULUM KONTROL ==="
echo "Git versiyonu:"
git --version

echo "Nano versiyonu:"
nano --version | head -1

echo "Curl versiyonu:"
curl --version | head -1

echo "=== KURULUM TAMAM ==="
```

**✅ Bu çıktıları görürseniz devam edebilirsiniz:**
- `git version 2.x.x`
- `GNU nano, version 4.x`  
- `curl 7.x.x`

---

## 🟢 2. NODE.JS KURULUMU

### 🎯 Adım 1: Node.js Repository Ekleyin

**Bu işlem 2-3 dakika sürer:**
```bash
# NodeSource repository ekle (uzun bir komut)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

**✅ Başarılı olursa** sonunda şu mesajı göreceksiniz:
```
## Run `sudo apt-get install -y nodejs` to install Node.js 20.x and npm
```

### 📦 Adım 2: Node.js'i Kurun

```bash
# Node.js ve npm'i kur (1-2 dakika sürer)
sudo apt-get install -y nodejs
```

### ✅ Adım 3: Kurulum Kontrolü

```bash
echo "=== NODE.JS KURULUM KONTROL ==="
echo "Node.js versiyonu:"
node --version

echo "NPM versiyonu:"
npm --version

echo "=== KONTROL TAMAM ==="
```

**🎉 Başarılı kurulum çıktısı:**
- Node.js: `v20.x.x` (örnek: v20.11.0)
- NPM: `10.x.x` (örnek: 10.2.4)

**❌ Eğer hata alırsanız:**
- Bir önceki adımı tekrar çalıştırın
- `sudo apt update` komutunu çalıştırıp tekrar deneyin

---

## 🐘 3. POSTGRESQL VERİTABANI KURULUMU

### 📥 Adım 1: PostgreSQL'i Kurun

```bash
# PostgreSQL veritabanını kur (2-3 dakika sürer)
sudo apt install postgresql postgresql-contrib -y
```

### 🚀 Adım 2: PostgreSQL Servisini Başlatın

```bash
# PostgreSQL'i başlat ve otomatik başlamasını sağla
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Durum kontrolü
sudo systemctl status postgresql
```

**✅ Başarılı çıktı:**
```
● postgresql.service - PostgreSQL RDBMS
   Loaded: loaded
   Active: active (running)
```

### 🗄️ Adım 3: Veritabanı ve Kullanıcı Oluşturun

**Step 1: PostgreSQL shell'e girin**
```bash
sudo -u postgres psql
```

**Bu komuttan sonra `postgres=#` yazısını göreceksiniz.**

**Step 2: Aşağıdaki komutları PostgreSQL shell içinde çalıştırın:**
```sql
-- Proje veritabanını oluştur
CREATE DATABASE ak_parti_gk_camp;

-- Uygulama kullanıcısı oluştur
CREATE USER app_user WITH PASSWORD 'GüçlüŞifre123!';

-- Kullanıcıya izinleri ver
GRANT ALL PRIVILEGES ON DATABASE ak_parti_gk_camp TO app_user;
ALTER USER app_user CREATEDB;

-- PostgreSQL shell'den çık
\q
```

**⚠️ Önemli Notlar:**
- Her satırın sonunda `;` olması gerekiyor
- `\q` ile çıkabilirsiniz
- Büyük/küçük harf önemli değil

### ✅ Adım 4: Kurulum Testi

```bash
# Veritabanı bağlantısını test et
sudo -u postgres psql -d ak_parti_gk_camp -c "SELECT version();"
```

**🎉 Başarılı test çıktısı:**
```
PostgreSQL 14.x on x86_64-pc-linux-gnu
```

---

## 📁 4. PROJE DOSYALARINI GITHUB'DAN İNDİRME

### 📂 Adım 1: Proje Klasörü Oluşturun

```bash
# Proje için klasör oluştur
sudo mkdir -p /var/www/ak-parti-gk-camp

# Klasör izinlerini ayarla
sudo chown -R $USER:$USER /var/www/ak-parti-gk-camp

# Proje klasörüne git
cd /var/www/ak-parti-gk-camp

# Mevcut konumu kontrol et
pwd
```

**✅ Doğru çıktı:** `/var/www/ak-parti-gk-camp`

### 📥 Adım 2: GitHub'dan Projeyi İndirin

```bash
# GitHub'dan projeyi indir (1-2 dakika sürer)
git clone https://github.com/karasungur/AKGenclikKamp .
```

**⚠️ Dikkat:** Komut sonundaki `.` işareti önemli! Bu sayede dosyalar doğru yere gelir.

### ✅ Adım 3: Dosyaları Kontrol Edin

```bash
# İndirilen dosyaları listele
ls -la

# package.json dosyasının varlığını kontrol et
ls -la package.json
```

**🎉 Başarılı çıktı görmelisiniz:**
- `package.json` dosyası olmalı
- `client/` klasörü olmalı  
- `server/` klasörü olmalı
- `shared/` klasörü olmalı

---

## 🔧 5. ENVIRONMENT VARIABLES AYARLARI

### 📝 Adım 1: .env Dosyası Oluşturun

```bash
# Proje klasöründe olduğunuzdan emin olun
cd /var/www/ak-parti-gk-camp

# .env dosyasını nano editör ile oluşturun
nano .env
```

**Nano editör açılacak. Aşağıdaki metni kopyalayıp yapıştırın:**

### 📋 Adım 2: .env Dosyasına Kopyalayın

```env
# Database
DATABASE_URL=postgres://app_user:GüçlüŞifre123!@localhost:5432/ak_parti_gk_camp

# JWT Secret (güçlü bir secret oluşturun)
JWT_SECRET=SizinGüçlüJWTSecretAnahtarınız123456789!

# Environment
NODE_ENV=production

# Server
PORT=5000
HOST=0.0.0.0

# Python için (fotoğraf işleme - şimdilik gerekmiyor)
PYTHON_PATH=/usr/bin/python3
```

### 💾 Adım 3: Dosyayı Kaydedin

**Nano editöründe kaydetme:**
1. `Ctrl + X` basın (Çıkış)
2. `Y` basın (Evet, kaydet)
3. `Enter` basın (Dosya adını onayla)

### ✅ Adım 4: Dosyayı Kontrol Edin

```bash
# .env dosyasını kontrol edin
cat .env
```

**✅ Doğru çıktıyı görmelisiniz:** Yukarıdaki environment variables

---

## 📦 6. DEPENDENCIES KURULUMU

```bash
cd /var/www/ak-parti-gk-camp

# Node.js dependencies kur
npm install

# Python dependencies (fotoğraf özelliği için - isteğe bağlı)
sudo apt install python3 python3-pip -y
pip3 install opencv-python pillow numpy insightface onnxruntime
```

---

## 🗄️ 7. VERİTABANI MIGRATION

```bash
cd /var/www/ak-parti-gk-camp

# Database schema oluştur
npm run db:push

# İlk admin kullanıcı oluştur (opsiyonel)
# PostgreSQL shell'e gir
sudo -u postgres psql -d ak_parti_gk_camp

# Mevcut kullanıcıları ekle (PostgreSQL shell içinde)
-- Gülbahar Öztürk (Genel Sekreterlik)
INSERT INTO users (first_name, last_name, tc_number, password, role, is_active) 
VALUES ('Gülbahar', 'Öztürk', '47704699208', '$2b$10$fbO0hdCDwZ/L9R38JU8WZO2xA3S18j1JP.0UdzvJZNZVsunJHVS/S', 'genelsekreterlik', true);

-- Yusuf İbiş (Genel Başkan)
INSERT INTO users (first_name, last_name, tc_number, password, role, is_active) 
VALUES ('Yusuf', 'İbiş', '46480904230', '$2b$10$UVLOgM.GizyhevtGNl/Tcu6Hef/NbosiqLkvw8MjHQLTow9Kr5xGy', 'genelbaskan', true);
\q
```

---

## 🏗️ 8. PRODUCTION BUILD

```bash
cd /var/www/ak-parti-gk-camp

# Production build oluştur
npm run build

# Build dosyalarını kontrol et
ls -la dist/
```

---

## 🔄 9. PM2 İLE PROCESS YÖNETİMİ

PM2 kurulumu ve yapılandırması:
```bash
# PM2'yi global olarak kur
sudo npm install -g pm2

# PM2 yapılandırma dosyası oluştur
cd /var/www/ak-parti-gk-camp
nano ecosystem.config.js
```

`ecosystem.config.js` dosyasına:
```javascript
module.exports = {
  apps: [{
    name: 'ak-parti-gk-camp',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G'
  }]
};
```

PM2 başlatma:
```bash
# Log klasörü oluştur
mkdir -p /var/www/ak-parti-gk-camp/logs

# Uygulamayı başlat
pm2 start ecosystem.config.js

# PM2'yi sistem başlangıcında çalıştır
pm2 startup
pm2 save

# Durum kontrol et
pm2 status
pm2 logs
```

---

## 🌐 10. NGINX REVERSE PROXY (IP ADRESİ İÇİN)

Nginx kurulumu:
```bash
sudo apt install nginx -y
```

Nginx yapılandırması:
```bash
sudo nano /etc/nginx/sites-available/ak-parti-gk-camp
```

Configuration dosyasına:
```nginx
server {
    listen 80;
    server_name 2.59.117.53;  # Sizin VPS IP adresiniz

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Static files
    location /public/ {
        alias /var/www/ak-parti-gk-camp/dist/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API and app
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

Nginx'i aktifleştir:
```bash
# Site'ı aktifleştir
sudo ln -s /etc/nginx/sites-available/ak-parti-gk-camp /etc/nginx/sites-enabled/

# Default site'ı kaldır
sudo rm /etc/nginx/sites-enabled/default

# Nginx yapılandırmasını test et
sudo nginx -t

# Nginx'i yeniden başlat
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 🔥 11. FIREWALL YAPıLANDıRMASI

```bash
# UFW firewall'ı aktifleştir
sudo ufw enable

# Gerekli portları aç
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Firewall durumunu kontrol et
sudo ufw status
```

---

## 🔒 12. GÜVENLİK YAPıLANDıRMASI

Temel güvenlik ayarları:
```bash
# Fail2ban kur (brute force saldırılarına karşı)
sudo apt install fail2ban -y

# PostgreSQL güvenliği
sudo nano /etc/postgresql/15/main/postgresql.conf
# listen_addresses = 'localhost' olduğundan emin olun

sudo nano /etc/postgresql/15/main/pg_hba.conf
# local connections için 'peer' authentication kullanın

# PostgreSQL'i yeniden başlat
sudo systemctl restart postgresql
```

---

## ✅ 13. KURULUM KONTROLÜ

Kurulumun başarılı olduğunu kontrol edin:

```bash
# PM2 durumu
pm2 status

# Nginx durumu  
sudo systemctl status nginx

# PostgreSQL durumu
sudo systemctl status postgresql

# Port kontrolü (5000 portu aktif olmalı)
sudo netstat -tlnp | grep :5000

# Log kontrolü
pm2 logs ak-parti-gk-camp
```

Web tarayıcınızda şuraya gidin:
```
http://2.59.117.53
```

---

## 🔄 14. GÜNCELLEME VE BAKIL

### Kod Güncellemesi
```bash
cd /var/www/ak-parti-gk-camp

# Git ile güncelle (eğer git kullanıyorsanız)
git pull origin main

# Dependencies güncelle
npm install

# Yeniden build et
npm run build

# PM2'yi yeniden başlat
pm2 restart ak-parti-gk-camp
```

### Log Kontrolü
```bash
# Uygulama logları
pm2 logs ak-parti-gk-camp

# Nginx logları
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Sistem logları
sudo journalctl -f -u nginx
```

### Backup
```bash
# Database backup
sudo -u postgres pg_dump ak_parti_gk_camp > backup_$(date +%Y%m%d_%H%M%S).sql

# Dosya backup
tar -czf backup_files_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/ak-parti-gk-camp
```

---

## 🌍 15. DOMAIN EKLEME (SONRADAN)

Domain'iniz hazır olduğunda:

1. **DNS Ayarları**: Domain'inizi VPS IP'nize yönlendirin (A kaydı)

2. **Nginx Güncelleme**:
```bash
sudo nano /etc/nginx/sites-available/ak-parti-gk-camp

# server_name satırını güncelleyin:
server_name yourdomain.com www.yourdomain.com;
```

3. **SSL Sertifikası** (Let's Encrypt):
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🆘 SORUN GİDERME

### Yaygın Sorunlar:

**1. Port 5000'e erişilemiyor:**
```bash
sudo ufw allow 5000/tcp
sudo netstat -tlnp | grep :5000
```

**2. Database bağlantı hatası:**
```bash
# PostgreSQL çalışıyor mu?
sudo systemctl status postgresql

# Database var mı?
sudo -u postgres psql -l
```

**3. Build hatası:**
```bash
# Node modules temizle ve yeniden kur
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**4. PM2 başlamıyor:**
```bash
pm2 kill
pm2 start ecosystem.config.js
```

---

## 📞 YARDIM

Kurulum sırasında sorun yaşarsanız:
1. Logları kontrol edin: `pm2 logs`
2. Nginx loglarını kontrol edin: `sudo tail -f /var/log/nginx/error.log`
3. System durumunu kontrol edin: `sudo systemctl status nginx postgresql`

**Not**: Bu rehber IP adresi üzerinden erişim içindir. Domain ekledikten sonra SSL sertifikası da eklemenizi öneririm.