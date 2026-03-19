import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import { DersType, OgrenciType } from '../types';

export type BorcluOgrenci = OgrenciType & {
    toplamDersUcreti: number;
    toplamOdeme: number;
    kalanBorc: number;
};

const detayliTarihFormatla = () => {
    const now = new Date();
    const tarih = now.toISOString().split('T')[0];
    const saat = now.getHours().toString().padStart(2, '0');
    const dakika = now.getMinutes().toString().padStart(2, '0');
    const saniye = now.getSeconds().toString().padStart(2, '0');
    return `${tarih}_${saat}-${dakika}-${saniye}`;
};

export const ozdetaKlasoruKontrolEt = async () => {
    try {
        // @ts-ignore
        const ozdetaKlasor = FileSystem.documentDirectory + 'ozdeta/';
        const dirInfo = await FileSystem.getInfoAsync(ozdetaKlasor);

        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(ozdetaKlasor, { intermediates: true });
        }
        return ozdetaKlasor;
    } catch (error) {
        console.error('Klasör oluşturma hatası:', error);
        // @ts-ignore
        return FileSystem.documentDirectory || '';
    }
};

export const dosyayiDirektKaydet = async (dosyaAdi: string, icerik: string, mimeType: string = 'application/octet-stream') => {
    try {
        const ozdetaKlasor = await ozdetaKlasoruKontrolEt();
        const dosyaYolu = ozdetaKlasor + dosyaAdi;

        if (mimeType.includes('sheet') || mimeType.includes('sqlite')) {
            await FileSystem.writeAsStringAsync(dosyaYolu, icerik, {
                encoding: 'base64'
            });
        } else {
            await FileSystem.writeAsStringAsync(dosyaYolu, icerik);
        }

        return {
            success: true,
            dosyaYolu,
            dosyaAdi,
            message: `Dosya başarıyla kaydedildi: ${dosyaAdi}`
        };
    } catch (error: any) {
        console.error('Dosya kaydetme hatası:', error);
        return { success: false, error: error.message };
    }
};

export const akilliDosyaKaydet = async (dosyaAdi: string, icerik: string, mimeType: string = 'application/octet-stream') => {
    try {
        // @ts-ignore
        const cacheKlasor = FileSystem.cacheDirectory + 'ozdeta/';
        const dirInfo = await FileSystem.getInfoAsync(cacheKlasor);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(cacheKlasor, { intermediates: true });
        }

        const geciciDosyaYolu = cacheKlasor + dosyaAdi;

        if (mimeType.includes('sheet') || mimeType.includes('sqlite')) {
            await FileSystem.writeAsStringAsync(geciciDosyaYolu, icerik, {
                encoding: 'base64'
            });
        } else {
            await FileSystem.writeAsStringAsync(geciciDosyaYolu, icerik);
        }

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(geciciDosyaYolu, {
                mimeType,
                dialogTitle: `Dosyayı Kaydet: ${dosyaAdi}`,
                UTI: mimeType
            });

            return {
                success: true,
                dosyaYolu: geciciDosyaYolu,
                dosyaAdi,
                message: `Dosya işlemi başlatıldı. Lütfen kaydetmek istediğiniz konumu seçin.`
            };
        }

        return {
            success: true,
            dosyaYolu: geciciDosyaYolu,
            dosyaAdi,
            message: `Dosya oluşturuldu: ${dosyaAdi}. Uygulama önbelleğine kaydedildi.`
        };
    } catch (error: any) {
        console.error('Dosya kaydetme hatası:', error);
        return { success: false, error: error.message };
    }
};

export const excelRaporOlustur = async (
    baslangicTarihi: Date,
    bitisTarihi: Date,
    tumDersler: DersType[],
    tumOgrenciler: OgrenciType[],
    borcluOgrenciler: BorcluOgrenci[]
) => {
    try {
        const baslangicStr = baslangicTarihi.toISOString().split('T')[0];
        const bitisStr = bitisTarihi.toISOString().split('T')[0];

        const filtreliDersler = tumDersler.filter(ders => {
            const dersTarihi = new Date(ders.tarih);
            return dersTarihi >= baslangicTarihi && dersTarihi <= bitisTarihi;
        });

        const workbook = XLSX.utils.book_new();

        // 1. DERSLER
        const derslerData: any[][] = [
            ['DERS RAPORU'],
            [`Tarih Aralığı: ${baslangicStr} - ${bitisStr}`],
            [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
            [''],
            ['Tarih', 'Saat', 'Öğrenci', 'Konu', 'Ücret (TL)']
        ];

        let toplamDersUcreti = 0;
        filtreliDersler.forEach(ders => {
            derslerData.push([
                ders.tarih,
                ders.saat,
                ders.ogrenciAdSoyad || 'Belirtilmemiş',
                ders.konu || '-',
                parseInt(ders.ucret) || 0
            ]);
            toplamDersUcreti += parseInt(ders.ucret) || 0;
        });

        derslerData.push(['', '', '', 'TOPLAM DERS ÜCRETİ:', toplamDersUcreti + ' TL']);
        const derslerWorksheet = XLSX.utils.aoa_to_sheet(derslerData);
        XLSX.utils.book_append_sheet(workbook, derslerWorksheet, 'Dersler');

        // 2. OĞRENCİLER
        const ogrencilerData: any[][] = [
            ['ÖĞRENCİ BİLGİLERİ'],
            [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
            [''],
            ['Ad Soyad', 'Telefon', 'Okul', 'Ders Ücreti', 'Durum']
        ];

        tumOgrenciler.forEach(ogrenci => {
            ogrencilerData.push([
                `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`,
                ogrenci.ogrenciTel || '-',
                ogrenci.okul || '-',
                parseInt(ogrenci.ucret.toString()) || 0,
                ogrenci.aktifmi ? 'Aktif' : 'Pasif'
            ]);
        });

        const ogrencilerWorksheet = XLSX.utils.aoa_to_sheet(ogrencilerData);
        XLSX.utils.book_append_sheet(workbook, ogrencilerWorksheet, 'Öğrenciler');

        // 3. BORC
        if (borcluOgrenciler.length > 0) {
            const borcluOgrencilerData: any[][] = [
                ['BORÇLU ÖĞRENCİLER'],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['Ad Soyad', 'Toplam Ders Ücreti', 'Toplam Ödeme', 'Kalan Borç']
            ];

            borcluOgrenciler.forEach(ogrenci => {
                borcluOgrencilerData.push([
                    `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`,
                    ogrenci.toplamDersUcreti,
                    ogrenci.toplamOdeme,
                    ogrenci.kalanBorc
                ]);
            });

            const borcluWorksheet = XLSX.utils.aoa_to_sheet(borcluOgrencilerData);
            XLSX.utils.book_append_sheet(workbook, borcluWorksheet, 'Borçlu Öğrenciler');
        }

        const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const dosyaAdi = `ozdeta_rapor_${baslangicStr}_${bitisStr}_${detayliTarihFormatla()}.xlsx`;

        const result = await akilliDosyaKaydet(
            dosyaAdi,
            excelBuffer,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        return result;
    } catch (error: any) {
        console.error('Excel rapor hatası:', error);
        return { success: false, error: error.message };
    }
};

export const veritabaniDbYedekle = async () => {
    try {
        const dbName = 'ozdeta.db';
        // @ts-ignore
        const sourceDbPath = FileSystem.documentDirectory + 'SQLite/' + dbName;
        const yedekDosyaAdi = `ozdeta_veritabani_${detayliTarihFormatla()}.db`;

        const dbInfo = await FileSystem.getInfoAsync(sourceDbPath);
        if (!dbInfo.exists) {
            throw new Error('Veritabanı dosyası bulunamadı');
        }

        const dbContent = await FileSystem.readAsStringAsync(sourceDbPath, {
            encoding: 'base64'
        });

        const result = await dosyayiDirektKaydet(
            yedekDosyaAdi,
            dbContent,
            'application/x-sqlite3'
        );

        return result;
    } catch (error: any) {
        console.error('Veritabanı yedekleme hatası:', error);
        return { success: false, error: error.message };
    }
};

export const dbYedekGeriYukle = async () => {
    try {
        const result = await DocumentPicker.getDocumentAsync({
            type: ['application/x-sqlite3', 'application/octet-stream', '*/*'],
            copyToCacheDirectory: true
        });

        if (result.canceled) return { success: false, canceled: true };

        const fileUri = result.assets[0].uri;
        const dbName = 'ozdeta.db';
        // @ts-ignore
        const targetDbPath = FileSystem.documentDirectory + 'SQLite/' + dbName;

        try {
            const guvenlikYedekAdi = `guvenlik_yedek_${detayliTarihFormatla()}.db`;
            // @ts-ignore
            const guvenlikYedekYolu = FileSystem.cacheDirectory + guvenlikYedekAdi;

            await FileSystem.copyAsync({
                from: targetDbPath,
                to: guvenlikYedekYolu
            });
        } catch (backupError) {
            console.warn('Güvenlik yedeği alınamadı:', backupError);
        }

        await FileSystem.copyAsync({
            from: fileUri,
            to: targetDbPath
        });

        return { success: true };
    } catch (error: any) {
        console.error('Geri yükleme hatası:', error);
        return { success: false, error: error.message };
    }
};
