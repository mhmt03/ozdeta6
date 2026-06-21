import { ensureDatabaseReady } from './init';
import { OdevType, KaynakType, NotType } from '../types';

// ================= EXAM TYPE OPERATIONS =================

export async function sinavTuruEkle(ad: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `INSERT INTO sinav_turleri (ad) VALUES (?)`,
            [ad]
        );
        return { success: true, id: result.lastInsertRowId };
    } catch (error: any) {
        console.error('Sınav türü ekleme hatası:', error);
        return { success: false, error: error.message };
    }
}

export async function getTumSinavTurleri() {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getAllAsync<{ id: number; ad: string }>(
            `SELECT * FROM sinav_turleri ORDER BY ad ASC`
        );
        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error('Sınav türleri alınamadı:', error);
        return { success: false, data: [], error: error.message };
    }
}

export async function sinavTuruSil(id: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM sinav_turleri WHERE id = ?`,
            [id]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error('Sınav türü silme hatası:', error);
        return { success: false, error: error.message };
    }
}
