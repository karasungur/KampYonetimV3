# Değişiklik Günlüğü
## AK Parti Gençlik Kolları Yönetim Sistemi

Bu dosya, projedeki tüm önemli değişiklikleri takip etmek için kullanılır.
Format [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) standardına uygun olarak hazırlanmıştır.
Bu proje [Semantic Versioning](https://semver.org/spec/v2.0.0.html) standardını kullanır.

## [Yayınlanmamış]

### Eklendi
- VPS deployment için kapsamlı kurulum scripti
- Otomatik backup sistemi
- Sağlık kontrolü monitoring scripti
- PM2 ecosystem konfigürasyonu
- Nginx reverse proxy yapılandırması
- Let's Encrypt SSL otomatik kurulumu

### Değiştirildi
- Veritabanı schema optimizasyonları
- API response zamanlarında iyileştirme
- Frontend performans optimizasyonları

### Düzeltildi
- Yüz tanıma servisi bağlantı sorunları
- Memory leak sorunları
- Session timeout problemleri

### Güvenlik
- Rate limiting iyileştirmeleri
- Input validation güçlendirmeleri
- CORS policy güncellemeleri

## [2.1.0] - 2025-01-29

### Eklendi
- **Feedback Yönetimi**: Genelsekreterlik rolü için feedback silme özelliği
- **Tablo Yönetimi**: Kullanıcı detayları görüntüleme ve düzenleme
- **Export Formatları**: Excel (.xlsx) ve TXT formatlarında export desteği
- **JSON Import**: Comprehensive JSON import documentation
- **User Deletion**: Cascade delete constraints ile güvenli kullanıcı silme

### Değiştirildi
- Moderatörlerin genelsekreterlik yanıtlarını görebilme özelliği onaylandı
- Tables tablosuna updatedAt alanı eklendi
- Tüm foreign key'lere cascade delete constraint'leri eklendi

### Düzeltildi
- Kullanıcı silme işleminde ilişkili verilerin silinmeme sorunu
- Export işlemlerinde karakter encoding sorunları

## [2.0.0] - 2025-01-28

### Eklendi
- **Rol Yeniden Adlandırma**: Türkçe organizasyon yapısına uygun rol isimleri
  - "adminpro" → "genelsekreterlik" (General Secretariat)
  - "admin" → "genelbaskan" (General President)
  - "moderator" → "moderator" (değişmedi)
- **Yüz Tanıma Sistemi**: Python tabanlı yüz eşleştirme servisi
- **Fotoğraf Yönetimi**: Kamp fotoğrafları için veritabanı sistemi
- **Google Cloud Integration**: Fotoğraf depolama için Google Cloud Storage

### Değiştirildi
- Tüm veritabanı referansları yeni rol isimlerine güncellendi
- API endpoint'leri yeni rol yapısına uyarlandı
- UI components rol kontrollerinde güncelleme
- Schema.ts dosyasındaki yorumlar güncellendi

### Düzeltildi
- User management sayfası erişim kontrolü (genelsekreterlik için)
- UserModal component rol tip uyumsuzlukları
- /api/answers route permissions

### Kaldırıldı
- Eski adminpro rol referansları
- Kullanılmayan rol kontrol kodları

## [1.5.0] - 2025-01-15

### Eklendi
- **Ana Sayfa Customization**: Dinamik layout editor
- **Fotoğraf Upload**: Arkaplan görselleri yükleme sistemi
- **Program Akışı**: Etkinlik takvimi yönetimi
- **Sosyal Medya**: Hesap bağlantıları yönetimi
- **Ekip Yönetimi**: Team member profil sistemi

### Değiştirildi
- Database schema genişletmeleri
- UI/UX iyileştirmeleri
- Mobile responsive design güncellemeleri

### Güvenlik
- File upload güvenlik kontrolleri
- Image processing optimizasyonları

## [1.4.0] - 2025-01-10

### Eklendi
- **Bulk Operations**: Toplu kullanıcı işlemleri
- **Advanced Search**: Gelişmiş arama filtreleri
- **Export/Import**: Excel/CSV veri transferi
- **Activity Logs**: Detaylı kullanıcı aktivite takibi

### Değiştirildi
- Performance optimizasyonları
- Database index iyileştirmeleri
- API response caching

### Düzeltildi
- Memory usage optimizasyonları
- Query performance sorunları
- Connection pool yönetimi

## [1.3.0] - 2025-01-05

### Eklendi
- **Multi-table Support**: Çoklu masa yönetimi
- **Question Assignment**: Soruların belirli masalara atanması
- **Feedback System**: Moderatör geri bildirim sistemi
- **Real-time Updates**: WebSocket ile canlı güncellemeler

### Güvenlik
- JWT token security improvements
- Rate limiting implementation
- Input sanitization enhancements

## [1.2.0] - 2024-12-28

### Eklendi
- **Question Management**: Soru oluşturma ve düzenleme
- **Answer System**: Çoklu cevap desteği
- **Role-based Access**: Rol bazlı yetkilendirme
- **Responsive Design**: Mobile-first approach

### Değiştirildi
- UI library upgrade (Radix UI)
- Database migration to PostgreSQL
- Authentication system overhaul

## [1.1.0] - 2024-12-20

### Eklendi
- **User Authentication**: TC Kimlik ile giriş sistemi
- **Password Security**: Bcrypt hash implementation
- **Session Management**: JWT based sessions
- **Basic CRUD**: Kullanıcı yönetimi

### Güvenlik
- Password hashing with bcrypt
- SQL injection prevention
- XSS protection headers

## [1.0.0] - 2024-12-15

### Eklendi
- **Initial Release**: Temel proje yapısı
- **Database Schema**: PostgreSQL veritabanı tasarımı
- **Frontend Framework**: React + TypeScript setup
- **Backend API**: Express.js REST API
- **Build System**: Vite build configuration

### Teknik Detaylar
- Node.js 20.x
- React 18.3.1
- TypeScript 5.6.3
- PostgreSQL 15
- Drizzle ORM

---

## Sürüm Notları

### Semantic Versioning Açıklaması
- **MAJOR.MINOR.PATCH** formatında
- **MAJOR**: Breaking changes (geriye uyumsuz değişiklikler)
- **MINOR**: New features (yeni özellikler, geriye uyumlu)
- **PATCH**: Bug fixes (hata düzeltmeleri)

### Değişiklik Kategorileri
- **Eklendi**: Yeni özellikler
- **Değiştirildi**: Mevcut özelliklerde değişiklikler
- **Kullanımdan Kaldırıldı**: Yakında kaldırılacak özellikler
- **Kaldırıldı**: Kaldırılan özellikler
- **Düzeltildi**: Hata düzeltmeleri
- **Güvenlik**: Güvenlik ile ilgili değişiklikler

### Migration Notları

#### v2.0.0 → v2.1.0
```sql
-- Tables tablosuna updatedAt alanı eklendi
ALTER TABLE tables ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Cascade delete constraints eklendi
-- Bu migration otomatik olarak npm run db:push ile yapılır
```

#### v1.x → v2.0.0
```sql
-- Rol isimleri değiştirildi
UPDATE users SET role = 'genelsekreterlik' WHERE role = 'adminpro';
UPDATE users SET role = 'genelbaskan' WHERE role = 'admin';

-- Yeni tablolar eklendi (otomatik migration ile)
-- Photo management tables
-- Face recognition tables
-- Camp days tables
```

### Deployment Notları

#### v2.1.0 Deployment
1. Veritabanı backup alın
2. `npm run db:push` çalıştırın
3. Uygulamayı yeniden başlatın
4. Health check yapın

#### v2.0.0 Deployment
1. **ÖNEMLİ**: Bu major version breaking changes içerir
2. Veritabanı tam backup alın
3. Environment variables kontrol edin
4. Role-based access kontrollerini test edin
5. Python face recognition servisini kurun

### Bilinen Sorunlar

#### v2.1.0
- Excel export'ta büyük veri setlerinde performans sorunu
- Safari browser'da file upload UI problemi
- Memory usage yüksek fotoğraf işlemede

#### v2.0.0
- Python face recognition servisi GPU gerektiriyor
- İlk kurulumda model indirme uzun sürebilir
- Mobile'da face detection preview sorunu

### Gelecek Sürüm Planları

#### v2.2.0 (Planlanıyor)
- Real-time notifications
- Advanced analytics dashboard
- Mobile app PWA support
- Multi-language support

#### v3.0.0 (Uzun vadeli)
- Microservices architecture
- Advanced AI features
- Cloud-native deployment
- Enhanced security features

### Katkı Sağlayanlar

Bu sürümde katkıda bulunanlar için teşekkürler:
- Development Team
- QA Team
- System Administration Team
- AK Parti Gençlik Kolları Feedback Team

### Destek ve Belgeler

- **API Dokümantasyonu**: `/docs/api/`
- **Deployment Rehberi**: `DEPLOYMENT_GUIDE.md`
- **Troubleshooting**: `FAQ.md`
- **Contribution Guide**: `CONTRIBUTING.md`

---

*Bu changelog düzenli olarak güncellenmektedir. Son değişiklikler için git commit history'yi de kontrol edebilirsiniz.*