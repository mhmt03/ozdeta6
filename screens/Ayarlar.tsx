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
    Platform,
    Switch,
    TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';

// Veritabanı fonksiyonları
import {
    ogrencileriListele,
    ogrencininOdemeleri,
    tumYapilanDersler,
    tumOdemeleriGetir,
    ensureDatabaseReady,
    veritabaniTemizle,
    getDersler,
    getOdemeler,
    ogrenciNotlari,
    closeDatabase,
    tumOdevleriGetir,
    tumKaynaklariGetir,
    ogrenciOdevleri,
    kaynakListesi,
    getTumKaynaklar
} from '../utils/database';
import { ogrenciAjandaGetir } from '../utils/ajandaDatabase';
import { getSetting, saveSetting } from '../database/settingsOperations';
import { rescheduleAllRandevuNotifications } from '../utils/notifications';

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

    // Öğrenci Excel Raporu state'leri
    const [ogrenciExcelModalAcik, setOgrenciExcelModalAcik] = useState(false);
    const [ogrenciListesi, setOgrenciListesi] = useState<any[]>([]);

    // Son Ödemeler state'leri
    const [sonOdemelerModalAcik, setSonOdemelerModalAcik] = useState(false);
    const [sonOdemeler, setSonOdemeler] = useState<any[]>([]);

    // Bildirim ayarları state'leri
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [notificationSound, setNotificationSound] = useState(true);
    const [notificationVibrate, setNotificationVibrate] = useState(true);
    const [dailySummaryEnabled, setDailySummaryEnabled] = useState(false);

    // Yedekleme ayarları state'leri
    const [yedekHatirlaticiAktif, setYedekHatirlaticiAktif] = useState(true);
    const [yedekHatirlaticiSiklik, setYedekHatirlaticiSiklik] = useState('14');

    useEffect(() => {
        borcluOgrencileriHesapla();
        loadNotificationSettings();
        loadBackupSettings();
    }, []);

    const loadBackupSettings = async () => {
        try {
            const enabledStr = await AsyncStorage.getItem('@backup_reminder_enabled');
            const intervalStr = await AsyncStorage.getItem('@backup_reminder_interval');
            if (enabledStr !== null) setYedekHatirlaticiAktif(enabledStr === 'true');
            if (intervalStr !== null) setYedekHatirlaticiSiklik(intervalStr);
        } catch (error) {
            console.error('Yedekleme ayarları yüklenemedi:', error);
        }
    };

    const saveBackupSetting = async (key: string, value: string) => {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (error) {
            console.error('Yedekleme ayarı kaydedilemedi:', error);
        }
    };

    const loadNotificationSettings = async () => {
        try {
            const enabled = await getSetting('notifications_enabled', '1');
            const sound = await getSetting('notification_sound', '1');
            const vibrate = await getSetting('notification_vibrate', '1');
            const daily = await getSetting('daily_summary', '0');

            setNotificationsEnabled(enabled === '1');
            setNotificationSound(sound === '1');
            setNotificationVibrate(vibrate === '1');
            setDailySummaryEnabled(daily === '1');
        } catch (error) {
            console.error('Bildirim ayarları yüklenemedi:', error);
        }
    };

    const requestNotificationPermission = async () => {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                Alert.alert(
                    'İzin Gerekli',
                    'Randevu bildirimlerini alabilmek için lütfen cihazınızın bildirim ayarlarına giderek Özdeta uygulamasına bildirim izni verin.',
                    [{ text: 'Tamam' }]
                );
                return false;
            }
            return true;
        } catch (error) {
            console.error('Bildirim izni alınırken hata:', error);
            return false;
        }
    };

    const toggleNotifications = async (val: boolean) => {
        if (val) {
            const granted = await requestNotificationPermission();
            if (!granted) {
                setNotificationsEnabled(false);
                await saveSetting('notifications_enabled', '0');
                await rescheduleAllRandevuNotifications();
                return;
            }
        }
        setNotificationsEnabled(val);
        await saveSetting('notifications_enabled', val ? '1' : '0');
        await rescheduleAllRandevuNotifications();
    };

    const toggleSound = async (val: boolean) => {
        setNotificationSound(val);
        await saveSetting('notification_sound', val ? '1' : '0');
        await rescheduleAllRandevuNotifications();
    };

    const toggleVibrate = async (val: boolean) => {
        setNotificationVibrate(val);
        await saveSetting('notification_vibrate', val ? '1' : '0');
        await rescheduleAllRandevuNotifications();
    };

    const toggleDailySummary = async (val: boolean) => {
        setDailySummaryEnabled(val);
        await saveSetting('daily_summary', val ? '1' : '0');
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
            // Klasör var mı kontrol et
            const dirInfo = await FileSystem.getInfoAsync(ozdetaKlasor);

            if (!dirInfo.exists) {
                // Klasör yoksa oluştur
                await FileSystem.makeDirectoryAsync(ozdetaKlasor, { intermediates: true });
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

    const yedekIsleminiBaslat = async (aksiyon: 'indir' | 'paylas') => {
        try {
            setLoading(true);
            console.log('Veritabanı bulundu, serializeAsync kullanılarak yedekleniyor...');

            const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                let base64 = '';
                const len = bytes.length;
                for (let i = 0; i < len; i += 3) {
                    const b1 = bytes[i];
                    const b2 = i + 1 < len ? bytes[i + 1] : 0;
                    const b3 = i + 2 < len ? bytes[i + 2] : 0;
                    
                    const enc1 = b1 >> 2;
                    const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
                    const enc3 = ((b2 & 15) << 2) | (b3 >> 6);
                    const enc4 = b3 & 63;
                    
                    base64 += chars[enc1] + chars[enc2] + 
                              (i + 1 < len ? chars[enc3] : '=') + 
                              (i + 2 < len ? chars[enc4] : '=');
                }
                return base64;
            };

            const db = await ensureDatabaseReady();
            // @ts-ignore - expo-sqlite serializeAsync function
            const dbUint8Array = await db.serializeAsync('main');
            
            const dbContent = uint8ArrayToBase64(dbUint8Array);
            const yedekDosyaAdi = `ozdeta_veritabani_${detayliTarihFormatla()}.db`;

            if (aksiyon === 'paylas') {
                const result = await akilliDosyaKaydet(yedekDosyaAdi, dbContent, 'application/x-sqlite3');
                if (result.success) {
                    Alert.alert('Başarılı', 'Dosya paylaşım menüsü açıldı.');
                } else {
                    Alert.alert('Hata', result.error || 'Dosya paylaşılamadı');
                }
            } else if (aksiyon === 'indir') {
                if (Platform.OS === 'android') {
                    try {
                        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                        if (permissions.granted) {
                            const directoryUri = permissions.directoryUri;
                            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                                directoryUri,
                                yedekDosyaAdi,
                                'application/x-sqlite3'
                            );
                            await FileSystem.writeAsStringAsync(fileUri, dbContent, {
                                // @ts-ignore
                                encoding: FileSystem.EncodingType.Base64
                            });
                            Alert.alert('Başarılı', 'Yedek dosyası seçtiğiniz klasöre kaydedildi.\nDosya yöneticinizden kolayca ulaşabilirsiniz.');
                        } else {
                            Alert.alert('İptal Edildi', 'Klasör seçilmediği için indirme işlemi iptal edildi.');
                        }
                    } catch (safError) {
                        console.error('SAF Error:', safError);
                        const result = await akilliDosyaKaydet(yedekDosyaAdi, dbContent, 'application/x-sqlite3');
                        if (result.success) {
                            Alert.alert('Bilgi', 'Klasöre kaydetme desteklenmediği için paylaşım menüsü açıldı.');
                        }
                    }
                } else {
                    const result = await akilliDosyaKaydet(yedekDosyaAdi, dbContent, 'application/x-sqlite3');
                    if (result.success) {
                        Alert.alert('Bilgi', 'Lütfen "Dosyalara Kaydet" seçeneğini kullanın.');
                    } else {
                        Alert.alert('Hata', result.error || 'Dosya kaydedilemedi');
                    }
                }
            }
        } catch (error) {
            console.error('Veritabanı yedekleme hatası:', error);
            Alert.alert('Hata', 'Veritabanı yedekleme işlemi başarısız oldu: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * SQLite veritabanını .db dosyası olarak yedekleme
     */
    const veritabaniDbYedekle = async () => {
        try {
            Alert.alert(
                'Veritabanı Yedekle',
                'Yedek dosyasını ne yapmak istersiniz?',
                [
                    { text: 'İptal', style: 'cancel' },
                    {
                        text: 'Cihaza İndir',
                        onPress: () => yedekIsleminiBaslat('indir')
                    },
                    {
                        text: 'Doğrudan Paylaş',
                        onPress: () => yedekIsleminiBaslat('paylas')
                    }
                ]
            );
        } catch (error) {
            console.error('Yedekleme hazırlık hatası:', error);
            Alert.alert('Hata', 'Yedekleme başlatılamadı');
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
                                const db = await ensureDatabaseReady();
                                let targetDbPath = db.databasePath;
                                
                                if (!targetDbPath.startsWith('file://') && targetDbPath.startsWith('/')) {
                                    targetDbPath = `file://${targetDbPath}`;
                                }

                                // Güvenlik yedeği alma (Expo Go okuma engelini aşmak için serializeAsync kullanıyoruz)
                                try {
                                    const guvenlikYedekAdi = `guvenlik_yedek_${detayliTarihFormatla()}.db`;
                                    // @ts-ignore
                                    const guvenlikYedekYolu = FileSystem.cacheDirectory + guvenlikYedekAdi;

                                    console.log('Güvenlik yedeği alınıyor...');
                                    const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
                                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                                        let base64 = '';
                                        const len = bytes.length;
                                        for (let i = 0; i < len; i += 3) {
                                            const b1 = bytes[i];
                                            const b2 = i + 1 < len ? bytes[i + 1] : 0;
                                            const b3 = i + 2 < len ? bytes[i + 2] : 0;
                                            const enc1 = b1 >> 2;
                                            const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
                                            const enc3 = ((b2 & 15) << 2) | (b3 >> 6);
                                            const enc4 = b3 & 63;
                                            base64 += chars[enc1] + chars[enc2] + (i + 1 < len ? chars[enc3] : '=') + (i + 2 < len ? chars[enc4] : '=');
                                        }
                                        return base64;
                                    };

                                    // @ts-ignore
                                    const dbUint8Array = await db.serializeAsync('main');
                                    const dbContent = uint8ArrayToBase64(dbUint8Array);
                                    
                                    await FileSystem.writeAsStringAsync(guvenlikYedekYolu, dbContent, {
                                        // @ts-ignore
                                        encoding: FileSystem.EncodingType.Base64
                                    });
                                    console.log('Güvenlik yedeği başarılı:', guvenlikYedekYolu);
                                } catch (backupError) {
                                    console.warn('Güvenlik yedeği alınamadı:', backupError);
                                }

                                // Geri yükleme işlemi
                                // Veritabanı bağlantısını kapat ki dosya kilitli (locked) olmasın
                                try {
                                    await closeDatabase();
                                } catch(e) {
                                    console.log('DB kapatılırken hata (önemsiz):', e);
                                }

                                console.log('Yeni veritabanı kopyalanıyor:', fileUri, '->', targetDbPath);
                                try {
                                    await FileSystem.copyAsync({
                                        from: fileUri ?? '',
                                        to: targetDbPath
                                    });
                                } catch (copyError) {
                                    console.error('copyAsync hatası:', copyError);
                                    throw new Error('Veritabanı kopyalanamadı.');
                                }

                                Alert.alert(
                                    'Geri Yükleme Başarılı',
                                    'Veritabanı başarıyla geri yüklendi. Değişikliklerin etkili olması için uygulamanın tamamen yeniden başlatılması gerekiyor. Lütfen uygulamayı kapatıp açın.',
                                    [{ text: 'Tamam', style: 'default' }]
                                );

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
            const odevlerResult = await tumOdevleriGetir();
            const kaynaklarResult = await tumKaynaklariGetir();
            const tumGlobalKaynaklarResult = await getTumKaynaklar();

            if (!derslerResult.success || !ogrencilerResult.success || !odemelerResult.success) {
                Alert.alert('Hata', 'Veriler alınamadı');
                return;
            }

            const tumDersler = derslerResult.yapilanDersler || [];
            const tumOgrenciler = ogrencilerResult.data || [];
            const tumOdemeler = odemelerResult.odemeler || [];
            const tumOdevler = odevlerResult.data || [];
            const tumKaynaklarAssigned = kaynaklarResult.data || [];
            const tumGlobalKaynaklar = tumGlobalKaynaklarResult.data || [];

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

            // Tarih aralığına göre ödevleri filtrele
            const filtreliOdevler = tumOdevler.filter((odev: any) => {
                if (!odev.verilmetarihi) return false;
                const odevTarihi = new Date(odev.verilmetarihi);
                const baslangic = new Date(baslangicStr);
                const bitis = new Date(bitisStr);
                return odevTarihi >= baslangic && odevTarihi <= bitis;
            });

            // Excel Workbook oluştur
            const workbook = XLSX.utils.book_new();

            // DERSLER sayfası
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
                    parseInt(String(ders.ucret)) || 0
                ]);
                toplamDersUcreti += parseInt(ders.ucret) || 0;
            });

            derslerData.push(['', '', '', 'TOPLAM DERS ÜCRETİ:', toplamDersUcreti + ' TL']);

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

            // ÖDEMELER sayfası
            const odemelerData: any[][] = [
                ['ÖDEME RAPORU'],
                [`Tarih Aralığı: ${baslangicStr} - ${bitisStr}`],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['Tarih', 'Saat', 'Öğrenci', 'Tür', 'Açıklama', 'Miktar (TL)']
            ];

            let toplamGelenOdeme = 0;
            filtreliOdemeler.forEach(odeme => {
                odemelerData.push([
                    odeme.odemetarih,
                    odeme.odemesaati || '-',
                    odeme.ogrenciAdSoyad || 'Belirtilmemiş',
                    odeme.odemeturu || '-',
                    odeme.aciklama || '-',
                    parseInt(String(odeme.alinanucret)) || 0
                ]);
                toplamGelenOdeme += parseInt(String(odeme.alinanucret)) || 0;
            });

            odemelerData.push(['', '', '', '', 'TOPLAM GELEN ÖDEME:', toplamGelenOdeme + ' TL']);

            const odemelerWorksheet = XLSX.utils.aoa_to_sheet(odemelerData);
            XLSX.utils.book_append_sheet(workbook, odemelerWorksheet, 'Ödemeler');

            // ÖDEVLER sayfası
            const odevlerData: any[][] = [
                ['ÖDEV RAPORU'],
                [`Tarih Aralığı: ${baslangicStr} - ${bitisStr}`],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['Tarih', 'Öğrenci', 'Kaynak', 'Ödev/Konu', 'Durum', 'Teslim Tarihi']
            ];

            filtreliOdevler.forEach((odev: any) => {
                odevlerData.push([
                    odev.verilmetarihi || '-',
                    odev.ogrenciAdSoyad || 'Belirtilmemiş',
                    odev.kaynak || '-',
                    odev.odev || '-',
                    odev.yapilmadurumu || 'Bekliyor',
                    odev.teslimttarihi || '-'
                ]);
            });
            const odevlerWorksheet = XLSX.utils.aoa_to_sheet(odevlerData);
            XLSX.utils.book_append_sheet(workbook, odevlerWorksheet, 'Ödevler');

            // KAYNAKLAR (Öğrenci Atamaları) sayfası
            const ogrKaynaklarData: any[][] = [
                ['ÖĞRENCİ KAYNAK ATAMALARI'],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['Öğrenci', 'Atanan Kaynak Adı']
            ];
            tumKaynaklarAssigned.forEach(k => {
                ogrKaynaklarData.push([
                    k.ogrenciAdSoyad || '-',
                    k.kaynak || '-'
                ]);
            });
            const ogrKaynaklarWorksheet = XLSX.utils.aoa_to_sheet(ogrKaynaklarData);
            XLSX.utils.book_append_sheet(workbook, ogrKaynaklarWorksheet, 'Atanan Kaynaklar');

            // GLOBAL KAYNAKLAR sayfası
            const globalKaynaklarData: any[][] = [
                ['GLOBAL KAYNAK LİSTESİ'],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['ID', 'Kaynak Adı', 'Türü']
            ];
            tumGlobalKaynaklar.forEach(k => {
                globalKaynaklarData.push([
                    k.id,
                    k.ad || '-',
                    k.tur || '-'
                ]);
            });
            const globalKaynaklarWorksheet = XLSX.utils.aoa_to_sheet(globalKaynaklarData);
            XLSX.utils.book_append_sheet(workbook, globalKaynaklarWorksheet, 'Global Kaynaklar');

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
                            text: 'Tamam'
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
     * Öğrenci Excel Raporu modalını aç
     */
    const ogrenciExcelModalAc = async () => {
        try {
            setLoading(true);
            const result = await ogrencileriListele(false);
            if (result.success) {
                setOgrenciListesi(result.data ?? []);
                setOgrenciExcelModalAcik(true);
            } else {
                Alert.alert('Hata', 'Öğrenci listesi alınamadı');
            }
        } catch (error) {
            console.error('Öğrenci listesi hatası:', error);
            Alert.alert('Hata', 'Öğrenci listesi yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Seçilen öğrencinin tüm verilerini Excel'e yazdır
     */
    const ogrenciExcelRaporuOlustur = async (ogrenci: any) => {
        try {
            setOgrenciExcelModalAcik(false);
            setLoading(true);

            const ogrenciId = ogrenci.ogrenciId;
            const adSoyad = `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`;

            // Tüm verileri paralel olarak çek
            const [derslerData, odemelerData, notlarData, ajandaData, odevlerData, kaynaklarData] = await Promise.all([
                getDersler(ogrenciId),
                getOdemeler(ogrenciId),
                ogrenciNotlari(ogrenciId),
                ogrenciAjandaGetir(ogrenciId, '2020-01-01', '2099-12-31'),
                ogrenciOdevleri(ogrenciId),
                kaynakListesi(ogrenciId)
            ]);

            const dersler = derslerData || [];
            const odemeler = odemelerData || [];
            const notlar = notlarData?.data || [];
            const randevular = ajandaData?.data || [];
            const odevler = odevlerData?.data || [];
            const kaynaklar = kaynaklarData?.data || [];

            // Excel Workbook oluştur
            const workbook = XLSX.utils.book_new();

            // 1. ÖĞRENCİ BİLGİLERİ sayfası
            const ogrenciBilgiData: any[][] = [
                ['ÖĞRENCİ BİLGİLERİ'],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['Alan', 'Değer'],
                ['Ad Soyad', adSoyad],
                ['Telefon', ogrenci.ogrenciTel || '-'],
                ['Veli Adı', ogrenci.veliAd || '-'],
                ['Veli Telefon', ogrenci.veliTel || '-'],
                ['Okul', ogrenci.okul || '-'],
                ['Sınıf', ogrenci.sinif || '-'],
                ['Ücret', `${ogrenci.ucret || 0} TL`],
                ['Kayıt Tarihi', ogrenci.kayitTarihi || '-'],
                ['Durum', ogrenci.aktifmi ? 'Aktif' : 'Pasif'],
                ['Açıklama', ogrenci.aciklama1 || '-'],
            ];
            const ogrenciSheet = XLSX.utils.aoa_to_sheet(ogrenciBilgiData);
            XLSX.utils.book_append_sheet(workbook, ogrenciSheet, 'Öğrenci Bilgileri');

            // 2. DERSLER sayfası
            const derslerSheetData: any[][] = [
                [`${adSoyad} - DERS RAPORU`],
                [`Toplam Ders: ${dersler.length}`],
                [''],
                ['Tarih', 'Saat', 'Konu', 'Ders Türü', 'Ücret (TL)']
            ];
            let toplamDersUcreti = 0;
            dersler.forEach(ders => {
                derslerSheetData.push([
                    ders.tarih,
                    ders.saat,
                    ders.konu || '-',
                    ders.dersturu || '-',
                    parseInt(String(ders.ucret)) || 0
                ]);
                toplamDersUcreti += parseInt(String(ders.ucret)) || 0;
            });
            derslerSheetData.push(['', '', '', 'TOPLAM:', `${toplamDersUcreti} TL`]);
            const derslerSheet = XLSX.utils.aoa_to_sheet(derslerSheetData);
            XLSX.utils.book_append_sheet(workbook, derslerSheet, 'Dersler');

            // 3. ÖDEMELER sayfası
            const odemelerSheetData: any[][] = [
                [`${adSoyad} - ÖDEME RAPORU`],
                [`Toplam Ödeme Sayısı: ${odemeler.length}`],
                [''],
                ['Tarih', 'Saat', 'Tür', 'Açıklama', 'Miktar (TL)']
            ];
            let toplamOdeme = 0;
            odemeler.forEach(odeme => {
                odemelerSheetData.push([
                    odeme.odemetarih,
                    odeme.odemesaati || '-',
                    odeme.odemeturu || '-',
                    odeme.aciklama || '-',
                    parseInt(String(odeme.alinanucret)) || 0
                ]);
                toplamOdeme += parseInt(String(odeme.alinanucret)) || 0;
            });
            odemelerSheetData.push(['', '', '', 'TOPLAM:', `${toplamOdeme} TL`]);
            const odemelerSheet = XLSX.utils.aoa_to_sheet(odemelerSheetData);
            XLSX.utils.book_append_sheet(workbook, odemelerSheet, 'Ödemeler');

            // 4. RANDEVULAR (AJANDA) sayfası
            const ajandaSheetData: any[][] = [
                [`${adSoyad} - RANDEVU RAPORU`],
                [`Toplam Randevu: ${randevular.length}`],
                [''],
                ['Tarih', 'Saat', 'Durum']
            ];
            randevular.forEach((randevu: any) => {
                const durum = randevu.tamamlandiMi ? 'Tamamlandı' : (randevu.iptal ? 'İptal' : 'Bekliyor');
                ajandaSheetData.push([
                    randevu.tarih,
                    randevu.saat,
                    durum
                ]);
            });
            const ajandaSheet = XLSX.utils.aoa_to_sheet(ajandaSheetData);
            XLSX.utils.book_append_sheet(workbook, ajandaSheet, 'Randevular');

            // 5. NOTLAR sayfası
            const notlarSheetData: any[][] = [
                [`${adSoyad} - NOTLAR`],
                [`Toplam Not: ${notlar.length}`],
                [''],
                ['Tarih', 'Not İçeriği']
            ];
            notlar.forEach((not: any) => {
                notlarSheetData.push([
                    not.tarih,
                    not.not1 || '-'
                ]);
            });
            const notlarSheet = XLSX.utils.aoa_to_sheet(notlarSheetData);
            XLSX.utils.book_append_sheet(workbook, notlarSheet, 'Notlar');

            // 6. ÖDEVLER sayfası
            const odevlerSheetData: any[][] = [
                [`${adSoyad} - ÖDEV RAPORU`],
                [`Toplam Ödev: ${odevler.length}`],
                [''],
                ['Verilme Tarihi', 'Kaynak', 'Ödev/Konu', 'Durum', 'Teslim Tarihi']
            ];
            odevler.forEach((odev: any) => {
                odevlerSheetData.push([
                    odev.verilmetarihi || '-',
                    odev.kaynak || '-',
                    odev.odev || '-',
                    odev.yapilmadurumu || 'Bekliyor',
                    odev.teslimttarihi || '-'
                ]);
            });
            const odevlerSheet = XLSX.utils.aoa_to_sheet(odevlerSheetData);
            XLSX.utils.book_append_sheet(workbook, odevlerSheet, 'Ödevler');

            // 7. KAYNAKLAR sayfası
            const kaynaklarSheetData: any[][] = [
                [`${adSoyad} - KAYNAK ATAMALARI`],
                [`Toplam Atanan Kaynak: ${kaynaklar.length}`],
                [''],
                ['Kaynak Adı']
            ];
            kaynaklar.forEach((k: any) => {
                kaynaklarSheetData.push([
                    k.kaynak || '-'
                ]);
            });
            const kaynaklarSheet = XLSX.utils.aoa_to_sheet(kaynaklarSheetData);
            XLSX.utils.book_append_sheet(workbook, kaynaklarSheet, 'Kaynaklar');

            // ÖZET sayfası
            const ozetData: any[][] = [
                [`${adSoyad} - ÖZET RAPOR`],
                [`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`],
                [''],
                ['Bilgi', 'Değer'],
                ['Toplam Ders Sayısı', dersler.length],
                ['Toplam Ders Ücreti', `${toplamDersUcreti} TL`],
                ['Toplam Ödeme Sayısı', odemeler.length],
                ['Toplam Ödenen', `${toplamOdeme} TL`],
                ['Kalan Borç', `${toplamDersUcreti - toplamOdeme} TL`],
                ['Toplam Randevu', randevular.length],
                ['Toplam Not', notlar.length],
                ['Toplam Ödev', odevler.length],
                ['Atanan Kaynak', kaynaklar.length],
            ];
            const ozetSheet = XLSX.utils.aoa_to_sheet(ozetData);
            XLSX.utils.book_append_sheet(workbook, ozetSheet, 'Özet');

            // Excel dosyasını oluştur
            const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
            const dosyaAdi = `ogrenci_rapor_${ogrenci.ogrenciAd}_${ogrenci.ogrenciSoyad}_${detayliTarihFormatla()}.xlsx`;

            const result = await akilliDosyaKaydet(
                dosyaAdi,
                excelBuffer,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );

            if (result.success) {
                Alert.alert('Excel Raporu Oluşturuldu', `${adSoyad} için rapor başarıyla oluşturuldu.\n\n${result.message}`);
            } else {
                Alert.alert('Hata', result.error || 'Rapor oluşturulamadı');
            }

        } catch (error) {
            console.error('Öğrenci Excel raporu hatası:', error);
            Alert.alert('Hata', 'Öğrenci raporu oluşturulamadı: ' + (error as any).message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Son 20 ödemeyi getir ve modalı aç
     */
    const sonOdemeleriGetir = async () => {
        try {
            setLoading(true);
            const result = await tumOdemeleriGetir();
            if (result.success) {
                const tumOdemeler = result.odemeler || [];
                // Tarihe göre ters sırala ve ilk 20'yi al
                const sirali = [...tumOdemeler].sort((a, b) => {
                    const tarihA = new Date(a.odemetarih).getTime();
                    const tarihB = new Date(b.odemetarih).getTime();
                    return tarihB - tarihA;
                });
                setSonOdemeler(sirali.slice(0, 20));
                setSonOdemelerModalAcik(true);
            } else {
                Alert.alert('Hata', 'Ödemeler alınamadı');
            }
        } catch (error) {
            console.error('Son ödemeler hatası:', error);
            Alert.alert('Hata', 'Ödemeler yüklenemedi');
        } finally {
            setLoading(false);
        }
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
            <View style={styles.borcDetay}>
                <Text style={styles.borcDetayText}>
                    Toplam Ders: {item.toplamDersUcreti} TL
                </Text>
                <Text style={styles.borcDetayText}>
                    Ödenen: {item.toplamOdeme} TL
                </Text>
            </View>
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
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Veritabanı Yönetimi</Text>

                    <TouchableOpacity
                        style={styles.ayarItem}
                        onPress={veritabaniDbYedekle}
                    >
                        <MaterialIcons name="backup" size={24} color="#4CAF50" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Veritabanını Yedekle </Text>
                            <Text style={styles.ayarAciklama}>
                                Veritabanını uygulama klasörüne kaydet
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
                                Yedek dosyasını geri yükle (tüm veriler değişir)
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.ayarItem}>
                        <MaterialIcons name="event-available" size={24} color="#2196F3" />
                        <View style={[styles.ayarText, { flex: 1, marginLeft: 16 }]}>
                            <Text style={styles.ayarBaslik}>Yedekleme Hatırlatıcısı</Text>
                            <Text style={styles.ayarAciklama}>Otomatik yedekleme hatırlatması al</Text>
                        </View>
                        <Switch
                            value={yedekHatirlaticiAktif}
                            onValueChange={(val) => {
                                setYedekHatirlaticiAktif(val);
                                saveBackupSetting('@backup_reminder_enabled', val ? 'true' : 'false');
                            }}
                            trackColor={{ false: "#767577", true: "#81b0ff" }}
                            thumbColor={yedekHatirlaticiAktif ? "#2196F3" : "#f4f3f4"}
                        />
                    </View>

                    {yedekHatirlaticiAktif && (
                        <View style={[styles.ayarItem, { paddingLeft: 40 }]}>
                            <MaterialIcons name="update" size={20} color="#666" />
                            <View style={[styles.ayarText, { flex: 1, marginLeft: 16 }]}>
                                <Text style={styles.ayarBaslik}>Hatırlatıcı Sıklığı (Gün)</Text>
                                <Text style={styles.ayarAciklama}>Kaç günde bir hatırlatılsın</Text>
                            </View>
                            <TextInput
                                style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 5, width: 60, textAlign: 'center', color: '#333' }}
                                keyboardType="numeric"
                                value={yedekHatirlaticiSiklik}
                                onChangeText={(text) => setYedekHatirlaticiSiklik(text)}
                                onEndEditing={() => {
                                    const val = parseInt(yedekHatirlaticiSiklik, 10);
                                    if (isNaN(val) || val < 1) {
                                        setYedekHatirlaticiSiklik('14');
                                        saveBackupSetting('@backup_reminder_interval', '14');
                                        Alert.alert('Hata', 'Geçerli bir gün sayısı giriniz.');
                                    } else {
                                        saveBackupSetting('@backup_reminder_interval', val.toString());
                                    }
                                }}
                            />
                        </View>
                    )}

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

                    <TouchableOpacity
                        style={styles.ayarItem}
                        onPress={ogrenciExcelModalAc}
                    >
                        <MaterialIcons name="person-search" size={24} color="#9C27B0" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Öğrenci Excel Raporu</Text>
                            <Text style={styles.ayarAciklama}>
                                Seçilen öğrencinin tüm verilerini Excel dosyasına aktar
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

                    <TouchableOpacity
                        style={styles.ayarItem}
                        onPress={sonOdemeleriGetir}
                    >
                        <MaterialIcons name="receipt-long" size={24} color="#4CAF50" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Son Ödemeler</Text>
                            <Text style={styles.ayarAciklama}>
                                Son alınan 20 ödemeyi listele
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bildirim Ayarları</Text>

                    <View style={styles.ayarItemRow}>
                        <View style={styles.ayarTextRow}>
                            <Text style={styles.ayarBaslik}>Bildirimleri Etkinleştir</Text>
                            <Text style={styles.ayarAciklama}>Yaklaşan randevular için bildirim gönder</Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={toggleNotifications}
                            trackColor={{ false: "#767577", true: "#81b0ff" }}
                            thumbColor={notificationsEnabled ? "#2196F3" : "#f4f3f4"}
                        />
                    </View>

                    {notificationsEnabled && (
                        <>
                            <View style={styles.ayarItemRow}>
                                <View style={styles.ayarTextRow}>
                                    <Text style={styles.ayarBaslik}>Sesli Bildirim</Text>
                                    <Text style={styles.ayarAciklama}>Bildirimler sesli çalsın (sessiz/sesli)</Text>
                                </View>
                                <Switch
                                    value={notificationSound}
                                    onValueChange={toggleSound}
                                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                                    thumbColor={notificationSound ? "#2196F3" : "#f4f3f4"}
                                />
                            </View>

                            <View style={styles.ayarItemRow}>
                                <View style={styles.ayarTextRow}>
                                    <Text style={styles.ayarBaslik}>Titreşim</Text>
                                    <Text style={styles.ayarAciklama}>Bildirim geldiğinde telefon titresin</Text>
                                </View>
                                <Switch
                                    value={notificationVibrate}
                                    onValueChange={toggleVibrate}
                                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                                    thumbColor={notificationVibrate ? "#2196F3" : "#f4f3f4"}
                                />
                            </View>

                            <View style={styles.ayarItemRow}>
                                <View style={styles.ayarTextRow}>
                                    <Text style={styles.ayarBaslik}>Günlük Randevu Özeti</Text>
                                    <Text style={styles.ayarAciklama}>Her sabah o günkü randevuların özetini al</Text>
                                </View>
                                <Switch
                                    value={dailySummaryEnabled}
                                    onValueChange={toggleDailySummary}
                                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                                    thumbColor={dailySummaryEnabled ? "#2196F3" : "#f4f3f4"}
                                />
                            </View>

                        </>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Uygulama</Text>

                    <View style={styles.bilgiItem}>
                        <MaterialIcons name="info" size={24} color="#9E9E9E" />
                        <View style={styles.ayarText}>
                            {/* <Text style={styles.ayarBaslik}>Dosya Konumu</Text> */}
                            <Text style={styles.ayarAciklama}>
                                created By  Mehmet Gündöner {'\n'}
                                gundoner@yahoo.com
                            </Text>
                        </View>
                    </View>

                    <View style={styles.bilgiItem}>
                        <MaterialIcons name="info" size={24} color="#9E9E9E" />
                        <View style={styles.ayarText}>
                            <Text style={styles.ayarBaslik}>Sürüm Bilgisi</Text>
                            <Text style={styles.ayarAciklama}>
                                Özdeta Öğretmen Takip Uygulaması v1.0
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
                                • Excel raporu sayfaları: Dersler, Ödemeler, Öğrenciler, Borçlu Öğrenciler, Ödevler, Atanan Kaynaklar, Global Kaynaklar
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

            {/* Öğrenci Excel Raporu - Öğrenci Seçim Modalı */}
            <Modal
                visible={ogrenciExcelModalAcik}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setOgrenciExcelModalAcik(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, styles.borcModalContent]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Öğrenci Seçin
                            </Text>
                            <TouchableOpacity onPress={() => setOgrenciExcelModalAcik(false)}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ padding: 15, color: '#666', fontSize: 14, textAlign: 'center' }}>
                            Excel raporu oluşturmak istediğiniz öğrenciyi seçin
                        </Text>

                        {ogrenciListesi.length > 0 ? (
                            <FlatList
                                data={ogrenciListesi}
                                keyExtractor={item => (item.ogrenciId ?? item.id ?? Math.random()).toString()}
                                showsVerticalScrollIndicator={false}
                                style={{ paddingHorizontal: 15 }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.ayarItem, { marginBottom: 6 }]}
                                        onPress={() => ogrenciExcelRaporuOlustur(item)}
                                    >
                                        <MaterialIcons name="person" size={24} color="#9C27B0" />
                                        <View style={styles.ayarText}>
                                            <Text style={styles.ayarBaslik}>
                                                {item.ogrenciAd} {item.ogrenciSoyad}
                                            </Text>
                                            <Text style={styles.ayarAciklama}>
                                                {item.okul || 'Okul belirtilmemiş'} • {item.aktifmi ? 'Aktif' : 'Pasif'}
                                            </Text>
                                        </View>
                                        <MaterialIcons name="chevron-right" size={24} color="#ccc" />
                                    </TouchableOpacity>
                                )}
                            />
                        ) : (
                            <View style={styles.borcBosListe}>
                                <MaterialIcons name="person-off" size={48} color="#ddd" />
                                <Text style={styles.borcBosText}>
                                    Kayıtlı öğrenci bulunmuyor.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Son Ödemeler Modalı */}
            <Modal
                visible={sonOdemelerModalAcik}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSonOdemelerModalAcik(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, styles.borcModalContent]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Son Ödemeler ({sonOdemeler.length})
                            </Text>
                            <TouchableOpacity onPress={() => setSonOdemelerModalAcik(false)}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {sonOdemeler.length > 0 ? (
                            <FlatList
                                data={sonOdemeler}
                                keyExtractor={(item, index) => (item.odemeId ?? index).toString()}
                                showsVerticalScrollIndicator={false}
                                style={{ paddingHorizontal: 15, paddingTop: 10 }}
                                renderItem={({ item }) => (
                                    <View style={[styles.borcItem, { borderLeftColor: '#4CAF50' }]}>
                                        <View style={styles.borcHeader}>
                                            <Text style={styles.borcOgrenciAd}>
                                                {item.ogrenciAdSoyad || 'Belirtilmemiş'}
                                            </Text>
                                            <Text style={[styles.borcMiktar, { color: '#4CAF50' }]}>
                                                {item.alinanucret} TL
                                            </Text>
                                        </View>
                                        <View style={styles.borcDetay}>
                                            <Text style={styles.borcDetayText}>
                                                Tarih: {item.odemetarih} {item.odemesaati ? `• ${item.odemesaati}` : ''}
                                            </Text>
                                            <Text style={styles.borcDetayText}>
                                                Tür: {item.odemeturu || '-'} {item.aciklama ? `• ${item.aciklama}` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            />
                        ) : (
                            <View style={styles.borcBosListe}>
                                <MaterialIcons name="receipt-long" size={48} color="#ddd" />
                                <Text style={styles.borcBosText}>
                                    Henüz ödeme kaydı bulunmuyor.
                                </Text>
                            </View>
                        )}

                        {sonOdemeler.length > 0 && (
                            <View style={[styles.borcToplamFooter, { backgroundColor: '#f0fff0' }]}>
                                <Text style={styles.borcToplamLabel}>Toplam:</Text>
                                <Text style={[styles.borcToplamMiktar, { color: '#4CAF50' }]}>
                                    {sonOdemeler.reduce((t, item) => t + (parseFloat(item.alinanucret) || 0), 0)} TL
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
        backgroundColor: '#F8FAFC', // Modern soft background
        paddingTop: 16,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)', // Sleeker backdrop blur equivalent
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingText: {
        color: 'white',
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
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
        fontWeight: '800',
        color: '#0F172A',
        marginLeft: 10,
    },
    section: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginBottom: 14, // Azaltıldı
        borderRadius: 18,
        padding: 14, // Azaltıldı
        elevation: 4,
        shadowColor: '#64748B', 
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 12, // Azaltıldı
        letterSpacing: 0.3,
    },
    ayarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12, // Azaltıldı
        paddingHorizontal: 12, // Azaltıldı
        borderRadius: 12,
        marginBottom: 8, // Azaltıldı
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    ayarText: {
        flex: 1,
        marginLeft: 16,
    },
    ayarBaslik: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 4,
    },
    ayarAciklama: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18,
    },
    bilgiItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12, // Azaltıldı
        paddingHorizontal: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        width: '92%',
        maxHeight: '85%',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        overflow: 'hidden', // to keep header/footer rounded
    },
    borcModalContent: {
        height: '75%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        flex: 1,
    },
    modalBody: {
        padding: 20, // Azaltıldı
    },
    modalAciklama: {
        fontSize: 15,
        color: '#475569',
        marginBottom: 16, // Azaltıldı
        textAlign: 'center',
        lineHeight: 22,
    },
    raporBilgi: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 10, // Azaltıldı
        fontStyle: 'italic',
        lineHeight: 20,
    },
    tarihContainer: {
        marginBottom: 12, // Azaltıldı
    },
    tarihLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6, // Azaltıldı
    },
    tarihButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        padding: 12, // Azaltıldı
        backgroundColor: '#F8FAFC',
    },
    tarihText: {
        marginLeft: 12,
        fontSize: 15,
        color: '#0F172A',
        fontWeight: '600',
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16, // Azaltıldı
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12, // Azaltıldı
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 6,
    },
    cancelButton: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cancelButtonText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 16,
    },
    createButton: {
        backgroundColor: '#3B82F6',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    createButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    borcListe: {
        flex: 1,
        paddingHorizontal: 16, // Azaltıldı
        paddingTop: 10,
    },
    borcItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14, // Azaltıldı
        marginBottom: 10, // Azaltıldı
        borderLeftWidth: 5,
        borderLeftColor: '#EF4444',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    borcHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6, // Azaltıldı
    },
    borcOgrenciAd: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        flex: 1,
    },
    borcMiktar: {
        fontSize: 18,
        fontWeight: '800',
        color: '#EF4444',
    },
    borcDetay: {
        marginBottom: 12,
    },
    borcDetayText: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 4,
        fontWeight: '500',
    },
    borcOgrenciGitButon: {
        backgroundColor: '#EFF6FF',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    borcOgrenciGitText: {
        color: '#3B82F6',
        fontWeight: '700',
        fontSize: 14,
    },
    borcBosListe: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    borcBosText: {
        color: '#94A3B8',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 12,
        fontWeight: '600',
        lineHeight: 24,
    },
    borcToplamFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16, // Azaltıldı
        borderTopWidth: 1,
        borderTopColor: '#FCA5A5',
        backgroundColor: '#FEF2F2',
    },
    borcToplamLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#7F1D1D',
    },
    borcToplamMiktar: {
        fontSize: 22,
        fontWeight: '900',
        color: '#DC2626',
    },
    modalBodyScroll: {
        maxHeight: '65%',
        paddingHorizontal: 20, // Azaltıldı
        paddingBottom: 20, // Azaltıldı
        paddingTop: 10,
    },
    checkboxList: {
        marginBottom: 12, // Azaltıldı
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 8, // Azaltıldı
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10, // Azaltıldı
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    checkboxText: {
        marginLeft: 12,
        fontSize: 15,
        color: '#334155',
        fontWeight: '600',
    },
    uyariBox: {
        flexDirection: 'row',
        backgroundColor: '#FFF7ED',
        padding: 14, // Azaltıldı
        borderRadius: 12,
        marginTop: 10,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    uyariText: {
        fontSize: 13,
        color: '#C2410C',
        marginLeft: 10,
        flex: 1,
        fontWeight: '500',
        lineHeight: 18, // Azaltıldı
    },
    ayarItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12, // Azaltıldı
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    ayarTextRow: {
        flex: 1,
        marginRight: 16,
    },
    ayarItemSub: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    counterControlsInline: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        alignSelf: 'flex-start',
    },
    counterBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
    },
    counterValText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        minWidth: 50,
        textAlign: 'center',
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
