import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

const DATABASE_NAME = 'ozdeta.db';
// VERİTABANI ŞİFRESİ - Buradan değiştirebilirsiniz eğer şifreyi silersen şifresiz olur
const DB_PASSWORD: string = '';

// VERİTABANI VERSİYONU - Değişiklik yaptığınızda sadece bunu artırın!
const DATABASE_VERSION = 6; // V5->V6: ajanda tablosuna tamamlandiMi eklendi

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
    try {
        if (db) {
            return db; // Zaten başlatılmışsa, mevcut bağlantıyı döndür
        }

        db = await SQLite.openDatabaseAsync(DATABASE_NAME);

        // Veritabanı şifreleme - Eğer şifre boş değilse uygula
        if (DB_PASSWORD && DB_PASSWORD.trim() !== "") {
            await db.execAsync(`PRAGMA key = '${DB_PASSWORD}';`);
            console.log('Veritabanı şifreli modda açıldı.');
        } else {
            console.log('Veritabanı şifresiz modda açıldı.');
        }

        // Version kontrolü ve migration işlemi
        await handleDatabaseMigration(db);

        console.log('Veritabanı başarıyla başlatıldı, versiyon:', DATABASE_VERSION);
        return db;
    } catch (error) {
        console.error("database_Veritabanı oluşturma hatası:", error);
        db = null;
        throw error;
    }
}

// Migration yönetim sistemi
async function handleDatabaseMigration(database: SQLite.SQLiteDatabase) {
    try {
        // Önce tabloları oluştur
        await database.execAsync(tabloOlusturucuV1);

        // Sonra version kontrolü yap
        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS database_version (
                id INTEGER PRIMARY KEY,
                version INTEGER NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        let currentVersion = 0;
        try {
            const currentVersionResult = await database.getFirstAsync<{ version: number }>(
                'SELECT version FROM database_version ORDER BY id DESC LIMIT 1'
            );
            currentVersion = currentVersionResult ? currentVersionResult.version : 0;
        } catch (error) {
            console.log('Version tablosu henüz yok, oluşturuluyor...');
            currentVersion = 0;
        }

        console.log(`Mevcut veritabanı versiyonu: ${currentVersion}, Hedef versiyon: ${DATABASE_VERSION}`);

        if (currentVersion < DATABASE_VERSION) {
            console.log('Veritabanı güncelleniyor...');

            // Migration işlemlerini uygula
            for (let version = currentVersion + 1; version <= DATABASE_VERSION; version++) {
                await applyMigration(database, version);
                console.log(`Versiyon ${version} uygulandı`);
            }

            // Yeni versiyonu kaydet veya güncelle
            await database.runAsync(
                'INSERT OR REPLACE INTO database_version (id, version) VALUES (1, ?)',
                [DATABASE_VERSION]
            );

            console.log('Veritabanı güncelleme tamamlandı');
        } else {
            console.log('Veritabanı güncel');
        }
    } catch (error) {
        console.error('Migration hatası:', error);
        try {
            await database.execAsync(tabloOlusturucuV1);
            console.log('Temel tablolar oluşturuldu');
        } catch (tableError) {
            console.error('Tablo oluşturma da başarısız:', tableError);
        }
        throw error;
    }
}

async function applyMigration(database: SQLite.SQLiteDatabase, version: number) {
    switch (version) {
        case 1:
            // İlk versiyon - tüm tabloları oluştur
            await database.execAsync(tabloOlusturucuV1);
            break;
        case 2:
            // Ayarlar tablosu
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            `);
            break;
        case 3:
            // Ajanda tablosuna iptal sütunu ekle
            try {
                await database.execAsync(`
                    ALTER TABLE ajanda ADD COLUMN iptal INTEGER DEFAULT 0;
                `);
            } catch (error) {
                console.log('iptal sütunu zaten mevcut, atlanıyor...');
            }
            break;
        case 4:
            // Tüm kaynaklar tablosu
            await database.execAsync(`
                CREATE TABLE IF NOT EXISTS tum_kaynaklar (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ad TEXT UNIQUE NOT NULL
                );
            `);
            break;
        case 5:
            // Ajanda tablosuna konu sütunu ekle
            try {
                await database.execAsync(`
                    ALTER TABLE ajanda ADD COLUMN konu TEXT;
                `);
            } catch (error) {
                console.log('konu sütunu zaten mevcut, atlanıyor...');
            }
            break;
        case 6:
            // Ajanda tablosuna tamamlandiMi sütunu ekle
            try {
                await database.execAsync(`
                    ALTER TABLE ajanda ADD COLUMN tamamlandiMi INTEGER DEFAULT 0;
                `);
            } catch (error) {
                console.log('tamamlandiMi sütunu zaten mevcut, atlanıyor...');
            }
            break;
        default:
            throw new Error(`Bilinmeyen migration versiyonu: ${version}`);
    }
}

export async function ensureDatabaseReady(): Promise<SQLite.SQLiteDatabase> {
    try {
        const database = await initDatabase();
        if (!database) {
            throw new Error('Veritabanı başlatılamadı');
        }
        return database;
    } catch (error) {
        console.error('Veritabanı hazırlık hatası:', error);
        throw error;
    }
}

export async function getDatabaseInfo() {
    try {
        const database = await ensureDatabaseReady();

        const versionInfo = await database.getFirstAsync<{ version: number }>(
            'SELECT version FROM database_version ORDER BY id DESC LIMIT 1'
        );

        const studentCount = await database.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM ogrenciler'
        );

        return {
            success: true,
            version: versionInfo ? versionInfo.version : 0,
            studentCount: studentCount ? studentCount.count : 0
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function closeDatabase() {
    if (db) {
        await db.closeAsync();
        db = null;
        console.log('Veritabanı bağlantısı kapatıldı');
    }
}

const tabloOlusturucuV1 = `
CREATE TABLE IF NOT EXISTS ogrenciler (        
    ogrenciId INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciAd TEXT NOT NULL,
    ogrenciSoyad TEXT DEFAULT '-',
    veliAd TEXT DEFAULT '-',
    okul TEXT DEFAULT '-',
    sinif TEXT DEFAULT '-',
    aciklama1 TEXT DEFAULT '-',
    aciklama2 TEXT DEFAULT '-',
    kayitTarihi TEXT DEFAULT CURRENT_TIMESTAMP,
    ucret INTEGER DEFAULT 0,
    ogrenciTel TEXT DEFAULT '-',
    veliTel TEXT DEFAULT '-',
    aktifmi INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS dersler (
    dersId INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciId INTEGER,
    dersturu TEXT,
    konu TEXT,
    saat TEXT,
    tarih TEXT,
    ucret TEXT,
    ogrenciAdSoyad TEXT,
    sutun2 TEXT,
    sutun3 TEXT,
    sutun4 TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS kaynaklar (
    kaynakId INTEGER PRIMARY KEY AUTOINCREMENT, 
    ogrenciId INTEGER, 
    kaynak TEXT,  
    sutun1 TEXT, 
    sutun2 TEXT, 
    sutun3 TEXT,  
    sutun4 TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS odevler (
    odevId INTEGER PRIMARY KEY AUTOINCREMENT, 
    ogrenciId INTEGER,
    kaynak TEXT,
    odev TEXT,
    verilmetarihi TEXT,
    teslimttarihi TEXT,
    kontroltarihi TEXT,
    yapilmadurumu TEXT,
    aciklama TEXT,
    sutun1 TEXT,
    sutun2 TEXT,
    sutun3 TEXT,
    sutun4 TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS notlarim (
    notlarimId INTEGER PRIMARY KEY AUTOINCREMENT, 
    ogrenciId INTEGER,
    tarih TEXT,
    not1 TEXT,
    sutun1 TEXT,
    sutun2 TEXT,
    sutun3 TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS odemeler (
    odemeId INTEGER PRIMARY KEY AUTOINCREMENT, 
    ogrenciId INTEGER,
    alinanucret TEXT,
    odemetarih TEXT,
    odemeturu TEXT,
    aciklama TEXT,
    odemesaati TEXT,
    sutun2 TEXT,
    sutun3 TEXT,
    sutun4 TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS ajanda (
    ajandaId INTEGER PRIMARY KEY AUTOINCREMENT, 
    ogrenciId INTEGER,
    ogrAdsoyad TEXT,
    tarih TEXT,
    saat TEXT,
    tekrarsayisi TEXT,
    kalanTekrarSayisi TEXT,
    olusmaAni TEXT,
    tamamlanma TEXT,
    tamamlandiMi INTEGER DEFAULT 0,
    sutun1 TEXT,
    sutun2 TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);
`;
