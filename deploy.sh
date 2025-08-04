#!/bin/bash

# AK Parti Gençlik Kolları - Deployment Script
# VPS'e deployment yapmak için kullanılır

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Variables
APP_NAME="akparti-genclik"
APP_USER="akparti"
APP_DIR="/opt/akparti-genclik"
LOG_DIR="/var/log/akparti-genclik"
BACKUP_DIR="/var/backups/akparti-genclik"
REPO_URL="${REPO_URL:-https://github.com/your-username/akparti-genclik-kollari.git}"
BRANCH="${BRANCH:-main}"

# Check if running as app user
if [[ "$USER" != "$APP_USER" ]]; then
    print_error "Bu script '$APP_USER' kullanıcısı ile çalıştırılmalıdır!"
    print_status "Şu komutu kullanın: sudo -u $APP_USER $0"
    exit 1
fi

print_status "Deployment başlatılıyor..."

# ==========================================
# 1. PRE-DEPLOYMENT BACKUP
# ==========================================
print_status "Önceki sürümün yedeği alınıyor..."
if [[ -d "$APP_DIR" ]]; then
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    cp -r "$APP_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    print_success "Yedek alındı: $BACKUP_DIR/$BACKUP_NAME"
fi

# ==========================================
# 2. CODE DEPLOYMENT
# ==========================================
print_status "Kod güncelleniyor..."

if [[ -d "$APP_DIR/.git" ]]; then
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
    print_success "Git repository güncellendi"
else
    print_status "Repository klonlanıyor..."
    rm -rf "$APP_DIR"
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
    print_success "Repository klonlandı"
fi

# ==========================================
# 3. INSTALL DEPENDENCIES
# ==========================================
print_status "Node.js bağımlılıkları kuruluyor..."
npm ci --production=false

print_status "Python sanal ortamı kontrol ediliyor..."
if [[ ! -d "venv" ]]; then
    python3.11 -m venv venv
    print_success "Python sanal ortamı oluşturuldu"
fi

print_status "Python bağımlılıkları kuruluyor..."
source venv/bin/activate
pip install --upgrade pip
pip install -r python-requirements.txt
deactivate

# ==========================================
# 4. BUILD APPLICATION
# ==========================================
print_status "Uygulama derleniyor..."
npm run build
print_success "Uygulama derlendi"

# ==========================================
# 5. DATABASE MIGRATION
# ==========================================
print_status "Veritabanı migrasyonları kontrol ediliyor..."
if [[ -f ".env" ]]; then
    npm run db:push
    print_success "Veritabanı migrasyonları tamamlandı"
else
    print_warning ".env dosyası bulunamadı. Veritabanı migrasyonu atlandı."
fi

# ==========================================
# 6. RESTART SERVICES
# ==========================================
print_status "Servisler yeniden başlatılıyor..."

# Stop services
sudo systemctl stop akparti-genclik || true
sleep 2

# Start services
sudo systemctl start akparti-genclik
sudo systemctl reload nginx

# Check services
sleep 5
if systemctl is-active --quiet akparti-genclik; then
    print_success "Ana servis başlatıldı"
else
    print_error "Ana servis başlatılamadı!"
    exit 1
fi

# ==========================================
# 7. HEALTH CHECK
# ==========================================
print_status "Sağlık kontrolü yapılıyor..."
for i in {1..10}; do
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        print_success "Uygulama sağlıklı çalışıyor"
        break
    elif [[ $i -eq 10 ]]; then
        print_error "Sağlık kontrolü başarısız!"
        exit 1
    else
        print_status "Sağlık kontrolü... ($i/10)"
        sleep 3
    fi
done

# ==========================================
# 8. CLEANUP
# ==========================================
print_status "Temizlik yapılıyor..."

# Remove old backups (keep last 5)
cd "$BACKUP_DIR"
ls -t | tail -n +6 | xargs -r rm -rf

# Clear npm cache
npm cache clean --force > /dev/null 2>&1 || true

print_success "Temizlik tamamlandı"

# ==========================================
# DEPLOYMENT COMPLETE
# ==========================================
print_success "=========================================="
print_success "DEPLOYMENT BAŞARIYLA TAMAMLANDI!"
print_success "=========================================="

echo ""
print_status "DEPLOYMENT BİLGİLERİ:"
echo "- Tarih: $(date)"
echo "- Branch: $BRANCH"
echo "- Commit: $(git rev-parse --short HEAD)"
echo "- Uygulama dizini: $APP_DIR"

echo ""
print_status "SERVİS DURUMU:"
if systemctl is-active --quiet akparti-genclik; then
    echo "✅ Ana servis: Çalışıyor"
else
    echo "❌ Ana servis: Durdu"
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx: Çalışıyor"
else
    echo "❌ Nginx: Durdu"
fi

echo ""
print_status "LOG DOSYALARI:"
echo "- Uygulama logları: $LOG_DIR/"
echo "- Nginx logları: /var/log/nginx/"
echo "- Sistem logları: sudo journalctl -u akparti-genclik"

echo ""
print_success "Deployment tamamlandı!"
exit 0