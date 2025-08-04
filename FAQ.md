# Sık Sorulan Sorular (FAQ)
## AK Parti Gençlik Kolları Yönetim Sistemi

Bu dokümanda sistem hakkında sık sorulan sorular ve çözümleri yer almaktadır.

## 📑 İçindekiler

1. [Genel Sorular](#genel-sorular)
2. [Kurulum ve Yapılandırma](#kurulum-ve-yapılandırma)
3. [Veritabanı Sorunları](#veritabanı-sorunları)
4. [Performance Sorunları](#performance-sorunları)
5. [Güvenlik Sorunları](#güvenlik-sorunları)
6. [Yedekleme ve Kurtarma](#yedekleme-ve-kurtarma)
7. [Monitoring ve Loglar](#monitoring-ve-loglar)
8. [SSL ve Domain Sorunları](#ssl-ve-domain-sorunları)
9. [Yüz Tanıma Sistemi](#yüz-tanıma-sistemi)
10. [Troubleshooting](#troubleshooting)

---

## 🤔 Genel Sorular

### S: Sistem hangi işletim sistemlerinde çalışır?
**C:** Sistem Ubuntu 20.04, 22.04 ve 24.04 LTS sürümlerinde test edilmiştir. Diğer Linux dağıtımlarında da çalışabilir ancak resmi olarak desteklenmemektedir.

### S: Minimum sistem gereksinimleri nelerdir?
**C:** 
- **RAM**: 4GB minimum (8GB önerilir)
- **CPU**: 2 core minimum (4 core önerilir) 
- **Disk**: 50GB SSD (100GB önerilir)
- **Network**: 1Gbps bağlantı

### S: Sistem kaç kullanıcıyı destekler?
**C:** Donanım kaynaklarına bağlı olarak aynı anda 100-500 kullanıcı desteklenebilir. Yoğun kullanım durumunda horizontal scaling yapılabilir.

### S: Hangi veritabanlarını destekliyor?
**C:** Sistem PostgreSQL 13+ sürümlerini desteklemektedir. MySQL veya diğer veritabanları için ek konfigürasyon gereklidir.

---

## 🔧 Kurulum ve Yapılandırma

### S: Otomatik kurulum scripti çalışmıyor, ne yapmalıyım?
**C:** 
1. İnternet bağlantınızı kontrol edin
2. Ubuntu sürümünüzü kontrol edin: `lsb_release -a`
3. Script yetkilerini kontrol edin: `chmod +x install-ubuntu.sh`
4. Log dosyasını inceleyin: `tail -f /var/log/akparti-install.log`

### S: .env dosyası nasıl yapılandırılır?
**C:** 
```bash
cp .env.example .env
nano .env
# Aşağıdaki değerleri mutlaka değiştirin:
# - DATABASE_URL
# - JWT_SECRET
# - DOMAIN
# - Email SMTP ayarları
```

### S: Port 5000 zaten kullanımda hatası alıyorum
**C:** 
```bash
# Hangi process'in kullandığını bulun
sudo netstat -tlnp | grep :5000
# Process'i durdurun
sudo kill -9 PROCESS_ID
# Veya .env'de farklı port kullanın
PORT=5001
```

### S: NPM install sırasında hata alıyorum
**C:** 
```bash
# Node.js sürümünü kontrol edin
node --version  # 20.x olmalı
# NPM cache'i temizleyin
npm cache clean --force
# Node_modules'u silin ve tekrar yükleyin
rm -rf node_modules package-lock.json
npm install
```

### S: Python bağımlılık kurulumu başarısız oluyor
**C:** 
```bash
# Python sürümünü kontrol edin
python3.11 --version
# Sistem paketlerini yükleyin
sudo apt install python3.11-dev build-essential
# Sanal ortamı yeniden oluşturun
rm -rf venv
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r python-requirements.txt
```

---

## 🗄️ Veritabanı Sorunları

### S: Veritabanına bağlanamıyorum
**C:** 
```bash
# PostgreSQL servisini kontrol edin
sudo systemctl status postgresql
# Bağlantıyı test edin
psql -h localhost -U akparti_user -d akparti_genclik_db
# Connection string'i kontrol edin
echo $DATABASE_URL
```

### S: Migration hatası alıyorum
**C:** 
```bash
# Veritabanı backup alın
pg_dump akparti_genclik_db > backup.sql
# Migration'ı force edin
npm run db:push --force
# Hata devam ederse manual migration yapın
psql akparti_genclik_db < migrations/manual.sql
```

### S: Veritabanı çok büyüdü, nasıl temizlerim?
**C:** 
```sql
-- Eski logları silin
DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '30 days';
-- VACUUM yapın
VACUUM FULL activity_logs;
-- Index'leri rebuild edin
REINDEX DATABASE akparti_genclik_db;
```

### S: Veritabanı backup nasıl alınır?
**C:** 
```bash
# Otomatik backup script kullanın
./backup.sh
# Manuel backup
pg_dump -h localhost -U akparti_user akparti_genclik_db > backup.sql
# Compressed backup
pg_dump -h localhost -U akparti_user -Fc akparti_genclik_db > backup.dump
```

---

## 🚀 Performance Sorunları

### S: Uygulama yavaş çalışıyor
**C:** 
1. **Sistem kaynaklarını kontrol edin**:
```bash
htop  # CPU/Memory kullanımı
iotop  # Disk I/O
```

2. **Database performance**:
```sql
-- Slow query'leri bulun
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
-- Index eksik mi kontrol edin
EXPLAIN ANALYZE SELECT * FROM your_query;
```

3. **Application logs kontrol edin**:
```bash
tail -f /var/log/akparti-genclik/combined.log | grep "slow"
```

### S: Memory usage çok yüksek
**C:** 
```bash
# Memory leak var mı kontrol edin
ps aux --sort=-%mem | head -10
# Node.js heap dump alın
kill -USR2 `pgrep node`
# PM2 ile restart edin
pm2 restart all
```

### S: Database connection pool exhausted hatası
**C:** 
```javascript
// drizzle config'de connection pool artırın
{
  min: 5,
  max: 30,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 600000
}
```

### S: Frontend yavaş yükleniyor
**C:** 
1. **Build optimization**:
```bash
npm run build -- --sourcemap=false
```

2. **Static asset caching**:
```nginx
location /static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    gzip_static on;
}
```

---

## 🔒 Güvenlik Sorunları

### S: 401 Unauthorized hatası alıyorum
**C:** 
```bash
# JWT secret kontrol edin
grep JWT_SECRET .env
# Token expire süresi kontrol edin
# Browser'da token'ı silin ve tekrar login olun
localStorage.clear()
```

### S: CORS hatası alıyorum
**C:** 
```javascript
// server/index.ts'de CORS ayarlarını kontrol edin
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true
}));
```

### S: Rate limiting çok agresif
**C:** 
```nginx
# nginx.conf'da rate limit ayarlarını güncelleyin
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
limit_req zone=api burst=40 nodelay;
```

### S: Fail2ban çok fazla IP ban'lıyor
**C:** 
```bash
# Ban'lı IP'leri görün
sudo fail2ban-client status nginx-limit-req
# IP ban'ını kaldırın
sudo fail2ban-client set nginx-limit-req unbanip IP_ADDRESS
# Ayarları güncelleyin
sudo nano /etc/fail2ban/jail.local
```

---

## 💾 Yedekleme ve Kurtarma

### S: Backup script çalışmıyor
**C:** 
```bash
# Script yetkilerini kontrol edin
chmod +x backup.sh
# Cron job'u kontrol edin
crontab -l
# Manuel çalıştırıp hata görün
./backup.sh
```

### S: Backup'tan nasıl restore yaparım?
**C:** 
```bash
# Backup arşivini açın
tar -xzf akparti_backup_20250129_123456.tar.gz
# Veritabanını restore edin
pg_restore -h localhost -U akparti_user -d akparti_genclik_db --clean database.dump
# Uygulama dosyalarını restore edin
tar -xzf application.tar.gz -C /opt/
# Servisleri restart edin
sudo systemctl restart akparti-genclik
```

### S: Backup dosyaları çok büyük
**C:** 
```bash
# Compression level artırın
tar -czf backup.tar.gz --use-compress-program="gzip -9" data/
# Eski logları backup'a dahil etmeyin
tar --exclude="*.log" -czf backup.tar.gz data/
# Differential backup yapın
rsync -av --delete source/ backup/
```

---

## 📊 Monitoring ve Loglar

### S: Log dosyaları çok büyüdü
**C:** 
```bash
# Log rotation ayarlarını kontrol edin
sudo nano /etc/logrotate.d/akparti-genclik
# Manuel rotation yapın
sudo logrotate -f /etc/logrotate.d/akparti-genclik
# Log dosyalarını temizleyin
> /var/log/akparti-genclik/combined.log
```

### S: Health check başarısız oluyor
**C:** 
```bash
# Health check scriptini çalıştırın
./health-check.sh
# Manuel health check yapın
curl http://localhost:5000/health
# Servis durumunu kontrol edin
systemctl status akparti-genclik
```

### S: Loglar analiz etmek zor
**C:** 
```bash
# JSON formatında loglar için jq kullanın
tail -f /var/log/akparti-genclik/combined.log | jq .
# Hata loglarını filtreleyin
grep "ERROR" /var/log/akparti-genclik/* | tail -20
# Log analiz için logstash/elasticsearch kurabilirsiniz
```

---

## 🌐 SSL ve Domain Sorunları

### S: SSL sertifikası alınamıyor
**C:** 
```bash
# Domain'in doğru resolve olduğunu kontrol edin
nslookup yourdomain.com
# Port 80'in açık olduğunu kontrol edin
sudo netstat -tlnp | grep :80
# Certbot'u manuel çalıştırın
sudo certbot --nginx -d yourdomain.com --verbose
```

### S: SSL sertifikası expired hatası
**C:** 
```bash
# Sertifika durumunu kontrol edin
sudo certbot certificates
# Manuel renewal
sudo certbot renew --force-renewal
# Cron job'un çalıştığını kontrol edin
sudo crontab -l | grep certbot
```

### S: Mixed content hatası (HTTP/HTTPS)
**C:** 
```javascript
// .env'de HTTPS zorla
FORCE_HTTPS=true
// Frontend'de base URL ayarla
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://yourdomain.com/api' 
  : 'http://localhost:5000/api';
```

---

## 👤 Yüz Tanıma Sistemi

### S: Yüz tanıma servisi başlamıyor
**C:** 
```bash
# Python servisi durumunu kontrol edin
ps aux | grep python | grep face
# GPU desteği var mı kontrol edin
nvidia-smi  # NVIDIA GPU için
# CPU moduna geçin
export CUDA_VISIBLE_DEVICES=""
python face_recognition_service.py
```

### S: Yüz tespit edilmiyor
**C:** 
1. **Resim kalitesini kontrol edin**:
   - En az 300x300 pixel
   - Yüz net görünür olmalı
   - İyı aydınlatma gerekli

2. **Model dosyalarını kontrol edin**:
```bash
ls ~/.insightface/models/buffalo_l/
# Model dosyaları eksikse tekrar indirin
```

3. **Confidence threshold'u ayarlayın**:
```python
# face_recognition_service.py'de
FACE_CONFIDENCE_THRESHOLD = 0.3  # Düşük değer daha az seçici
```

### S: Yüz eşleştirme yanlış sonuçlar veriyor
**C:** 
```python
# Similarity threshold'u ayarlayın
SIMILARITY_THRESHOLD = 0.65  # Yüksek değer daha seçici
# Multiple face detection kullanın
faces = face_app.get(image, max_num=5)
# Quality filtering ekleyin
good_faces = [f for f in faces if f.det_score > 0.8]
```

### S: Python servisi memory leak yapıyor
**C:** 
```python
# Garbage collection ekleyin
import gc
# Her N işlemde bir
if processed_count % 100 == 0:
    gc.collect()
    
# Process restart edin
pm2 restart akparti-face-recognition
```

---

## 🔧 Troubleshooting

### S: Uygulama hiç açılmıyor
**C:** 
```bash
# 1. Servisleri kontrol edin
sudo systemctl status akparti-genclik postgresql nginx

# 2. Port'ları kontrol edin
sudo netstat -tlnp | grep -E ":(5000|80|443|5432) "

# 3. Log'ları kontrol edin
journalctl -u akparti-genclik -n 50 --no-pager
tail -50 /var/log/akparti-genclik/error.log

# 4. Disk alanını kontrol edin
df -h

# 5. Memory kullanımını kontrol edin
free -h
```

### S: 502 Bad Gateway hatası
**C:** 
```bash
# 1. Upstream server kontrol
curl http://localhost:5000/health

# 2. Nginx error log
tail -f /var/log/nginx/error.log

# 3. Firewall kontrol
sudo ufw status

# 4. SELinux kontrol (varsa)
sestatus
```

### S: Database connection refused
**C:** 
```bash
# 1. PostgreSQL çalışıyor mu?
sudo systemctl status postgresql

# 2. Port dinleniyor mu?
sudo netstat -tlnp | grep :5432

# 3. Connection string doğru mu?
psql "$DATABASE_URL"

# 4. User permissions
sudo -u postgres psql -c "\du"
```

### S: Nginx start olmuyor
**C:** 
```bash
# 1. Config syntax kontrol
sudo nginx -t

# 2. Port conflict kontrol
sudo netstat -tlnp | grep -E ":(80|443) "

# 3. Log kontrol
tail -f /var/log/nginx/error.log

# 4. Default site devre dışı
sudo rm /etc/nginx/sites-enabled/default
```

### S: PM2 process'leri crash oluyor
**C:** 
```bash
# 1. PM2 status
pm2 status

# 2. Crash log
pm2 logs --lines 50

# 3. Memory limit artır
pm2 start ecosystem.config.js --max-memory-restart 1G

# 4. Restart strategy
pm2 start app.js --restart-delay=3000
```

---

## 🛠️ Genel Troubleshooting Stratejisi

### 1. Problem Tanımlama
```bash
# Sistemik kontrol
./health-check.sh

# Kaynak kullanımı
htop
iotop
df -h
```

### 2. Log Analizi
```bash
# Sistem logları
journalctl -xe

# Uygulama logları
tail -f /var/log/akparti-genclik/*.log

# Nginx logları  
tail -f /var/log/nginx/*.log

# PostgreSQL logları
tail -f /var/log/postgresql/*.log
```

### 3. Service Recovery
```bash
# Servis restart sırası
sudo systemctl restart postgresql
sudo systemctl restart akparti-genclik
sudo systemctl reload nginx

# Acil durum restart
sudo systemctl stop akparti-genclik
sleep 5
sudo systemctl start akparti-genclik
```

### 4. Backup Recovery
```bash
# Acil durumda önceki sürüme dön
cd /var/backups/akparti-genclik
tar -xzf latest-backup.tar.gz -C /opt/
sudo systemctl restart akparti-genclik
```

---

## 📞 Yardım Alma

### Bu FAQ'da çözüm bulamadıysanız:

1. **Log dosyalarını toplayın**:
```bash
mkdir /tmp/debug-logs
cp /var/log/akparti-genclik/*.log /tmp/debug-logs/
cp /var/log/nginx/*.log /tmp/debug-logs/
journalctl -u akparti-genclik -n 100 > /tmp/debug-logs/systemd.log
tar -czf debug-logs.tar.gz /tmp/debug-logs/
```

2. **Sistem bilgilerini toplayın**:
```bash
# sistem-info.txt dosyası oluşturun
echo "OS: $(lsb_release -d)" > sistem-info.txt
echo "Uptime: $(uptime)" >> sistem-info.txt
echo "Memory: $(free -h)" >> sistem-info.txt
echo "Disk: $(df -h)" >> sistem-info.txt
echo "Services:" >> sistem-info.txt
systemctl status akparti-genclik postgresql nginx >> sistem-info.txt
```

3. **GitHub Issues**:
   - Repository'de issue açın
   - Problem tanımını net yazın
   - Log dosyalarını ve sistem bilgilerini ekleyin

4. **Acil Durumlar**:
   - Sistem yöneticisi ile iletişime geçin
   - Maintenance mode aktive edin
   - Backup'tan restore işlemi yapın

---

*Bu FAQ düzenli olarak güncellenmektedir. Yeni sorular ve çözümler için repository'yi takip edin.*