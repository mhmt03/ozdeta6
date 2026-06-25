import { ensureDatabaseReady } from './init';

export interface GlobalNoteType {
    id?: number;
    not_metni: string;
    tarih_saat: string;
}

export const globalNotlariGetir = async () => {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getAllAsync<GlobalNoteType>(
            'SELECT * FROM global_notlar ORDER BY id DESC'
        );
        return { success: true, data: result };
    } catch (error: any) {
        console.error('globalNotlariGetir hatasi:', error);
        return { success: false, error: error.message };
    }
};

export const globalNotEkle = async (notMetni: string, tarihSaat: string) => {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            'INSERT INTO global_notlar (not_metni, tarih_saat) VALUES (?, ?)',
            [notMetni, tarihSaat]
        );
        return { success: true, insertId: result.lastInsertRowId };
    } catch (error: any) {
        console.error('globalNotEkle hatasi:', error);
        return { success: false, error: error.message };
    }
};

export const globalNotGuncelle = async (id: number, notMetni: string, tarihSaat: string) => {
    try {
        const db = await ensureDatabaseReady();
        await db.runAsync(
            'UPDATE global_notlar SET not_metni = ?, tarih_saat = ? WHERE id = ?',
            [notMetni, tarihSaat, id]
        );
        return { success: true };
    } catch (error: any) {
        console.error('globalNotGuncelle hatasi:', error);
        return { success: false, error: error.message };
    }
};

export const globalNotSil = async (id: number) => {
    try {
        const db = await ensureDatabaseReady();
        await db.runAsync('DELETE FROM global_notlar WHERE id = ?', [id]);
        return { success: true };
    } catch (error: any) {
        console.error('globalNotSil hatasi:', error);
        return { success: false, error: error.message };
    }
};
