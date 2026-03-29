import { ensureDatabaseReady } from './init';
import { NotType, KaynakType, OdevType } from '../types';

// ================= NOTE OPERATIONS =================

export async function notKaydet(notVerisi: NotType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `INSERT INTO notlarim (ogrenciId, tarih, not1) VALUES (?, ?, ?)`,
            [notVerisi.ogrenciId, notVerisi.tarih, notVerisi.not1]
        );

        console.log("Not başarıyla kaydedildi");
        return { success: true, result };
    } catch (error: any) {
        console.error("Not kaydetme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function notGuncelle(notId: number, notVerisi: NotType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `UPDATE notlarim SET not1=?, tarih=? WHERE notlarimId=?`,
            [notVerisi.not1, notVerisi.tarih, notId]
        );

        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Not güncelleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function notSil(notId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `DELETE FROM notlarim WHERE notlarimId=?`,
            [notId]
        );

        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Not silme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function ogrenciNotlari(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.getAllAsync<NotType>(
            `SELECT * FROM notlarim WHERE ogrenciId=? ORDER BY tarih DESC`,
            [ogrenciId]
        );

        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error("Notlar alma hatası:", error);
        return { success: false, error: error.message, data: [] };
    }
}

// ================= RESOURCE OPERATIONS =================

export async function kaynakKaydet(kaynakVerisi: KaynakType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `INSERT INTO kaynaklar (ogrenciId, kaynak) VALUES (?, ?)`,
            [kaynakVerisi.ogrenciId, kaynakVerisi.kaynak]
        );

        return { success: true, result };
    } catch (error: any) {
        console.error("Kaynak kaydetme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function kaynakListesi(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.getAllAsync<KaynakType>(
            `SELECT * FROM kaynaklar WHERE ogrenciId=? ORDER BY kaynak ASC`,
            [ogrenciId]
        );

        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error("DB_Kaynak listesi alma hatası:", error);
        return { success: false, error: error.message, data: [] };
    }
}

export async function kaynakSil(kaynakId: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            "DELETE FROM kaynaklar WHERE kaynakId = ?",
            [kaynakId]
        );
        return { success: true, result };
    } catch (error: any) {
        console.error("Kaynak silme hatası:", error);
        return { success: false, error: error.message };
    }
}

// ================= HOMEWORK OPERATIONS =================

export async function odevKaydet(odevVerisi: OdevType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `INSERT INTO odevler (ogrenciId, kaynak, odev, verilmetarihi, teslimttarihi, yapilmadurumu, aciklama) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                odevVerisi.ogrenciId!,
                odevVerisi.kaynak ?? '',
                odevVerisi.odev ?? '',
                odevVerisi.verilmetarihi ?? '',
                odevVerisi.teslimttarihi ?? '',
                odevVerisi.yapilmadurumu ?? 'Bekliyor',
                odevVerisi.aciklama ?? ''
            ]
        );

        return { success: true, result };
    } catch (error: any) {
        console.error("Ödev kaydetme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function odevGuncelle(odevId: number, odevVerisi: OdevType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `UPDATE odevler 
             SET kaynak=?, odev=?, verilmetarihi=?, teslimttarihi=?, yapilmadurumu=?, kontroltarihi=?, aciklama=?
             WHERE odevId=?`,
            [
                odevVerisi.kaynak ?? '',
                odevVerisi.odev ?? '',
                odevVerisi.verilmetarihi ?? '',
                odevVerisi.teslimttarihi ?? '',
                odevVerisi.yapilmadurumu ?? '',
                odevVerisi.kontroltarihi ?? '',
                odevVerisi.aciklama ?? '',
                odevId
            ]
        );

        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Ödev güncelleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function ogrenciOdevleri(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.getAllAsync<OdevType>(
            `SELECT * FROM odevler WHERE ogrenciId=? ORDER BY verilmetarihi DESC`,
            [ogrenciId]
        );

        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error("Ödevler alma hatası:", error);
        return { success: false, error: error.message, data: [] };
    }
}

export async function getBekleyenOdevSayisi(ogrenciId: number): Promise<number> {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM odevler WHERE ogrenciId=? AND yapilmadurumu='Bekliyor'`,
            [ogrenciId]
        );
        return result ? result.count : 0;
    } catch (error) {
        console.error("Bekleyen ödev sayısı alınamadı:", error);
        return 0;
    }
}

// ================= GLOBAL RESOURCE OPERATIONS =================

export async function tumKaynakEkle(ad: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `INSERT INTO tum_kaynaklar (ad) VALUES (?)`,
            [ad]
        );
        return { success: true, id: result.lastInsertRowId };
    } catch (error: any) {
        console.error("Global kaynak ekleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function tumKaynakSil(id: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM tum_kaynaklar WHERE id=?`,
            [id]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Global kaynak silme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function getTumKaynaklar() {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getAllAsync<{ id: number; ad: string }>(
            `SELECT * FROM tum_kaynaklar ORDER BY ad ASC`
        );
        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error("Global kaynaklar alınamadı:", error);
        return { success: false, data: [], error: error.message };
    }
}
