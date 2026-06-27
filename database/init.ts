import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

const DATABASE_NAME = 'ozdeta.db';
const DB_PASSWORD: string = '';

// Yeni sütun/tablo ekleyince sadece bu sayıyı artırın
const DATABASE_VERSION = 1;

// ─── TABLOLAR (mevcut son hal) ────────────────────────────────────────────────

const TABLO_OLUSTUR = `
CREATE TABLE IF NOT EXISTS ogrenciler (
    ogrenciId        INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciAd        TEXT    NOT NULL,
    ogrenciSoyad     TEXT    DEFAULT '-',
    veliAd           TEXT    DEFAULT '-',
    okul             TEXT    DEFAULT '-',
    sinif            TEXT    DEFAULT '-',
    aciklama1        TEXT    DEFAULT '-',
    aciklama2        TEXT    DEFAULT '-',
    kayitTarihi      TEXT    DEFAULT CURRENT_TIMESTAMP,
    ucret            INTEGER DEFAULT 0,
    ogrenciTel       TEXT    DEFAULT '-',
    veliTel          TEXT    DEFAULT '-',
    aktifmi          INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS dersler (
    dersId           INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciId        INTEGER,
    dersturu         TEXT,
    konu             TEXT,
    saat             TEXT,
    tarih            TEXT,
    ucret            TEXT,
    ogrenciAdSoyad   TEXT,
    sutun2           TEXT,
    sutun3           TEXT,
    sutun4           TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS kaynaklar (
    kaynakId         INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciId        INTEGER,
    kaynak           TEXT,
    sutun1           TEXT,
    sutun2           TEXT,
    sutun3           TEXT,
    sutun4           TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS odevler (
    odevId           INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciId        INTEGER,
    kaynak           TEXT,
    odev             TEXT,
    verilmetarihi    TEXT,
    teslimttarihi    TEXT,
    kontroltarihi    TEXT,
    yapilmadurumu    TEXT,
    aciklama         TEXT,
    sutun1           TEXT,
    sutun2           TEXT,
    sutun3           TEXT,
    sutun4           TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS notlarim (
    notlarimId       INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciId        INTEGER,
    tarih            TEXT,
    not1             TEXT,
    sutun1           TEXT,
    sutun2           TEXT,
    sutun3           TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS odemeler (
    odemeId          INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciId        INTEGER,
    alinanucret      TEXT,
    odemetarih       TEXT,
    odemeturu        TEXT,
    aciklama         TEXT,
    odemesaati       TEXT,
    sutun2           TEXT,
    sutun3           TEXT,
    sutun4           TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS ajanda (
    ajandaId         INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciId        INTEGER,
    ogrAdsoyad       TEXT,
    tarih            TEXT,
    saat             TEXT,
    tekrarsayisi     TEXT,
    kalanTekrarSayisi TEXT,
    olusmaAni        TEXT,
    tamamlanma       TEXT,
    tamamlandiMi     INTEGER DEFAULT 0,
    iptal            INTEGER DEFAULT 0,
    konu             TEXT,
    sutun1           TEXT,
    sutun2           TEXT,
    FOREIGN KEY (ogrenciId) REFERENCES ogrenciler(ogrenciId)
);

CREATE TABLE IF NOT EXISTS settings (
    key              TEXT PRIMARY KEY,
    value            TEXT
);

CREATE TABLE IF NOT EXISTS tum_kaynaklar (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ad               TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS sinav_turleri (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ad               TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS denemeler (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ogrenciId        INTEGER NOT NULL,
    sinavTuruId      INTEGER NOT NULL,
    denemeAd         TEXT,
    tarih            TEXT NOT NULL,
    dogru            INTEGER NOT NULL,
    yanlis           INTEGER NOT NULL,
    FOREIGN KEY (ogrenciId)   REFERENCES ogrenciler(ogrenciId),
    FOREIGN KEY (sinavTuruId) REFERENCES sinav_turleri(id)
);

CREATE TABLE IF NOT EXISTS global_notlar (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    not_metni        TEXT NOT NULL,
    tarih_saat       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS database_version (
    id               INTEGER PRIMARY KEY,
    version          INTEGER NOT NULL,
    updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

// ─── MIGRATION ADIMLARI ───────────────────────────────────────────────────────
// Yeni bir değişiklik için:
//   1. Buraya yeni bir async fonksiyon ekleyin
//   2. DATABASE_VERSION'ı 1 artırın
// Her adım mutlaka idempotent olmalı (tekrar çalışınca hata vermemeli).
//
// Örnek — yeni sütun:   async (db) => { await kolonEkle(db, 'tablo', 'kolon', 'TEXT DEFAULT "-"'); }
// Örnek — yeni tablo:   async (db) => { await db.execAsync(`CREATE TABLE IF NOT EXISTS ...`); }

const migrations: Array<(db: SQLite.SQLiteDatabase) => Promise<void>> = [
    // v1 → v2 : (henüz boş — ilk değişikliğinizi buraya ekleyin)
];

// ─── YARDIMCI: GÜVENLİ SÜTUN EKLEME ─────────────────────────────────────────

async function kolonEkle(
    database: SQLite.SQLiteDatabase,
    tablo: string,
    kolon: string,
    tanim: string
): Promise<void> {
    try {
        await database.execAsync(`ALTER TABLE ${tablo} ADD COLUMN ${kolon} ${tanim};`);
    } catch {
        // Kolon zaten varsa SQLite hata fırlatır — görmezden gel
    }
}

// ─── MIGRATION MOTORU ─────────────────────────────────────────────────────────

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
    await database.execAsync(TABLO_OLUSTUR);

    const row = await database.getFirstAsync<{ version: number }>(
        'SELECT version FROM database_version ORDER BY id DESC LIMIT 1'
    );
    const currentVersion = row?.version ?? 0;

    if (currentVersion >= DATABASE_VERSION) {
        console.log(`Veritabanı güncel (v${currentVersion})`);
        return;
    }

    console.log(`Migration: v${currentVersion} → v${DATABASE_VERSION}`);

    for (let i = currentVersion; i < DATABASE_VERSION; i++) {
        const step = migrations[i];
        if (step) await step(database);
        console.log(`  ✓ adım ${i + 1}`);
    }

    await database.runAsync(
        'INSERT OR REPLACE INTO database_version (id, version) VALUES (1, ?)',
        [DATABASE_VERSION]
    );

    console.log(`Migration tamamlandı (v${DATABASE_VERSION})`);
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (db) return db;

    try {
        db = await SQLite.openDatabaseAsync(DATABASE_NAME);

        if (DB_PASSWORD.trim()) {
            await db.execAsync(`PRAGMA key = '${DB_PASSWORD}';`);
        }

        await runMigrations(db);
        return db;
    } catch (error) {
        console.error('Veritabanı başlatma hatası:', error);
        db = null;
        throw error;
    }
}

export async function ensureDatabaseReady(): Promise<SQLite.SQLiteDatabase> {
    return initDatabase();
}

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

export async function getDatabaseInfo() {
    try {
        const database = await ensureDatabaseReady();

        const versionRow = await database.getFirstAsync<{ version: number }>(
            'SELECT version FROM database_version ORDER BY id DESC LIMIT 1'
        );
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