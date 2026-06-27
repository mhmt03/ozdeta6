import { ensureDatabaseReady } from './init';
import { OgrenciType } from '../types';
import { getSetting } from './settingsOperations';

export async function ogrenciKaydet(params: OgrenciType) {
    try {
        const db = await ensureDatabaseReady();

        // Trial kontrolü
        const isPremium = await getSetting('is_premium', 'false');
        if (isPremium !== 'true') {
            const countResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM ogrenciler');
            if (countResult && countResult.count >= 3) {
                return { 
                    success: false, 
                    error: "TRIAL_LIMIT", 
                    message: "Trial versiyonunda en fazla 3 öğrenci ekleyebilirsiniz. Sınırsız kullanım için lütfen satın alın." 
                };
            }
        }

        const result = await db.runAsync(`
            INSERT INTO ogrenciler (ogrenciAd, ogrenciSoyad, ogrenciTel, veliAd, veliTel, ucret, okul, sinif, aciklama1, aciklama2, kayitTarihi, aktifmi) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                params.ogrenciAd,
                params.ogrenciSoyad,
                params.ogrenciTel,
                params.veliAd,
                params.veliTel,
                params.ucret,
                params.okul,
                params.sinif,
                params.aciklama1,
                params.aciklama2,
                params.kayitTarihi,
                params.aktifmi ? 1 : 0
            ]
        );

        console.log("Öğrenci kaydı başarılı");
        return { success: true, result };
    } catch (error: any) {
        console.error("Öğrenci kaydı eklenemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ogrenciSil(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(`
            DELETE FROM ogrenciler WHERE ogrenciId=?`,
            [ogrenciId]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Öğrenci silinemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ogrenciGuncelle(ogrenciId: number, params: OgrenciType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(`
            UPDATE ogrenciler
            SET ogrenciAd=?, ogrenciSoyad=?, ogrenciTel=?, veliAd=?, veliTel=?, ucret=?, okul=?, sinif=?, aciklama1=?, aciklama2=?, kayitTarihi=?, aktifmi=?
            WHERE ogrenciId=?`,
            [
                params.ogrenciAd,
                params.ogrenciSoyad,
                params.ogrenciTel,
                params.veliAd,
                params.veliTel,
                params.ucret,
                params.okul,
                params.sinif,
                params.aciklama1,
                params.aciklama2,
                params.kayitTarihi,
                params.aktifmi ? 1 : 0,
                ogrenciId
            ]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Kayıt güncelleme başarısız:", error);
        return { success: false, error: error.message };
    }
}

export async function ogrencileriListele(pasifGoster: boolean = false) {
    try {
        const db = await ensureDatabaseReady();

        const aktifDeger = pasifGoster ? 0 : 1;
        const result = await db.getAllAsync<OgrenciType>(
            `SELECT * FROM ogrenciler WHERE aktifmi=? ORDER BY ogrenciAd ASC`,
            [aktifDeger]
        );

        return { success: true, data: result };
    } catch (error: any) {
        console.error("Öğrenci listeleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function tumOgrencileriListele() {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.getAllAsync<OgrenciType>(
            `SELECT * FROM ogrenciler ORDER BY ogrenciAd ASC`
        );

        return { success: true, data: result };
    } catch (error: any) {
        console.error("Tüm öğrenci listeleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function tekOgrenci(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.getFirstAsync<OgrenciType>(
            `SELECT * FROM ogrenciler WHERE ogrenciId=?`,
            [ogrenciId]
        );
        return { success: true, data: result };
    } catch (error: any) {
        console.error("Öğrenci bilgisi alınamadı:", error);
        return { success: false, error: error.message };
    }
}
