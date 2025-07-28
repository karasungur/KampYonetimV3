# JSON Kullanıcı İçe Aktarma Formatı

Bu dokümantasyon, AK Parti Gençlik Kolları İstişare Kampı Yönetim Sistemi için kullanıcı içe aktarma JSON formatını açıklar.

## JSON Dosya Yapısı

JSON dosyası aşağıdaki yapıda olmalıdır:

```json
{
  "users": [
    {
      "tcNumber": "12345678901",
      "password": "sifre123",
      "firstName": "Ahmet",
      "lastName": "Yılmaz",
      "role": "moderator",
      "tableNumber": 1
    },
    {
      "tcNumber": "98765432109",
      "password": "sifre456",
      "firstName": "Mehmet",
      "lastName": "Demir",
      "role": "genelbaskan"
    }
  ]
}
```

## Alan Açıklamaları

### Zorunlu Alanlar

- **tcNumber** (string): 11 haneli T.C. Kimlik Numarası
- **password** (string): Kullanıcı şifresi (minimum 6 karakter)
- **firstName** (string): Kullanıcının adı
- **lastName** (string): Kullanıcının soyadı
- **role** (string): Kullanıcı rolü. Değerler:
  - `"genelsekreterlik"` - Genel Sekreterlik (tüm yetkilere sahip)
  - `"genelbaskan"` - Genel Başkan (raporlama ve görüntüleme yetkisi)
  - `"moderator"` - Moderatör (masa bazlı soru cevaplama yetkisi)

### Opsiyonel Alanlar

- **tableNumber** (number): Masa numarası (sadece moderatör rolü için gerekli)

## Örnek Dosya

Örneki `attached_assets/ornek_kullanici_import.json` dosyasında bulabilirsiniz:

```json
{
  "users": [
    {
      "tcNumber": "11111111111",
      "password": "demo123",
      "firstName": "Ali",
      "lastName": "Kaya",
      "role": "genelsekreterlik"
    },
    {
      "tcNumber": "22222222222",
      "password": "demo123",
      "firstName": "Veli",
      "lastName": "Öz",
      "role": "genelbaskan"
    },
    {
      "tcNumber": "33333333333",
      "password": "demo123",
      "firstName": "Ayşe",
      "lastName": "Yıldız",
      "role": "moderator",
      "tableNumber": 1
    },
    {
      "tcNumber": "44444444444",
      "password": "demo123",
      "firstName": "Fatma",
      "lastName": "Demir",
      "role": "moderator",
      "tableNumber": 2
    }
  ]
}
```

## İçe Aktarma İşlemi

1. **Dosya Hazırlama**: Yukarıdaki formata uygun bir JSON dosyası hazırlayın
2. **Kullanıcı Yönetimi Sayfası**: Sistemde "Kullanıcı Yönetimi" sayfasına gidin
3. **JSON İçe Aktar**: Sayfanın sağ üst köşesindeki "JSON İçe Aktar" butonuna tıklayın
4. **Dosya Seçimi**: Hazırladığınız JSON dosyasını seçin
5. **Otomatik İşlem**: Sistem otomatik olarak:
   - Kullanıcıları oluşturur
   - Şifreleri güvenli bir şekilde hashler
   - Moderatörler için belirtilen masaları oluşturur (eğer yoksa)
   - İşlem sonucunu bildirir

## Önemli Notlar

- T.C. Kimlik Numaraları benzersiz olmalıdır
- Aynı T.C. Kimlik Numarası ile birden fazla kullanıcı oluşturulamaz
- Moderatör rolü için masa numarası zorunludur
- Şifreler en az 6 karakter olmalıdır
- Masa numaraları pozitif tam sayı olmalıdır
- Sistem, belirtilen masa numarası yoksa otomatik olarak oluşturur

## Hata Durumları

- **Geçersiz JSON formatı**: Dosya düzgün JSON formatında değilse
- **Eksik zorunlu alan**: Yukarıda belirtilen zorunlu alanlardan biri eksikse
- **Geçersiz rol**: Belirtilen rol değerlerinden biri değilse
- **Tekrar eden T.C. Kimlik No**: Aynı T.C. Kimlik Numarası sistemde zaten varsa
- **Geçersiz T.C. Kimlik No**: 11 haneli değilse

## Başarılı İçe Aktarma

İşlem başarılı olduğunda sistem:
- Kaç kullanıcının başarıyla içe aktarıldığını
- Kaç masanın oluşturulduğunu (varsa)
- bildirir.

## Destek

Sorunlarla karşılaşırsanız, JSON dosyanızın formatını kontrol edin ve yukarıdaki kurallara uyduğundan emin olun.