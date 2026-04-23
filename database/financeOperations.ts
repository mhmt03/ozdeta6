import { ensureDatabaseReady } from './init';
import { ajandaTamamla } from './agendaOperations';
import { OdemeType, DersType } from '../types';

export async function odemeKaydet(odeme: OdemeType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `INSERT INTO odemeler (ogrenciId, alinanucret, odemetarih, odemesaati, odemeturu, aciklama)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                odeme.ogrenciId,
                odeme.alinanucret,
                odeme.odemetarih,
                odeme.odemesaati ?? '',
                odeme.odemeturu,
                odeme.aciklama ?? ''
            ]
        );

        console.log('Ödeme başarıyla kaydedildi:', odeme);
        return { success: true, result };
    } catch (error: any) {
        console.error('Ödeme kaydetme hatası:', error);
        return { success: false, error: error.message };
    }
}

export async function ogrencininOdemeleri(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        const odemeler = await db.getAllAsync<OdemeType>(
            `SELECT * FROM odemeler WHERE ogrenciId=?`,
            [ogrenciId]
        );
        const dersler = await db.getAllAsync<DersType>(
            `SELECT * FROM dersler WHERE ogrenciId=?`,
            [ogrenciId]
        );

        return { success: true, odemeler: odemeler || [], dersler: dersler || [] };
    } catch (error: any) {
        console.error("Ödeme toplamı bulunamadı:", error);
        return { success: false, odemeler: [], dersler: [], error: error.message };
    }
}

export async function dersiKaydet(dersVerisi: DersType) {
    try {
        const db = await ensureDatabaseReady();

        await db.runAsync(
            `INSERT INTO dersler (ogrenciId, tarih, saat, ucret, konu, dersturu, ogrenciAdSoyad) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                dersVerisi.ogrenciId,
                dersVerisi.tarih,
                dersVerisi.saat,
                dersVerisi.ucret,
                dersVerisi.konu,
                dersVerisi.dersturu,
                dersVerisi.ogrenciAdSoyad
            ]
        );

        console.log("✅ Ders başarıyla kaydedildi!");
        
        // Ajandada bu tarihte bu öğrenci için randevu varsa tamamlandı olarak işaretle
        await ajandaTamamla(dersVerisi.ogrenciId, dersVerisi.tarih, true);
        
        return { success: true };
    } catch (error: any) {
        console.error("❌ Ders kaydetme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function tumYapilanDersler() {
    try {
        const db = await ensureDatabaseReady();
        const yapilanDersler = await db.getAllAsync<DersType>(`SELECT * FROM dersler`);

        return { success: true, yapilanDersler: yapilanDersler || [] };
    } catch (error: any) {
        console.error("DB_yapılan dersler alınamadı...");
        return { success: false, yapilanDersler: [], error: error.message };
    }
}

// Bir öğrencinin ödemelerini getir
export async function getOdemeler(ogrenciId: number): Promise<OdemeType[]> {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getAllAsync<OdemeType>(
            `SELECT * FROM odemeler WHERE ogrenciId=?`,
            [ogrenciId]
        );
        return result || [];
    } catch (error: any) {
        console.error("Ödemeler alınamadı:", error);
        return [];
    }
}

// Bir öğrencinin derslerini getir
export async function getDersler(ogrenciId: number): Promise<DersType[]> {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getAllAsync<DersType>(
            `SELECT * FROM dersler WHERE ogrenciId=?`,
            [ogrenciId]
        );
        return result || [];
    } catch (error: any) {
        console.error("Dersler alınamadı:", error);
        return [];
    }
}

// Ders sil
export async function dersSil(dersId: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM dersler WHERE dersId=?`,
            [dersId]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Ders silinemedi:", error);
        return { success: false, error: error.message };
    }
}

// Ödeme sil
export async function odemeSil(odemeId: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM odemeler WHERE odemeId=?`,
            [odemeId]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Ödeme silinemedi:", error);
        return { success: false, error: error.message };
    }
}

// Ders güncelle
export async function dersGuncelle(dersId: number, dersVerisi: DersType) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `UPDATE dersler SET tarih=?, saat=?, ucret=?, konu=?, dersturu=?, ogrenciAdSoyad=? WHERE dersId=?`,
            [
                dersVerisi.tarih,
                dersVerisi.saat,
                dersVerisi.ucret,
                dersVerisi.konu,
                dersVerisi.dersturu,
                dersVerisi.ogrenciAdSoyad,
                dersId
            ]
        );
        
        // Ajandada bu tarihte bu öğrenci için randevu varsa tamamlandı olarak işaretle
        await ajandaTamamla(dersVerisi.ogrenciId, dersVerisi.tarih, true);
        
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Ders güncellenemedi:", error);
        return { success: false, error: error.message };
    }
}

// Ödeme güncelle
export async function odemeGuncelle(odemeId: number, odemeVerisi: OdemeType) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `UPDATE odemeler SET alinanucret=?, odemetarih=?, odemesaati=?, odemeturu=?, aciklama=? WHERE odemeId=?`,
            [
                odemeVerisi.alinanucret,
                odemeVerisi.odemetarih,
                odemeVerisi.odemesaati ?? '',
                odemeVerisi.odemeturu,
                odemeVerisi.aciklama ?? '',
                odemeId
            ]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Ödeme güncellenemedi:", error);
        return { success: false, error: error.message };
    }
}

// Bir öğrencinin son dersini getir
export async function getSonDers(ogrenciId: number): Promise<DersType | null> {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getFirstAsync<DersType>(
            `SELECT * FROM dersler WHERE ogrenciId=? ORDER BY tarih DESC, saat DESC LIMIT 1`,
            [ogrenciId]
        );
        return result || null;
    } catch (error: any) {
        console.error("Son ders alınamadı:", error);
        return null;
    }
}

// Tüm ödemeleri öğrenci adı ile birlikte getir
export async function tumOdemeleriGetir() {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getAllAsync<OdemeType>(
            `SELECT o.*, (og.ogrenciAd || ' ' || og.ogrenciSoyad) as ogrenciAdSoyad 
             FROM odemeler o 
             LEFT JOIN ogrenciler og ON o.ogrenciId = og.ogrenciId`
        );
        return { success: true, odemeler: result || [] };
    } catch (error: any) {
        console.error("Tüm ödemeler alınamadı:", error);
        return { success: false, odemeler: [], error: error.message };
    }
}
