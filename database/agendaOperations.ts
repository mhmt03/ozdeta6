import { ensureDatabaseReady } from './init';
import { AjandaType, OgrenciType } from '../types';
import { scheduleRandevuNotification, cancelRandevuNotification, rescheduleAllRandevuNotifications } from '../utils/notifications';

export type AjandaWithOgrenciType = AjandaType & {
    ogrenciAd?: string;
    ogrenciSoyad?: string;
    ogrenciTel?: string;
    aktifmi?: number;
};

export async function ajandaKayitEkle(kayit: AjandaType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `INSERT INTO ajanda (ogrenciId, ogrAdsoyad, tarih, saat, tekrarsayisi, kalanTekrarSayisi, olusmaAni, tamamlanma, tamamlandiMi, sutun1, sutun2) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                kayit.ogrenciId,
                kayit.ogrAdsoyad,
                kayit.tarih,
                kayit.saat,
                kayit.tekrarsayisi,
                kayit.kalanTekrarSayisi,
                kayit.olusmaAni,
                '', // tamamlanma durumu başlangıçta boş
                kayit.tamamlandiMi || 0,
                kayit.sutun1 || '',
                kayit.sutun2 || ''
            ]
        );
        if (result.lastInsertRowId) {
            await scheduleRandevuNotification(result.lastInsertRowId, kayit.tarih, kayit.saat, kayit.ogrAdsoyad);
        }
        return { success: true, insertId: result.lastInsertRowId };
    } catch (error: any) {
        console.error("ajandaDatabase_Ajanda kaydı eklenemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function tumAjandaKayitlariniGetir() {
    try {
        const db = await ensureDatabaseReady();
        const rows = await db.getAllAsync<AjandaWithOgrenciType>(
            `SELECT 
                a.*,
                o.ogrenciAd,
                o.ogrenciSoyad,
                o.ogrenciTel,
                o.aktifmi,
                CASE WHEN (a.tamamlandiMi = 1 OR a.tamamlanma = '1' OR a.sutun1 = 'tamamlandı' OR EXISTS (SELECT 1 FROM dersler d WHERE d.ogrenciId = a.ogrenciId AND d.tarih = a.tarih)) THEN 1 ELSE 0 END AS dersYapildiMi
             FROM ajanda a 
             LEFT JOIN ogrenciler o ON a.ogrenciId = o.ogrenciId 
             ORDER BY a.tarih, a.saat`
        );
        return { success: true, data: rows };
    } catch (error: any) {
        console.error("Ajanda kayıtları getirilemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function gunlukAjandaGetir(tarih: string) {
    try {
        const db = await ensureDatabaseReady();
        const rows = await db.getAllAsync<AjandaWithOgrenciType>(
            `SELECT 
                a.*,
                o.ogrenciAd,
                o.ogrenciSoyad,
                o.ogrenciTel,
                o.aktifmi,
                CASE WHEN (a.tamamlandiMi = 1 OR a.tamamlanma = '1' OR a.sutun1 = 'tamamlandı' OR EXISTS (SELECT 1 FROM dersler d WHERE d.ogrenciId = a.ogrenciId AND d.tarih = a.tarih)) THEN 1 ELSE 0 END AS dersYapildiMi
             FROM ajanda a 
             LEFT JOIN ogrenciler o ON a.ogrenciId = o.ogrenciId 
             WHERE a.tarih = ? 
             ORDER BY a.saat`,
            [tarih]
        );
        return { success: true, data: rows };
    } catch (error: any) {
        console.error("Günlük ajanda getirilemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ajandaGuncelle(ajandaId: number, kayit: AjandaType) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `UPDATE ajanda 
             SET ogrenciId = ?, ogrAdsoyad = ?, tarih = ?, saat = ?, 
                 tekrarsayisi = ?, kalanTekrarSayisi = ?, tamamlanma = ?, tamamlandiMi = ?
             WHERE ajandaId = ?`,
            [
                kayit.ogrenciId,
                kayit.ogrAdsoyad,
                kayit.tarih,
                kayit.saat,
                kayit.tekrarsayisi,
                kayit.kalanTekrarSayisi,
                kayit.tamamlanma || '',
                kayit.tamamlandiMi || 0,
                ajandaId
            ]
        );
        if (result.changes > 0) {
            const isInactive = kayit.tamamlandiMi === 1 || kayit.tamamlanma === '1' || kayit.sutun1 === 'tamamlandı';
            if (isInactive) {
                await cancelRandevuNotification(ajandaId);
            } else {
                await scheduleRandevuNotification(ajandaId, kayit.tarih, kayit.saat, kayit.ogrAdsoyad);
            }
        }
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("[agendaOperations.ts] ajandaGuncelle error:", error);
        return { success: false, error: error.message };
    }
}

// Öğrenciye ait belirli tarih aralığındaki ajanda kayıtlarını getir
export async function ogrenciAjandaGetir(ogrenciId: number, baslangicTarih: string, bitisTarih: string) {
    try {
        const db = await ensureDatabaseReady();
        const rows = await db.getAllAsync<AjandaWithOgrenciType>(
            `SELECT 
                a.*,
                o.ogrenciAd,
                o.ogrenciSoyad,
                o.ogrenciTel,
                o.aktifmi,
                CASE WHEN (a.tamamlandiMi = 1 OR a.tamamlanma = '1' OR a.sutun1 = 'tamamlandı' OR EXISTS (SELECT 1 FROM dersler d WHERE d.ogrenciId = a.ogrenciId AND d.tarih = a.tarih)) THEN 1 ELSE 0 END AS dersYapildiMi
             FROM ajanda a 
             LEFT JOIN ogrenciler o ON a.ogrenciId = o.ogrenciId 
             WHERE a.ogrenciId = ? AND a.tarih BETWEEN ? AND ? 
             ORDER BY a.tarih DESC, a.saat DESC`,
            [ogrenciId, baslangicTarih, bitisTarih]
        );
        return { success: true, data: rows };
    } catch (error: any) {
        console.error("Öğrenci ajanda kayıtları getirilemedi:", error);
        return { success: false, error: error.message };
    }
}

// Randevu iptal et
export async function randevuIptal(ajandaId: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `UPDATE ajanda SET iptal=1 WHERE ajandaId=?`,
            [ajandaId]
        );
        if (result.changes > 0) {
            await cancelRandevuNotification(ajandaId);
        }
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Randevu iptal edilemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ajandaSil(ajandaId: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM ajanda WHERE ajandaId = ?`,
            [ajandaId]
        );
        if (result.changes > 0) {
            await cancelRandevuNotification(ajandaId);
        }
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Ajanda kaydı silinemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ajandaGrupSil(olusmaAni: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM ajanda WHERE olusmaAni = ?`,
            [olusmaAni]
        );
        if (result.changes > 0) {
            await rescheduleAllRandevuNotifications();
        }
        return { success: true, deletedCount: result.changes };
    } catch (error: any) {
        console.error("Ajanda grubu silinemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ajandaSiradakiKayitlariSil(olusmaAni: string, tarih: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM ajanda WHERE olusmaAni = ? AND tarih >= ?`,
            [olusmaAni, tarih]
        );
        if (result.changes > 0) {
            await rescheduleAllRandevuNotifications();
        }
        return { success: true, deletedCount: result.changes };
    } catch (error: any) {
        console.error("Sıradaki ajanda kayıtları silinemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ajandaGrupGetir(olusmaAni: string) {
    try {
        const db = await ensureDatabaseReady();
        const rows = await db.getAllAsync<AjandaWithOgrenciType>(
            `SELECT 
                a.*,
                o.ogrenciAd,
                o.ogrenciSoyad,
                o.ogrenciTel,
                o.aktifmi,
                CASE WHEN (a.tamamlandiMi = 1 OR a.tamamlanma = '1' OR a.sutun1 = 'tamamlandı' OR EXISTS (SELECT 1 FROM dersler d WHERE d.ogrenciId = a.ogrenciId AND d.tarih = a.tarih)) THEN 1 ELSE 0 END AS dersYapildiMi
             FROM ajanda a 
             LEFT JOIN ogrenciler o ON a.ogrenciId = o.ogrenciId 
             WHERE a.olusmaAni = ? 
             ORDER BY a.tarih, a.saat`,
            [olusmaAni]
        );
        return { success: true, data: rows };
    } catch (error: any) {
        console.error("Ajanda grubu getirilemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ajandaGrupGuncelle(olusmaAni: string, seciliTarih: string, yeniTekrarSayisi: number, yeniSaat: string, yeniPeriyot: number = 7) {
    try {
        const db = await ensureDatabaseReady();

        await db.runAsync(
            `DELETE FROM ajanda WHERE olusmaAni = ? AND tarih > ?`,
            [olusmaAni, seciliTarih]
        );

        const mevcutKayit = await db.getFirstAsync<AjandaType>(
            `SELECT * FROM ajanda WHERE olusmaAni = ? AND tarih = ?`,
            [olusmaAni, seciliTarih]
        );

        if (!mevcutKayit) {
            console.error(`[agendaOperations.ts] ajandaGrupGuncelle error: Güncellenecek kayıt bulunamadı.`);
            throw new Error('Güncellenecek kayıt bulunamadı');
        }

        await db.runAsync(
            `UPDATE ajanda 
             SET saat = ?, tekrarsayisi = ?, kalanTekrarSayisi = ?
             WHERE olusmaAni = ? AND tarih = ?`,
            [yeniSaat, yeniTekrarSayisi.toString(), yeniTekrarSayisi.toString(), olusmaAni, seciliTarih]
        );

        const baslangicTarihi = new Date(seciliTarih);

        for (let i = 1; i < yeniTekrarSayisi; i++) {
            const yeniTarih = new Date(baslangicTarihi);
            yeniTarih.setDate(baslangicTarihi.getDate() + (i * yeniPeriyot));

            const kalanTekrar = yeniTekrarSayisi - i;
            const yerelTarihString = `${yeniTarih.getFullYear()}-${(yeniTarih.getMonth() + 1).toString().padStart(2, '0')}-${yeniTarih.getDate().toString().padStart(2, '0')}`;

            await db.runAsync(
                `INSERT INTO ajanda (ogrenciId, ogrAdsoyad, tarih, saat, tekrarsayisi, kalanTekrarSayisi, olusmaAni, tamamlanma, tamamlandiMi, sutun1, sutun2) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    mevcutKayit.ogrenciId,
                    mevcutKayit.ogrAdsoyad,
                    yerelTarihString,
                    yeniSaat,
                    yeniTekrarSayisi.toString(),
                    kalanTekrar.toString(),
                    olusmaAni,
                    '',
                    0,
                    '',
                    ''
                ]
            );
        }

        await rescheduleAllRandevuNotifications();
        return { success: true };
    } catch (error: any) {
        console.error("[agendaOperations.ts] Ajanda grup güncellemesi başarısız:", error);
        return { success: false, error: error.message };
    }
}

export async function ajandaTamamlanmaDurumuGuncelle(ajandaId: number, durum: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `UPDATE ajanda SET tamamlanma = ? WHERE ajandaId = ?`,
            [durum, ajandaId]
        );
        if (result.changes > 0) {
            await rescheduleAllRandevuNotifications();
        }
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Tamamlanma durumu güncellenemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ajandaTamamla(ogrenciId: number, tarih: string, tamamlandi: boolean) {
    try {
        const db = await ensureDatabaseReady();
        const status = tamamlandi ? 1 : 0;
        const result = await db.runAsync(
            `UPDATE ajanda SET tamamlandiMi = ? WHERE ogrenciId = ? AND tarih = ?`,
            [status, ogrenciId, tarih]
        );
        if (result.changes > 0) {
            await rescheduleAllRandevuNotifications();
        }
        return { success: true, changes: result.changes };
    } catch (error: any) {
        console.error("ajandaTamamla hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function tarihAraligiAjandaGetir(baslangicTarihi: string, bitisTarihi: string) {
    try {
        const db = await ensureDatabaseReady();
        const rows = await db.getAllAsync<AjandaWithOgrenciType>(
            `SELECT 
                a.*,
                o.ogrenciAd,
                o.ogrenciSoyad,
                o.ogrenciTel,
                o.aktifmi,
                CASE WHEN (a.tamamlandiMi = 1 OR a.tamamlanma = '1' OR a.sutun1 = 'tamamlandı' OR EXISTS (SELECT 1 FROM dersler d WHERE d.ogrenciId = a.ogrenciId AND d.tarih = a.tarih)) THEN 1 ELSE 0 END AS dersYapildiMi
             FROM ajanda a 
             LEFT JOIN ogrenciler o ON a.ogrenciId = o.ogrenciId 
             WHERE a.tarih BETWEEN ? AND ?
             ORDER BY a.tarih, a.saat`,
            [baslangicTarihi, bitisTarihi]
        );
        return { success: true, data: rows };
    } catch (error: any) {
        console.error("Tarih aralığı ajandası getirilemedi:", error);
        return { success: false, error: error.message };
    }
}

export async function ogrencininSonTamamlananDersTarihi(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();
        const bugunStr = new Date().toISOString().split('T')[0];
        
        // Geçmişteki ve tamamlanmış olan en son dersi bul
        const kayitlar = await db.getAllAsync(
            `SELECT tarih FROM ajanda 
             WHERE ogrenciId = ? 
             AND tarih <= ? 
             AND (dersYapildiMi = 1 OR tamamlandiMi = 1 OR tamamlanma = '1' OR sutun1 = 'tamamlandı')
             ORDER BY tarih DESC 
             LIMIT 1`,
            [ogrenciId, bugunStr]
        );
        
        if (kayitlar && kayitlar.length > 0) {
            return { success: true, tarih: (kayitlar[0] as any).tarih };
        }
        return { success: false, message: "Tamamlanmış ders bulunamadı." };
    } catch (error: any) {
        console.error('Son ders tarihi alma hatası:', error);
        return { success: false, error: error.message };
    }
}
