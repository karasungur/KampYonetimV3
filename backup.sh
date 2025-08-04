#!/bin/bash

# AK Parti Gençlik Kolları - Backup Script
# Veritabanı ve uygulama dosyalarının yedeğini alır

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
APP_DIR="/opt/akparti-genclik"
BACKUP_DIR="/var/backups/akparti-genclik"
DB_NAME="akparti_genclik_db"
DB_USER="akparti_user"
RETENTION_DAYS=30

# Load database credentials
if [[ -f "/etc/akparti-genclik/db-credentials" ]]; then
    source /etc/akparti-genclik/db-credentials
else
    print_error "Veritabanı bilgileri bulunamadı: /etc/akparti-genclik/db-credentials"
    exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="${APP_NAME}_backup_${TIMESTAMP}"
FULL_BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

print_status "Yedekleme işlemi başlatılıyor..."
print_status "Yedek adı: $BACKUP_NAME"
print_status "Yedek dizini: $FULL_BACKUP_PATH"

# Create backup directory
mkdir -p "$FULL_BACKUP_PATH"

# ==========================================
# 1. DATABASE BACKUP
# ==========================================
print_status "Veritabanı yedeği alınıyor..."

# PostgreSQL dump
pg_dump \
    --host=localhost \
    --port=5432 \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --no-password \
    --verbose \
    --clean \
    --create \
    --format=custom \
    --compress=9 \
    --file="$FULL_BACKUP_PATH/database.dump"

if [[ $? -eq 0 ]]; then
    print_success "Veritabanı yedeği alındı"
else
    print_error "Veritabanı yedeği alınamadı!"
    exit 1
fi

# Also create SQL dump for easier restoration
pg_dump \
    --host=localhost \
    --port=5432 \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --no-password \
    --clean \
    --create \
    --file="$FULL_BACKUP_PATH/database.sql"

# ==========================================
# 2. APPLICATION FILES BACKUP
# ==========================================
print_status "Uygulama dosyaları yedeği alınıyor..."

# Create application backup excluding node_modules and build files
tar -czf "$FULL_BACKUP_PATH/application.tar.gz" \
    --exclude="node_modules" \
    --exclude="dist" \
    --exclude="venv" \
    --exclude=".git" \
    --exclude="*.log" \
    --exclude="temp" \
    -C "$(dirname "$APP_DIR")" \
    "$(basename "$APP_DIR")"

print_success "Uygulama dosyaları yedeği alındı"

# ==========================================
# 3. CONFIGURATION FILES BACKUP
# ==========================================
print_status "Konfigürasyon dosyaları yedeği alınıyor..."

CONFIG_BACKUP_DIR="$FULL_BACKUP_PATH/config"
mkdir -p "$CONFIG_BACKUP_DIR"

# Environment file
if [[ -f "$APP_DIR/.env" ]]; then
    cp "$APP_DIR/.env" "$CONFIG_BACKUP_DIR/"
fi

# Database credentials
cp "/etc/akparti-genclik/db-credentials" "$CONFIG_BACKUP_DIR/"

# Nginx configuration
if [[ -f "/etc/nginx/sites-available/akparti-genclik" ]]; then
    cp "/etc/nginx/sites-available/akparti-genclik" "$CONFIG_BACKUP_DIR/"
fi

# Systemd service
if [[ -f "/etc/systemd/system/akparti-genclik.service" ]]; then
    cp "/etc/systemd/system/akparti-genclik.service" "$CONFIG_BACKUP_DIR/"
fi

# PM2 ecosystem
if [[ -f "$APP_DIR/ecosystem.config.js" ]]; then
    cp "$APP_DIR/ecosystem.config.js" "$CONFIG_BACKUP_DIR/"
fi

print_success "Konfigürasyon dosyaları yedeği alındı"

# ==========================================
# 4. UPLOADED FILES BACKUP
# ==========================================
print_status "Yüklenen dosyalar yedeği alınıyor..."

if [[ -d "/var/www/akparti-genclik/uploads" ]]; then
    tar -czf "$FULL_BACKUP_PATH/uploads.tar.gz" \
        -C "/var/www/akparti-genclik" \
        "uploads"
    print_success "Yüklenen dosyalar yedeği alındı"
else
    print_warning "Yüklenen dosyalar dizini bulunamadı"
fi

# ==========================================
# 5. LOGS BACKUP
# ==========================================
print_status "Loglar yedeği alınıyor..."

if [[ -d "/var/log/akparti-genclik" ]]; then
    tar -czf "$FULL_BACKUP_PATH/logs.tar.gz" \
        -C "/var/log" \
        "akparti-genclik"
    print_success "Loglar yedeği alındı"
fi

# ==========================================
# 6. CREATE BACKUP MANIFEST
# ==========================================
print_status "Yedek manifest dosyası oluşturuluyor..."

cat > "$FULL_BACKUP_PATH/MANIFEST.txt" << EOF
AK Parti Gençlik Kolları Sistem Yedeği
=====================================

Yedek Bilgileri:
- Tarih: $(date)
- Hostname: $(hostname)
- Uygulama Sürümü: $(cd "$APP_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "Bilinmiyor")
- Yedek Adı: $BACKUP_NAME

Yedek İçeriği:
- database.dump: PostgreSQL veritabanı yedeği (custom format)
- database.sql: PostgreSQL veritabanı yedeği (SQL format)
- application.tar.gz: Uygulama kaynak kodları
- uploads.tar.gz: Yüklenen dosyalar
- logs.tar.gz: Uygulama logları
- config/: Konfigürasyon dosyaları

Veritabanı Bilgileri:
- Veritabanı: $DB_NAME
- Kullanıcı: $DB_USER
- Host: localhost:5432

Restore Komutları:
1. Veritabanı restore:
   pg_restore -h localhost -U $DB_USER -d $DB_NAME --clean --create database.dump

2. Uygulama restore:
   tar -xzf application.tar.gz -C /opt/

3. Uploads restore:
   tar -xzf uploads.tar.gz -C /var/www/akparti-genclik/

4. Konfigürasyon restore:
   cp config/.env /opt/akparti-genclik/
   cp config/akparti-genclik /etc/nginx/sites-available/
   cp config/akparti-genclik.service /etc/systemd/system/

Dosya Boyutları:
$(du -h "$FULL_BACKUP_PATH"/* | sort -hr)

Toplam Boyut: $(du -sh "$FULL_BACKUP_PATH" | cut -f1)
EOF

print_success "Manifest dosyası oluşturuldu"

# ==========================================
# 7. COMPRESS ENTIRE BACKUP
# ==========================================
print_status "Yedek arşivleniyor..."

cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

FINAL_BACKUP_PATH="$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
BACKUP_SIZE=$(du -h "$FINAL_BACKUP_PATH" | cut -f1)

print_success "Yedek arşivlendi: $FINAL_BACKUP_PATH"
print_success "Yedek boyutu: $BACKUP_SIZE"

# ==========================================
# 8. CLEANUP OLD BACKUPS
# ==========================================
print_status "Eski yedekler temizleniyor (${RETENTION_DAYS} günden eski)..."

find "$BACKUP_DIR" -name "${APP_NAME}_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "${APP_NAME}_backup_*.tar.gz" -type f | wc -l)
print_success "Temizlik tamamlandı. Kalan yedek sayısı: $REMAINING_BACKUPS"

# ==========================================
# 9. OPTIONAL: REMOTE BACKUP
# ==========================================
# Uncomment and configure for remote backup
# if [[ -n "$REMOTE_BACKUP_HOST" ]]; then
#     print_status "Uzak sunucuya yedek gönderiliyor..."
#     scp "$FINAL_BACKUP_PATH" "$REMOTE_BACKUP_USER@$REMOTE_BACKUP_HOST:$REMOTE_BACKUP_PATH/"
#     print_success "Uzak yedek tamamlandı"
# fi

# ==========================================
# BACKUP COMPLETE
# ==========================================
print_success "=========================================="
print_success "YEDEKLEME İŞLEMİ BAŞARIYLA TAMAMLANDI!"
print_success "=========================================="

echo ""
print_status "YEDEK BİLGİLERİ:"
echo "- Yedek dosyası: $FINAL_BACKUP_PATH"
echo "- Yedek boyutu: $BACKUP_SIZE"
echo "- Yedek tarihi: $(date)"

echo ""
print_status "RESTORE İÇİN GEREKLİ KOMUTLAR:"
echo "1. Yedek arşivini açın:"
echo "   cd $BACKUP_DIR && tar -xzf ${BACKUP_NAME}.tar.gz"
echo ""
echo "2. Veritabanını restore edin:"
echo "   pg_restore -h localhost -U $DB_USER -d $DB_NAME --clean --create $BACKUP_DIR/$BACKUP_NAME/database.dump"
echo ""
echo "3. Uygulama dosyalarını restore edin:"
echo "   tar -xzf $BACKUP_DIR/$BACKUP_NAME/application.tar.gz -C /opt/"

echo ""
print_success "Yedek işlemi tamamlandı!"
exit 0