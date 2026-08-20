import { ensureDatabaseReady } from './init';
import { NotType, KaynakType, OdevType } from '../types';

// ================= NOTE OPERATIONS =================

export async function notKaydet(notVerisi: NotType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `INSERT INTO notlarim (ogrenciId, tarih, not1) VALUES (?, ?, ?)`,
            [notVerisi.ogrenciId, notVerisi.tarih, notVerisi.not1]
        );
        return { success: true, result };
    } catch (error: any) {
        console.error("Not kaydetme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function notGuncelle(notId: number, notVerisi: NotType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `UPDATE notlarim SET not1=?, tarih=? WHERE notlarimId=?`,
            [notVerisi.not1, notVerisi.tarih, notId]
        );

        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Not güncelleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function notSil(notId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `DELETE FROM notlarim WHERE notlarimId=?`,
            [notId]
        );

        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Not silme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function ogrenciNotlari(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.getAllAsync<NotType>(
            `SELECT * FROM notlarim WHERE ogrenciId=? ORDER BY tarih DESC`,
            [ogrenciId]
        );

        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error("Notlar alma hatası:", error);
        return { success: false, error: error.message, data: [] };
    }
}

// ================= RESOURCE OPERATIONS =================

export async function kaynakKaydet(kaynakVerisi: KaynakType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `INSERT INTO kaynaklar (ogrenciId, kaynak) VALUES (?, ?)`,
            [kaynakVerisi.ogrenciId, kaynakVerisi.kaynak]
        );

        return { success: true, result };
    } catch (error: any) {
        console.error("Kaynak kaydetme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function kaynakListesi(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.getAllAsync<KaynakType>(
            `SELECT * FROM kaynaklar WHERE ogrenciId=? ORDER BY kaynak ASC`,
            [ogrenciId]
        );

        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error("DB_Kaynak listesi alma hatası:", error);
        return { success: false, error: error.message, data: [] };
    }
}

export async function kaynakSil(kaynakId: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            "DELETE FROM kaynaklar WHERE kaynakId = ?",
            [kaynakId]
        );
        return { success: true, result };
    } catch (error: any) {
        console.error("Kaynak silme hatası:", error);
        return { success: false, error: error.message };
    }
}

// ================= HOMEWORK OPERATIONS =================

export async function odevKaydet(odevVerisi: OdevType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `INSERT INTO odevler (ogrenciId, kaynak, odev, verilmetarihi, teslimttarihi, yapilmadurumu, aciklama) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                odevVerisi.ogrenciId!,
                odevVerisi.kaynak ?? '',
                odevVerisi.odev ?? '',
                odevVerisi.verilmetarihi ?? '',
                odevVerisi.teslimttarihi ?? '',
                odevVerisi.yapilmadurumu ?? 'Bekliyor',
                odevVerisi.aciklama ?? ''
            ]
        );

        return { success: true, result };
    } catch (error: any) {
        console.error("Ödev kaydetme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function odevGuncelle(odevId: number, odevVerisi: OdevType) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.runAsync(
            `UPDATE odevler 
             SET kaynak=?, odev=?, verilmetarihi=?, teslimttarihi=?, yapilmadurumu=?, kontroltarihi=?, aciklama=?
             WHERE odevId=?`,
            [
                odevVerisi.kaynak ?? '',
                odevVerisi.odev ?? '',
                odevVerisi.verilmetarihi ?? '',
                odevVerisi.teslimttarihi ?? '',
                odevVerisi.yapilmadurumu ?? '',
                odevVerisi.kontroltarihi ?? '',
                odevVerisi.aciklama ?? '',
                odevId
            ]
        );

        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Ödev güncelleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function odevSil(odevId: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM odevler WHERE odevId=?`,
            [odevId]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Ödev silme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function ogrenciOdevleri(ogrenciId: number) {
    try {
        const db = await ensureDatabaseReady();

        const result = await db.getAllAsync<OdevType>(
            `SELECT * FROM odevler WHERE ogrenciId=? ORDER BY verilmetarihi DESC`,
            [ogrenciId]
        );

        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error("Ödevler alma hatası:", error);
        return { success: false, error: error.message, data: [] };
    }
}

export async function getBekleyenOdevSayisi(ogrenciId: number): Promise<number> {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM odevler WHERE ogrenciId=? AND yapilmadurumu='Bekliyor'`,
            [ogrenciId]
        );
        return result ? result.count : 0;
    } catch (error) {
        console.error("Bekleyen ödev sayısı alınamadı:", error);
        return 0;
    }
}

// ================= GLOBAL RESOURCE OPERATIONS =================

export async function tumKaynakEkle(ad: string, tur: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `INSERT INTO tum_kaynaklar (ad, tur) VALUES (?, ?)`,
            [ad, tur]
        );
        return { success: true, id: result.lastInsertRowId };
    } catch (error: any) {
        console.error("Global kaynak ekleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function tumKaynakSil(id: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM tum_kaynaklar WHERE id=?`,
            [id]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Global kaynak silme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function getTumKaynaklar() {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getAllAsync<{ id: number; ad: string; tur: string }>(
            `SELECT * FROM tum_kaynaklar ORDER BY tur ASC, ad ASC`
        );
        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error("Global kaynaklar alınamadı:", error);
        return { success: false, data: [], error: error.message };
    }
}

export async function tumKaynakGuncelle(id: number, ad: string, tur: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `UPDATE tum_kaynaklar SET ad=?, tur=? WHERE id=?`,
            [ad, tur, id]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Global kaynak güncelleme hatası:", error);
        return { success: false, error: error.message };
    }
}

// ================= KAYNAK İÇERİK OPERATIONS =================

export async function kaynakIcerikEkle(kaynakId: number, icerik: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `INSERT INTO kaynak_icerikleri (kaynakId, icerik) VALUES (?, ?)`,
            [kaynakId, icerik]
        );
        return { success: true, id: result.lastInsertRowId };
    } catch (error: any) {
        console.error("Kaynak içerik ekleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function getKaynakIcerikleri(kaynakId: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getAllAsync<{ id: number; kaynakId: number; icerik: string }>(
            `SELECT * FROM kaynak_icerikleri WHERE kaynakId=? ORDER BY id ASC`,
            [kaynakId]
        );
        return { success: true, data: result || [] };
    } catch (error: any) {
        console.error("Kaynak içerikleri alınamadı:", error);
        return { success: false, data: [], error: error.message };
    }
}

export async function kaynakIcerikGuncelle(id: number, icerik: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `UPDATE kaynak_icerikleri SET icerik=? WHERE id=?`,
            [icerik, id]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Kaynak içerik güncelleme hatası:", error);
        return { success: false, error: error.message };
    }
}

export async function kaynakIcerikSil(id: number) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(
            `DELETE FROM kaynak_icerikleri WHERE id=?`,
            [id]
        );
        return { success: result.changes > 0 };
    } catch (error: any) {
        console.error("Kaynak içerik silme hatası:", error);
        return { success: false, error: error.message };
    }
}

// Kaynak adına göre global kaynakId bul (ödev verirken içerik eşleştirmesi için)
export async function getKaynakIdByAd(ad: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.getFirstAsync<{ id: number; ad: string; tur: string }>(
            `SELECT * FROM tum_kaynaklar WHERE ad=? LIMIT 1`,
            [ad]
        );
        return { success: true, data: result ?? null };
    } catch (error: any) {
        console.error("Kaynak id bulunamadı:", error);
        return { success: false, data: null, error: error.message };
    }
}

// ================= KAYNAK TAMAMLANMA RAPORU =================

export type KonuRaporItem = {
    icerik: string;
    odevVarMi: boolean;
    odevTarihi: string | null;      // verilmetarihi
    odevDurumu: string | null;      // yapilmadurumu
};

export type KaynakRaporItem = {
    kaynakAd: string;
    kaynakTur: string;
    globalKaynakVar: boolean;        // tum_kaynaklar'da tanımlı mı?
    toplamIcerik: number;
    odevVerilenIcerik: number;
    tamamlananIcerik: number;
    tamamlanmaOrani: number;         // 0-100 arası
    konular: KonuRaporItem[];
};

export async function getKaynakTamamlanmaRaporu(ogrenciId: number): Promise<{
    success: boolean;
    data: KaynakRaporItem[];
    error?: string;
}> {
    try {
        const db = await ensureDatabaseReady();

        // Öğrenciye atanmış kaynaklar
        const ogrKaynaklar = await db.getAllAsync<{ kaynakId: number; kaynak: string }>(
            `SELECT kaynakId, kaynak FROM kaynaklar WHERE ogrenciId=? ORDER BY kaynak ASC`,
            [ogrenciId]
        );

        const rapor: KaynakRaporItem[] = [];

        for (const ok of ogrKaynaklar) {
            const kaynakAd = ok.kaynak;

            // Global kaynakta bu isimle eşleşen kaynak var mı?
            const globalKaynak = await db.getFirstAsync<{ id: number; ad: string; tur: string }>(
                `SELECT * FROM tum_kaynaklar WHERE ad=? LIMIT 1`,
                [kaynakAd]
            );

            if (!globalKaynak) {
                // Global listede tanımlanmamış kaynak — sadece özet satır ekle
                rapor.push({
                    kaynakAd,
                    kaynakTur: '-',
                    globalKaynakVar: false,
                    toplamIcerik: 0,
                    odevVerilenIcerik: 0,
                    tamamlananIcerik: 0,
                    tamamlanmaOrani: 0,
                    konular: [],
                });
                continue;
            }

            // Kaynağın tüm içerikleri
            const icerikleri = await db.getAllAsync<{ id: number; icerik: string }>(
                `SELECT id, icerik FROM kaynak_icerikleri WHERE kaynakId=? ORDER BY id ASC`,
                [globalKaynak.id]
            );

            // Bu öğrenciye bu kaynaktan verilen tüm ödevler
            const odevler = await db.getAllAsync<{
                odev: string;
                verilmetarihi: string;
                yapilmadurumu: string;
            }>(
                `SELECT odev, verilmetarihi, yapilmadurumu
                 FROM odevler
                 WHERE ogrenciId=? AND kaynak=?`,
                [ogrenciId, kaynakAd]
            );

            // Her içerik için ödev durumunu bul
            const konular: KonuRaporItem[] = icerikleri.map(ic => {
                const eslesen = odevler.find(
                    o => o.odev.trim().toLowerCase() === ic.icerik.trim().toLowerCase()
                );
                return {
                    icerik: ic.icerik,
                    odevVarMi: !!eslesen,
                    odevTarihi: eslesen?.verilmetarihi ?? null,
                    odevDurumu: eslesen?.yapilmadurumu ?? null,
                };
            });

            const odevVerilenIcerik = konular.filter(k => k.odevVarMi).length;
            const tamamlananIcerik  = konular.filter(k => k.odevDurumu === 'Yapıldı').length;
            const tamamlanmaOrani   = icerikleri.length > 0
                ? Math.round((tamamlananIcerik / icerikleri.length) * 100)
                : 0;

            rapor.push({
                kaynakAd,
                kaynakTur: globalKaynak.tur ?? 'Diğer',
                globalKaynakVar: true,
                toplamIcerik: icerikleri.length,
                odevVerilenIcerik,
                tamamlananIcerik,
                tamamlanmaOrani,
                konular,
            });
        }

        return { success: true, data: rapor };
    } catch (error: any) {
        console.error("Kaynak tamamlanma raporu hatası:", error);
        return { success: false, data: [], error: error.message };
    }
}

// ================= KAYNAK TÜRLERİ CRUD =================

export type KaynakTuru = { id: number; ad: string };

export async function getTumKaynakTurleri() {
    try {
        const db = await ensureDatabaseReady();
        const data = await db.getAllAsync<KaynakTuru>(`SELECT * FROM kaynak_turleri ORDER BY id ASC`);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, data: [] as KaynakTuru[], error: error.message };
    }
}

export async function kaynakTuruEkle(ad: string) {
    try {
        const db = await ensureDatabaseReady();
        const result = await db.runAsync(`INSERT INTO kaynak_turleri (ad) VALUES (?)`, [ad.trim()]);
        return { success: true, id: result.lastInsertRowId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// guncelMevcut=true ise tum_kaynaklar'daki kaynak türleri de güncellenir
export async function kaynakTuruGuncelle(id: number, yeniAd: string, eskiAd: string, guncelMevcut: boolean) {
    try {
        const db = await ensureDatabaseReady();
        await db.runAsync(`UPDATE kaynak_turleri SET ad=? WHERE id=?`, [yeniAd.trim(), id]);
        if (guncelMevcut) {
            await db.runAsync(
                `UPDATE tum_kaynaklar SET tur=? WHERE tur=?`,
                [yeniAd.trim(), eskiAd]
            );
        }
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function kaynakTuruSil(id: number) {
    try {
        const db = await ensureDatabaseReady();
        await db.runAsync(`DELETE FROM kaynak_turleri WHERE id=?`, [id]);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Kaç kaynak bu türü kullanıyor?
export async function kaynakTuruKullanimSayisi(turAd: string): Promise<number> {
    try {
        const db = await ensureDatabaseReady();
        const row = await db.getFirstAsync<{ sayi: number }>(
            `SELECT COUNT(*) as sayi FROM tum_kaynaklar WHERE tur=?`, [turAd]
        );
        return row?.sayi ?? 0;
    } catch {
        return 0;
    }
}

// ================= İÇERİK KOPYALAMA =================

// Bir kaynağın tüm içeriklerini başka bir kaynağa kopyala
// Zaten var olan içerikler (aynı icerik metni) atlanır
export async function kaynakIcerikleriniKopyala(kaynakId: number, hedefKaynakId: number) {
    try {
        const db = await ensureDatabaseReady();
        const kaynakIcerikleri = await db.getAllAsync<{ icerik: string }>(
            `SELECT icerik FROM kaynak_icerikleri WHERE kaynakId=? ORDER BY id ASC`,
            [kaynakId]
        );
        const hedefIcerikleri = await db.getAllAsync<{ icerik: string }>(
            `SELECT icerik FROM kaynak_icerikleri WHERE kaynakId=?`,
            [hedefKaynakId]
        );
        const hedefSet = new Set(hedefIcerikleri.map(h => h.icerik.trim().toLowerCase()));

        let eklenenSayi = 0;
        for (const ic of kaynakIcerikleri) {
            if (!hedefSet.has(ic.icerik.trim().toLowerCase())) {
                await db.runAsync(
                    `INSERT INTO kaynak_icerikleri (kaynakId, icerik) VALUES (?, ?)`,
                    [hedefKaynakId, ic.icerik]
                );
                eklenenSayi++;
            }
        }
        return { success: true, eklenenSayi, toplamKaynak: kaynakIcerikleri.length };
    } catch (error: any) {
        return { success: false, eklenenSayi: 0, toplamKaynak: 0, error: error.message };
    }
}
