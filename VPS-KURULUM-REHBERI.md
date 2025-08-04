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

**Sizin VPS Bağlantı Bilgileriniz:**
- **IP Adresi**: 2.59.117.53
- **Port**: 22
- **Kullanıcı Adı**: virtcon-W6tcX6pk
- **Şifre**: Xn5ty6iJxnexMBXR

Git Bash ile sunucunuza bağlanın:
```bash
ssh virtcon-W6tcX6pk@2.59.117.53
# Şifre sorulduğunda: Xn5ty6iJxnexMBXR
```

**Not**: İlk bağlantıda "authenticity of host" onayı istenirse **yes** yazın.

Sistem güncellemesi:
```bash
sudo apt update && sudo apt upgrade -y
```

---

## 🟢 2. NODE.JS KURULUMU

Node.js 20.x kurulumu:
```bash
# NodeSource repository ekle
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js kur
sudo apt-get install -y nodejs

# Versiyonları kontrol et
node --version    # v20.x.x olmalı
npm --version     # 10.x.x olmalı
```

---

## 🐘 3. POSTGRESQL KURULUMU

PostgreSQL 15 kurulumu:
```bash
# PostgreSQL kur
sudo apt install postgresql postgresql-contrib -y

# PostgreSQL servisini başlat
sudo systemctl start postgresql
sudo systemctl enable postgresql

# PostgreSQL kullanıcısına geç
sudo -u postgres psql

# Veritabanı oluştur (PostgreSQL shell içinde)
CREATE DATABASE ak_parti_gk_camp;
CREATE USER app_user WITH PASSWORD 'GüçlüŞifre123!';
GRANT ALL PRIVILEGES ON DATABASE ak_parti_gk_camp TO app_user;
ALTER USER app_user CREATEDB;
\q

# PostgreSQL bağlantısını test et
sudo -u postgres psql -d ak_parti_gk_camp -c "SELECT version();"
```

---

## 📁 4. PROJE DOSYALARINI YÜKLEME

### Seçenek A: Git ile (Önerilen)
```bash
# Proje klasörü oluştur
sudo mkdir -p /var/www/ak-parti-gk-camp
sudo chown -R $USER:$USER /var/www/ak-parti-gk-camp
cd /var/www/ak-parti-gk-camp

# Git repository'yi clone et (eğer GitHub'da varsa)
git clone YOUR_REPO_URL .

# veya dosyaları manuel olarak yükleyin
```

### Seçenek B: SCP ile Dosya Yükleme
Local makinenizden Git Bash ile:
```bash
# Tüm proje dosyalarını yükle
scp -r /path/to/your/project/* virtcon-W6tcX6pk@2.59.117.53:/var/www/ak-parti-gk-camp/
```

---

## 🔧 5. ENVIRONMENT VARIABLES AYARLARI

Environment dosyası oluşturun:
```bash
cd /var/www/ak-parti-gk-camp
nano .env
```

`.env` dosyasına şunları yazın:
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

Dosyayı kaydedin (Ctrl+X, Y, Enter)

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
VALUES ('Gülbahar', 'Öztürk', '47704699208', '$2b$10$encrypted_password_here', 'genelsekreterlik', true);

-- Yusuf İbiş (Genel Başkan)
INSERT INTO users (first_name, last_name, tc_number, password, role, is_active) 
VALUES ('Yusuf', 'İbiş', '46480904230', '$2b$10$encrypted_password_here', 'genelbaskan', true);
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