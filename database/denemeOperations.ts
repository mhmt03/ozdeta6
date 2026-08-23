import { ensureDatabaseReady } from './init';
import { DenemeType } from '../types';

/**
 * Yeni bir deneme sınav sonucu kaydını veritabanına ekler.
 * 
 * @param deneme Eklenecek deneme sınavına ait veriler (DenemeType)
 * @returns Başarı durumu ve eklenen kaydın benzersiz veritabanı ID'si (insertId)
 */
export async function denemeEkle(deneme: DenemeType) {
    try {
        // Veritabanı bağlantısının hazır olduğundan emin ol
        const db = await ensureDatabaseReady();
        
        // runAsync metodu veritabanına veri eklemek, güncellemek veya silmek (yazma işlemleri) için kullanılır.
        // Parametrik sorgu (?) kullanılarak SQL Injection açığı önlenir.
        const result = await db.runAsync(
            'INSERT INTO denemeler (ogrenciId, sinavTuruId, denemeAd, tarih, dogru, yanlis) VALUES (?, ?, ?, ?, ?, ?)',
            [
                deneme.ogrenciId, 
                deneme.sinavTuruId, 
                deneme.denemeAd ?? null, // Eğer boşsa veritabanına NULL olarak kaydet
                deneme.tarih, 
                deneme.dogru, 
                deneme.yanlis
            ]
        );
        
        // lastInsertRowId, SQLite tarafından otomatik oluşturulan PRIMARY KEY değerini verir.
        return { success: true, insertId: result.lastInsertRowId };
    } catch (error: any) {
        console.error('Deneme ekleme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mevcut bir deneme sınav sonucunu günceller.
 * Partial<DenemeType> kullanılarak sadece güncellenmek istenen alanların gönderilmesi sağlanır.
 * 
 * @param id Güncellenecek deneme kaydının veritabanı ID'si
 * @param deneme Güncellenecek yeni veriler (Partial)
 * @returns Güncellemenin başarılı olup olmadığı bilgisi
 */
export async function denemeGuncelle(id: number, deneme: Partial<DenemeType>) {
    try {
        const db = await ensureDatabaseReady();
        
        // TypeScript hatasını önlemek ve SQLite veri parametrelerinin 'undefined' olmasını engellemek için
        // nullish coalescing (?? null) operatörünü kullanıyoruz. 
        // SQLite 'undefined' yerine 'null' (veritabanı karşılığı NULL) kabul eder.
        const result = await db.runAsync(
            'UPDATE denemeler SET sinavTuruId = ?, denemeAd = ?, tarih = ?, dogru = ?, yanlis = ? WHERE id = ?',
            [
                deneme.sinavTuruId ?? null, 
                deneme.denemeAd ?? null, 
                deneme.tarih ?? null, 
                deneme.dogru ?? null, 
                deneme.yanlis ?? null, 
                id
            ]
        );
        
        // changes, etkilenen/güncellenen satır sayısını belirtir. 0'dan büyükse işlem başarılıdır.
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error('Deneme güncelleme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Belirli bir öğrenciye ait tüm deneme sınavı sonuçlarını listeler.
 * Sonuçlar, sınav türü adı (sinavTuruAd) ile birleştirilerek (LEFT JOIN) getirilir.
 * 
 * @param ogrenciId Listelenecek öğrencinin ID'si
 * @returns Öğrencinin deneme kayıtları listesi
 */
export async function getDenemeler(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();
        
        // getAllAsync metodu veritabanından çoklu satır sorgulamak (okuma işlemleri) için kullanılır.
        // LEFT JOIN kullanılarak sınav türü ID'sine karşılık gelen sınav türü adı (Örn: TYT, LGS) çekilir.
        const result = await db.getAllAsync<DenemeType>(
            `SELECT d.*, s.ad as sinavTuruAd 
             FROM denemeler d
             LEFT JOIN sinav_turleri s ON d.sinavTuruId = s.id
             WHERE d.ogrenciId = ?
             ORDER BY d.tarih DESC`, // En yeni deneme sınavı en üstte görünecek şekilde sıralar
            [ogrenciId]
        );
        
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Denemeleri getirme hatası:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Belirtilen ID'ye sahip deneme sınavı kaydını veritabanından siler.
 * 
 * @param id Silinecek deneme kaydının veritabanı ID'si
 * @returns İşlem başarı durumu
 */
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
