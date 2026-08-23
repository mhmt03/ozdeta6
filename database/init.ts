import * as SQLite from 'expo-sqlite';

/**
 * Global veritabanı bağlantı referansı.
 * Tekil (Singleton) bağlantı yönetimi sağlamak için kullanılır.
 */
let db: SQLite.SQLiteDatabase | null = null;

/**
 * SQLite veritabanı dosya adı.
 * Cihazın yerel depolama alanında bu isimle saklanır.
 */
const DATABASE_NAME = 'ozdeta.db';

/**
 * Şifreli SQLite veritabanı desteği için parola.
 * Boş bırakıldığında standart şifresiz SQLite veritabanı kullanılır.
 */
const DB_PASSWORD: string = '';

/**
 * Veritabanı Şema Sürümü.
 * Tablolara yeni sütunlar veya tablolar eklendiğinde bu değer 1 artırılmalıdır.
 * Migration motoru bu değere göre eksik adımları otomatik çalıştırır.
 */
const DATABASE_VERSION = 6;

// ─── ŞEMA TANIMLARI (SQL) ────────────────────────────────────────────────────
/**
 * Uygulamanın sıfırdan kurulumunda veya veritabanı bulunmadığında çalıştırılan
 * temel tablo oluşturma komutlarıdır (DDL).
 * Tüm tablolarda `IF NOT EXISTS` kullanılarak idempotency (tekrarlanabilirlik) sağlanır.
 */
const TABLO_OLUSTUR = `
-- 1. Öğrenci bilgilerini tutan ana tablo
CREATE TABLE IF NOT EXISTS ogrenciler (
    ogrenciId            INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Öğrenci ID
    ogrenciAd            TEXT    NOT NULL,                  -- Öğrenci Adı
    ogrenciSoyad         TEXT    DEFAULT '-',               -- Öğrenci Soyadı
    veliAd               TEXT    DEFAULT '-',               -- Veli Adı/Soyadı
    okul                 TEXT    DEFAULT '-',               -- Okul Adı
    sinif                TEXT    DEFAULT '-',               -- Sınıf/Şube (Örn: 12-A, LGS)
    aciklama1            TEXT    DEFAULT '-',               -- Ek açıklama alanı 1
    aciklama2            TEXT    DEFAULT '-',               -- Ek açıklama alanı 2
    kayitTarihi          TEXT    DEFAULT CURRENT_TIMESTAMP, -- Kayıt tarihi (Varsayılan: Şimdiki Zaman)
    ucret                INTEGER DEFAULT 0,                 -- Anlaşılan ders ucreti
    ogrenciTel           TEXT    DEFAULT '-',               -- Öğrenci telefon numarası
    veliTel              TEXT    DEFAULT '-',               -- Veli telefon numarası
    aktifmi              INTEGER DEFAULT 1,                 -- Öğrencinin aktiflik durumu (1: Aktif, 0: Pasif)
    veli_odev_istiyor_mu INTEGER DEFAULT 0                  -- Velinin ödev bildirimi isteyip istemediği (1: Evet, 0: Hayır)
);

-- 2. Alınan/işlenen derslerin kayıtlarını tutan tablo
CREATE TABLE IF NOT EXISTS dersler (
    dersId               INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Ders ID
    ogrenciId            INTEGER,                           -- İlişkili Öğrenci ID (Foreign Key)
    dersturu             TEXT,                              -- Ders Türü (Örn: Matematik, Fizik)
    konu                 TEXT,                              -- İşlenen konu
    saat                 TEXT,                              -- Ders saati/süresi
    tarih                TEXT,                              -- Ders tarihi
    ucret                TEXT,                              -- Dersi ucret bilgisi
    ogrenciAdSoyad       TEXT,                              -- Arama kolaylığı için hızlı ad-soyad alanı
    sutun2               TEXT,                              -- Gelecekte kullanım için yedek sütunlar
    sutun3               TEXT,
    sutun4               TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId) ON DELETE CASCADE
);

-- 3. Öğrencilere atanan kaynak kitapları tutan tablo
CREATE TABLE IF NOT EXISTS kaynaklar (
    kaynakId             INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz kaynak ID
    ogrenciId            INTEGER,                           -- İlişkili Öğrenci ID
    kaynak               TEXT,                              -- Kaynak adı
    sutun1               TEXT,                              -- Yedek sütunlar
    sutun2               TEXT,
    sutun3               TEXT,
    sutun4               TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId) ON DELETE CASCADE
);

-- 4. Ödev takip kayıtlarını tutan tablo
CREATE TABLE IF NOT EXISTS odevler (
    odevId               INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Ödev ID
    ogrenciId            INTEGER,                           -- İlişkili Öğrenci ID
    kaynak               TEXT,                              -- Ödevlendirilen kaynak adı
    odev                 TEXT,                              -- Ödevin konusu/detayı (Örn: sayfa 20-30 arası)
    verilmetarihi        TEXT,                              -- Ödevin verildiği tarih
    teslimttarihi        TEXT,                              -- Planlanan teslim tarihi
    kontroltarihi        TEXT,                              -- Kontrolün yapıldığı tarih
    yapilmadurumu        TEXT,                              -- Ödev durumu (Örn: Yapıldı, Yapılmadı, Eksik)
    aciklama             TEXT,                              -- Ödevle ilgili öğretmen notu
    sutun1               TEXT,                              -- Yedek sütunlar
    sutun2               TEXT,
    sutun3               TEXT,
    sutun4               TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId) ON DELETE CASCADE
);

-- 5. Öğrenciye özel notların tutulduğu tablo
CREATE TABLE IF NOT EXISTS notlarim (
    notlarimId           INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Not ID
    ogrenciId            INTEGER,                           -- İlişkili Öğrenci ID
    tarih                TEXT,                              -- Not tarihi
    not1                 TEXT,                              -- Not içeriği
    sutun1               TEXT,                              -- Yedek sütunlar
    sutun2               TEXT,
    sutun3               TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId) ON DELETE CASCADE
);

-- 6. Ödeme / muhasebe kayıtlarını tutan tablo
CREATE TABLE IF NOT EXISTS odemeler (
    odemeId              INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Ödeme ID
    ogrenciId            INTEGER,                           -- İlişkili Öğrenci ID
    alinanucret          TEXT,                              -- Alınan ödeme miktarı
    odemetarih           TEXT,                              -- Ödeme tarihi
    odemeturu            TEXT,                              -- Ödeme yöntemi (Elden, Havale vb.)
    aciklama             TEXT,                              -- Ödeme açıklaması
    odemesaati           TEXT,                              -- Ödeme saati
    sutun2               TEXT,                              -- Yedek sütunlar
    sutun3               TEXT,
    sutun4               TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId) ON DELETE CASCADE
);

-- 7. Ajanda / Randevu / Ders planlama kayıtlarını tutan tablo
CREATE TABLE IF NOT EXISTS ajanda (
    ajandaId             INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Randevu ID
    ogrenciId            INTEGER,                           -- İlişkili Öğrenci ID
    ogrAdsoyad           TEXT,                              -- Öğrenci Ad-Soyad hızlı arama alanı
    tarih                TEXT,                              -- Randevu tarihi
    saat                 TEXT,                              -- Randevu saati
    tekrarsayisi         TEXT,                              -- Randevu tekrarlama periyodu
    kalanTekrarSayisi    TEXT,                              -- Tekrarlı dersler için kalan sayı
    olusmaAni            TEXT,                              -- Kaydın sisteme girildiği tarih/saat
    tamamlanma           TEXT,                              -- Tamamlandığı tarih/saat
    tamamlandiMi         INTEGER DEFAULT 0,                 -- Tamamlanma bayrağı (1: Tamamlandı, 0: Bekliyor)
    iptal                INTEGER DEFAULT 0,                 -- İptal bayrağı (1: İptal edildi, 0: Aktif)
    konu                 TEXT,                              -- Randevu/Ders konusu
    sutun1               TEXT,                              -- Yedek sütunlar
    sutun2               TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId) ON DELETE CASCADE
);

-- 8. Uygulama genel ayarlarını key-value formatında tutan tablo
CREATE TABLE IF NOT EXISTS settings (
    key                  TEXT PRIMARY KEY,                  -- Ayar anahtarı (Örn: backup_time)
    value                TEXT                               -- Ayar değeri
);

-- 9. Sistem genelinde tanımlı ortak kaynak kitapların tablosu
CREATE TABLE IF NOT EXISTS tum_kaynaklar (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Kaynak ID
    ad                   TEXT NOT NULL,                     -- Kaynak Kitap Adı
    tur                  TEXT DEFAULT 'Diğer'               -- Kaynak Türü (Örn: TYT, AYT, LGS)
);

-- 10. Ortak kaynaklara ait içerik / konu listesini tutan tablo
CREATE TABLE IF NOT EXISTS kaynak_icerikleri (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz İçerik ID
    kaynakId             INTEGER NOT NULL,                  -- İlişkili Ortak Kaynak ID
    icerik               TEXT NOT NULL,                     -- Konu veya içerik başlığı (Örn: Üslü Sayılar)
    FOREIGN KEY (kaynakId) REFERENCES tum_kaynaklar(id) ON DELETE CASCADE
);

-- 11. Sınav türlerini (TYT, AYT vb.) tanımlayan tablo
CREATE TABLE IF NOT EXISTS sinav_turleri (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Sınav Türü ID
    ad                   TEXT UNIQUE NOT NULL               -- Sınav Türü Adı (Benzersiz)
);

-- 12. Deneme sınavı sonuçlarını (Net takibi) tutan tablo
CREATE TABLE IF NOT EXISTS denemeler (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Sonuç ID
    ogrenciId            INTEGER NOT NULL,                  -- İlişkili Öğrenci ID
    sinavTuruId          INTEGER NOT NULL,                  -- İlişkili Sınav Türü ID
    denemeAd             TEXT,                              -- Deneme adı (Örn: Özdebir-1)
    tarih                TEXT NOT NULL,                     -- Sınav tarihi
    dogru                INTEGER NOT NULL,                  -- Doğru sayısı
    yanlis               INTEGER NOT NULL,                  -- Yanlış sayısı
    FOREIGN KEY (ogrenciId)   REFERENCES ogrenciler(ogrenciId) ON DELETE CASCADE,
    FOREIGN KEY (sinavTuruId) REFERENCES sinav_turleri(id) ON DELETE CASCADE
);

-- 13. Genel (öğrenciden bağımsız) notların tutulduğu tablo
CREATE TABLE IF NOT EXISTS global_notlar (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Not ID
    not_metni            TEXT NOT NULL,                     -- Not içeriği
    tarih_saat           TEXT NOT NULL                      -- Notun kaydedildiği tarih/saat
);

-- 14. Kaynak türleri tablosu
CREATE TABLE IF NOT EXISTS kaynak_turleri (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT, -- Benzersiz Tür ID
    ad                   TEXT UNIQUE NOT NULL               -- Tür adı (Örn: TYT, AYT)
);

-- 15. Veritabanının şema versiyon geçmişini tutan tablo
CREATE TABLE IF NOT EXISTS database_version (
    id                   INTEGER PRIMARY KEY,               -- Tekil ID (Genellikle 1)
    version              INTEGER NOT NULL,                  -- Mevcut aktif şema versiyon numarası
    updated_at           TEXT DEFAULT CURRENT_TIMESTAMP     -- Son güncelleme anı
);
`;

// ─── MIGRATION ADIMLARI (Artımlı Güncellemeler) ──────────────────────────────
/**
 * migrations dizisi veritabanını adım adım güncellemek (upgrade etmek) için kullanılır.
 * Her bir fonksiyon, veritabanının bir önceki sürümünden bir sonrakine geçmesini sağlar.
 * 
 * KRİTİK NOT: Buradaki her adım "idempotent" (yani bir kez çalıştırıldığında da, 
 * hata durumunda tekrar tekrar çalıştırıldığında da veritabanı yapısını bozmayacak) olmalıdır.
 */
const migrations: Array<(db: SQLite.SQLiteDatabase) => Promise<void>> = [
    // 1. ADIM (v1 -> v2): `tum_kaynaklar` tablosuna `tur` sütunu eklenmesi.
    async (database) => {
        await kolonEkle(database, 'tum_kaynaklar', 'tur', "TEXT DEFAULT 'Diğer'");
    },
    // 2. ADIM (v2 -> v3): `kaynak_icerikleri` tablosunun oluşturulması.
    async (database) => {
        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS kaynak_icerikleri (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                kaynakId INTEGER NOT NULL,
                icerik   TEXT NOT NULL,
                FOREIGN KEY (kaynakId) REFERENCES tum_kaynaklar(id) ON DELETE CASCADE
            );
        `);
    },
    // 3. ADIM (v3 -> v4): Önceki adımlarda oluşabilecek olası eksiklikleri (idempotent olarak) tamir etme adımı.
    async (database) => {
        await kolonEkle(database, 'tum_kaynaklar', 'tur', "TEXT DEFAULT 'Diğer'");
        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS kaynak_icerikleri (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                kaynakId INTEGER NOT NULL,
                icerik   TEXT NOT NULL,
                FOREIGN KEY (kaynakId) REFERENCES tum_kaynaklar(id) ON DELETE CASCADE
            );
        `);
    },
    // 4. ADIM (v4 -> v5): `kaynak_turleri` tablosunun eklenmesi ve varsayılan türlerin (seed) girilmesi.
    async (database) => {
        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS kaynak_turleri (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                ad   TEXT UNIQUE NOT NULL
            );
        `);
        // INSERT OR IGNORE, türler zaten varsa hata fırlatmasını engeller
        const varsayilanTurler = ['TYT', 'AYT', '9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'Diğer'];
        for (const tur of varsayilanTurler) {
            await database.runAsync(`INSERT OR IGNORE INTO kaynak_turleri (ad) VALUES (?)`, [tur]);
        }
    },
    // 5. ADIM (v5 -> v6): `kaynak_icerikleri` tablosuna `sira` (sıralama) sütunu eklenmesi.
    async (database) => {
        await kolonEkle(database, 'kaynak_icerikleri', 'sira', "INTEGER DEFAULT 0");
    },
];

// ─── YARDIMCI METOTLAR ───────────────────────────────────────────────────────

/**
 * Veritabanında belirtilen tabloya güvenli bir şekilde sütun ekler (ALTER TABLE).
 * Eğer eklenmek istenen sütun zaten varsa SQLite hata fırlatır; bu fonksiyon
 * hatayı yakalayarak uygulamanın çökmesini engeller (idempotency sağlar).
 * 
 * @param database Çalıştırılacak veritabanı referansı
 * @param tablo Hedef tablo adı
 * @param kolon Eklenecek sütun adı
 * @param tanim Sütunun veri tipi ve varsayılan değer tanımı (Örn: "INTEGER DEFAULT 0")
 */
async function kolonEkle(
    database: SQLite.SQLiteDatabase,
    tablo: string,
    kolon: string,
    tanim: string
): Promise<void> {
    try {
        await database.execAsync(`ALTER TABLE ${tablo} ADD COLUMN ${kolon} ${tanim};`);
    } catch {
        // Sütun zaten varsa SQLite "duplicate column" hatası fırlatır, bu hatayı yutup devam ediyoruz.
    }
}

/**
 * Şema Garantisi (Schema Assurance).
 * Uygulamanın her açılışında, migration tablosunun durumundan bağımsız olarak çalışır.
 * Amacı: Migration sürümü ne olursa olsun kritik sütun ve tabloların kesinlikle var olduğundan emin olmaktır.
 * 
 * @param database SQLite Veritabanı referansı
 */
async function ensureSchema(database: SQLite.SQLiteDatabase): Promise<void> {
    // 1. Öğrenciler tablosunda veli odev istiyor mu sütununun garantilenmesi
    await kolonEkle(database, 'ogrenciler', 'veli_odev_istiyor_mu', "INTEGER DEFAULT 0");

    // 2. Kaynaklar tablosunda kaynak türü sütununun garantilenmesi
    await kolonEkle(database, 'tum_kaynaklar', 'tur', "TEXT DEFAULT 'Diğer'");

    // 3. Konu içerik tablosunun varlığının kesinleştirilmesi
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS kaynak_icerikleri (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            kaynakId INTEGER NOT NULL,
            icerik   TEXT NOT NULL,
            sira     INTEGER DEFAULT 0,
            FOREIGN KEY (kaynakId) REFERENCES tum_kaynaklar(id) ON DELETE CASCADE
        );
    `);
    await kolonEkle(database, 'kaynak_icerikleri', 'sira', "INTEGER DEFAULT 0");

    // 4. Kaynak türleri tablosunun varlığının kesinleştirilmesi ve temel değerlerin seed edilmesi
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS kaynak_turleri (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            ad   TEXT UNIQUE NOT NULL
        );
    `);

    const varsayilanTurler = ['TYT', 'AYT', '9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'Diğer'];
    for (const tur of varsayilanTurler) {
        await database.runAsync(`INSERT OR IGNORE INTO kaynak_turleri (ad) VALUES (?)`, [tur]);
    }
}

/**
 * Veritabanı şemasını ve migration adımlarını sırayla çalıştıran ana motor fonksiyonu.
 * 
 * @param database Başlatılacak veritabanı referansı
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
    // 1. Temel tabloları oluştur
    await database.execAsync(TABLO_OLUSTUR);

    // 2. Şema garantilerini çalıştır (Kritik güncellemeleri kontrol et)
    await ensureSchema(database);

    // 3. Mevcut şema versiyonunu oku
    const row = await database.getFirstAsync<{ version: number }>(
        'SELECT version FROM database_version ORDER BY id DESC LIMIT 1'
    );
    const currentVersion = row?.version ?? 0;

    // 4. Eğer veritabanı güncel ise işlemi sonlandır
    if (currentVersion >= DATABASE_VERSION) {
        return;
    }

    // 5. Eksik kalan migration adımlarını sırayla uygula
    for (let i = currentVersion; i < DATABASE_VERSION; i++) {
        const step = migrations[i];
        if (step) {
            await step(database);
        }
    }

    // 6. Güncelleme tamamlandıktan sonra versiyon kaydını güncelle
    await database.runAsync(
        'INSERT OR REPLACE INTO database_version (id, version) VALUES (1, ?)',
        [DATABASE_VERSION]
    );
}

// ─── DIŞA AKTARILAN GENEL API (PUBLIC API) ───────────────────────────────────

/**
 * Veritabanını açar, bağlantıyı hazırlar ve şema güncellemelerini yapar.
 * Tekil referansı (Singleton) geri döner.
 * 
 * @returns SQLiteDatabase bağlantısı
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (db) return db;

    try {
        // SQLite veritabanını asenkron olarak aç
        db = await SQLite.openDatabaseAsync(DATABASE_NAME);

        // Eğer veritabanı şifreleme parolası belirtilmişse pragma key uygula
        if (DB_PASSWORD.trim()) {
            await db.execAsync(`PRAGMA key = '${DB_PASSWORD}';`);
        }

        // Migration ve şema işlemlerini başlat
        await runMigrations(db);
        return db;
    } catch (error) {
        console.error('Veritabanı başlatma hatası:', error);
        db = null;
        throw error;
    }
}

/**
 * Veritabanı bağlantısının açık ve hazır durumda olmasını garanti eder.
 * 
 * @returns SQLiteDatabase bağlantısı
 */
export async function ensureDatabaseReady(): Promise<SQLite.SQLiteDatabase> {
    return initDatabase();
}

/**
 * Açık olan veritabanı bağlantısını güvenli bir şekilde kapatır.
 */
export async function closeDatabase(): Promise<void> {
    if (!db) return;
    try {
        await db.closeAsync();
    } catch (error) {
        console.warn('Veritabanı kapatma uyarısı:', error);
    } finally {
        db = null;
    }
}

/**
 * Tanısal ve arayüz bilgisi amaçlı veritabanı özet bilgilerini döner.
 * 
 * @returns Veritabanı versiyonu ve kayıtlı toplam öğrenci sayısı
 */
export async function getDatabaseInfo() {
    try {
        const database = await ensureDatabaseReady();

        // Şema versiyonunu al
        const versionRow = await database.getFirstAsync<{ version: number }>(
            'SELECT version FROM database_version ORDER BY id DESC LIMIT 1'
        );
        // İstatistik amaçlı öğrenci sayısını al
        const countRow = await database.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM ogrenciler'
        );

        return {
            success: true,
            version: versionRow?.version ?? 0,
            studentCount: countRow?.count ?? 0,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}