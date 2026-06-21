import { ensureDatabaseReady } from './init';
import { DenemeType } from '../types';

export async function denemeEkle(deneme: DenemeType) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            'INSERT INTO denemeler (ogrenciId, sinavTuruId, denemeAd, tarih, dogru, yanlis) VALUES (?, ?, ?, ?, ?, ?)',
            [deneme.ogrenciId, deneme.sinavTuruId, deneme.denemeAd, deneme.tarih, deneme.dogru, deneme.yanlis]
        );
        return { success: true, insertId: result.lastInsertRowId };
    } catch (error: any) {
        console.error('Deneme ekleme hatası:', error);
        return { success: false, error: error.message };
    }
}

export async function denemeGuncelle(id: number, deneme: Partial<DenemeType>) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            'UPDATE denemeler SET sinavTuruId = ?, denemeAd = ?, tarih = ?, dogru = ?, yanlis = ? WHERE id = ?',
            [deneme.sinavTuruId, deneme.denemeAd, deneme.tarih, deneme.dogru, deneme.yanlis, id]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error('Deneme güncelleme hatası:', error);
        return { success: false, error: error.message };
    }
}

export async function getDenemeler(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getAllAsync<DenemeType>(
            `SELECT d.*, s.ad as sinavTuruAd 
             FROM denemeler d
             LEFT JOIN sinav_turleri s ON d.sinavTuruId = s.id
             WHERE d.ogrenciId = ?
             ORDER BY d.tarih DESC`,
            [ogrenciId]
        );
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Denemeleri getirme hatası:', error);
        return { success: false, error: error.message };
    }
}

export async function denemeSil(id: number) {
    try {
        const db = await ensureDatabaseReady();
        await db.runAsync('DELETE FROM denemeler WHERE id = ?', [id]);
        return { success: true };
    } catch (error: any) {
        console.error('Deneme silme hatası:', error);
        return { success: false, error: error.message };
    }
}
