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
            INSERT INTO ogrenciler (ogrenciAd, ogrenciSoyad, ogrenciTel, veliAd, veliTel, veli2Ad, veli2Tel, ucret, okul, sinif, aciklama1, aciklama2, kayitTarihi, aktifmi, veli_odev_istiyor_mu, veli2_odev_istiyor_mu) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                params.ogrenciAd,
                params.ogrenciSoyad,
                params.ogrenciTel,
                params.veliAd,
                params.veliTel,
                params.veli2Ad ?? '-',
                params.veli2Tel ?? '-',
                params.ucret,
                params.okul,
                params.sinif,
                params.aciklama1,
                params.aciklama2,
                params.kayitTarihi,
                params.aktifmi ? 1 : 0,
                params.veli_odev_istiyor_mu ?? 0,
                params.veli2_odev_istiyor_mu ?? 0
            ]
        );
        return { success: true, result };
    } catch (error: any) {
        console.error("Öğrenci kaydı eklenemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ogrenciSil(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        await db.withTransactionAsync(async () => {
            // Bağlı tüm kayıtları (child records) sil
            await db.runAsync(`DELETE FROM dersler WHERE ogrenciId=?`, [ogrenciId]);
            await db.runAsync(`DELETE FROM kaynaklar WHERE ogrenciId=?`, [ogrenciId]);
            await db.runAsync(`DELETE FROM odevler WHERE ogrenciId=?`, [ogrenciId]);
            await db.runAsync(`DELETE FROM notlarim WHERE ogrenciId=?`, [ogrenciId]);
            await db.runAsync(`DELETE FROM odemeler WHERE ogrenciId=?`, [ogrenciId]);
            await db.runAsync(`DELETE FROM ajanda WHERE ogrenciId=?`, [ogrenciId]);
            await db.runAsync(`DELETE FROM denemeler WHERE ogrenciId=?`, [ogrenciId]);

            // En son ana öğrenci kaydını sil
            await db.runAsync(`DELETE FROM ogrenciler WHERE ogrenciId=?`, [ogrenciId]);
        });

        return { success: true };
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
            SET ogrenciAd=?, ogrenciSoyad=?, ogrenciTel=?, veliAd=?, veliTel=?, veli2Ad=?, veli2Tel=?, ucret=?, okul=?, sinif=?, aciklama1=?, aciklama2=?, kayitTarihi=?, aktifmi=?, veli_odev_istiyor_mu=?, veli2_odev_istiyor_mu=?
            WHERE ogrenciId=?`,
            [
                params.ogrenciAd,
                params.ogrenciSoyad,
                params.ogrenciTel,
                params.veliAd,
                params.veliTel,
                params.veli2Ad ?? '-',
                params.veli2Tel ?? '-',
                params.ucret,
                params.okul,
                params.sinif,
                params.aciklama1,
                params.aciklama2,
                params.kayitTarihi,
                params.aktifmi ? 1 : 0,
                params.veli_odev_istiyor_mu ?? 0,
                params.veli2_odev_istiyor_mu ?? 0,
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
