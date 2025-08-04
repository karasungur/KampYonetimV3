# 🚀 AK Parti Gençlik Kolları VPS Kurulum Talimatları
## Sizin İçin Hazırlanan Adım Adım Rehber

Bu belge, sisteminizi Replit'ten Ubuntu VPS'e taşımak için izlemeniz gereken adımları içermektedir.

---

## 📝 İLK YAPMANIZ GEREKENLER

### 1. VPS Satın Alın
**Önerilen Sağlayıcılar ve Fiyatlar:**
- **DigitalOcean**: 4GB RAM, 2CPU, 80GB SSD = ~$24/ay
- **Linode**: 4GB RAM, 2CPU, 80GB SSD = ~$24/ay  
- **Vultr**: 4GB RAM, 2CPU, 80GB SSD = ~$24/ay

**VPS Satın Alırken:**
- ✅ **Ubuntu 22.04 LTS** seçin
- ✅ **4GB RAM** minimum
- ✅ **SSD Disk** tercih edin
- ✅ **SSH Key** ekleyin (güvenlik için)

### 2. Domain Ayarları
- Domain'inizi satın alın (örn: akpartigenclik.com)
- DNS ayarlarında A record ekleyin:
  - `akpartigenclik.com` → VPS IP Adresi
  - `www.akpartigenclik.com` → VPS IP Adresi

### 3. Email SMTP Ayarları
Gmail SMTP için App Password oluşturun:
1. Gmail > Hesap Ayarları > Güvenlik
2. "2-Step Verification" aktif edin
3. "App passwords" oluşturun
4. Şifreyi not alın

---

## 🔧 KURULUM ADIMLARI

### ADIM 1: VPS'e Bağlanma
```bash
# SSH ile VPS'e bağlanın
ssh root@VPS_IP_ADRESİ

# Güvenlik için yeni kullanıcı oluşturun
adduser akparti
usermod -aG sudo akparti
su - akparti
```

### ADIM 2: Kurulum Dosyalarını Yükleme
```bash
# Replit'ten indirdiğiniz dosyaları VPS'e yükleyin
scp -r akparti-project/ akparti@VPS_IP:/tmp/

# VPS'te devam edin
cd /tmp/akparti-project/
```

### ADIM 3: Otomatik Kurulumu Başlatma
```bash
# Kurulum scriptini çalıştırın
chmod +x install-ubuntu.sh
./install-ubuntu.sh akpartigenclik.com

# Script 15-20 dakika sürecektir
# Sonunda şu mesajı göreceksiniz: "KURULUM BAŞARIYLA TAMAMLANDI!"
```

### ADIM 4: Projeyi Yükleme
```bash
# Proje dizinine gidin
cd /opt/akparti-genclik

# Environment dosyasını oluşturun
cp .env.example .env
nano .env
```

**Bu değerleri mutlaka değiştirin:**
```env
DATABASE_URL=postgresql://akparti_user:GENERATED_PASSWORD@localhost:5432/akparti_genclik_db
JWT_SECRET=çok-güçlü-bir-secret-key-buraya
DOMAIN=akpartigenclik.com
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=gmail-app-password
```

### ADIM 5: Bağımlılıkları Kurma
```bash
# Node.js paketleri
npm install

# Python sanal ortamı
python3.11 -m venv venv
source venv/bin/activate
pip install -r python-requirements.txt
deactivate

# Projeyi derleyin
npm run build
```

### ADIM 6: Veritabanını Kurma
```bash
# Veritabanı yapısını oluşturun
npm run db:push

# Replit'ten aldığınız backup'ı yükleyin
PGPASSWORD=password psql -h localhost -U akparti_user -d akparti_genclik_db < /tmp/akparti-backup.sql
```

### ADIM 7: SSL Sertifikası Alma
```bash
# Let's Encrypt ile SSL
sudo certbot --nginx -d akpartigenclik.com -d www.akpartigenclik.com

# Email adresinizi girin ve şartları kabul edin
```

### ADIM 8: Servisleri Başlatma
```bash
# Nginx ayarlarını kopyalayın
sudo cp nginx-akparti.conf /etc/nginx/sites-available/akparti-genclik
sudo ln -s /etc/nginx/sites-available/akparti-genclik /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Systemd servisini kurun
sudo cp akparti-genclik.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable akparti-genclik
sudo systemctl start akparti-genclik

# Nginx'i yeniden başlatın
sudo systemctl reload nginx
```

---

## ✅ TEST VE DOĞRULAMA

### 1. Sağlık Kontrolü
```bash
# Health check script çalıştırın
chmod +x health-check.sh
./health-check.sh
```

**Beklenen çıktı:**
```
✅ CPU kullanımı: 15%
✅ Bellek kullanımı: 45%
✅ Ana uygulama servisi çalışıyor
✅ PostgreSQL servisi çalışıyor
✅ Nginx servisi çalışıyor
✅ HTTP health endpoint erişilebilir
✅ PostgreSQL bağlantısı başarılı
```

### 2. Web Sitesi Testi
1. Tarayıcınızda `https://akpartigenclik.com` adresine gidin
2. Ana sayfa yüklenmelidir
3. **Moderatör Girişi** butonuna tıklayın
4. TC Kimlik ve şifre ile giriş yapın

### 3. Fonksiyon Testleri
- ✅ **Kullanıcı girişi** çalışıyor mu?
- ✅ **Soru-cevap sistemi** çalışıyor mu?
- ✅ **Fotoğraf sistemi** çalışıyor mu?
- ✅ **Email gönderimi** çalışıyor mu?

---

## 🔄 BACKUP KURULUMU

### Otomatik Backup
```bash
# Backup scriptini test edin
chmod +x backup.sh
./backup.sh

# Günlük otomatik backup için cron job ekleyin
crontab -e
# Bu satırı ekleyin:
0 2 * * * /opt/akparti-genclik/backup.sh
```

---

## 📊 MONİTÖRLEME KURULUMU

### 1. Log İzleme
```bash
# Ana uygulama logları
tail -f /var/log/akparti-genclik/combined.log

# Nginx logları
tail -f /var/log/nginx/access.log

# Sistem logları
journalctl -u akparti-genclik -f
```

### 2. Performance Monitoring
```bash
# Sistem kaynakları
htop

# Disk kullanımı
df -h

# Memory kullanımı
free -h
```

---

## 🚨 SORUN GİDERME

### Problem: Site açılmıyor
```bash
# Servisleri kontrol edin
sudo systemctl status akparti-genclik nginx postgresql

# Logları kontrol edin
journalctl -u akparti-genclik -n 50
```

### Problem: SSL hatası
```bash
# Domain'in doğru resolve olup olmadığını kontrol edin
nslookup akpartigenclik.com

# SSL sertifikasını yeniden alın
sudo certbot --nginx -d akpartigenclik.com
```

### Problem: Veritabanı bağlantı hatası
```bash
# PostgreSQL durumunu kontrol edin
sudo systemctl status postgresql

# Bağlantıyı test edin
PGPASSWORD=password psql -h localhost -U akparti_user -d akparti_genclik_db
```

---

## 📞 YARDIM ALMA

### Acil Durumlar
```bash
# Servisleri yeniden başlatın
sudo systemctl restart akparti-genclik nginx postgresql

# Veya sistemi yeniden başlatın
sudo reboot
```

### Log Toplama (Destek için)
```bash
# Debug bilgilerini toplayın
mkdir /tmp/debug-logs
cp /var/log/akparti-genclik/*.log /tmp/debug-logs/
journalctl -u akparti-genclik -n 100 > /tmp/debug-logs/systemd.log

# Zip'leyip gönderin
tar -czf debug-logs.tar.gz /tmp/debug-logs/
```

---

## ✅ KURULUM TAMAMLANDI!

### Başarılı Kurulum Sonrası:
1. ✅ Site https://akpartigenclik.com adresinde çalışıyor
2. ✅ SSL sertifikası aktif
3. ✅ Backup sistemi kurulu
4. ✅ Monitoring aktif
5. ✅ Tüm servisler çalışıyor

### Sonraki Adımlar:
1. **Kullanıcıları bilgilendirin** - Yeni adres ve giriş bilgileri
2. **7 gün boyunca takip edin** - Herhangi bir sorun olup olmadığını
3. **Performance'ı optimize edin** - Gerekirse kaynak artırımı
4. **Backup'ları test edin** - Restore işlemini deneyin
5. **Team eğitimi verin** - Yeni sistem hakkında bilgilendirme

---

## 📋 HATIRLATMALAR

### Güvenlik
- ⚠️ **Root parolasını** güçlü yapın
- ⚠️ **SSH key authentication** kullanın
- ⚠️ **Düzenli güvenlik güncellemeleri** yapın
- ⚠️ **Firewall ayarlarını** kontrol edin

### Bakım
- 🔄 **Haftalık backup kontrolü** yapın
- 🔄 **Aylık performance analizi** yapın
- 🔄 **SSL sertifika yenileme** takibi (otomatik)
- 🔄 **Log dosyalarını** düzenli temizleyin

### İletişim
- 📧 **Teknik destek**: admin@akpartigenclik.com
- 📞 **Acil durum**: +90 XXX XXX XX XX
- 📚 **Dokümantasyon**: Bu rehberleri saklayın

---

**🎉 Tebrikler! Sisteminiz başarıyla VPS'e taşındı ve kullanıma hazır!**

*Bu rehber sizin için özel olarak hazırlanmıştır. Herhangi bir sorunuz olursa yukarıdaki iletişim bilgilerini kullanabilirsiniz.*