# AK Parti Gençlik Kolları Yönetim Sistemi
## Kullanım Kılavuzu

Bu kılavuz, sistem yöneticileri ve kullanıcılar için detaylı kullanım talimatlarını içermektedir.

## 📋 İçindekiler

1. [Giriş ve Kimlik Doğrulama](#giriş-ve-kimlik-doğrulama)
2. [Rol Bazlı Yetkilendirme](#rol-bazlı-yetkilendirme)
3. [Genel Sekreterlik Yönetimi](#genel-sekreterlik-yönetimi)
4. [Genel Başkan İşlemleri](#genel-başkan-işlemleri)
5. [Moderatör İşlemleri](#moderatör-işlemleri)
6. [Yüz Tanıma Sistemi](#yüz-tanıma-sistemi)
7. [Ana Sayfa Yönetimi](#ana-sayfa-yönetimi)
8. [Veri İçeri/Dışarı Aktarma](#veri-içeridışarı-aktarma)
9. [Sistem Yönetimi](#sistem-yönetimi)
10. [Mobil Kullanım](#mobil-kullanım)

---

## 🔐 Giriş ve Kimlik Doğrulama

### İlk Giriş
1. Web tarayıcınızda `https://akpartigenclik.yourdomain.com` adresine gidin
2. **TC Kimlik Numarası** ve **Şifre** bilgilerinizi girin
3. **Giriş Yap** butonuna tıklayın

### Şifre Sıfırlama
```
⚠️ Şifre sıfırlama işlemi sadece sistem yöneticisi tarafından yapılabilir.
Şifrenizi unuttuysanız sistem yöneticisi ile iletişime geçin.
```

### Güvenli Çıkış
- Sağ üst köşedeki kullanıcı menüsünden **Çıkış Yap**'ı seçin
- Tarayıcı sekmesini kapatmadan önce mutlaka çıkış yapın

---

## 👥 Rol Bazlı Yetkilendirme

### Roller ve Yetkiler

#### **Genel Sekreterlik** (genelsekreterlik)
- ✅ Tüm sistem yönetimi
- ✅ Kullanıcı yönetimi (ekleme, düzenleme, silme)
- ✅ Soru yönetimi (oluşturma, düzenleme, silme)
- ✅ Tüm masa yanıtlarını görüntüleme
- ✅ Feedback yönetimi (görüntüleme, yanıtlama, silme)
- ✅ Ana sayfa özelleştirme
- ✅ Sistem raporları
- ✅ Yüz tanıma sistemi yönetimi

#### **Genel Başkan** (genelbaskan)
- ✅ Tüm masa yanıtlarını görüntüleme
- ✅ Sistem raporları
- ✅ Ana sayfa görüntüleme
- ❌ Kullanıcı yönetimi
- ❌ Soru oluşturma/düzenleme
- ❌ Sistem ayarları

#### **Moderatör** (moderator)
- ✅ Atanmış masa sorularını görüntüleme
- ✅ Kendi masasının sorularına yanıt verme
- ✅ Feedback gönderme
- ✅ Kendi aktivite geçmişi
- ❌ Diğer masaların yanıtları
- ❌ Kullanıcı yönetimi
- ❌ Sistem ayarları

---

## 🏢 Genel Sekreterlik Yönetimi

### Dashboard Özellikleri
- **Kullanıcı İstatistikleri**: Toplam kullanıcı, aktif kullanıcı sayıları
- **Masa İstatistikleri**: Masa sayısı, yanıt durumları
- **Son Aktiviteler**: Sistem genelindeki son işlemler
- **Hızlı Erişim**: Sık kullanılan işlemler için kısayollar

### Kullanıcı Yönetimi

#### Yeni Kullanıcı Ekleme
1. Sol menüden **Kullanıcılar** seçin
2. **Yeni Kullanıcı Ekle** butonuna tıklayın
3. Gerekli bilgileri doldurun:
   - **Ad**: Kullanıcının adı
   - **Soyad**: Kullanıcının soyadı  
   - **TC Kimlik No**: 11 haneli TC numarası
   - **Şifre**: Güçlü şifre (en az 8 karakter)
   - **Rol**: genelsekreterlik/genelbaskan/moderator
   - **Masa Numarası**: Moderatör için gerekli
4. **Kaydet** butonuna tıklayın

#### Kullanıcı Düzenleme
1. **Kullanıcılar** listesinden düzenlemek istediğiniz kullanıcıyı seçin
2. **Düzenle** butonuna tıklayın
3. Bilgileri güncelleyin
4. **Kaydet** butonuna tıklayın

#### Kullanıcı Silme
```
⚠️ DİKKAT: Kullanıcı silindiğinde tüm ilişkili veriler de silinir!
```
1. Silinecek kullanıcıyı seçin
2. **Sil** butonuna tıklayın
3. Onay penceresinde **Evet, Sil** seçin

#### Toplu Kullanıcı İşlemleri
1. **JSON İçeri Aktar** butonunu kullanarak toplu kullanıcı ekleyebilirsiniz
2. Örnek JSON formatı:
```json
[
  {
    "firstName": "Ahmet",
    "lastName": "Yılmaz", 
    "tcNumber": "12345678901",
    "password": "güçlü_şifre",
    "role": "moderator",
    "tableNumber": 1
  }
]
```

### Soru Yönetimi

#### Yeni Soru Oluşturma
1. **Sorular** menüsünden **Yeni Soru Ekle**'yi seçin
2. Soru tipini belirleyin:
   - **Genel**: Tüm masalara gönderilir
   - **Belirli Masalar**: Sadece seçilen masalara gönderilir
3. Soru metnini yazın
4. Belirli masalar seçtiyseniz masa numaralarını belirleyin
5. **Kaydet** butonuna tıklayın

#### Soru Düzenleme ve Silme
- Mevcut soruları **Sorular** listesinden düzenleyebilir veya silebilirsiniz
- Silinen sorular tüm yanıtlarıyla birlikte kaldırılır

### Feedback Yönetimi
1. **Feedback** menüsünden gelen moderatör mesajlarını görüntüleyin
2. Her feedback'e yanıt verebilirsiniz
3. Çözümlenen feedback'leri **Çözümlendi** olarak işaretleyin
4. Gereksiz feedback'leri silebilirsiniz

### Sistem Raporları
- **Kullanıcı Aktivite Raporu**: Tüm kullanıcı işlemleri
- **Masa Performans Raporu**: Masa bazında yanıt istatistikleri
- **Soru Analiz Raporu**: Soru bazında yanıt durumları
- **Excel/CSV Export**: Tüm raporları dosya olarak indirin

---

## 📊 Genel Başkan İşlemleri

### Dashboard Görünümü
- **Özet İstatistikler**: Genel sistem durumu
- **Masa Durumları**: Tüm masaların yanıt durumları
- **Grafik Analizler**: Görsel raporlar

### Masa Yanıtlarını İnceleme
1. **Masalar** menüsünden istediğiniz masayı seçin
2. Masa sorularını ve yanıtlarını görüntüleyin
3. **Excel Export** ile rapor alabilirsiniz

### Sistem Raporları
- Genel Sekreterlik ile aynı rapor yetkilerine sahipsiniz
- Ancak düzenleme yetkiniz yoktur

---

## 📝 Moderatör İşlemleri

### Dashboard
- **Kendi Masa İstatistikleri**: Yanıtladığınız/yanıtlamadığınız sorular
- **Son Aktiviteler**: Kendi işlemleriniz
- **Güncel Duyurular**: Sistem duyuruları

### Soru Yanıtlama
1. **Sorularım** menüsünden yanıtlanacak soruyu seçin
2. **Yanıt Ekle** butonuna tıklayın
3. Yanıtınızı yazın
4. **Kaydet** butonuna tıklayın

#### Çoklu Yanıt Sistemi
- Her soruya birden fazla yanıt verebilirsiniz
- Yanıtlar sıralı olarak numaralandırılır
- Önceki yanıtlarınızı düzenleyebilirsiniz

### Feedback Gönderme
1. **Feedback** menüsünden **Yeni Feedback**'i seçin
2. İlgili soruyu seçin
3. Mesajınızı yazın (belirsizlik, eksik bilgi vb.)
4. **Gönder** butonuna tıklayın

### Kendi Aktivitelerini İzleme
- **Aktivite Geçmişi** menüsünden kendi işlemlerinizi görebilirsiniz
- Tarih aralığına göre filtreleme yapabilirsiniz

---

## 👨‍💻 Yüz Tanıma Sistemi

### Sistem Kurulumu (Sadece Genel Sekreterlik)

#### Kamp Günleri Yönetimi
1. **Yüz Tanıma > Kamp Günleri** menüsüne gidin
2. **Yeni Gün Ekle** butonuna tıklayın
3. Gün bilgilerini girin:
   - **Gün Adı**: "15 Ağustos", "16 Ağustos" vb.
   - **Tarih**: Kampın tarihi
4. **Kaydet** butonuna tıklayın

#### Fotoğraf Yükleme
1. **Fotoğraf Veritabanı** menüsünden **Yeni Fotoğraf Yükle**'yi seçin
2. Kamp fotoğraflarını toplu olarak yükleyin
3. Sistem otomatik olarak yüz tespiti yapacaktır

### Fotoğraf Talep Sistemi (Kullanıcılar için)

#### Kişisel Fotoğraf İsteme
1. Ana sayfada **Fotoğraflarım** butonuna tıklayın
2. **TC Kimlik Numarası** ve **Email** bilgilerinizi girin
3. **Referans fotoğraf** yükleyin (net yüzünüzün göründüğü)
4. **Kamp günlerini** seçin
5. **İsteği Gönder** butonuna tıklayın

#### İstek Durumu Takibi
- Email ile bilgilendirileceksiniz
- Sistem durumları:
  - **Beklemede**: İstek sıraya alındı
  - **İşleniyor**: Yüz eşleştirme çalışıyor
  - **Tamamlandı**: Eşleşen fotoğraflar email'e gönderildi
  - **Başarısız**: Teknik hata oluştu

---

## 🎨 Ana Sayfa Yönetimi (Sadece Genel Sekreterlik)

### Menü Ayarları
1. **Ana Sayfa > Menü Ayarları** menüsüne gidin
2. Menü öğelerini aktif/pasif yapın:
   - **Moderatör Girişi**: Sistem giriş butonu
   - **Program Akışı**: Etkinlik programı
   - **Fotoğraflar**: Yüz tanıma sistemi
   - **Sosyal Medya**: Sosyal medya hesapları
   - **Ekibimiz**: Team üyeleri
3. Menü başlıklarını özelleştirin
4. **Ana sayfa metinlerini** düzenleyin

### Program Akışı Yönetimi
1. **Program Akışı** menüsünden **Yeni Etkinlik Ekle**'yi seçin
2. Etkinlik bilgilerini girin:
   - **Başlık**: Etkinlik adı
   - **Açıklama**: Detay bilgi
   - **Tarih/Saat**: Etkinlik zamanı
   - **Konum**: Etkinlik yeri
3. **Kaydet** butonuna tıklayın

### Sosyal Medya Hesapları
1. **Sosyal Medya** menüsünden hesapları ekleyin:
   - **Platform**: Twitter, Instagram, Facebook vb.
   - **Hesap Adı**: @akpartigenclik
   - **URL**: Tam hesap linki
   - **Sıralama**: Görünüm sırası

### Ekip Üyeleri
1. **Ekibimiz** menüsünden team üyelerini ekleyin:
   - **Ad/Soyad**: Üye bilgileri
   - **Görev**: Pozisyon/rol
   - **İletişim**: Telefon/email (isteğe bağlı)
   - **Sıralama**: Liste sırası

### Layout Özelleştirme
1. **Layout Düzenleyici**'yi kullanarak:
   - **Arkaplan görselleri** yükleyin (desktop/mobile)
   - **Metin renkleri** değiştirin
   - **Buton stilleri** ayarlayın
   - **Pozisyonları** sürükle-bırak ile değiştirin

---

## 📤 Veri İçeri/Dışarı Aktarma

### Export İşlemleri

#### Excel Export
1. İlgili sayfada (Kullanıcılar, Sorular, Yanıtlar) **Excel İndir** butonuna tıklayın
2. Dosya otomatik olarak indirilecektir
3. Excel formatında: `.xlsx`

#### CSV Export  
1. **CSV İndir** butonunu kullanın
2. Türkçe karakter desteği: UTF-8 encoding
3. Sütun ayracı: Virgül (,)

#### TXT Export
1. **TXT İndir** butonunu kullanın
2. Düz metin formatında
3. Tab-separated values

### Import İşlemleri

#### JSON Import (Sadece Kullanıcılar)
1. **JSON İçeri Aktar** butonuna tıklayın
2. Doğru JSON formatında dosya seçin
3. **Yükle** butonuna tıklayın
4. Hata mesajları varsa düzeltip tekrar deneyin

**Örnek JSON formatı:**
```json
[
  {
    "firstName": "Mehmet",
    "lastName": "Demir",
    "tcNumber": "98765432101", 
    "password": "güçlü_şifre_123",
    "role": "moderator",
    "tableNumber": 5
  }
]
```

---

## ⚙️ Sistem Yönetimi

### Aktivite İzleme
- **Aktivite Logları** menüsünden tüm sistem işlemlerini görüntüleyin
- Filtreleme seçenekleri:
  - **Kullanıcı**: Belirli kullanıcının işlemleri
  - **Tarih Aralığı**: Zaman filtresi
  - **İşlem Tipi**: Login, soru oluşturma vb.

### Sistem Ayarları (Sadece Genel Sekreterlik)
- **Genel Ayarlar**: Sistem başlığı, logo vb.
- **Email Ayarları**: SMTP konfigürasyonu
- **Güvenlik Ayarları**: Şifre politikaları
- **Backup Ayarları**: Otomatik yedekleme

### Kullanıcı Desteği
1. **Yardım** menüsünden sistem rehberlerine erişin
2. **SSS** bölümünden yaygın sorunların çözümlerini bulun
3. **İletişim** bilgileri ile teknik destek alın

---

## 📱 Mobil Kullanım

### Responsive Tasarım
- Sistem tamamen mobil uyumludur
- Telefon ve tablet'te rahatlıkla kullanılabilir
- Touch-friendly interface

### Mobil Özellikler
- **Swipe Navigation**: Kaydırarak gezinme
- **Touch Gestures**: Dokunmatik hareketler
- **Optimized Forms**: Mobil-friendly formlar
- **Quick Actions**: Hızlı işlem butonları

### Mobil İpuçları
1. **Yatay kullanım** daha iyi deneyim sunar
2. **Zoom yaparak** küçük metinleri okuyun
3. **Çift dokunuş** ile hızlı işlemler yapın
4. **Geri tuşu** ile önceki sayfaya dönün

---

## 🔍 Arama ve Filtreleme

### Genel Arama
- **Global arama kutusu** ile tüm sistemde arama yapın
- **Enter** tuşu ile arama başlatın
- **X** butonu ile aramayı temizleyin

### Gelişmiş Filtreleme
1. **Filtre** butonuna tıklayın
2. Filtreleme kriterlerini seçin:
   - **Tarih aralığı**
   - **Kullanıcı/Rol**
   - **Durum** (aktif/pasif)
   - **Kategori**
3. **Filtrele** butonuna tıklayın
4. **Temizle** ile filtreleri sıfırlayın

### Sıralama
- **Kolon başlıkları**na tıklayarak sıralama yapın
- **Artan/Azalan** sıralama desteği
- **Çoklu sıralama** için Ctrl+Click

---

## 💡 İpuçları ve Kısayollar

### Klavye Kısayolları
- **Ctrl + S**: Formu kaydet
- **Esc**: Modal/popup'ı kapat
- **Ctrl + F**: Sayfa içinde arama
- **F5**: Sayfayı yenile

### Hızlı İşlemler
- **Çift tıklama**: Hızlı düzenleme
- **Sağ tık**: Context menu
- **Sürükle-bırak**: Sıralama/organizasyon

### Verimlilik İpuçları
1. **Favoriler** menüsünü kullanarak sık kullanılan sayfalara hızlı erişin
2. **Kısa yol tuşları** ile zaman kazanın
3. **Toplu işlemler** ile çoklu veri yönetimi yapın
4. **Export/Import** ile veri transferi kolaylaştırın

---

## ⚠️ Önemli Uyarılar

### Güvenlik
- **Şifrenizi** düzenli olarak değiştirin
- **Oturumu** kullanım sonrası mutlaka kapatın
- **Hassas bilgileri** paylaşmayın
- **Güvenilir ağlarda** sisteme erişin

### Veri Güvenliği  
- **Düzenli backup** alın
- **Kritik işlemlerden** önce yedekleme yapın
- **Silme işlemlerinde** dikkatli olun
- **Veri kaybı** durumunda hemen rapor edin

### Performance
- **Büyük dosyalar** yüklerken sabırlı olun
- **Çoklu sekme** kullanımından kaçının
- **Cache temizleme** sorunları çözebilir
- **Güncel tarayıcı** kullanın

---

## 📞 Destek ve Yardım

### Teknik Destek
- **Email**: admin@akpartigenclik.org.tr
- **Telefon**: +90 (XXX) XXX XX XX
- **Çalışma Saatleri**: 09:00 - 18:00 (Hafta içi)

### Acil Durumlar
- **Sistem erişim sorunu**: Teknik destek hattı
- **Veri kaybı**: Derhal rapor edin
- **Güvenlik ihlali**: Acil destek hattı

### Eğitim ve Dokümantasyon
- **Kullanım videoları**: YouTube kanalımız
- **PDF rehberler**: İndirme bölümü  
- **Online eğitim**: Webinar programları
- **SSS**: Sık sorulan sorular

---

*Bu kullanım kılavuzu düzenli olarak güncellenmektedir. En güncel sürüm için sistem içindeki Yardım menüsünü kontrol edin.*