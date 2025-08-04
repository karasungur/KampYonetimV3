#!/bin/bash

# AK Parti Gençlik Kolları - Health Check Script
# Sistem sağlığını kontrol eder ve sorunları tespit eder

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# Variables
APP_NAME="akparti-genclik"
APP_DIR="/opt/akparti-genclik"
LOG_DIR="/var/log/akparti-genclik"
HEALTH_LOG="/var/log/health-check.log"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

check_passed() {
    ((TOTAL_CHECKS++))
    ((PASSED_CHECKS++))
    print_success "$1"
}

check_warning() {
    ((TOTAL_CHECKS++))
    ((WARNING_CHECKS++))
    print_warning "$1"
}

check_failed() {
    ((TOTAL_CHECKS++))
    ((FAILED_CHECKS++))
    print_error "$1"
}

# Log health check
echo "$(date): Health check started" >> "$HEALTH_LOG"

print_status "=========================================="
print_status "AK PARTİ GENÇLİK KOLLARI SAĞLIK KONTROLÜ"
print_status "=========================================="
print_status "Tarih: $(date)"
print_status "Hostname: $(hostname)"
echo ""

# ==========================================
# 1. SYSTEM RESOURCES
# ==========================================
print_status "1. SİSTEM KAYNAKLARI KONTROLÜ:"

# CPU Usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
CPU_USAGE_INT=${CPU_USAGE%.*}
if [[ $CPU_USAGE_INT -lt 80 ]]; then
    check_passed "CPU kullanımı: ${CPU_USAGE}%"
elif [[ $CPU_USAGE_INT -lt 90 ]]; then
    check_warning "CPU kullanımı yüksek: ${CPU_USAGE}%"
else
    check_failed "CPU kullanımı kritik: ${CPU_USAGE}%"
fi

# Memory Usage
MEMORY_INFO=$(free | grep Mem)
TOTAL_MEM=$(echo $MEMORY_INFO | awk '{print $2}')
USED_MEM=$(echo $MEMORY_INFO | awk '{print $3}')
MEMORY_USAGE=$((USED_MEM * 100 / TOTAL_MEM))

if [[ $MEMORY_USAGE -lt 80 ]]; then
    check_passed "Bellek kullanımı: ${MEMORY_USAGE}%"
elif [[ $MEMORY_USAGE -lt 90 ]]; then
    check_warning "Bellek kullanımı yüksek: ${MEMORY_USAGE}%"
else
    check_failed "Bellek kullanımı kritik: ${MEMORY_USAGE}%"
fi

# Disk Usage
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | cut -d'%' -f1)
if [[ $DISK_USAGE -lt 80 ]]; then
    check_passed "Disk kullanımı: ${DISK_USAGE}%"
elif [[ $DISK_USAGE -lt 90 ]]; then
    check_warning "Disk kullanımı yüksek: ${DISK_USAGE}%"
else
    check_failed "Disk kullanımı kritik: ${DISK_USAGE}%"
fi

# Load Average
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | cut -d',' -f1)
LOAD_AVG_INT=${LOAD_AVG%.*}
CPU_CORES=$(nproc)

if (( $(echo "$LOAD_AVG < $CPU_CORES" | bc -l) )); then
    check_passed "Load average: $LOAD_AVG (CPU cores: $CPU_CORES)"
else
    check_warning "Load average yüksek: $LOAD_AVG (CPU cores: $CPU_CORES)"
fi

echo ""

# ==========================================
# 2. SERVICE STATUS
# ==========================================
print_status "2. SERVİS DURUMU KONTROLÜ:"

# Check main application
if systemctl is-active --quiet akparti-genclik; then
    check_passed "Ana uygulama servisi çalışıyor"
else
    check_failed "Ana uygulama servisi durmuş!"
fi

# Check PostgreSQL
if systemctl is-active --quiet postgresql; then
    check_passed "PostgreSQL servisi çalışıyor"
else
    check_failed "PostgreSQL servisi durmuş!"
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    check_passed "Nginx servisi çalışıyor"
else
    check_failed "Nginx servisi durmuş!"
fi

# Check Redis (if installed)
if systemctl is-installed redis-server &>/dev/null; then
    if systemctl is-active --quiet redis-server; then
        check_passed "Redis servisi çalışıyor"
    else
        check_warning "Redis servisi durmuş"
    fi
fi

# Check Fail2Ban
if systemctl is-active --quiet fail2ban; then
    check_passed "Fail2Ban servisi çalışıyor"
else
    check_warning "Fail2Ban servisi durmuş"
fi

echo ""

# ==========================================
# 3. APPLICATION HEALTH
# ==========================================
print_status "3. UYGULAMA SAĞLIK KONTROLÜ:"

# HTTP Health Check
if curl -f -s http://localhost:5000/health > /dev/null; then
    check_passed "HTTP health endpoint erişilebilir"
else
    check_failed "HTTP health endpoint erişilemiyor!"
fi

# Check if application is listening on port
if netstat -ln | grep -q ":5000 "; then
    check_passed "Uygulama 5000 portunda dinliyor"
else
    check_failed "Uygulama 5000 portunda dinlemiyor!"
fi

# Check process count
PROCESS_COUNT=$(pgrep -f "node.*index.js" | wc -l)
if [[ $PROCESS_COUNT -gt 0 ]]; then
    check_passed "Uygulama process'leri çalışıyor (Count: $PROCESS_COUNT)"
else
    check_failed "Uygulama process'leri bulunamadı!"
fi

echo ""

# ==========================================
# 4. DATABASE CONNECTIVITY
# ==========================================
print_status "4. VERİTABANI BAĞLANTI KONTROLÜ:"

# Load database credentials
if [[ -f "/etc/akparti-genclik/db-credentials" ]]; then
    source /etc/akparti-genclik/db-credentials
    
    # Test database connection
    if PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
        check_passed "PostgreSQL bağlantısı başarılı"
    else
        check_failed "PostgreSQL bağlantısı başarısız!"
    fi
    
    # Check database size
    DB_SIZE=$(PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT pg_size_pretty(pg_database_size('$PGDATABASE'));" 2>/dev/null | xargs)
    if [[ -n "$DB_SIZE" ]]; then
        check_passed "Veritabanı boyutu: $DB_SIZE"
    else
        check_warning "Veritabanı boyutu alınamadı"
    fi
else
    check_failed "Veritabanı kimlik bilgileri bulunamadı!"
fi

echo ""

# ==========================================
# 5. FILE SYSTEM CHECKS
# ==========================================
print_status "5. DOSYA SİSTEMİ KONTROLÜ:"

# Check application directory
if [[ -d "$APP_DIR" ]]; then
    check_passed "Uygulama dizini mevcut: $APP_DIR"
else
    check_failed "Uygulama dizini bulunamadı: $APP_DIR"
fi

# Check log directory
if [[ -d "$LOG_DIR" ]]; then
    check_passed "Log dizini mevcut: $LOG_DIR"
else
    check_warning "Log dizini bulunamadı: $LOG_DIR"
fi

# Check uploads directory
if [[ -d "/var/www/akparti-genclik/uploads" ]]; then
    check_passed "Upload dizini mevcut"
else
    check_warning "Upload dizini bulunamadı"
fi

# Check permissions
if [[ -r "$APP_DIR/.env" ]]; then
    check_passed "Environment dosyası okunabilir"
else
    check_warning "Environment dosyası okunamıyor"
fi

echo ""

# ==========================================
# 6. NETWORK CONNECTIVITY
# ==========================================
print_status "6. AĞ BAĞLANTI KONTROLÜ:"

# Check internet connectivity
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    check_passed "İnternet bağlantısı mevcut"
else
    check_warning "İnternet bağlantısı yok"
fi

# Check DNS resolution
if nslookup google.com > /dev/null 2>&1; then
    check_passed "DNS çözümleme çalışıyor"
else
    check_warning "DNS çözümleme problemi"
fi

# Check HTTPS port
if netstat -ln | grep -q ":443 "; then
    check_passed "HTTPS portu (443) dinleniyor"
else
    check_warning "HTTPS portu (443) dinlenmiyor"
fi

echo ""

# ==========================================
# 7. LOG FILE ANALYSIS
# ==========================================
print_status "7. LOG ANALİZİ:"

# Check for recent errors in application logs
if [[ -f "$LOG_DIR/error.log" ]]; then
    ERROR_COUNT=$(tail -100 "$LOG_DIR/error.log" | grep -c "ERROR" || echo "0")
    if [[ $ERROR_COUNT -eq 0 ]]; then
        check_passed "Son 100 satırda hata bulunamadı"
    elif [[ $ERROR_COUNT -lt 5 ]]; then
        check_warning "Son 100 satırda $ERROR_COUNT hata bulundu"
    else
        check_failed "Son 100 satırda $ERROR_COUNT hata bulundu!"
    fi
else
    check_warning "Error log dosyası bulunamadı"
fi

# Check log file sizes
if [[ -d "$LOG_DIR" ]]; then
    LARGE_LOGS=$(find "$LOG_DIR" -name "*.log" -size +100M | wc -l)
    if [[ $LARGE_LOGS -eq 0 ]]; then
        check_passed "Büyük log dosyası yok"
    else
        check_warning "$LARGE_LOGS adet büyük log dosyası (>100MB)"
    fi
fi

echo ""

# ==========================================
# 8. SSL CERTIFICATE CHECK
# ==========================================
print_status "8. SSL SERTİFİKA KONTROLÜ:"

# Check SSL certificate expiry
CERT_PATH="/etc/letsencrypt/live"
if [[ -d "$CERT_PATH" ]]; then
    CERT_DIR=$(find "$CERT_PATH" -maxdepth 1 -type d -name "*.yourdomain.com" | head -1)
    if [[ -n "$CERT_DIR" && -f "$CERT_DIR/cert.pem" ]]; then
        CERT_EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_DIR/cert.pem" | cut -d= -f2)
        CERT_EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s)
        CURRENT_EPOCH=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( (CERT_EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
        
        if [[ $DAYS_UNTIL_EXPIRY -gt 30 ]]; then
            check_passed "SSL sertifikası geçerli ($DAYS_UNTIL_EXPIRY gün kaldı)"
        elif [[ $DAYS_UNTIL_EXPIRY -gt 7 ]]; then
            check_warning "SSL sertifikası yakında sona erecek ($DAYS_UNTIL_EXPIRY gün kaldı)"
        else
            check_failed "SSL sertifikası çok yakında sona erecek! ($DAYS_UNTIL_EXPIRY gün kaldı)"
        fi
    else
        check_warning "SSL sertifikası bulunamadı"
    fi
else
    check_warning "Let's Encrypt dizini bulunamadı"
fi

echo ""

# ==========================================
# SUMMARY
# ==========================================
print_status "=========================================="
print_status "SAĞLIK KONTROLÜ ÖZET"
print_status "=========================================="

echo "Toplam kontrol: $TOTAL_CHECKS"
echo -e "Başarılı: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Uyarı: ${YELLOW}$WARNING_CHECKS${NC}"
echo -e "Başarısız: ${RED}$FAILED_CHECKS${NC}"

echo ""

# Determine overall health status
if [[ $FAILED_CHECKS -eq 0 && $WARNING_CHECKS -eq 0 ]]; then
    print_success "SİSTEM TAMAMEN SAĞLIKLI! ✅"
    HEALTH_STATUS="HEALTHY"
elif [[ $FAILED_CHECKS -eq 0 ]]; then
    print_warning "Sistem çalışıyor ancak bazı uyarılar var ⚠️"
    HEALTH_STATUS="WARNING"
elif [[ $FAILED_CHECKS -lt 3 ]]; then
    print_error "Sistem sorunlu, acil müdahale gerekli! ⚠️"
    HEALTH_STATUS="DEGRADED"
else
    print_error "SİSTEM KRİTİK DURUMDA! 🚨"
    HEALTH_STATUS="CRITICAL"
fi

echo ""
print_status "Son kontrol: $(date)"

# Log health check result
echo "$(date): Health check completed - Status: $HEALTH_STATUS, Passed: $PASSED_CHECKS, Warnings: $WARNING_CHECKS, Failed: $FAILED_CHECKS" >> "$HEALTH_LOG"

# Exit with appropriate code
if [[ $FAILED_CHECKS -eq 0 ]]; then
    exit 0  # Success
elif [[ $FAILED_CHECKS -lt 3 ]]; then
    exit 1  # Warning
else
    exit 2  # Critical
fi