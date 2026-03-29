import { ensureDatabaseReady } from './init';

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM settings WHERE key = ?',
            [key]
        );
        return result ? result.value : defaultValue;
    } catch (error) {
        console.error('Ayar getirme hatası:', error);
        return defaultValue;
    }
}

export async function saveSetting(key: string, value: string): Promise<boolean> {
    try {
        const db = await ensureDatabaseReady();
        await db.runAsync(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [key, value]
        );
        return true;
    } catch (error) {
        console.error('Ayar kaydetme hatası:', error);
        return false;
    }
}
