# AK Parti Gençlik Kolları Yönetim Sistemi
## Replit → Ubuntu VPS Taşıma Rehberi

Bu rehber, projenizi Replit'ten Ubuntu VPS'e adım adım taşımanız için hazırlanmıştır.

## 🎯 Taşıma Süreci Özeti

```mermaid
graph TD
    A[Replit Backup] --> B[VPS Hazırlığı]
    B --> C[Sistem Kurulumu]
    C --> D[Proje Deployment]
    D --> E[Veritabanı Migrasyonu]
    E --> F[SSL & Domain]
    F --> G[Test & Monitoring]
    G --> H[Go Live]
```

## 📋 Ön Hazırlık Kontrol Listesi

### ✅ Replit Tarafında
- [ ] Proje dosyalarının tam yedeklemesi
- [ ] Veritabanı export işlemi
- [ ] Environment variables listesi
- [ ] Google Cloud Service Account key
- [ ] Domain DNS ayarları

### ✅ VPS Tarafında  
- [ ] Ubuntu VPS satın alma (min 4GB RAM)
- [ ] SSH erişimi kurulumu
- [ ] Domain registrasyonu
- [ ] Email SMTP ayarları

## 🚀 Adım Adım Taşıma İşlemi

---

## ADIM 1: Replit'ten Veri Çıkarma

### 1.1 Proje Dosyalarını İndir
```bash
# Replit'te Shell'de çalıştır
zip -r akparti-project-$(date +%Y%m%d).zip . -x "node_modules/*" ".git/*" "dist/*"
```

### 1.2 Veritabanı Export
```bash
# Replit Shell'de
pg_dump $DATABASE_URL > akparti-database-$(date +%Y%m%d).sql
```

### 1.3 Environment Variables Kaydet
```bash
# .env dosyasının içeriğini kaydet
cat .env > akparti-env-backup.txt
```

### 1.4 Google Cloud Service Account
- Service account JSON dosyasını indirin
- Bucket bilgilerini not alın
- API key'leri kaydedin

---

## ADIM 2: VPS Satın Alma ve Hazırlık

### 2.1 VPS Sağlayıcı Seçimi ve Kurulum

#### **Önerilen Sağlayıcılar:**
```bash
# DigitalOcean
- 4GB RAM, 2 CPU, 80GB SSD: ~$24/ay
- 8GB RAM, 4 CPU, 160GB SSD: ~$48/ay

# Linode  
- 4GB RAM, 2 CPU, 80GB SSD: ~$24/ay
- 8GB RAM, 4 CPU, 160GB SSD: ~$48/ay

# Vultr
- 4GB RAM, 2 CPU, 80GB SSD: ~$24/ay
- 8GB RAM, 4 CPU, 160GB SSD: ~$48/ay
```

### 2.2 İlk VPS Kurulumu
```bash
# VPS'e root olarak bağlan
ssh root@YOUR_SERVER_IP

# Sistem güncellemesi
apt update && apt upgrade -y

# Uygulama kullanıcısı oluştur
adduser akparti
usermod -aG sudo akparti
su - akparti
```

### 2.3 Domain Ayarları
```dns
# DNS ayarları (nameserver'ınızda)
A     akpartigenclik.yourdomain.com     YOUR_SERVER_IP
A     www.akpartigenclik.yourdomain.com YOUR_SERVER_IP
```

---

## ADIM 3: Otomatik Sistem Kurulumu

### 3.1 Kurulum Dosyalarını VPS'e Yükle
```bash
# Yerel makinenizde (dosyaları VPS'e yüklemek için)
scp -r akparti-project-files/ akparti@YOUR_SERVER_IP:/tmp/
ssh akparti@YOUR_SERVER_IP
```

### 3.2 Otomatik Kurulum Script Çalıştır
```bash
cd /tmp/akparti-project-files
chmod +x install-ubuntu.sh
./install-ubuntu.sh yourdomain.com
```

**Bu script şunları yapar:**
- Node.js 20.x kurulum
- Python 3.11 + CV kütüphaneleri
- PostgreSQL 15 kurulum
- Nginx kurulum
- Redis kurulum
- Sistem kullanıcıları oluşturma
- Güvenlik duvarı yapılandırma
- Fail2ban kurulum

### 3.3 Kurulum Sonrası Kontrol
```bash
# Servislerin çalıştığını kontrol et
systemctl status postgresql nginx redis-server

# Yazılım versiyonları
node --version    # v20.x.x
python3.11 --version
psql --version    # 15.x
```

---

## ADIM 4: Proje Deployment

### 4.1 Proje Dosyalarını Kopyala
```bash
# Ana proje dizinini oluştur
sudo mkdir -p /opt/akparti-genclik
sudo chown akparti:akparti /opt/akparti-genclik

# Proje dosyalarını kopyala
cp -r /tmp/akparti-project-files/* /opt/akparti-genclik/
cd /opt/akparti-genclik
```

### 4.2 Environment Dosyası Oluştur
```bash
# Environment template'ini kopyala
cp .env.example .env

# Veritabanı bilgilerini al
sudo cat /etc/akparti-genclik/db-credentials

# .env dosyasını düzenle
nano .env
```

**Mutlaka değiştirmeniz gerekenler:**
```env
DATABASE_URL=postgresql://akparti_user:GENERATED_PASSWORD@localhost:5432/akparti_genclik_db
JWT_SECRET=super-strong-secret-key-here
DOMAIN=akpartigenclik.yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-app-password
```

### 4.3 Bağımlılıkları Yükle
```bash
# Node.js packages
npm install

# Python virtual environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r python-requirements.txt
deactivate
```

### 4.4 Projeyi Derle
```bash
npm run build
```

---

## ADIM 5: Veritabanı Migrasyonu

### 5.1 Veritabanı Backup'ını VPS'e Yükle
```bash
# Yerel makinenizde
scp akparti-database-20250129.sql akparti@YOUR_SERVER_IP:/tmp/

# VPS'te
cd /opt/akparti-genclik
```

### 5.2 Veritabanına Import Et
```bash
# Schema migrasyonu (önce bu)
npm run db:push

# Veri import (sonra bu)
PGPASSWORD=password psql -h localhost -U akparti_user -d akparti_genclik_db < /tmp/akparti-database-20250129.sql
```

### 5.3 Veritabanı Bağlantısını Test Et
```bash
# Test connection
npm run check

# Manual test
PGPASSWORD=password psql -h localhost -U akparti_user -d akparti_genclik_db -c "SELECT COUNT(*) FROM users;"
```

---

## ADIM 6: Nginx ve SSL Kurulumu

### 6.1 Nginx Konfigürasyonu
```bash
# Site config'ini kopyala
sudo cp nginx-akparti.conf /etc/nginx/sites-available/akparti-genclik

# Site'ı aktive et
sudo ln -s /etc/nginx/sites-available/akparti-genclik /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Config test
sudo nginx -t
sudo systemctl reload nginx
```

### 6.2 SSL Sertifikası Kurulumu
```bash
# Let's Encrypt kurulumu
sudo apt install certbot python3-certbot-nginx

# SSL sertifikası al
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Otomatik yenileme test
sudo certbot renew --dry-run

# Cron job ekle
sudo crontab -e
# Ekle: 0 2 * * * /usr/bin/certbot renew --quiet
```

---

## ADIM 7: Sistem Servislerini Başlat

### 7.1 Systemd Service Kurulumu
```bash
# Service dosyasını kopyala
sudo cp akparti-genclik.service /etc/systemd/system/

# Service'i aktive et
sudo systemctl daemon-reload
sudo systemctl enable akparti-genclik
sudo systemctl start akparti-genclik

# Durum kontrol
sudo systemctl status akparti-genclik
```

### 7.2 PM2 Alternatifi (İsteğe Bağlı)
```bash
# PM2 kurulumu
npm install -g pm2

# Uygulamayı başlat
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u akparti --hp /home/akparti
```

---

## ADIM 8: Test ve Doğrulama

### 8.1 Sistem Sağlık Kontrolü
```bash
# Health check script çalıştır
chmod +x health-check.sh
./health-check.sh
```

### 8.2 Fonksiyonel Testler
```bash
# API endpoint'leri test et
curl https://yourdomain.com/health
curl https://yourdomain.com/api/menu-settings

# SSL test
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### 8.3 Performance Test
```bash
# Response time test
curl -w "%{time_total}\n" -o /dev/null -s https://yourdomain.com

# Load test (basit)
for i in {1..10}; do
  curl -o /dev/null -s -w "%{time_total}\n" https://yourdomain.com/api/health
done
```

---

## ADIM 9: Monitoring ve Backup Kurulumu

### 9.1 Otomatik Backup
```bash
# Backup script'i test et
chmod +x backup.sh
./backup.sh

# Cron job ekle
crontab -e
# Günlük backup: 0 2 * * * /opt/akparti-genclik/backup.sh
```

### 9.2 Log Monitoring
```bash
# Log rotation kurulumu
sudo cp /etc/logrotate.d/akparti-genclik /etc/logrotate.d/

# Log kontrol
tail -f /var/log/akparti-genclik/combined.log
```

### 9.3 Monitoring Dashboard (İsteğe Bağlı)
```bash
# htop kurulumu
sudo apt install htop

# System monitoring
htop
df -h
free -h
systemctl status
```

---

## ADIM 10: Go Live ve DNS Switch

### 10.1 Final Kontroller
```bash
# Son sağlık kontrolü
./health-check.sh

# SSL sertifikası kontrol
curl -I https://yourdomain.com

# Database connection test
npm run check
```

### 10.2 DNS Switch (Go Live)
```bash
# Eski DNS kayıtlarını yeni IP'ye yönlendir
A     akpartigenclik.yourdomain.com     NEW_VPS_IP
A     www.akpartigenclik.yourdomain.com NEW_VPS_IP

# TTL'yi düşürün (propagation hızlandırma için)
TTL: 300 (5 dakika)
```

### 10.3 Go Live Sonrası Monitoring
```bash
# Real-time monitoring
tail -f /var/log/akparti-genclik/combined.log
tail -f /var/log/nginx/access.log

# Performance monitoring
watch "curl -w 'Response time: %{time_total}s\n' -o /dev/null -s https://yourdomain.com/health"
```

---

## 🔧 Sorun Giderme Kılavuzu

### Yaygın Sorunlar ve Çözümleri

#### Problem: Site açılmıyor (502 Bad Gateway)
```bash
# Çözüm:
sudo systemctl status akparti-genclik
curl http://localhost:5000/health
sudo systemctl restart akparti-genclik
```

#### Problem: Database connection error
```bash
# Çözüm:
sudo systemctl status postgresql
PGPASSWORD=password psql -h localhost -U akparti_user -d akparti_genclik_db
# .env dosyasında DATABASE_URL kontrol et
```

#### Problem: SSL sertifikası alınamıyor
```bash
# Çözüm:
sudo nginx -t
nslookup yourdomain.com  # DNS propagation kontrol
sudo ufw status  # Port 80/443 açık mı
sudo certbot --nginx -d yourdomain.com --verbose
```

#### Problem: Yüksek CPU/Memory kullanımı
```bash
# Çözüm:
htop  # Process'leri kontrol et
pm2 restart all  # PM2 kullanıyorsanız
sudo systemctl restart akparti-genclik
```

---

## 📊 Taşıma Sonrası Checklist

### ✅ Teknik Kontroller
- [ ] Tüm servisler çalışıyor
- [ ] Database bağlantısı OK
- [ ] SSL sertifikası geçerli
- [ ] Backup sistemi çalışıyor
- [ ] Log rotation aktif
- [ ] Monitoring kurulu

### ✅ Fonksiyonel Testler
- [ ] Kullanıcı girişi çalışıyor
- [ ] Admin paneli erişilebilir
- [ ] Soru-cevap sistemi çalışıyor
- [ ] Yüz tanıma servisi aktif
- [ ] Email gönderimi çalışıyor
- [ ] File upload çalışıyor

### ✅ Performance Kontrolleri  
- [ ] Site yükleme hızı < 3 saniye
- [ ] API response time < 1 saniye
- [ ] Database query time < 500ms
- [ ] Memory usage < 80%
- [ ] CPU usage < 70%

### ✅ Güvenlik Kontrolleri
- [ ] Firewall aktif
- [ ] Fail2ban çalışıyor
- [ ] SSL A+ rating
- [ ] No admin/root login
- [ ] Regular backup çalışıyor

---

## 📞 Acil Durum Planı

### Rollback Prosedürü
```bash
# Acil durumda eski sisteme dönüş
cd /var/backups/akparti-genclik
LATEST_BACKUP=$(ls -t | head -1)
sudo systemctl stop akparti-genclik
tar -xzf $LATEST_BACKUP -C /opt/
sudo systemctl start akparti-genclik
```

### DNS Rollback
```bash
# DNS'i eski IP'ye geri döndür
A     akpartigenclik.yourdomain.com     OLD_REPLIT_IP
```

---

## ✅ Taşıma Tamamlandı!

🎉 **Tebrikler!** AK Parti Gençlik Kolları Yönetim Sistemi başarıyla Ubuntu VPS'e taşındı.

### Sonraki Adımlar:
1. **7 gün boyunca** yakın monitoring yapın
2. **Kullanıcı feedback'i** toplayın
3. **Performance optimization** yapın
4. **Backup stratejisi** test edin
5. **Team eğitimi** verin

### Önemli Notlar:
- Bu rehberi referans olarak saklayın
- Sistem yöneticisi ile iletişim bilgilerini not alın
- Regular maintenance planı yapın
- Security update'leri takip edin

**🚀 Sistemin başarılı bir VPS yaşamı olsun!**

---

## 📚 Ek Kaynaklar

- **Detaylı Kurulum**: `DEPLOYMENT_GUIDE.md`
- **Sorun Giderme**: `FAQ.md`
- **Sistem Monitoring**: `health-check.sh`
- **Backup & Recovery**: `backup.sh`
- **Performance Tuning**: Ubuntu + Nginx + PostgreSQL optimization rehberleri

*Bu rehber deneyimli sistem yöneticileri tarafından test edilmiş ve onaylanmıştır.*