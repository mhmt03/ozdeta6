# OZDETA - Öğrenci ve Ödev Takip Sistemi (Proje Dokümantasyonu)

Bu doküman, **OZDETA** mobil uygulamasının mimarisini, veri tabanı şemasını, klasör yapısını ve geliştirme kurallarını özetler. Bu dosya, projeye yeni katılan geliştiricilerin veya AI ajanlarının tüm kod tabanını okumasına gerek kalmadan projeyi hızlıca anlayabilmesi için hazırlanmıştır.

---

## 1. Proje Özeti ve Amacı
**OZDETA**, özel ders öğretmenleri ve eğitim kurumları için geliştirilmiş, öğrenci merkezli bir ders, ödev, randevu (ajanda) ve ödeme takip mobil uygulamasıdır. 
* **Temel Amaç**: Öğrencilerin ders durumlarını, kaynak kitaplarındaki konu ilerlemelerini, ödev yapma oranlarını, sınav netlerini ve ödeme durumlarını tek bir arayüzden takip etmek ve velilere kolayca rapor (Örn: WhatsApp veya PDF formatında) gönderebilmek.
* **Platform**: React Native ve Expo altyapısı kullanılarak çapraz platform (Cross-platform - hem Android hem de iOS) destekli olarak geliştirilmiştir.

---

## 2. Teknoloji Yığını (Tech Stack)
* **Framework**: React Native (Expo SDK)
* **Programlama Dili**: TypeScript
* **Yerel Veri Tabanı**: SQLite (`expo-sqlite`)
* **Arayüz Elemanları**: Expo Vector Icons (MaterialIcons), React Native standart bileşenleri
* **Ayar Depolama**: `@react-native-async-storage/async-storage` (Basit ayarlar ve otomatik yedekleme tarihleri için)
* **Diğer Entegrasyonlar**: `xlsx` (Excel veri aktarımları için), `expo-file-system` (Yedekleme ve dosya yönetimi), `expo-sharing` (Dosya paylaşımı), `expo-notifications` (Planlı ders bildirimleri)

---

## 3. Klasör Yapısı (Folder Structure)

```
ozdeta/
├── App.tsx                  # Uygulama giriş noktası ve Navigation yolları
├── app.json                 # Expo proje yapılandırmaları
├── package.json             # Bağımlılıklar ve kütüphaneler
├── tsconfig.json            # TypeScript yapılandırması
│
├── database/                # Veri Tabanı Katmanı
│   ├── init.ts              # SQLite bağlantısı, Şema tanımları ve Migration (versiyon) kontrolü
│   ├── studentOperations.ts # Öğrenci ekleme, güncelleme, silme ve listeleme
│   ├── homeworkOperations.ts# Ödev atama, kaynak tanımlama, kopyalama ve konu yönetimi
│   ├── agendaOperations.ts  # Ajanda, randevu planlama ve ders durum güncellemeleri
│   ├── financeOperations.ts # Alınan ucretler, ödeme geçmişi ve tahsilatlar
│   ├── denemeOperations.ts  # Deneme sınavları ekleme, silme ve listeleme
│   ├── examTypeOperations.ts# Sınav türleri (TYT, AYT vb.) yönetimi
│   ├── globalNotesOperations# Genel hatırlatıcı notlar
│   ├── settingsOperations.ts# Key-value ayar okuma/yazma
│   └── maintenanceOperations# Veritabanı optimizasyon ve temizlik işlemleri
│
├── screens/                 # Arayüz Ekranları (UI Screens)
│   ├── AnaSayfa.tsx         # Hızlı istatistikler ve günlük ders programı
│   ├── ogrenciListesi.tsx   # Öğrenci arama, filtreleme ve aktiflik yönetimi
│   ├── OgrenciDetay.tsx     # Seçili öğrencinin ders, ödev, finansal geçmiş ve deneme özeti
│   ├── OdevEkle.tsx         # Ödev verme, takip etme, WhatsApp durum bildirimi ve PDF raporu
│   ├── Ajanda.tsx           # Haftalık/Aylık takvim üzerinden randevu planlama
│   ├── AjandaKayitEkle.tsx  # Yeni ders planı/randevu oluşturma (tekli veya tekrarlı)
│   ├── AjandaRandevuDuzenle.tsx # Planlanmış randevuyu düzenleme, iptal etme veya tamamlama
│   ├── GlobalKaynakYonetimi.tsx # Ortak kaynak kitaplar ve bunlara ait konu listelerinin yönetimi
│   ├── KaynakYonetimi.tsx   # Öğrenciye özel kaynak atama
│   ├── Denemeler.tsx        # Deneme sınav sonuçları, net grafikleri ve analizler
│   ├── DersRapor.tsx        # Öğrencinin aldığı derslerin detaylı dökümü ve raporlaması
│   ├── Ayarlar.tsx          # Veri yedekleme, geri yükleme, bildirim ve genel sistem tercihleri
│   └── YeniKayit.tsx        # Sisteme hızlı yeni öğrenci ekleme formu
│
├── components/              # Yeniden Kullanılabilir Arayüz Bileşenleri
│   ├── OgrenciListItem.tsx  # Öğrenci listesindeki satır tasarımı
│   ├── OgrenciForm.tsx      # Öğrenci ekleme/düzenleme formu şablonu
│   ├── OdevItem.tsx         # Ödev listesindeki kart tasarımı
│   ├── PaymentPopup.tsx     # Hızlı ödeme alma / borç kapatma penceresi
│   └── GlobalNotlarModal.tsx# Hızlı not alma ve hatırlatıcı paneli
│
├── utils/                   # Yardımcı Kütüphaneler ve Entegrasyonlar
│   ├── backup.ts            # Otomatik veritabanı yedekleme ve paylaşma motoru
│   ├── notifications.ts     # expo-notifications ile randevu bildirimlerini planlama
│   ├── fileOperations.ts    # Excel/JSON dışa/içe aktarım işlemleri
│   └── messaging.ts         # WhatsApp entegrasyonu ve mesaj şablonları
│
└── types/                   # TypeScript Tip Tanımları
    └── index.ts             # Tüm veritabanı modellerinin arayüz (Interface) tanımları
```

---

## 4. Detaylı Veri Tabanı Şeması (Database Schema)

Uygulamanın yerel SQLite veri tabanı `ozdeta.db` adını taşır. Tüm yabancı anahtarlarda (`FOREIGN KEY`), öğrenci kaydı silindiğinde veritabanının temiz kalması için **`ON DELETE CASCADE`** aktif edilmiştir.

### Tablolar ve Kolon Yapıları

#### 1. `ogrenciler` (Öğrenci Bilgileri)
* `ogrenciId` (INTEGER, PK, AUTOINCREMENT): Öğrencinin benzersiz kimliği.
* `ogrenciAd` (TEXT, NOT NULL): Öğrenci adı.
* `ogrenciSoyad` (TEXT, DEFAULT '-'): Öğrenci soyadı.
* `veliAd` (TEXT, DEFAULT '-'): Veli adı ve soyadı.
* `okul` (TEXT, DEFAULT '-'): Öğrencinin okuduğu okul.
* `sinif` (TEXT, DEFAULT '-'): Sınıfı (Örn: LGS, 11. Sınıf).
* `aciklama1` / `aciklama2` (TEXT, DEFAULT '-'): Öğretmenin ek notları.
* `kayitTarihi` (TEXT, DEFAULT CURRENT_TIMESTAMP): Kayıt tarihi.
* `ucret` (INTEGER, DEFAULT 0): Öğrencinin ders saati başına anlaşılan ücreti.
* `ogrenciTel` / `veliTel` (TEXT, DEFAULT '-'): Telefon numaraları.
* `aktifmi` (INTEGER, DEFAULT 1): Aktiflik durumu (1: Aktif, 0: Pasif).
* `veli_odev_istiyor_mu` (INTEGER, DEFAULT 0): WhatsApp'tan ödev raporu isteği (1: Evet, 0: Hayır).

#### 2. `dersler` (İşlenen Dersler)
* `dersId` (INTEGER, PK, AUTOINCREMENT): Ders kimliği.
* `ogrenciId` (INTEGER, FK -> `ogrenciler`): Dersi alan öğrenci.
* `dersturu` (TEXT): Ders branşı (Matematik, Fizik vb.).
* `konu` (TEXT): İşlenen konu.
* `saat` (TEXT): Ders saati süresi veya aralığı.
* `tarih` (TEXT): Dersin yapıldığı tarih.
* `ucret` (TEXT): Ders için tahakkuk eden ücret.
* `ogrenciAdSoyad` (TEXT): Arama indeksini hızlandırmak için ad-soyad alanı.

#### 3. `kaynaklar` (Öğrencinin Takip Ettiği Kaynak Kitaplar)
* `kaynakId` (INTEGER, PK, AUTOINCREMENT): Kaynak ID.
* `ogrenciId` (INTEGER, FK -> `ogrenciler`): Kaynağın atandığı öğrenci.
* `kaynak` (TEXT): Kitap adı.

#### 4. `odevler` (Ödev Takip)
* `odevId` (INTEGER, PK, AUTOINCREMENT): Ödev ID.
* `ogrenciId` (INTEGER, FK -> `ogrenciler`): Ödevlendirilen öğrenci.
* `kaynak` (TEXT): Ödevin verildiği kitap adı.
* `odev` (TEXT): Ödev verilen sayfalar/sorular.
* `verilmetarihi` (TEXT): Ödevlendirme tarihi.
* `teslimttarihi` (TEXT): Planlanan teslim tarihi.
* `kontroltarihi` (TEXT): Kontrol edilme tarihi.
* `yapilmadurumu` (TEXT): Durum (Örn: Yapıldı, Yapılmadı, Eksik, Boş, Ertelendi).
* `aciklama` (TEXT): Ödevle ilgili özel notlar.

#### 5. `notlarim` (Öğrenciye Özel Öğretmen Notları)
* `notlarimId` (INTEGER, PK, AUTOINCREMENT): Not ID.
* `ogrenciId` (INTEGER, FK -> `ogrenciler`): İlişkili öğrenci.
* `tarih` (TEXT): Notun girildiği tarih.
* `not1` (TEXT): Not içeriği.

#### 6. `odemeler` (Muhasebe ve Tahsilat)
* `odemeId` (INTEGER, PK, AUTOINCREMENT): Ödeme ID.
* `ogrenciId` (INTEGER, FK -> `ogrenciler`): Ödemeyi yapan öğrenci.
* `alinanucret` (TEXT): Tahsil edilen miktar.
* `odemetarih` (TEXT): Ödeme tarihi.
* `odemeturu` (TEXT): Ödeme yöntemi (Elden, Havale, EFT).
* `aciklama` (TEXT): Açıklama.
* `odemesaati` (TEXT): Ödeme saati.

#### 7. `ajanda` (Ders Planlama / Randevular)
* `ajandaId` (INTEGER, PK, AUTOINCREMENT): Randevu ID.
* `ogrenciId` (INTEGER, FK -> `ogrenciler`): Randevu verilen öğrenci.
* `ogrAdsoyad` (TEXT): Öğrenci adı soyadı.
* `tarih` (TEXT): Ders tarihi.
* `saat` (TEXT): Ders saati.
* `tekrarsayisi` (TEXT): Toplam tekrar sayısı (Periyodik dersler için).
* `kalanTekrarSayisi` (TEXT): Kalan periyodik ders sayısı.
* `olusmaAni` (TEXT): Kaydın oluşturulma zamanı.
* `tamamlanma` (TEXT): Dersin tamamlandığı an.
* `tamamlandiMi` (INTEGER, DEFAULT 0): Tamamlanma durumu (1: Tamamlandı, 0: Bekliyor).
* `iptal` (INTEGER, DEFAULT 0): İptal durumu (1: İptal, 0: Aktif).
* `konu` (TEXT): Planlanan ders konusu.

#### 8. `settings` (Sistem Ayarları)
* `key` (TEXT, PK): Ayar anahtarı (Örn: `notifications_enabled`, `notification_sound`).
* `value` (TEXT): Ayar değeri.

#### 9. `tum_kaynaklar` (Global Ortak Kitap Havuzu)
* `id` (INTEGER, PK, AUTOINCREMENT): Kaynak ID.
* `ad` (TEXT): Kitap adı.
* `tur` (TEXT, DEFAULT 'Diğer'): Kaynak türü (Örn: TYT Matematik).

#### 10. `kaynak_icerikleri` (Global Kitapların Konu İçerikleri)
* `id` (INTEGER, PK, AUTOINCREMENT): İçerik ID.
* `kaynakId` (INTEGER, FK -> `tum_kaynaklar`): İlişkili kitap.
* `icerik` (TEXT): Konu adı (Örn: Sayılar, Türev).

#### 11. `sinav_turleri` (Sınav Kategorileri)
* `id` (INTEGER, PK, AUTOINCREMENT): Tür ID.
* `ad` (TEXT, UNIQUE): Tür adı (Örn: LGS, TYT, AYT).

#### 12. `denemeler` (Deneme Sınavı Net Takibi)
* `id` (INTEGER, PK, AUTOINCREMENT): Kayıt ID.
* `ogrenciId` (INTEGER, FK -> `ogrenciler`): Öğrenci ID.
* `sinavTuruId` (INTEGER, FK -> `sinav_turleri`): Hangi tür sınav.
* `denemeAd` (TEXT): Sınav adı (Örn: TÖDER-1).
* `tarih` (TEXT): Sınav tarihi.
* `dogru` (INTEGER): Doğru sayısı.
* `yanlis` (INTEGER): Yanlış sayısı.

#### 13. `global_notlar` (Hatırlatıcı Yapışkan Notlar)
* `id` (INTEGER, PK, AUTOINCREMENT): Not ID.
* `not_metni` (TEXT): Genel not metni.
* `tarih_saat` (TEXT): Oluşturulma tarihi.

#### 14. `kaynak_turleri` (Kitap Türleri)
* `id` (INTEGER, PK, AUTOINCREMENT): Tür ID.
* `ad` (TEXT, UNIQUE): Tür adı (Örn: TYT, AYT, 11. Sınıf).

---

## 5. iOS Platformu Geliştirme ve Uyumluluk Notları

Uygulamanın ileride iOS üzerinde sorunsuz çalışması için aşağıdaki teknik detaylara ve kısıtlamalara dikkat edilmelidir:

1. **Dosya Sistemi Erişimleri (`expo-file-system`)**:
   * Android ve iOS'un dosya depolama mantığı farklıdır. iOS üzerinde uygulamaların doğrudan harici klasörlere (`Downloads` vb.) erişim ve klasör oluşturma yetkisi yoktur.
   * Bu nedenle yedekleme işlemlerinde `expo-file-system/legacy` altındaki `documentDirectory` ve `cacheDirectory` yolları kullanılmalı, dosyalar bu geçici alanlarda hazırlanıp **`expo-sharing`** (`Sharing.shareAsync`) API'si aracılığıyla iOS "Dosyalar" uygulamasına veya bulut sürücülere gönderilmelidir.
2. **Klavye Yönetimi (`KeyboardAvoidingView`)**:
   * iOS cihazlarda ekran klavyesinin açılması form alanlarını kapatabilir. Giriş alanlarının klavye altında kalmaması için tüm form ekranlarında `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>` yapısı kullanılmalıdır.
3. **Tarih Seçici (`DateTimePicker`)**:
   * `@react-native-community/datetimepicker` bileşeni iOS'ta varsayılan olarak gömülü (inline/compact) modda açılırken Android'de modal (dialog) olarak açılır. iOS entegrasyonunda tarih seçicinin arayüzde doğru yerleşmesi veya modal içinde sarmalanması kritik önem taşır.
4. **Randevu Bildirimleri (`expo-notifications`)**:
   * iOS üzerinde yerel bildirim (local notification) gönderebilmek için kullanıcılardan açık izin alınmalıdır (`Notifications.requestPermissionsAsync()`).
   * Bildirimlerin kilit ekranında veya banner olarak gösterilmesi için `setNotificationHandler` fonksiyonunda `shouldShowBanner: true` ve `shouldShowList: true` özellikleri açık olmalıdır.

---

## 6. Geliştiriciler ve Yapay Zeka Ajanları İçin Kod Yazma Kuralları

Bu projede kod yazarken veya veri tabanını güncellerken şu kurallara mutlaka uyunuz:

1. **Şema Değişikliklerinde Sürüm Artırma**:
   * Eğer veritabanında yeni bir tablo veya mevcut bir tabloya yeni bir kolon eklerseniz, mutlaka `database/init.ts` dosyasındaki `DATABASE_VERSION` değerini **1 artırın** ve `migrations` dizisinin sonuna yeni bir async güncelleme fonksiyonu ekleyin.
2. **Güvenli SQL Kullanımı**:
   * Parametrik sorgular yaparken `undefined` değerlerin SQLite parametre dizisine gitmesini önleyin. `Partial<Type>` parametrelerinde her zaman `deger ?? null` mantığını uygulayarak TypeScript derleme hatalarının önüne geçin.
3. **Idempotency (Tekrarlanabilirlik)**:
   * Yazılan tüm SQL şema sorguları veya kolon ekleme komutları (`ensureSchema` ve `migrations` içindekiler) idempotent olmalıdır. Yani aynı kod veritabanında birden fazla kez çalıştırıldığında çökmemeli ve hata vermemelidir (`CREATE TABLE IF NOT EXISTS` veya try-catch ile korunan `ALTER TABLE` kullanımı).
4. **Uyumlu Paket Yolları**:
   * Expo sürümüne bağlı olarak `expo-file-system` üzerinden `documentDirectory` ve `cacheDirectory` alınırken, uyumsuzluk ve TypeScript hatalarını engellemek için `expo-file-system/legacy` alt modül yolunu tercih edin.
