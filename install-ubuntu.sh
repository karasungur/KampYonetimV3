#!/bin/bash

# AK Parti Gençlik Kolları Yönetim Sistemi
# Ubuntu VPS Kurulum Scripti
# Desteklenen: Ubuntu 20.04, 22.04, 24.04

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/var/log/akparti-install.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$LOG_FILE" >&2)

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "Bu script root kullanıcısı ile çalıştırılmamalıdır!"
   exit 1
fi

print_status "AK Parti Gençlik Kolları Yönetim Sistemi Kurulumu Başlatılıyor..."

# Variables
APP_NAME="akparti-genclik"
APP_USER="akparti"
APP_DIR="/opt/akparti-genclik"
LOG_DIR="/var/log/akparti-genclik"
BACKUP_DIR="/var/backups/akparti-genclik"
DOMAIN="${1:-akpartigenclik.yourdomain.com}"

# ==========================================
# 1. SYSTEM UPDATE AND BASIC PACKAGES
# ==========================================
print_status "Sistem güncellemeleri yapılıyor..."
sudo apt update && sudo apt upgrade -y

print_status "Temel paketler kuruluyor..."
sudo apt install -y \
    curl \
    wget \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    build-essential \
    git \
    unzip \
    htop \
    vim \
    nginx \
    fail2ban \
    ufw \
    logrotate \
    cron \
    supervisor

# ==========================================
# 2. NODE.JS INSTALLATION
# ==========================================
print_status "Node.js 20.x kuruluyor..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

print_status "Node.js versiyonu: $(node --version)"
print_status "NPM versiyonu: $(npm --version)"

# Install global packages
sudo npm install -g pm2@latest
sudo npm install -g typescript@latest

# ==========================================
# 3. PYTHON INSTALLATION
# ==========================================
print_status "Python 3.11 ve sanal ortam kuruluyor..."
sudo apt install -y \
    python3.11 \
    python3.11-dev \
    python3.11-venv \
    python3-pip \
    python3-setuptools \
    python3-wheel

# Install system-level packages for computer vision
sudo apt install -y \
    libopencv-dev \
    python3-opencv \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgconf-2-4

# ==========================================
# 4. POSTGRESQL INSTALLATION
# ==========================================
print_status "PostgreSQL 15 kuruluyor..."
sudo apt install -y postgresql-15 postgresql-contrib-15 postgresql-client-15

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

print_status "PostgreSQL servisi başlatıldı"

# ==========================================
# 5. REDIS INSTALLATION (Optional - for caching)
# ==========================================
print_status "Redis kuruluyor..."
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# ==========================================
# 6. CREATE APPLICATION USER
# ==========================================
print_status "Uygulama kullanıcısı oluşturuluyor..."
if ! id "$APP_USER" &>/dev/null; then
    sudo useradd -r -s /bin/bash -d /home/$APP_USER -m $APP_USER
    sudo usermod -aG sudo $APP_USER
    print_success "Kullanıcı '$APP_USER' oluşturuldu"
else
    print_warning "Kullanıcı '$APP_USER' zaten mevcut"
fi

# ==========================================
# 7. CREATE DIRECTORIES
# ==========================================
print_status "Uygulama dizinleri oluşturuluyor..."
sudo mkdir -p $APP_DIR
sudo mkdir -p $LOG_DIR
sudo mkdir -p $BACKUP_DIR
sudo mkdir -p /var/www/akparti-genclik/uploads
sudo mkdir -p /etc/akparti-genclik

# Set permissions
sudo chown -R $APP_USER:$APP_USER $APP_DIR
sudo chown -R $APP_USER:$APP_USER $LOG_DIR
sudo chown -R $APP_USER:$APP_USER $BACKUP_DIR
sudo chown -R $APP_USER:www-data /var/www/akparti-genclik
sudo chmod -R 755 /var/www/akparti-genclik

print_success "Dizinler oluşturuldu ve izinler ayarlandı"

# ==========================================
# 8. FIREWALL CONFIGURATION
# ==========================================
print_status "Güvenlik duvarı yapılandırılıyor..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow essential services
sudo ufw allow ssh
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# Enable firewall
sudo ufw --force enable
print_success "Güvenlik duvarı yapılandırıldı"

# ==========================================
# 9. FAIL2BAN CONFIGURATION
# ==========================================
print_status "Fail2Ban yapılandırılıyor..."
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
print_success "Fail2Ban yapılandırıldı"

# ==========================================
# 10. SSL CERTIFICATE SETUP
# ==========================================
print_status "Let's Encrypt SSL sertifikası için hazırlık..."
sudo apt install -y certbot python3-certbot-nginx

# Create webroot directory for certbot
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot

print_warning "SSL sertifikası için şu komutu çalıştırın:"
print_warning "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"

# ==========================================
# 11. LOG ROTATION SETUP
# ==========================================
print_status "Log rotation yapılandırılıyor..."
sudo tee /etc/logrotate.d/akparti-genclik > /dev/null <<EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $APP_USER $APP_USER
    postrotate
        /bin/systemctl reload akparti-genclik || true
    endscript
}
EOF

print_success "Log rotation yapılandırıldı"

# ==========================================
# 12. DATABASE USER AND DATABASE CREATION
# ==========================================
print_status "PostgreSQL veritabanı ve kullanıcısı oluşturuluyor..."

# Generate random password
DB_PASSWORD=$(openssl rand -base64 32)

sudo -u postgres psql <<EOF
CREATE USER akparti_user WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE akparti_genclik_db OWNER akparti_user;
GRANT ALL PRIVILEGES ON DATABASE akparti_genclik_db TO akparti_user;
ALTER USER akparti_user CREATEDB;
\q
EOF

# Save database credentials
sudo tee /etc/akparti-genclik/db-credentials > /dev/null <<EOF
DATABASE_URL=postgresql://akparti_user:$DB_PASSWORD@localhost:5432/akparti_genclik_db
PGUSER=akparti_user
PGPASSWORD=$DB_PASSWORD
PGDATABASE=akparti_genclik_db
PGHOST=localhost
PGPORT=5432
EOF

sudo chown $APP_USER:$APP_USER /etc/akparti-genclik/db-credentials
sudo chmod 600 /etc/akparti-genclik/db-credentials

print_success "Veritabanı oluşturuldu"
print_warning "Veritabanı bilgileri /etc/akparti-genclik/db-credentials dosyasında saklandı"

# ==========================================
# 13. FINAL CHECKS
# ==========================================
print_status "Kurulum doğrulaması yapılıyor..."

# Check services
services=("postgresql" "nginx" "redis-server" "fail2ban")
for service in "${services[@]}"; do
    if systemctl is-active --quiet $service; then
        print_success "$service servisi çalışıyor"
    else
        print_error "$service servisi çalışmıyor!"
    fi
done

# Check Node.js and Python
if command -v node &> /dev/null; then
    print_success "Node.js kurulu: $(node --version)"
else
    print_error "Node.js kurulumu başarısız!"
fi

if command -v python3.11 &> /dev/null; then
    print_success "Python kurulu: $(python3.11 --version)"
else
    print_error "Python kurulumu başarısız!"
fi

# ==========================================
# INSTALLATION COMPLETE
# ==========================================
print_success "=========================================="
print_success "AK PARTİ GENÇLİK KOLLARI SİSTEM KURULUMU TAMAMLANDI!"
print_success "=========================================="

echo ""
print_status "SONRAKİ ADIMLAR:"
echo "1. Proje dosyalarını $APP_DIR dizinine kopyalayın"
echo "2. .env dosyasını oluşturun ve yapılandırın"
echo "3. Python sanal ortamını kurun:"
echo "   sudo -u $APP_USER python3.11 -m venv $APP_DIR/venv"
echo "4. Node.js bağımlılıklarını kurun:"
echo "   cd $APP_DIR && sudo -u $APP_USER npm install"
echo "5. Projeyi derleyin:"
echo "   sudo -u $APP_USER npm run build"
echo "6. Veritabanı migrasyonlarını çalıştırın"
echo "7. SSL sertifikasını kurun:"
echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "8. Servisleri başlatın"

echo ""
print_warning "ÖNEMLİ BİLGİLER:"
echo "- Uygulama kullanıcısı: $APP_USER"
echo "- Uygulama dizini: $APP_DIR"
echo "- Log dizini: $LOG_DIR"
echo "- Veritabanı bilgileri: /etc/akparti-genclik/db-credentials"
echo "- Kurulum logu: $LOG_FILE"

echo ""
print_status "Kurulum scripti tamamlandı!"
exit 0