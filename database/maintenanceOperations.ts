import { ensureDatabaseReady } from './init';

/**
 * Veritabanını seçilen tarihten öncesi için temizler.
 * @param tarih 'YYYY-MM-DD' formatında sınır tarihi
 * @param seciliTablolar Temizlenecek tablo isimleri listesi
 */
export async function veritabaniTemizle(tarih: string, seciliTablolar: string[]) {
    try {
        const db = await ensureDatabaseReady();
        
        console.log(`Veritabanı temizleme başlatıldı. Tarih: ${tarih}, Tablolar: ${seciliTablolar.join(', ')}`);

        // İşlemleri sırasıyla yapalım. 
        // Eğer öğrenciler silinecekse, onlara bağlı tüm verileri (tarih bağımsız) temizlemek gerekir.
        
        if (seciliTablolar.includes('dersler')) {
            await db.runAsync('DELETE FROM dersler WHERE tarih < ?', [tarih]);
        }
        
        if (seciliTablolar.includes('odemeler')) {
            await db.runAsync('DELETE FROM odemeler WHERE odemetarih < ?', [tarih]);
        }
        
        if (seciliTablolar.includes('odevler')) {
            await db.runAsync('DELETE FROM odevler WHERE verilmetarihi < ?', [tarih]);
        }
        
        if (seciliTablolar.includes('notlarim')) {
            await db.runAsync('DELETE FROM notlarim WHERE tarih < ?', [tarih]);
        }
        
        if (seciliTablolar.includes('ajanda')) {
            await db.runAsync('DELETE FROM ajanda WHERE tarih < ?', [tarih]);
        }
        
        if (seciliTablolar.includes('ogrenciler')) {
            // Önce öğrencileri sil (tarihle karşılaştırırken CURRENT_TIMESTAMP formatı 'YYYY-MM-DD HH:MM:SS' olduğu için direkt string karşılaştırması çalışır)
            await db.runAsync('DELETE FROM ogrenciler WHERE kayitTarihi < ?', [tarih]);
            
            // Silinen öğrencilerin yetim kalan tüm kayıtlarını temizle (tarihine bakmaksızın)
            await db.runAsync('DELETE FROM dersler WHERE ogrenciId NOT IN (SELECT ogrenciId FROM ogrenciler)');
            await db.runAsync('DELETE FROM odemeler WHERE ogrenciId NOT IN (SELECT ogrenciId FROM ogrenciler)');
            await db.runAsync('DELETE FROM odevler WHERE ogrenciId NOT IN (SELECT ogrenciId FROM ogrenciler)');
            await db.runAsync('DELETE FROM notlarim WHERE ogrenciId NOT IN (SELECT ogrenciId FROM ogrenciler)');
            await db.runAsync('DELETE FROM ajanda WHERE ogrenciId NOT IN (SELECT ogrenciId FROM ogrenciler)');
            await db.runAsync('DELETE FROM kaynaklar WHERE ogrenciId NOT IN (SELECT ogrenciId FROM ogrenciler)');
        }

        // Veritabanı dosyasını fiziksel olarak küçült
        await db.execAsync('VACUUM');

        console.log('Veritabanı temizleme ve VACUUM tamamlandı.');
        return { success: true };
    } catch (error: any) {
        console.error('Veritabanı temizleme hatası:', error);
        return { success: false, error: error.message };
    }
}
