// Ayarlar.js - DÜZELTİLMİŞ VERSİYON

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    FlatList,
    Modal,
    ActivityIndicator,
    Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

// Veritabanı fonksiyonları
import {
    ogrencileriListele,
    ogrencininOdemeleri,
    tumYapilanDersler,
    tumOdemeleriGetir,
    veritabaniTemizle
} from '../utils/database';
import { getSetting, saveSetting } from '../database/settingsOperations';

export default function Ayarlar() {
    const navigation = useNavigation<any>();

    // State tanımlamaları
    const [ogrenciler, setOgrenciler] = useState<any[]>([]);
    const [borcluOgrenciler, setBorcluOgrenciler] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [raporModalAcik, setRaporModalAcik] = useState(false);
    const [borcListesiAcik, setBorcListesiAcik] = useState(false);
    const [baslangicTarihi, setBaslangicTarihi] = useState(new Date());
    const [bitisTarihi, setBitisTarihi] = useState(new Date());
    const [baslangicPickerAcik, setBaslangicPickerAcik] = useState(false);
    const [bitisPickerAcik, setBitisPickerAcik] = useState(false);

    // Veritabanı temizleme state'leri
    const [temizlikModalAcik, setTemizlikModalAcik] = useState(false);
    const [temizlikTarihi, setTemizlikTarihi] = useState(new Date());
    const [temizlikPickerAcik, setTemizlikPickerAcik] = useState(false);
    const [seciliTablolar, setSeciliTablolar] = useState<any>({
        ogrenciler: false,
        dersler: true,
        odemeler: true,
        odevler: true,
        notlarim: true,
        ajanda: true
    });
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        borcluOgrencileriHesapla();
        premiumDurumuYukle();
    }, []);

    const premiumDurumuYukle = async () => {
        const status = await getSetting('is_premium', 'false');
        setIsPremium(status === 'true');
    };

    const satinAl = async () => {
        Alert.alert(
            'Satın Al',
            'Tam sürümü satın almak istiyor musunuz? (Bu bir simülasyondur)',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Evet, Satın Al',
                    onPress: async () => {
                        const success = await saveSetting('is_premium', 'true');
                        if (success) {
                            setIsPremium(true);
                            Alert.alert('Başarılı', 'Uygulama başarıyla tam sürüme yükseltildi!');
                        }
                    }
                }
            ]
        );
    };

    /**
     * Detaylı tarih formatı oluşturma
     */
    const detayliTarihFormatla = () => {
        const now = new Date();
        const tarih = now.toISOString().split('T')[0];
        const saat = now.getHours().toString().padStart(2, '0');
        const dakika = now.getMinutes().toString().padStart(2, '0');
        const saniye = now.getSeconds().toString().padStart(2, '0');

        return `${tarih}_${saat}-${dakika}-${saniye}`;
    };

    /**
     * Downloads/ozdeta klasörünü oluşturma - DÜZELTİLDİ
     */
    const ozdetaKlasoruKontrolEt = async () => {
        try {
            // Android için documentDirectory kullan (Downloads'a doğrudan yazma izni yok)
            // @ts-ignore - expo-file-system documentDirectory
            const ozdetaKlasor = (FileSystem.documentDirectory ?? '') + 'ozdeta/';
            console.log("klayıt klasoru:" + ozdetaKlasor);
            // Klasör var mı kontrol et
            const dirInfo = await FileSystem.getInfoAsync(ozdetaKlasor);

            if (!dirInfo.exists) {
                // Klasör yoksa oluştur
                await FileSystem.makeDirectoryAsync(ozdetaKlasor, { intermediates: true });
                console.log('Ozdeta klasörü oluşturuldu:', ozdetaKlasor);
            }

            return ozdetaKlasor;
        } catch (error) {
            console.error('Klasör oluşturma hatası:', error);
            // @ts-ignore - expo-file-system documentDirectory
            return FileSystem.documentDirectory ?? '';
        }
    };

    /**
     * Dosyayı doğrudan uygulama klasörüne kaydet - DÜZELTİLDİ
     */
    const dosyayiDirektKaydet = async (dosyaAdi: string, icerik: string, mimeType = 'application/octet-stream') => {
        try {
            // Ozdeta klasörünü kontrol et ve oluştur
            const ozdetaKlasor = await ozdetaKlasoruKontrolEt();

            // Dosya yolunu oluştur
            const dosyaYolu = ozdetaKlasor + dosyaAdi;

            // Dosya türüne göre encoding belirle
            if (mimeType.includes('sheet') || mimeType.includes('sqlite')) {
                // Excel ve SQLite dosyaları için base64 encoding
                await FileSystem.writeAsStringAsync(dosyaYolu, icerik, {
                    // @ts-ignore - expo-file-system EncodingType
                    encoding: FileSystem.EncodingType.Base64
                });
            } else {
                // Diğer dosyalar için normal yazma
                await FileSystem.writeAsStringAsync(dosyaYolu, icerik);
            }

            // Başarılı sonucu döndür
            return {
                success: true,
                dosyaYolu: dosyaYolu,
                dosyaAdi: dosyaAdi,
                message: `Dosya başarıyla kaydedildi: ${dosyaAdi}`
            };

        } catch (error) {
            console.error('Dosya kaydetme hatası:', error);
            return {
                success: false,
                error: (error as any).message
            };
        }
    };
    /**
     * AKILLI DOSYA KAYDETME FONKSİYONU
     * Sharing üzerinden paylaşım yapar
     */
    const akilliDosyaKaydet = async (dosyaAdi: string, icerik: string, mimeType = 'application/octet-stream') => {
        try {
            // @ts-ignore - expo-file-system cacheDirectory
            const cacheKlasor = (FileSystem.cacheDirectory ?? '') + 'ozdeta/';
            const dirInfo = await FileSystem.getInfoAsync(cacheKlasor);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(cacheKlasor, { intermediates: true });
            }

            const geciciDosyaYolu = cacheKlasor + dosyaAdi;

            if (mimeType.includes('sheet') || mimeType.includes('sqlite')) {
                await FileSystem.writeAsStringAsync(geciciDosyaYolu, icerik, {
                    // @ts-ignore - expo-file-system EncodingType
                    encoding: FileSystem.EncodingType.Base64
                });
            } else {
                await FileSystem.writeAsStringAsync(geciciDosyaYolu, icerik);
            }

            // 2. SHARING API (her platform için paylaşım menüsünü açar)
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(geciciDosyaYolu, {
                    mimeType: mimeType,
                    dialogTitle: `Dosyayı Kaydet: ${dosyaAdi}`,
                    UTI: mimeType
                });

                return {
                    success: true,
                    dosyaYolu: geciciDosyaYolu,
                    dosyaAdi: dosyaAdi,
                    message: `Dosya işlemi başlatıldı. Lütfen kaydetmek istediğiniz konumu seçin.`
                };
            }

            // 3. SON ÇARE: Cache'de bırak
            return {
                success: true,
                dosyaYolu: geciciDosyaYolu,
                dosyaAdi: dosyaAdi,
                message: `Dosya oluşturuldu: ${dosyaAdi}. Uygulama önbelleğine kaydedildi.`
            };

        } catch (error) {
            console.error('Dosya kaydetme hatası:', error);
            return {
                success: false,
                error: (error as any).message
            };
        }
    };
    /**
     * Borçlu öğrencileri hesaplama fonksiyonu
     */
    const borcluOgrencileriHesapla = async () => {
        try {
            setLoading(true);
            const ogrenciResult = await ogrencileriListele(false);
            if (!ogrenciResult.success) return;

            const tumOgrenciler = ogrenciResult.data ?? [];
            const borcluListe = [];

            for (const ogrenci of tumOgrenciler) {
                const { odemeler, dersler } = await ogrencininOdemeleri(ogrenci.ogrenciId!);

                const toplamDersUcreti = dersler.reduce((toplam, ders) => {
                    return toplam + (parseInt(ders.ucret) || 0);
                }, 0);

                const toplamOdeme = odemeler.reduce((toplam, odeme) => {
                    return toplam + (parseInt(odeme.alinanucret) || 0);
                }, 0);

                const kalanBorc = toplamDersUcreti - toplamOdeme;

                if (kalanBorc > 0) {
                    borcluListe.push({
                        ...ogrenci,
                        toplamDersUcreti,
                        toplamOdeme,
                        kalanBorc
                    });
                }
            }

            borcluListe.sort((a, b) => b.kalanBorc - a.kalanBorc);
            setBorcluOgrenciler(borcluListe);

        } catch (error) {
            console.error('Borç hesaplama hatası:', error);
            Alert.alert('Hata', 'Borç hesaplaması yapılamadı');
        } finally {
            setLoading(false);
        }
    };

    /**
     * SQLite veritabanını .db dosyası olarak yedekleme - DÜZELTİLDİ
     */
    const veritabaniDbYedekle = async () => {
        try {
            setLoading(true);

            Alert.alert(
                'Veritabanı Yedekle',
                'SQLite veritabanı .db dosyası olarak yedeklenecek. Devam edilsin mi?',
                [
                    { text: 'İptal', style: 'cancel' },
                    {
                        text: 'Evet',
                        onPress: async () => {
                            try {
                                // SQLite veritabanı dosya yolu
                                const dbName = 'ozdeta.db';
                                // @ts-ignore - expo-file-system documentDirectory
                                const sourceDbPath = FileSystem.documentDirectory + 'SQLite/' + dbName;

                                // Yedek dosya adı
                                const yedekDosyaAdi = `ozdeta_veritabani_${detayliTarihFormatla()}.db`;

                                // Veritabanı dosyasını kontrol et
                                const dbInfo = await FileSystem.getInfoAsync(sourceDbPath);
                                if (!dbInfo.exists) {
                                    Alert.alert('Hata', 'Veritabanı dosyası bulunamadı');
                                    return;
                                }

                                const dbContent = await FileSystem.readAsStringAsync(sourceDbPath, {
                                    encoding: 'base64' as any
                                });

                                // Doğrudan uygulama klasörüne kaydet
                                const result = await dosyayiDirektKaydet(
                                    yedekDosyaAdi,
                                    dbContent,
                                    'application/x-sqlite3'
                                );

                                if (result.success) {
                                    // Kaydetme başarılı, paylaşım seçeneği sun
                                    Alert.alert(
                                        'Yedekleme Başarılı',
                                        result.message,
                                        [
                                            {
                                                text: 'Tamam',
                                                onPress: () => console.log('Yedekleme tamamlandı')
                                            },
                                            {
                                                text: 'Paylaş',
                                                onPress: async () => {
                                                    if (await Sharing.isAvailableAsync()) {
                                                        await Sharing.shareAsync(result.dosyaYolu!, {
                                                            mimeType: 'application/x-sqlite3',
                                                            dialogTitle: 'Veritabanı Yedek Dosyası'
                                                        });
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                } else {
                                    Alert.alert('Hata', result.error || 'Dosya kaydedilemedi');
                                }

                            } catch (error) {
                                console.error('Veritabanı yedekleme hatası:', error);
                                Alert.alert('Hata', 'Veritabanı yedekleme işlemi başarısız oldu: ' + (error as any).message);
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Yedekleme hazırlık hatası:', error);
            Alert.alert('Hata', 'Yedekleme başlatılamadı');
            setLoading(false);
        }
    };

    /**
     * Veritabanı geri yükleme fonksiyonu
     */
    const dbYedekGeriYukle = async () => {
        try {
            Alert.alert(
                'Veritabanı Geri Yükle',
                'DİKKAT: Bu işlem mevcut veritabanını tamamen silecek ve seçilen yedek dosyası ile değiştirecektir. Tüm mevcut veriler kaybolacaktır. Devam edilsin mi?',
                [
                    { text: 'İptal', style: 'cancel' },
                    {
                        text: 'Evet, Geri Yükle',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                setLoading(true);

                                // .db dosyasını seçtir
                                const result = await DocumentPicker.getDocumentAsync({
                                    type: ['application/x-sqlite3', 'application/octet-stream'],
                                    copyToCacheDirectory: true
                                });

                                if (result.canceled) {
                                    setLoading(false);
                                    return;
                                }

                                const fileUri = result.assets?.[0]?.uri;

                                // Hedef veritabanı yolunu belirle
                                const dbName = 'ozdeta.db';
                                // @ts-ignore - expo-file-system documentDirectory
                                const targetDbPath = FileSystem.documentDirectory + 'SQLite/' + dbName;

                                // Güvenlik yedeği alma
                                try {
                                    const guvenlikYedekAdi = `guvenlik_yedek_${detayliTarihFormatla()}.db`;
                                    // @ts-ignore - expo-file-system cacheDirectory
                                    const guvenlikYedekYolu = FileSystem.cacheDirectory + guvenlikYedekAdi;

                                    await FileSystem.copyAsync({
                                        from: targetDbPath,
                                        to: guvenlikYedekYolu
                                    });
                                } catch (backupError) {
                                    console.warn('Güvenlik yedeği alınamadı:', backupError);
                                }

                                await FileSystem.copyAsync({
                                    from: fileUri ?? '',
                                    to: targetDbPath
                                });

                                Alert.alert(
                                    'Geri Yükleme Başarılı',
                                    'Veritabanı başarıyla geri yüklendi. Değişikliklerin etkili olması için uygulamayı yeniden başlatmanız önerilir.'
                                );

                                borcluOgrencileriHesapla();

                            } catch (error) {
                                console.error('Geri yükleme hatası:', error);
                                Alert.alert('Hata', 'Geri yükleme işlemi başarısız oldu: ' + (error as any).message);
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Geri yükleme hazırlık hatası:', error);
            Alert.alert('Hata', 'Geri yükleme başlatılamadı');
        }
    };

    /**
     * Excel raporu oluşturma fonksiyonu - DÜZELTİLDİ
     */
    const excelRaporOlustur = async () => {
        try {
            setLoading(true);

            const baslangicStr = baslangicTarihi.toISOString().split('T')[0];
            const bitisStr = bitisTarihi.toISOString().split('T')[0];

            const derslerResult = await tumYapilanDersler();
            const ogrencilerResult = await ogrencileriListele(true);
            const odemelerResult = await tumOdemeleriGetir();

            if (!derslerResult.success || !ogrencilerResult.success || !odemelerResult.success) {
                Alert.alert('Hata', 'Veriler alınamadı');
                return;
            }

            const tumDersler = derslerResult.yapilanDersler || [];
            const tumOgrenciler = ogrencilerResult.data || [];
            const tumOdemeler = odemelerResult.odemeler || [];

            // Tarih aralığına göre dersleri filtrele
            const filtreliDersler = tumDersler.filter(ders => {
                const dersTarihi = new Date(ders.tarih);
                const baslangic = new Date(baslangicStr);
                const bitis = new Date(bitisStr);
                return dersTarihi >= baslangic && dersTarihi <= bitis;
            });

            // Tarih aralığına göre ödemeleri filtrele
            const filtreliOdemeler = tumOdemeler.filter(odeme => {
                const odemeTarihi = new Date(odeme.odemetarih);
                const baslangic = new Date(baslangicStr);
                const bitis = new Date(bitisStr);
                return odemeTarihi >= baslangic && odemeTarihi <= bitis;
            });

            // Excel Workbook oluştur
            const workbook = XLSX.utils.book_new();

            // DERSLER sayfası
            const derslerData: any[][] = [
                ['DERS RAPORU'],
                [`Tarih Aralığı: ${baslangicStr} - ${bitisStr}`],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['Tarih', 'Öğrenci', 'Konu', 'Ücret (TL)']
            ];

            let toplamDersUcreti = 0;
            filtreliDersler.forEach(ders => {
                derslerData.push([
                    ders.tarih,
                    ders.ogrenciAdSoyad || 'Belirtilmemiş',
                    ders.konu || '-',
                    parseInt(String(ders.ucret)) || 0
                ]);
                toplamDersUcreti += parseInt(ders.ucret) || 0;
            });

            derslerData.push(['', '', 'TOPLAM DERS ÜCRETİ:', toplamDersUcreti + ' TL']);

            const derslerWorksheet = XLSX.utils.aoa_to_sheet(derslerData);
            XLSX.utils.book_append_sheet(workbook, derslerWorksheet, 'Dersler');

            // ÖĞRENCİLER sayfası
            const ogrencilerData: any[][] = [
                ['ÖĞRENCİ BİLGİLERİ'],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['Ad Soyad', 'Telefon', 'Okul', 'Ders Ücreti', 'Durum']
            ];

            tumOgrenciler.forEach(ogrenci => {
                const durum = ogrenci.aktifmi ? 'Aktif' : 'Pasif';
                ogrencilerData.push([
                    `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`,
                    ogrenci.ogrenciTel || '-',
                    ogrenci.okul || '-',
                    parseInt(String(ogrenci.ucret)) || 0,
                    durum
                ]);
            });

            const ogrencilerWorksheet = XLSX.utils.aoa_to_sheet(ogrencilerData);
            XLSX.utils.book_append_sheet(workbook, ogrencilerWorksheet, 'Öğrenciler');

            // BORÇLU ÖĞRENCİLER sayfası (sadece borçlu öğrenciler varsa)
            if (borcluOgrenciler.length > 0) {
                const borcluOgrencilerData: any[][] = [
                    ['ÖĞRENCİLER'],
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
                XLSX.utils.book_append_sheet(workbook, borcluWorksheet, 'Öğrenciler');
            }

            // ÖDEMELER sayfası
            const odemelerData: any[][] = [
                ['ÖDEME RAPORU'],
                [`Tarih Aralığı: ${baslangicStr} - ${bitisStr}`],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['Tarih', 'Öğrenci', 'Tür', 'Açıklama', 'Miktar (TL)']
            ];

            let toplamGelenOdeme = 0;
            filtreliOdemeler.forEach(odeme => {
                odemelerData.push([
                    odeme.odemetarih,
                    odeme.ogrenciAdSoyad || 'Belirtilmemiş',
                    odeme.odemeturu || '-',
                    odeme.aciklama || '-',
                    parseInt(String(odeme.alinanucret)) || 0
                ]);
                toplamGelenOdeme += parseInt(String(odeme.alinanucret)) || 0;
            });

            odemelerData.push(['', '', '', 'TOPLAM GELEN ÖDEME:', toplamGelenOdeme + ' TL']);

            const odemelerWorksheet = XLSX.utils.aoa_to_sheet(odemelerData);
            XLSX.utils.book_append_sheet(workbook, odemelerWorksheet, 'Ödemeler');

            // Excel dosyasını base64 formatında oluştur
            const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

            // Dosya adını oluştur
            const dosyaAdi = `ozdeta_rapor_${baslangicStr}_${bitisStr}_${detayliTarihFormatla()}.xlsx`;

            // Doğrudan uygulama klasörüne kaydet
            const result = await akilliDosyaKaydet(
                dosyaAdi,
                excelBuffer,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );

            if (result.success) {
                // Kaydetme başarılı, paylaşım seçeneği sun
                Alert.alert(
                    'Excel Raporu Oluşturuldu',
                    result.message,
                    [
                        {
                            text: 'Tamam',
                            onPress: () => console.log('Rapor oluşturma tamamlandı')
                        },
                        {
                            text: 'Paylaş',
                            onPress: async () => {
                                if (await Sharing.isAvailableAsync()) {
                                    // Ensure result.dosyaYolu is not null/undefined before sharing
                                    if (result.dosyaYolu) {
                                        await Sharing.shareAsync(result.dosyaYolu, {
                                            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                            dialogTitle: 'Özdeta Excel Raporu'
                                        });
                                    } else {
                                        Alert.alert('Hata', 'Paylaşılacak dosya yolu bulunamadı.');
                                    }
                                } else {
                                    Alert.alert('Hata', 'Paylaşım özelliği bu cihazda kullanılamıyor.');
                                }
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Hata', result.error || 'Excel raporu kaydedilemedi');
            }

            setRaporModalAcik(false);

        } catch (error) {
            console.error('Excel rapor hatası:', error);
            Alert.alert('Hata', 'Excel raporu oluşturulamadı: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Veritabanı temizleme işlemi
     */
    const veritabaniniTemizleIslemi = async () => {
        try {
            const secilenler = Object.entries(seciliTablolar)
                .filter(([_, value]) => value)
                .map(([key, _]) => key);

            if (secilenler.length === 0) {
                Alert.alert('Uyarı', 'Lütfen temizlenecek en az bir tablo seçin.');
                return;
            }

            Alert.alert(
                'DİKKAT: Veritabanı Temizleme',
                `${formatTarih(temizlikTarihi)} tarihinden önceki seçili veriler KALICI OLARAK silinecektir. Bu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?`,
                [
                    { text: 'İptal', style: 'cancel' },
                    {
                        text: 'Evet, Sil',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                setLoading(true);
                                const tarihStr = temizlikTarihi.toISOString().split('T')[0];
                                const result = await veritabaniTemizle(tarihStr, secilenler);

                                if (result.success) {
                                    Alert.alert('Başarılı', 'Seçilen veriler başarıyla temizlendi ve veritabanı optimize edildi.');
                                    setTemizlikModalAcik(false);
                                    borcluOgrencileriHesapla();
                                } else {
                                    Alert.alert('Hata', 'Temizleme işlemi sırasında bir hata oluştu: ' + result.error);
                                }
                            } catch (error) {
                                console.error('Temizleme hatası:', error);
                                Alert.alert('Hata', 'Bir hata oluştu.');
                            } finally {
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Temizleme hazırlık hatası:', error);
        }
    };

    const tabloSecimiDegistir = (tablo: string) => {
        setSeciliTablolar((prev: any) => ({
            ...prev,
            [tablo]: !prev[tablo]
        }));
    };

    /**
     * Tarih formatı düzenleme fonksiyonu
     */
    const formatTarih = (tarih: Date) => {
        return tarih.toLocaleDateString('tr-TR');
    };

    /**
     * Borçlu öğrenci listesi render fonksiyonu
     */
    const renderBorcluOgrenci = ({ item }: { item: any }) => (
        <View style={styles.borcItem}>
            <View style={styles.borcHeader}>
                <Text style={styles.borcOgrenciAd}>
                    {item.ogrenciAd} {item.ogrenciSoyad}
                </Text>
                <Text style={styles.borcMiktar}>
                    {item.kalanBorc} TL
                </Text>
            </View>
            {/* <View style={styles.borcDetay}>
                <Text style={styles.borcDetayText}>
                    Toplam Ders: {item.toplamDersUcreti} TL
                </Text>
                <Text style={styles.borcDetayText}>
                    Ödenen: {item.toplamOdeme} TL
                </Text>
            </View> */}
            <TouchableOpacity
                style={styles.borcOgrenciGitButon}
                onPress={() => {
                    setBorcListesiAcik(false);
                    (navigation as any).navigate('ogrenciDetay', { ogrenci: item });
                }}
            >
                <Text style={styles.borcOgrenciGitText}>Öğrenciye Git</Text>
            </TouchableOpacity>
        </View>
    );

    // Geri kalan JSX kodu aynı kalacak...
    return (
        <View style={styles.container}>
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text style={styles.loadingText}>İşlem yapılıyor...</Text>
                </View>
            )}

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <MaterialIcons name="settings" size={32} color="#2196F3" />
                    <Text style={styles.headerTitle}>Ayarlar</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Veritabanı Yönetimi</Text>

                    <TouchableOpacity
                        style={styles.ayarItem}
                        onPress={veritabaniDbYedekle}
                    >
                        <MaterialIcons name="backup" size={24} color="#4CAF50" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Veritabanını Yedekle (.db)</Text>
                            <Text style={styles.ayarAciklama}>
                                SQLite veritabanını .db dosyası olarak uygulama klasörüne kaydet
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.ayarItem}
                        onPress={dbYedekGeriYukle}
                    >
                        <MaterialIcons name="restore" size={24} color="#FF9800" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Veritabanını Geri Yükle</Text>
                            <Text style={styles.ayarAciklama}>
                                .db yedek dosyasını geri yükle (tüm veriler değişir)
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.ayarItem}
                        onPress={() => setTemizlikModalAcik(true)}
                    >
                        <MaterialIcons name="delete-sweep" size={24} color="#F44336" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Veritabanını Temizle (Hafiflet)</Text>
                            <Text style={styles.ayarAciklama}>
                                Seçilen bir tarihten önceki verileri silerek dosya boyutunu küçült
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Raporlar</Text>

                    <TouchableOpacity
                        style={styles.ayarItem}
                        onPress={() => setRaporModalAcik(true)}
                    >
                        <MaterialIcons name="assessment" size={24} color="#2196F3" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Excel Raporu Oluştur (.xlsx)</Text>
                            <Text style={styles.ayarAciklama}>
                                Ders, öğrenci ve borç raporunu Excel formatında oluştur
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Finansal Takip</Text>

                    <TouchableOpacity
                        style={styles.ayarItem}
                        onPress={() => setBorcListesiAcik(true)}
                    >
                        <MaterialIcons name="account-balance-wallet" size={24} color="#F44336" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Borçlu Öğrenci Listesi</Text>
                            <Text style={styles.ayarAciklama}>
                                Kalan ücretleri olan öğrencilerin listesi ({borcluOgrenciler.length} öğrenci)
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Uygulama Versiyonu</Text>

                    <View style={styles.ayarItem}>
                        <MaterialIcons
                            name={isPremium ? "verified" : "hourglass-empty"}
                            size={24}
                            color={isPremium ? "#4CAF50" : "#FF9800"}
                        />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>
                                {isPremium ? "Normal Versiyon (Sınırsız)" : "Trial Versiyon (Limitli)"}
                            </Text>
                            <Text style={styles.ayarAciklama}>
                                {isPremium
                                    ? "Tüm özellikler açık ve sınırsız öğrenci ekleyebilirsiniz."
                                    : "Şu an 3 öğrenci limiti bulunmaktadır."}
                            </Text>
                        </View>
                    </View>

                    {!isPremium && (
                        <TouchableOpacity
                            style={[styles.ayarItem, { backgroundColor: '#E3F2FD', borderLeftWidth: 4, borderLeftColor: '#2196F3' }]}
                            onPress={satinAl}
                        >
                            <MaterialIcons name="shopping-cart" size={24} color="#2196F3" />
                            <View style={styles.ayarText}>
                                <Text style={[styles.ayarBaslik, { color: '#1565C0' }]}>Tam Sürüme Yükselt</Text>
                                <Text style={styles.ayarAciklama}>
                                    Öğrenci limitini kaldırın ve tüm özellikleri süresiz kullanın.
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Hakkında</Text>

                    <View style={styles.bilgiItem}>
                        <MaterialIcons name="person" size={24} color="#9E9E9E" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Geliştirici</Text>
                            <Text style={styles.ayarAciklama}>
                                created By Mehmet Gündöner {'\n'}
                                gundoner@yahoo.com
                            </Text>
                        </View>
                    </View>

                    <View style={styles.bilgiItem}>
                        <MaterialIcons name="info" size={24} color="#9E9E9E" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Sürüm Bilgisi</Text>
                            <Text style={styles.ayarAciklama}>
                                Özdeta Öğretmen Takip Uygulaması v1.1
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Modal ve diğer JSX kodları aynı kalacak... */}
            <Modal
                visible={raporModalAcik}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setRaporModalAcik(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Excel Raporu Oluştur</Text>
                            <TouchableOpacity onPress={() => setRaporModalAcik(false)}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.modalAciklama}>
                                Rapor için tarih aralığını seçiniz:
                            </Text>

                            <View style={styles.tarihContainer}>
                                <Text style={styles.tarihLabel}>Başlangıç Tarihi:</Text>
                                <TouchableOpacity
                                    style={styles.tarihButton}
                                    onPress={() => setBaslangicPickerAcik(true)}
                                >
                                    <MaterialIcons name="date-range" size={20} color="#666" />
                                    <Text style={styles.tarihText}>
                                        {formatTarih(baslangicTarihi)}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.tarihContainer}>
                                <Text style={styles.tarihLabel}>Bitiş Tarihi:</Text>
                                <TouchableOpacity
                                    style={styles.tarihButton}
                                    onPress={() => setBitisPickerAcik(true)}
                                >
                                    <MaterialIcons name="date-range" size={20} color="#666" />
                                    <Text style={styles.tarihText}>
                                        {formatTarih(bitisTarihi)}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.raporBilgi}>
                                • Excel raporu sayfaları: Dersler, Ödemeler, Öğrenciler, Borçlu Öğrenciler
                            </Text>
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setRaporModalAcik(false)}
                            >
                                <Text style={styles.cancelButtonText}>İptal</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.createButton]}
                                onPress={excelRaporOlustur}
                            >
                                <Text style={styles.createButtonText}>Excel Oluştur</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {baslangicPickerAcik && (
                    <DateTimePicker
                        value={baslangicTarihi}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                            setBaslangicPickerAcik(Platform.OS === 'ios');
                            if (selectedDate) {
                                setBaslangicTarihi(selectedDate);
                            }
                        }}
                    />
                )}

                {bitisPickerAcik && (
                    <DateTimePicker
                        value={bitisTarihi}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                            setBitisPickerAcik(Platform.OS === 'ios');
                            if (selectedDate) {
                                setBitisTarihi(selectedDate);
                            }
                        }}
                    />
                )}
            </Modal>

            {/* Veritabanı Temizleme Modalı */}
            <Modal
                visible={temizlikModalAcik}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setTemizlikModalAcik(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Veritabanını Temizle</Text>
                            <TouchableOpacity onPress={() => setTemizlikModalAcik(false)}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBodyScroll}>
                            <Text style={[styles.modalAciklama, { textAlign: 'left', marginBottom: 10 }]}>
                                Temizlenecek tarih sınırını seçin:
                            </Text>

                            <View style={styles.tarihContainer}>
                                <TouchableOpacity
                                    style={styles.tarihButton}
                                    onPress={() => setTemizlikPickerAcik(true)}
                                >
                                    <MaterialIcons name="date-range" size={20} color="#666" />
                                    <Text style={styles.tarihText}>
                                        {formatTarih(temizlikTarihi)}'den Öncekiler
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.modalAciklama, { textAlign: 'left', marginBottom: 10, marginTop: 10 }]}>
                                Silinecek tabloları seçin:
                            </Text>

                            <View style={styles.checkboxList}>
                                <TouchableOpacity style={styles.checkboxContainer} onPress={() => tabloSecimiDegistir('ogrenciler')}>
                                    <MaterialIcons
                                        name={seciliTablolar.ogrenciler ? "check-box" : "check-box-outline-blank"}
                                        size={24} color={seciliTablolar.ogrenciler ? "#F44336" : "#666"}
                                    />
                                    <Text style={styles.checkboxText}>Öğrenciler (Kayıt Tarihi)</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.checkboxContainer} onPress={() => tabloSecimiDegistir('dersler')}>
                                    <MaterialIcons
                                        name={seciliTablolar.dersler ? "check-box" : "check-box-outline-blank"}
                                        size={24} color={seciliTablolar.dersler ? "#2196F3" : "#666"}
                                    />
                                    <Text style={styles.checkboxText}>Dersler</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.checkboxContainer} onPress={() => tabloSecimiDegistir('odemeler')}>
                                    <MaterialIcons
                                        name={seciliTablolar.odemeler ? "check-box" : "check-box-outline-blank"}
                                        size={24} color={seciliTablolar.odemeler ? "#4CAF50" : "#666"}
                                    />
                                    <Text style={styles.checkboxText}>Ödemeler</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.checkboxContainer} onPress={() => tabloSecimiDegistir('odevler')}>
                                    <MaterialIcons
                                        name={seciliTablolar.odevler ? "check-box" : "check-box-outline-blank"}
                                        size={24} color={seciliTablolar.odevler ? "#FF9800" : "#666"}
                                    />
                                    <Text style={styles.checkboxText}>Ödevler</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.checkboxContainer} onPress={() => tabloSecimiDegistir('notlarim')}>
                                    <MaterialIcons
                                        name={seciliTablolar.notlarim ? "check-box" : "check-box-outline-blank"}
                                        size={24} color={seciliTablolar.notlarim ? "#9C27B0" : "#666"}
                                    />
                                    <Text style={styles.checkboxText}>Notlarım</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.checkboxContainer} onPress={() => tabloSecimiDegistir('ajanda')}>
                                    <MaterialIcons
                                        name={seciliTablolar.ajanda ? "check-box" : "check-box-outline-blank"}
                                        size={24} color={seciliTablolar.ajanda ? "#795548" : "#666"}
                                    />
                                    <Text style={styles.checkboxText}>Ajanda Kayıtları</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.uyariBox}>
                                <MaterialIcons name="warning" size={20} color="#F44336" />
                                <Text style={styles.uyariText}>
                                    NOT: Öğrenciler seçilirse, silinen öğrencilere ait tüm veriler (tarihinden bağımsız olarak) temizlenir.
                                </Text>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setTemizlikModalAcik(false)}
                            >
                                <Text style={styles.cancelButtonText}>İptal</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: '#F44336' }]}
                                onPress={veritabaniniTemizleIslemi}
                            >
                                <Text style={styles.createButtonText}>Temizle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {temizlikPickerAcik && (
                        <DateTimePicker
                            value={temizlikTarihi}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, selectedDate) => {
                                setTemizlikPickerAcik(Platform.OS === 'ios');
                                if (selectedDate) {
                                    setTemizlikTarihi(selectedDate);
                                }
                            }}
                        />
                    )}
                </View>
            </Modal>

            <Modal
                visible={borcListesiAcik}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setBorcListesiAcik(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, styles.borcModalContent]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Borçlu Öğrenciler ({borcluOgrenciler.length})
                            </Text>
                            <TouchableOpacity onPress={() => setBorcListesiAcik(false)}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {borcluOgrenciler.length > 0 ? (
                            <FlatList
                                data={borcluOgrenciler}
                                renderItem={renderBorcluOgrenci}
                                keyExtractor={item => item.ogrenciId.toString()}
                                style={styles.borcListe}
                                showsVerticalScrollIndicator={false}
                            />
                        ) : (
                            <View style={styles.borcBosListe}>
                                <MaterialIcons name="account-balance-wallet" size={48} color="#ddd" />
                                <Text style={styles.borcBosText}>
                                    Harika! Hiçbir öğrencinin borcu bulunmuyor.
                                </Text>
                            </View>
                        )}

                        {borcluOgrenciler.length > 0 && (
                            <View style={styles.borcToplamFooter}>
                                <Text style={styles.borcToplamLabel}>Toplam Alacak:</Text>
                                <Text style={styles.borcToplamMiktar}>
                                    {borcluOgrenciler.reduce((toplam, item) => toplam + (parseFloat(item.kalanBorc) || 0), 0)} TL
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// Stil tanımlamaları aynı kalacak...
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingTop: 16,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingText: {
        color: 'white',
        marginTop: 10,
        fontSize: 16,
    },
    scrollView: {
        flex: 1,
        paddingBottom: 80,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'white',
        marginBottom: 10,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginLeft: 10,
    },
    section: {
        backgroundColor: 'white',
        marginHorizontal: 15,
        marginBottom: 15,
        borderRadius: 10,
        padding: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
        paddingBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    ayarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 5,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#f8f9fa',
    },
    ayarText: {
        flex: 1,
        marginLeft: 15,
    },
    ayarBaslik: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    ayarAciklama: {
        fontSize: 14,
        color: '#666',
        lineHeight: 18,
    },
    bilgiItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 15,
        width: '90%',
        maxHeight: '80%',
        elevation: 10,
    },
    borcModalContent: {
        height: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    modalBody: {
        padding: 20,
    },
    modalAciklama: {
        fontSize: 16,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center',
    },
    raporBilgi: {
        fontSize: 14,
        color: '#666',
        marginTop: 10,
        fontStyle: 'italic',
    },
    tarihContainer: {
        marginBottom: 15,
    },
    tarihLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    tarihButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#f8f9fa',
    },
    tarihText: {
        marginLeft: 10,
        fontSize: 16,
        color: '#333',
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '600',
        fontSize: 16,
    },
    createButton: {
        backgroundColor: '#2196F3',
    },
    createButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    borcListe: {
        flex: 1,
        paddingHorizontal: 20,
    },
    borcItem: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#F44336',
        elevation: 1,
    },
    borcHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    borcOgrenciAd: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    borcMiktar: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#F44336',
    },
    borcDetay: {
        marginBottom: 10,
    },
    borcDetayText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    borcOgrenciGitButon: {
        backgroundColor: '#2196F3',
        padding: 8,
        borderRadius: 6,
        alignItems: 'center',
    },
    borcOgrenciGitText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    borcBosListe: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    borcBosText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 10,
        fontWeight: '500',
    },
    borcToplamFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderTopWidth: 2,
        borderTopColor: '#f0f0f0',
        backgroundColor: '#fff9f9',
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
    },
    borcToplamLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    borcToplamMiktar: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#F44336',
    },
    modalBodyScroll: {
        maxHeight: 400,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    checkboxList: {
        marginBottom: 15,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    checkboxText: {
        marginLeft: 10,
        fontSize: 16,
        color: '#333',
    },
    uyariBox: {
        flexDirection: 'row',
        backgroundColor: '#FFF3E0',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
        alignItems: 'flex-start',
    },
    uyariText: {
        fontSize: 12,
        color: '#E65100',
        marginLeft: 8,
        flex: 1,
    },
});

// Güvenli kopyalama: kaynakın varlığını kontrol eder; Android content:// URI'leri için base64 yöntemi kullanır.
async function safeCopyFile(fromUri: string, toUri: string) {
    try {
        if (!fromUri || !toUri) throw new Error('Kaynak veya hedef yolu boş.');

        const isContentUri = Platform.OS === 'android' && fromUri.startsWith('content://');

        if (isContentUri) {
            // @ts-ignore - expo-file-system EncodingType
            const data = await FileSystem.readAsStringAsync(fromUri, { encoding: 'base64' });
            // @ts-ignore - expo-file-system EncodingType
            await FileSystem.writeAsStringAsync(toUri, data, { encoding: 'base64' });
            return { success: true, path: toUri };
        }

        const info = await FileSystem.getInfoAsync(fromUri, { size: false } as any);
        if (!info.exists) throw new Error('Kaynak dosya bulunamadı: ' + fromUri);

        const dir = toUri.substring(0, toUri.lastIndexOf('/'));
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

        await FileSystem.copyAsync({ from: fromUri, to: toUri });
        return { success: true, path: toUri };
    } catch (err: any) {
        console.error('safeCopyFile hata:', err);
        return { success: false, message: err.message || String(err) };
    }
}

// ozdetaklasorunukontrolet: uygulama için gerekli klasörü doküman dizininde oluşturur
async function ozdetaklasorunukontrolet() {
    try {
        // @ts-ignore - expo-file-system documentDirectory / cacheDirectory
        const base = FileSystem.documentDirectory || FileSystem.cacheDirectory;
        if (!base) throw new Error('Dosya sistemi dizini bulunamadı.');
        const target = `${base}ozdeta/`;
        const info = await FileSystem.getInfoAsync(target);
        if (!info.exists) {
            await FileSystem.makeDirectoryAsync(target, { intermediates: true });
        }
        return { success: true, path: target };
    } catch (err: any) {
        console.error('ozdetaklasorunukontrolet hata:', err);
        return { success: false, message: err.message || String(err) };
    }
}

// veritabaniyedekle: veritabanını güvenli şekilde yedekler
async function veritabaniyedekle(dbFileRelativePath: string, targetFileName?: string) {
    try {
        const folderRes = await ozdetaklasorunukontrolet();
        if (!folderRes.success) throw new Error(folderRes.message);

        const dest = `${folderRes.path}${targetFileName || 'veritabani_yedek.sqlite'}`;

        // Not: SQLite açık bağlantı sorunları uygulama mimarisine göre ele alınmalı.
        const copyResult = await safeCopyFile(dbFileRelativePath, dest);
        if (!copyResult.success) throw new Error(copyResult.message);

        return { success: true, path: dest };
    } catch (err: any) {
        console.error('veritabaniyedekle hata:', err);
        return { success: false, message: err.message || String(err) };
    }
}

// dosyayidirektkaydet: seçilen bir dosyayı doğrudan ozdeta klasörüne kaydeder
async function dosyayidirektkaydet(pickedDocument: any, targetFileName?: string) {
    try {
        if (!pickedDocument) throw new Error('Seçilen dosya yok.');
        const { uri, name } = pickedDocument;
        const folderRes = await ozdetaklasorunukontrolet();
        if (!folderRes.success) throw new Error(folderRes.message);

        const finalName = targetFileName || name || `dosya_${Date.now()}`;
        const dest = `${folderRes.path}${finalName}`;

        const copyResult = await safeCopyFile(uri, dest);
        if (!copyResult.success) throw new Error(copyResult.message);

        return { success: true, path: dest };
    } catch (err: any) {
        console.error('dosyayidirektkaydet hata:', err);
        return { success: false, message: err.message || String(err) };
    }
}
