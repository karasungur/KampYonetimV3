# AK Parti Gençlik Kolları Yönetim Sistemi
## Ubuntu VPS Deployment Rehberi

Bu rehber, AK Parti Gençlik Kolları Yönetim Sistemi'ni Replit'ten Ubuntu VPS'e taşımak için gerekli tüm adımları içermektedir.

## 📋 İçindekiler

1. [Sistem Gereksinimleri](#sistem-gereksinimleri)
2. [Kurulum Öncesi Hazırlık](#kurulum-öncesi-hazırlık)
3. [Otomatik Kurulum](#otomatik-kurulum)
4. [Manuel Kurulum](#manuel-kurulum)
5. [Veritabanı Migrasyonu](#veritabanı-migrasyonu)
6. [SSL Kurulumu](#ssl-kurulumu)
7. [Servis Yönetimi](#servis-yönetimi)
8. [Monitoring ve Bakım](#monitoring-ve-bakım)
9. [Troubleshooting](#troubleshooting)

## 🖥️ Sistem Gereksinimleri

### Minimum Sistem Özellikleri
- **İşletim Sistemi**: Ubuntu 20.04, 22.04 veya 24.04 LTS
- **RAM**: En az 4GB (8GB önerilir)
- **CPU**: 2 core minimum (4 core önerilir)
- **Disk**: 50GB SSD (100GB önerilir)
- **Network**: 1Gbps bağlantı

### Önerilen VPS Sağlayıcıları
- DigitalOcean (4GB Droplet)
- Linode (4GB Linode)
- Vultr (4GB Instance)
- AWS EC2 (t3.medium)
- Google Cloud (e2-standard-2)

## 🚀 Kurulum Öncesi Hazırlık

### 1. VPS'e SSH Bağlantısı
```bash
ssh root@YOUR_SERVER_IP
```

### 2. Sistem Kullanıcısı Oluştur
```bash
adduser akparti
usermod -aG sudo akparti
su - akparti
```

### 3. SSH Key Kurulumu (Önerilir)
```bash
mkdir ~/.ssh
chmod 700 ~/.ssh
# Kendi public key'inizi ekleyin
echo "your-public-key" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 4. Domain Ayarları
- Domain'inizi VPS IP adresine yönlendirin
- A record: `akpartigenclik.yourdomain.com` → `YOUR_SERVER_IP`
- A record: `www.akpartigenclik.yourdomain.com` → `YOUR_SERVER_IP`

## ⚡ Otomatik Kurulum

### 1. Kurulum Scriptini İndir ve Çalıştır
```bash
# Replit'ten dosyaları indirin veya git clone yapın
wget https://raw.githubusercontent.com/your-repo/akparti-genclik/main/install-ubuntu.sh
chmod +x install-ubuntu.sh
./install-ubuntu.sh yourdomain.com
```

### 2. Kurulum Sonrası Kontrol
```bash
systemctl status postgresql
systemctl status nginx
systemctl status redis-server
node --version
python3.11 --version
```

## 🔧 Manuel Kurulum

Otomatik kurulum başarısız olursa, manuel kurulum adımları:

### 1. Node.js Kurulumu
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pm2 typescript
```

### 2. Python Kurulumu
```bash
sudo apt update
sudo apt install -y python3.11 python3.11-dev python3.11-venv python3-pip
sudo apt install -y libopencv-dev python3-opencv libgl1-mesa-glx
```

### 3. PostgreSQL Kurulumu
```bash
sudo apt install -y postgresql-15 postgresql-contrib-15
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Veritabanı ve kullanıcı oluştur
sudo -u postgres createuser --interactive akparti_user
sudo -u postgres createdb akparti_genclik_db -O akparti_user
```

### 4. Nginx Kurulumu
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## 📦 Proje Deployment

### 1. Proje Kodlarını Kopyala
```bash
# Replit'ten export yapın ve VPS'e yükleyin
cd /opt
sudo git clone https://github.com/your-repo/akparti-genclik.git
sudo chown -R akparti:akparti akparti-genclik
cd akparti-genclik
```

### 2. Environment Dosyasını Oluştur
```bash
cp .env.example .env
nano .env
# Gerekli değişkenleri yapılandırın
```

### 3. Bağımlılıkları Yükle
```bash
# Node.js bağımlılıkları
npm install

# Python sanal ortamı
python3.11 -m venv venv
source venv/bin/activate
pip install -r python-requirements.txt
deactivate
```

### 4. Projeyi Derle
```bash
npm run build
```

## 🗄️ Veritabanı Migrasyonu

### 1. Replit'ten Veritabanı Export
```bash
# Replit'te çalıştırın
pg_dump $DATABASE_URL > akparti_backup.sql
```

### 2. VPS'e Veritabanı Import
```bash
# Backup dosyasını VPS'e yükleyin
scp akparti_backup.sql akparti@YOUR_SERVER_IP:/tmp/

# VPS'te import edin
sudo -u postgres psql akparti_genclik_db < /tmp/akparti_backup.sql

# Veya schema migrasyonu
npm run db:push
```

### 3. Veritabanı Bağlantısını Test Et
```bash
npm run check
```

## 🔐 SSL Kurulumu

### 1. Let's Encrypt Kurulumu
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. SSL Sertifikası Al
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 3. Otomatik Yenileme Ayarla
```bash
sudo crontab -e
# Şu satırı ekleyin:
0 2 * * * /usr/bin/certbot renew --quiet
```

## 🌐 Nginx Yapılandırması

### 1. Site Yapılandırması
```bash
sudo cp nginx-akparti.conf /etc/nginx/sites-available/akparti-genclik
sudo ln -s /etc/nginx/sites-available/akparti-genclik /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

### 2. Nginx Test ve Restart
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🚀 Servis Yönetimi

### 1. Systemd Service (Önerilen)
```bash
sudo cp akparti-genclik.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable akparti-genclik
sudo systemctl start akparti-genclik
```

### 2. PM2 ile Yönetim (Alternatif)
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 3. Servis Durumunu Kontrol Et
```bash
systemctl status akparti-genclik
journalctl -u akparti-genclik -f
```

## 📊 Monitoring ve Bakım

### 1. Sağlık Kontrolü Script
```bash
chmod +x health-check.sh
./health-check.sh
```

### 2. Otomatik Backup Ayarla
```bash
chmod +x backup.sh
sudo crontab -e
# Günlük backup için:
0 2 * * * /opt/akparti-genclik/backup.sh
```

### 3. Log Monitoring
```bash
# Ana uygulama logları
tail -f /var/log/akparti-genclik/combined.log

# Nginx logları
tail -f /var/log/nginx/akparti-access.log

# Sistem logları
journalctl -u akparti-genclik -f
```

### 4. Performans Monitoring
```bash
# CPU ve Memory kullanımı
htop

# Disk kullanımı
df -h

# Network bağlantıları
netstat -tlnp
```

## 🔄 Güncelleme İşlemi

### 1. Otomatik Deployment
```bash
chmod +x deploy.sh
./deploy.sh
```

### 2. Manuel Güncelleme
```bash
cd /opt/akparti-genclik
git pull origin main
npm install
npm run build
sudo systemctl restart akparti-genclik
```

## 🔒 Güvenlik Önlemleri

### 1. Güvenlik Duvarı
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 2. Fail2ban Yapılandırması
```bash
sudo systemctl enable fail2ban
sudo fail2ban-client status
```

### 3. SSH Güvenliği
```bash
# /etc/ssh/sshd_config düzenle
PermitRootLogin no
PasswordAuthentication no
Port 2222  # Varsayılan port değiştir
```

### 4. Düzenli Güvenlik Güncellemeleri
```bash
sudo crontab -e
# Haftalık güvenlik güncellemeleri:
0 3 * * 0 apt update && apt upgrade -y
```

## 🚨 Troubleshooting

### Yaygın Sorunlar ve Çözümleri

#### 1. Uygulama Başlamıyor
```bash
# Logları kontrol et
journalctl -u akparti-genclik -n 50

# Port kullanımını kontrol et
netstat -tlnp | grep 5000

# Process'leri kontrol et
ps aux | grep node
```

#### 2. Veritabanı Bağlantı Sorunu
```bash
# PostgreSQL durumunu kontrol et
systemctl status postgresql

# Bağlantıyı test et
psql -h localhost -U akparti_user -d akparti_genclik_db

# Log kontrolü
tail -f /var/log/postgresql/postgresql-15-main.log
```

#### 3. Nginx 502 Bad Gateway
```bash
# Nginx error loglarını kontrol et
tail -f /var/log/nginx/error.log

# Upstream servisleri kontrol et
curl http://localhost:5000/health

# Nginx yapılandırmasını test et
nginx -t
```

#### 4. SSL Sertifika Sorunları
```bash
# Sertifika durumunu kontrol et
certbot certificates

# Manuel yenileme
certbot renew --dry-run

# Nginx SSL yapılandırması test
openssl s_client -connect yourdomain.com:443
```

#### 5. Yüksek CPU/Memory Kullanımı
```bash
# Process'leri analiz et
top -p $(pgrep -d, node)

# Memory leak kontrol
ps aux --sort=-%mem | head

# Log boyutlarını kontrol et
du -sh /var/log/akparti-genclik/
```

### Acil Durum Komutları

```bash
# Servisi durdur
sudo systemctl stop akparti-genclik

# Önceki sürüme geri dön
cd /var/backups/akparti-genclik
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz -C /opt/

# Maintenance mode
echo "Bakım modu - Kısa süre sonra geri döneceğiz" > /var/www/html/maintenance.html
```

## 📞 Destek ve İletişim

Sorun yaşadığınızda:
1. Bu rehberdeki troubleshooting bölümünü kontrol edin
2. Log dosyalarını inceleyin
3. Health check scriptini çalıştırın
4. Sistem yöneticisine ulaşın

## 📝 Notlar

- Tüm değişikliklerde backup almayı unutmayın
- Production'da değişiklik yapmadan önce test ortamında deneyin
- Log dosyalarını düzenli olarak temizleyin
- SSL sertifikalarının yenileme tarihlerini takip edin
- Güvenlik güncellemelerini düzenli olarak yapın

Bu rehber düzenli olarak güncellenmektedir. En son sürüm için repository'yi kontrol edin.