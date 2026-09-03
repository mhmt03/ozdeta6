/**
 * OdevEkle Ekrani
 * 
 * Bu ekran, secili ogrencinin odev durumlarini takip etmeyi, yeni odevler vermeyi, 
 * ve ogrencinin kaynak tamamlanma durumlarina gore cesitli formatlarda (WhatsApp / PDF) 
 * raporlar olusturmayi saglar.
 * 
 * iOS ve Android arayuz uyumlulugu icin:
 * - KeyboardAvoidingView ve ScrollView bilesenleri klavye acildiginda formlarin kapanmamasi icin entegre edilmistir.
 * - Platform.OS kontrolu ile klavye kayma mesafeleri ve klavye davranislari yonetilmektedir.
 */

import { KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, Switch } from 'react-native';
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    FlatList,
    Platform,
    Linking,
    ToastAndroid
} from 'react-native';
import OdevItem from '../components/OdevItem';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    kaynakListesi,
    odevKaydet,
    odevGuncelle,
    odevSil,
    ogrenciOdevleri,
    tekOgrenci
} from '../utils/database';
import { ogrencininSonTamamlananDersTarihi } from '../database/agendaOperations';
import {
    getKaynakIdByAd,
    getKaynakIcerikleri,
    getKaynakTamamlanmaRaporu,
    type KaynakRaporItem,
    type KonuRaporItem,
} from '../database/homeworkOperations';
import { KaynakType, OdevType, OgrenciType } from '../types';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Modal, ActivityIndicator } from 'react-native';


export default function OdevEkle() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { ogrenciId } = route.params;

    const [ogrenci, setOgrenci] = useState<OgrenciType | null>(null);
    const [kaynaklar, setKaynaklar] = useState<KaynakType[]>([]);
    const [odevler, setOdevler] = useState<OdevType[]>([]);
    const [loading, setLoading] = useState(true);

    // Ödev formu state'leri
    const [kayitsizKaynak, setKayitsizKaynak] = useState(false);
    const [seciliKaynak, setSeciliKaynak] = useState('');
    const [serbetKaynak, setSerbetKaynak] = useState('');
    const [odevKonusu, setOdevKonusu] = useState('');
    const [verilmeTarihi, setVerilmeTarihi] = useState(new Date());
    const [teslimTarihi, setTeslimTarihi] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [verilmeTarihPickerAcik, setVerilmeTarihPickerAcik] = useState(false);
    const [teslimTarihPickerAcik, setTeslimTarihPickerAcik] = useState(false);

    // İçerik / konu seçimi state'leri
    type IcerikItem = { id: number; kaynakId: number; icerik: string };
    const [kaynakIcerikleri, setKaynakIcerikleri] = useState<IcerikItem[]>([]);
    const [seciliIcerikler, setSeciliIcerikler] = useState<string[]>([]);
    const [konuModu, setKonuModu] = useState<'liste' | 'elle'>('elle'); // 'liste' | 'elle'

    // Ödev düzenleme modalı state'leri
    const [duzenlenenOdev, setDuzenlenenOdev] = useState<OdevType | null>(null);
    const [duzenleModalGorunur, setDuzenleModalGorunur] = useState(false);
    const [duzenleKayitsizKaynak, setDuzenleKayitsizKaynak] = useState(false);
    const [duzenleSeciliKaynak, setDuzenleSeciliKaynak] = useState('');
    const [duzenleSerbetKaynak, setDuzenleSerbetKaynak] = useState('');
    const [duzenleOdevKonusu, setDuzenleOdevKonusu] = useState('');
    const [duzenleVerilmeTarihi, setDuzenleVerilmeTarihi] = useState(new Date());
    const [duzenleTeslimTarihi, setDuzenleTeslimTarihi] = useState(new Date());
    const [duzenleVerilmeTarihPickerAcik, setDuzenleVerilmeTarihPickerAcik] = useState(false);
    const [duzenleTeslimTarihPickerAcik, setDuzenleTeslimTarihPickerAcik] = useState(false);
    const [duzenleKaynakIcerikleri, setDuzenleKaynakIcerikleri] = useState<IcerikItem[]>([]);
    const [duzenleSeciliIcerikler, setDuzenleSeciliIcerikler] = useState<string[]>([]);
    const [duzenleKonuModu, setDuzenleKonuModu] = useState<'liste' | 'elle'>('elle');

    // Stil Yardımcı Fonksiyonu
    const getIcerikStili = (icerik: string, isSelected: boolean, kaynakParam?: string) => {
        const kaynakValue = kaynakParam !== undefined ? kaynakParam : (kayitsizKaynak ? serbetKaynak : seciliKaynak);
        const gecmisOdevler = odevler.filter(o => o.kaynak === kaynakValue && o.odev === icerik);
        
        let durum = 'verilmedi';
        if (gecmisOdevler.length > 0) {
            const eksikVarMi = gecmisOdevler.some(o => o.yapilmadurumu === 'Yapılmadı' || o.yapilmadurumu === 'Eksik');
            const bekleyenVarMi = gecmisOdevler.some(o => o.yapilmadurumu === 'Bekliyor');
            const yapildiVarMi = gecmisOdevler.some(o => o.yapilmadurumu === 'Yapıldı');
            
            if (eksikVarMi) {
                durum = 'eksik';
            } else if (bekleyenVarMi) {
                durum = 'bekliyor';
            } else if (yapildiVarMi) {
                durum = 'yapildi';
            }
        }

        if (isSelected) {
            if (durum === 'yapildi') return { bg: '#27ae60', border: '#27ae60', text: 'white' }; // Yeşil
            if (durum === 'eksik') return { bg: '#e74c3c', border: '#e74c3c', text: 'white' }; // Kırmızı
            if (durum === 'bekliyor') return { bg: '#f39c12', border: '#f39c12', text: 'white' }; // Turuncu
            return { bg: '#3498db', border: '#3498db', text: 'white' }; // Mavi
        }

        if (durum === 'yapildi') return { bg: '#e8f5e9', border: '#81c784', text: '#2e7d32' };
        if (durum === 'eksik') return { bg: '#ffebee', border: '#e57373', text: '#c62828' };
        if (durum === 'bekliyor') return { bg: '#fff8e1', border: '#ffb74d', text: '#e65100' };
        return { bg: '#f9f9f9', border: '#ddd', text: '#555' };
    };

    // Yeni Özellikler State'leri
    const [odevVermeGorunur, setOdevVermeGorunur] = useState(false);
    const [raporModaliGorunur, setRaporModaliGorunur] = useState(false);
    const [raporBaslangic, setRaporBaslangic] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const [raporBitis, setRaporBitis] = useState(new Date());
    const [showRaporBaslangicPicker, setShowRaporBaslangicPicker] = useState(false);
    const [showRaporBitisPicker, setShowRaporBitisPicker] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    // Kaynak Tamamlanma Raporu Sekmeleri icin Tip Tanimlamasi (Odevler, Ozet, Detay, Kapsamli)
    type RaporTipi = 'odevler' | 'ozet' | 'detay' | 'kapsamli';
    
    // Rapor sekmesi secim durumunu tutan State (RaporTipi ile tip guvenligi saglanmistir)
    const [raporTipi, setRaporTipi] = useState<RaporTipi>('odevler');
    const [seciliRaporKaynak, setSeciliRaporKaynak] = useState<KaynakRaporItem | null>(null);

    // Konu Durum Atama Modali State'leri
    const [durumSecimModalGorunur, setDurumSecimModalGorunur] = useState(false);
    const [seciliKonuKaynakAd, setSeciliKonuKaynakAd] = useState('');
    const [seciliKonu, setSeciliKonu] = useState<KonuRaporItem | null>(null);

    // 🔵 ÖDEV BİLGİ YOLLA MODAL STATE 🔵
    const [bilgiModalGorunur, setBilgiModalGorunur] = useState(false);
    const [bilgiBaslangic, setBilgiBaslangic] = useState<Date>(new Date());
    const [bilgiBitis, setBilgiBitis] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const [bilgiOgrenciSecili, setBilgiOgrenciSecili] = useState(true);
    const [bilgiVeliSecili, setBilgiVeliSecili] = useState(false);
    const [bilgiVeli2Secili, setBilgiVeli2Secili] = useState(false);
    const [showBilgiBaslangic, setShowBilgiBaslangic] = useState(false);
    const [showBilgiBitis, setShowBilgiBitis] = useState(false);

    // 🔵 ÖDEV DURUM YOLLA MODAL STATE 🔵
    const [durumModalGorunur, setDurumModalGorunur] = useState(false);
    const [durumBaslangic, setDurumBaslangic] = useState<Date>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const [durumBitis, setDurumBitis] = useState<Date>(new Date());
    const [durumOgrenciSecili, setDurumOgrenciSecili] = useState(false);
    const [durumVeliSecili, setDurumVeliSecili] = useState(true);
    const [durumVeli2Secili, setDurumVeli2Secili] = useState(false);
    const [showDurumBaslangic, setShowDurumBaslangic] = useState(false);
    const [showDurumBitis, setShowDurumBitis] = useState(false);

    const [kaynakRaporVerisi, setKaynakRaporVerisi] = useState<KaynakRaporItem[]>([]);
    const [kaynakRaporYukleniyor, setKaynakRaporYukleniyor] = useState(false);
    const [genisletilmisKaynak, setGenisletilmisKaynak] = useState<string | null>(null);


    // Filtreleme State'leri
    const [durumFiltresi, setDurumFiltresi] = useState<'hepsi' | 'Yapıldı' | 'Yapılmadı' | 'Eksik' | 'Bekliyor'>('hepsi');
    const [tarihSiralamasi, setTarihSiralamasi] = useState<'azalan' | 'artan'>('azalan'); // azalan: yeniden eskiye, artan: eskiden yeniye

    // Filtrelenmiş ve Sıralanmış Ödevler
    const filtrelenmisOdevler = odevler
        .filter(odev => {
            if (durumFiltresi === 'hepsi') return true;
            return odev.yapilmadurumu === durumFiltresi;
        })
        .sort((a, b) => {
            const timeA = new Date(a.verilmetarihi).getTime();
            const timeB = new Date(b.verilmetarihi).getTime();
            return tarihSiralamasi === 'azalan' ? timeB - timeA : timeA - timeB;
        });

    const durumFiltresiDegistir = () => {
        const siradaki: Record<string, 'hepsi' | 'Yapıldı' | 'Yapılmadı' | 'Eksik' | 'Bekliyor'> = {
            'hepsi': 'Bekliyor',
            'Bekliyor': 'Yapıldı',
            'Yapıldı': 'Yapılmadı',
            'Yapılmadı': 'Eksik',
            'Eksik': 'hepsi'
        };
        setDurumFiltresi(siradaki[durumFiltresi]);
    };

    const tarihSiralamasiDegistir = () => {
        setTarihSiralamasi(prev => prev === 'azalan' ? 'artan' : 'azalan');
    };

    const konuTiklandi = (kaynakAd: string, konu: KonuRaporItem) => {
        setSeciliKonuKaynakAd(kaynakAd);
        setSeciliKonu(konu);
        setDurumSecimModalGorunur(true);
    };

    const durumAta = async (yeniDurum: string) => {
        if (!seciliKonu || !ogrenci) return;
        try {
            setLoading(true);
            setDurumSecimModalGorunur(false);
            
            if (yeniDurum === 'Atanmadı') {
                if (seciliKonu.odevVarMi && seciliKonu.odevId) {
                    const res = await odevSil(seciliKonu.odevId);
                    if (res.success) {
                        Alert.alert('Başarılı', 'Ödev silindi (Atanmadı durumuna alındı).');
                    } else {
                        Alert.alert('Hata', 'Ödev durumu güncellenemedi.');
                    }
                }
            } else {
                if (seciliKonu.odevVarMi && seciliKonu.odevId) {
                    const mevcutOdev = odevler.find(o => o.odevId === seciliKonu.odevId);
                    if (mevcutOdev) {
                        const guncelOdev = {
                            ...mevcutOdev,
                            yapilmadurumu: yeniDurum,
                            kontroltarihi: yeniDurum === 'Yapıldı' ? new Date().toISOString().split('T')[0] : mevcutOdev.kontroltarihi
                        };
                        const res = await odevGuncelle(seciliKonu.odevId, guncelOdev);
                        if (res.success) {
                            Alert.alert('Başarılı', `Ödev durumu "${yeniDurum}" olarak güncellendi.`);
                        } else {
                            Alert.alert('Hata', 'Ödev durumu güncellenemedi.');
                        }
                    }
                } else {
                    const yeniOdev = {
                        ogrenciId: ogrenciId,
                        kaynak: seciliKonuKaynakAd,
                        odev: seciliKonu.icerik,
                        verilmetarihi: new Date().toISOString().split('T')[0],
                        teslimttarihi: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        yapilmadurumu: yeniDurum,
                        aciklama: 'Rapor sayfasından durum atandı'
                    };
                    const res = await odevKaydet(yeniOdev);
                    if (res.success) {
                        Alert.alert('Başarılı', `Ödev kaydedildi ve "${yeniDurum}" olarak işaretlendi.`);
                    } else {
                        Alert.alert('Hata', 'Ödev kaydedilemedi.');
                    }
                }
            }

            await odevleriYenile();
            const r = await getKaynakTamamlanmaRaporu(ogrenciId);
            if (r.success) {
                setKaynakRaporVerisi(r.data);
                if (seciliRaporKaynak) {
                    const guncelSecili = r.data.find(k => k.kaynakAd === seciliRaporKaynak.kaynakAd);
                    setSeciliRaporKaynak(guncelSecili || null);
                }
            }
        } catch (error) {
            console.error('Durum atama hatası:', error);
            Alert.alert('Hata', 'İşlem sırasında bir hata oluştu.');
        } finally {
            setLoading(false);
            setSeciliKonu(null);
            setSeciliKonuKaynakAd('');
        }
    };

    useEffect(() => {
        veriAl();
    }, []);

    const veriAl = async () => {
        try {
            setLoading(true);

            // Öğrenci bilgilerini al
            const ogrenciResult = await tekOgrenci(ogrenciId);
            if (ogrenciResult.success && ogrenciResult.data) {
                const ogr = ogrenciResult.data;
                setOgrenci(ogr);
                navigation.setOptions({
                    title: `${ogr.ogrenciAd} ${ogr.ogrenciSoyad} Ödevleri`
                });

                // Varsayılan Ödev Durum Yolla başlangıç tarihini son ders olarak ayarla
                const sonDersResult = await ogrencininSonTamamlananDersTarihi(ogrenciId);
                if (sonDersResult.success && sonDersResult.tarih) {
                    setDurumBaslangic(new Date(sonDersResult.tarih));
                }
            }

            // Kaynakları al
            await kaynaklariYenile();

            // Ödevleri al
            await odevleriYenile();

        } catch (error) {
            console.error('Veri alma hatası:', error);
            Alert.alert('Hata', 'Veriler alınamadı');
        } finally {
            setLoading(false);
        }
    };

    // Ödev silme fonksiyonu
    const odevSilKaydet = async (odevId: number) => {
        try {
            const result = await odevSil(odevId);
            if (result.success) {
                Alert.alert('Başarılı', 'Ödev silindi');
                await odevleriYenile();
            } else {
                Alert.alert('Hata', 'Ödev silinemedi');
            }
        } catch (error) {
            console.error('Ödev silme hatası:', error);
            Alert.alert('Hata', 'Ödev silinemedi');
        }
    };

    const kaynaklariYenile = async () => {
        try {
            const kaynakResult = await kaynakListesi(ogrenciId);
            if (kaynakResult.success) {
                setKaynaklar(kaynakResult.data);
            }
        } catch (error) {
            console.error('Kaynaklar alınamadı:', error);
        }
    };

    const odevleriYenile = async () => {
        try {
            const odevResult = await ogrenciOdevleri(ogrenciId);
            if (odevResult.success) {
                // Ödevleri tarihe göre sırala (en yeni önce)
                const siralanmisOdevler = odevResult.data.sort((a: OdevType, b: OdevType) =>
                    new Date(b.verilmetarihi).getTime() - new Date(a.verilmetarihi).getTime()
                );
                setOdevler(siralanmisOdevler);
            }
        } catch (error) {
            console.error('Ödevler alınamadı:', error);
        }
    };

    // Ödev ekleme
    const odevEkle = async () => {
        if (konuModu === 'elle' && !odevKonusu.trim()) {
            Alert.alert('Uyarı', 'Lütfen ödev konusunu giriniz');
            return;
        }
        if (konuModu === 'liste' && seciliIcerikler.length === 0) {
            Alert.alert('Uyarı', 'Lütfen en az bir içerik seçiniz');
            return;
        }

        try {
            const kaynakValue = kayitsizKaynak ? serbetKaynak : seciliKaynak;
            let successCount = 0;

            const baseOdev = {
                ogrenciId: ogrenciId,
                kaynak: kaynakValue || 'Belirtilmemiş',
                verilmetarihi: verilmeTarihi.toISOString().split('T')[0],
                teslimttarihi: teslimTarihi.toISOString().split('T')[0],
                yapilmadurumu: 'Bekliyor',
                aciklama: `${formatTarih(verilmeTarihi)} tarihinde verildi`
            };

            if (konuModu === 'liste') {
                for (const icerik of seciliIcerikler) {
                    const result = await odevKaydet({ ...baseOdev, odev: icerik.trim() });
                    if (result.success) successCount++;
                }
                if (successCount > 0) {
                    Alert.alert('Başarılı', `${successCount} ödev başarıyla verildi`);
                }
            } else {
                const result = await odevKaydet({ ...baseOdev, odev: odevKonusu.trim() });
                if (result.success) {
                    Alert.alert('Başarılı', 'Ödev başarıyla verildi');
                    successCount++;
                } else {
                    Alert.alert('Hata', 'Ödev kaydedilemedi');
                }
            }

            if (successCount > 0) {
                formuTemizle();
                await odevleriYenile();
            }
        } catch (error) {
            console.error('Ödev ekleme hatası:', error);
            Alert.alert('Hata', 'Ödev kaydedilemedi: ' + (error as any).message);
        }
    };

    // Form temizleme
    const formuTemizle = () => {
        setSeciliKaynak('');
        setSerbetKaynak('');
        setOdevKonusu('');
        setKaynakIcerikleri([]);
        setSeciliIcerikler([]);
        setKonuModu('elle');
        setVerilmeTarihi(new Date());
        setTeslimTarihi(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    };

    // Kaynak seçilince içeriklerini yükle
    const kaynakSecildi = async (kaynakAdi: string) => {
        setSeciliKaynak(kaynakAdi);
        setOdevKonusu('');
        setSeciliIcerikler([]);
        setKonuModu('elle');
        setKaynakIcerikleri([]);
        if (!kaynakAdi) return;
        const idResult = await getKaynakIdByAd(kaynakAdi);
        if (idResult.success && idResult.data) {
            const icResult = await getKaynakIcerikleri(idResult.data.id);
            if (icResult.success && icResult.data.length > 0) {
                setKaynakIcerikleri(icResult.data as IcerikItem[]);
                setKonuModu('liste');
            }
        }
    };

    // Ödev güncelleme fonksiyonu
    const odevGuncelleKaydet = async (odev: OdevType) => {
        try {
            const result = await odevGuncelle(odev.odevId!, odev);
            if (result.success) {
                Platform.OS === 'android' ? ToastAndroid.show('Ödev güncellendi', ToastAndroid.SHORT) : Alert.alert('Başarılı', 'Ödev güncellendi');
                await odevleriYenile();
            } else {
                Platform.OS === 'android' ? ToastAndroid.show('Ödev güncellenemedi', ToastAndroid.SHORT) : Alert.alert('Hata', 'Ödev güncellenemedi');
            }
        } catch (error) {
            console.error('Ödev güncelleme hatası:', error);
            Platform.OS === 'android' ? ToastAndroid.show('Güncelleme yapılamadı', ToastAndroid.SHORT) : Alert.alert('Hata', 'Güncelleme yapılamadı');
        }
    };

    // Tarih formatı
    const formatTarih = (tarih: string | Date | null | undefined) => {
        if (!tarih) return '-';
        if (typeof tarih === 'string') {
            return new Date(tarih).toLocaleDateString('tr-TR');
        }
        return (tarih as Date).toLocaleDateString('tr-TR');
    };

    // Verilme tarihi değiştiğinde teslim tarihini otomatik ayarla
    const verilmeTarihiDegistir = (tarih: Date) => {
        setVerilmeTarihi(tarih);
        // 1 hafta sonrasını hesapla
        const yeniTeslimTarihi = new Date(tarih.getTime() + 7 * 24 * 60 * 60 * 1000);
        setTeslimTarihi(yeniTeslimTarihi);
    };

    const handleDuzenlemeBaslat = async (item: OdevType) => {
        setDuzenlenenOdev(item);
        setDuzenleVerilmeTarihi(new Date(item.verilmetarihi));
        setDuzenleTeslimTarihi(new Date(item.teslimttarihi));
        
        // Find if this is a registered resource
        const existsInRegistered = kaynaklar.some(k => k.kaynak.toLowerCase() === item.kaynak?.toLowerCase());
        
        if (existsInRegistered) {
            setDuzenleKayitsizKaynak(false);
            setDuzenleSeciliKaynak(item.kaynak || '');
            setDuzenleSerbetKaynak('');
            
            const idResult = await getKaynakIdByAd(item.kaynak || '');
            if (idResult.success && idResult.data) {
                const icResult = await getKaynakIcerikleri(idResult.data.id);
                if (icResult.success && icResult.data.length > 0) {
                    setDuzenleKaynakIcerikleri(icResult.data as IcerikItem[]);
                    
                    const currentOdevText = item.odev || '';
                    const parsedTopics = currentOdevText.split(',').map(s => s.trim().toLowerCase());
                    const matchedTopics = (icResult.data as IcerikItem[])
                        .filter(ic => parsedTopics.includes(ic.icerik.trim().toLowerCase()))
                        .map(ic => ic.icerik);
                    
                    if (matchedTopics.length > 0) {
                        setDuzenleSeciliIcerikler(matchedTopics);
                        setDuzenleKonuModu('liste');
                        setDuzenleOdevKonusu('');
                    } else {
                        setDuzenleSeciliIcerikler([]);
                        setDuzenleKonuModu('elle');
                        setDuzenleOdevKonusu(currentOdevText);
                    }
                } else {
                    setDuzenleKaynakIcerikleri([]);
                    setDuzenleSeciliIcerikler([]);
                    setDuzenleKonuModu('elle');
                    setDuzenleOdevKonusu(item.odev || '');
                }
            } else {
                setDuzenleKaynakIcerikleri([]);
                setDuzenleSeciliIcerikler([]);
                setDuzenleKonuModu('elle');
                setDuzenleOdevKonusu(item.odev || '');
            }
        } else {
            setDuzenleKayitsizKaynak(true);
            setDuzenleSeciliKaynak('');
            setDuzenleSerbetKaynak(item.kaynak || '');
            setDuzenleKaynakIcerikleri([]);
            setDuzenleSeciliIcerikler([]);
            setDuzenleKonuModu('elle');
            setDuzenleOdevKonusu(item.odev || '');
        }
        
        setDuzenleModalGorunur(true);
    };

    const duzenleKaynakSecildi = async (kaynakAdi: string) => {
        setDuzenleSeciliKaynak(kaynakAdi);
        setDuzenleOdevKonusu('');
        setDuzenleSeciliIcerikler([]);
        setDuzenleKonuModu('elle');
        setDuzenleKaynakIcerikleri([]);
        if (!kaynakAdi) return;
        const idResult = await getKaynakIdByAd(kaynakAdi);
        if (idResult.success && idResult.data) {
            const icResult = await getKaynakIcerikleri(idResult.data.id);
            if (icResult.success && icResult.data.length > 0) {
                setDuzenleKaynakIcerikleri(icResult.data as IcerikItem[]);
                setDuzenleKonuModu('liste');
            }
        }
    };

    const duzenleIcerikTiklandi = (icerik: string) => {
        let yeniSecilenler = [...duzenleSeciliIcerikler];
        if (yeniSecilenler.includes(icerik)) {
            yeniSecilenler = yeniSecilenler.filter(x => x !== icerik);
        } else {
            yeniSecilenler.push(icerik);
        }
        setDuzenleSeciliIcerikler(yeniSecilenler);
    };

    const handleDuzenleKaydet = async () => {
        if (!duzenlenenOdev) return;
        
        const kaynakValue = duzenleKayitsizKaynak ? duzenleSerbetKaynak.trim() : duzenleSeciliKaynak;
        
        let odevKonuValue = '';
        if (duzenleKonuModu === 'liste' && duzenleSeciliIcerikler.length > 0) {
            odevKonuValue = duzenleSeciliIcerikler.join(', ');
        } else {
            odevKonuValue = duzenleOdevKonusu.trim();
        }
        
        if (!odevKonuValue) {
            Alert.alert('Hata', 'Lütfen ödev konusu giriniz veya listeden seçiniz.');
            return;
        }
        
        try {
            setLoading(true);
            const guncelOdev: OdevType = {
                ...duzenlenenOdev,
                kaynak: kaynakValue,
                odev: odevKonuValue,
                verilmetarihi: duzenleVerilmeTarihi.toISOString().split('T')[0],
                teslimttarihi: duzenleTeslimTarihi.toISOString().split('T')[0],
            };
            
            const result = await odevGuncelle(duzenlenenOdev.odevId!, guncelOdev);
            if (result.success) {
                Platform.OS === 'android' ? ToastAndroid.show('Ödev güncellendi.', ToastAndroid.SHORT) : Alert.alert('Başarılı', 'Ödev güncellendi.');
                setDuzenleModalGorunur(false);
                setDuzenlenenOdev(null);
                await odevleriYenile();
            } else {
                Platform.OS === 'android' ? ToastAndroid.show('Ödev güncellenemedi.', ToastAndroid.SHORT) : Alert.alert('Hata', 'Ödev güncellenemedi.');
            }
        } catch (error) {
            console.error('Ödev düzenleme kaydetme hatası:', error);
            Platform.OS === 'android' ? ToastAndroid.show('Bir hata oluştu.', ToastAndroid.SHORT) : Alert.alert('Hata', 'Bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    // PDF Raporu Oluştur ve Paylaş/İndir
    const odevRaporuOlustur = async (hedef: 'indir' | 'ogrenci' | 'veli' | 'veli2') => {
        if (!ogrenci) return;

        try {
            setIsGeneratingPDF(true);

            // Tarih aralığındaki ödevleri filtrele
            const filtrelenmişOdevler = odevler.filter(o => {
                const oDate = new Date(o.verilmetarihi);
                return oDate >= raporBaslangic && oDate <= raporBitis;
            });

            if (filtrelenmişOdevler.length === 0) {
                Alert.alert('Uyarı', 'Seçilen tarih aralığında ödev bulunamadı.');
                setIsGeneratingPDF(false);
                return;
            }

            const studentName = `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`;
            const rangeText = `${formatTarih(raporBaslangic)} - ${formatTarih(raporBitis)}`;

            const htmlContent = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                        h1 { color: #2c3e50; text-align: center; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }
                        .info { margin-bottom: 20px; font-size: 14px; background-color: #f8f9fa; padding: 15px; border-radius: 8px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background-color: #3498db; color: white; padding: 12px 8px; text-align: left; font-size: 12px; }
                        td { border-bottom: 1px solid #eee; padding: 10px 8px; font-size: 11px; }
                        .status-Bekliyor { color: #f39c12; font-weight: bold; }
                        .status-Yapıldı { color: #27ae60; font-weight: bold; }
                        .status-Yapılmadı { color: #e74c3c; font-weight: bold; }
                        .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #95a5a6; border-top: 1px solid #eee; padding-top: 10px; }
                    </style>
                </head>
                <body>
                    <h1>Ödev Takip Raporu</h1>
                    <div class="info">
                        <p><strong>Öğrenci:</strong> ${studentName}</p>
                        <p><strong>Tarih Aralığı:</strong> ${rangeText}</p>
                        <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Verilme</th>
                                <th>Ödev Konusu</th>
                                <th>Kaynak</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtrelenmişOdevler.map(o => `
                                <tr>
                                    <td>${formatTarih(o.verilmetarihi)}</td>
                                    <td>${o.odev}</td>
                                    <td>${o.kaynak || '-'}</td>
                                    <td class="status-${o.yapilmadurumu}">${o.yapilmadurumu}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="footer">
                        Özdeta Öğretmen Takip Sistemi tarafından oluşturulmuştur.
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });

            const fileName = `${ogrenci.ogrenciAd}_${ogrenci.ogrenciSoyad}_Odev_Raporu.pdf`;

            if (await Sharing.isAvailableAsync()) {
                let shareOptions: Sharing.SharingOptions = {
                    mimeType: 'application/pdf',
                    dialogTitle: `${studentName} Ödev Raporu`,
                    UTI: 'com.adobe.pdf'
                };

                // WhatsApp için metin hazırla
                if (hedef === 'ogrenci' || hedef === 'veli' || hedef === 'veli2') {
                    const mesaj = `${studentName} e ait ödev raporu ektedir.`;
                    (shareOptions as any).message = mesaj;
                }

                await Sharing.shareAsync(uri, shareOptions);
            } else {
                Alert.alert('Hata', 'Paylaşım özelliği bu cihazda kullanılamıyor.');
            }

        } catch (error) {
            console.error('PDF Hatası:', error);
            Alert.alert('Hata', 'Rapor oluşturulurken bir sorun oluştu.');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // ── PDF 2: KAYNAK ÖZET TABLOSU ──
    const kaynakOzetPdfOlustur = async () => {
        if (!ogrenci || kaynakRaporVerisi.length === 0) return;
        try {
            setIsGeneratingPDF(true);
            const sn = `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`;
            const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
                body{font-family:Arial,sans-serif;padding:20px;color:#333}
                h1{color:#2c3e50;text-align:center;border-bottom:2px solid #3498db;padding-bottom:10px}
                .info{background:#f8f9fa;padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px}
                table{width:100%;border-collapse:collapse}
                th{background:#2c3e50;color:white;padding:10px 8px;font-size:12px;text-align:center}
                td{border-bottom:1px solid #eee;padding:9px 8px;font-size:11px;text-align:center}
                td:first-child{text-align:left}
                .tur{font-size:10px;color:#777}
                .footer{margin-top:40px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px}
            </style></head><body>
            <h1>Kaynak Tamamlanma Özeti</h1>
            <div class="info"><strong>Öğrenci:</strong> ${sn}<br/><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}</div>
            <table><thead><tr><th>Kaynak</th><th>Toplam İçerik</th><th>Ödev Verilen</th><th>Tamamlanan</th><th>Oran</th></tr></thead><tbody>
            ${kaynakRaporVerisi.map(k=>`<tr>
                <td>${k.kaynakAd}${k.kaynakTur!=='-'?`<br/><span class="tur">${k.kaynakTur}</span>`:''}</td>
                <td>${k.globalKaynakVar?k.toplamIcerik:'-'}</td>
                <td>${k.odevVerilenIcerik}</td>
                <td>${k.tamamlananIcerik}</td>
                <td style="color:${k.tamamlanmaOrani>=80?'#27ae60':k.tamamlanmaOrani>=40?'#e67e22':'#e74c3c'};font-weight:bold">${k.globalKaynakVar?'%'+k.tamamlanmaOrani:'-'}</td>
            </tr>`).join('')}
            </tbody></table>
            <div class="footer">Özdeta Öğretmen Takip Sistemi</div></body></html>`;
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType:'application/pdf', dialogTitle:`${sn} Kaynak Özeti`, UTI:'com.adobe.pdf' });
        } catch (error) { 
            console.error('Özet PDF Hatası:', error);
            Alert.alert('Hata', 'PDF oluşturulamadı: ' + (error as any).message); 
        } finally { setIsGeneratingPDF(false); }
    };

    // ── PDF 3: KAYNAK DETAY (tek kaynak) ──
    const kaynakDetayPdfOlustur = async (kaynak: KaynakRaporItem) => {
        if (!ogrenci) return;
        try {
            setIsGeneratingPDF(true);
            const sn = `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`;
            const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
                body{font-family:Arial,sans-serif;padding:20px;color:#333}
                h1{color:#2c3e50;text-align:center;border-bottom:2px solid #3498db;padding-bottom:10px;font-size:18px}
                .info{background:#f8f9fa;padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px}
                table{width:100%;border-collapse:collapse}
                th{background:#2c3e50;color:white;padding:10px 8px;font-size:12px;text-align:left}
                td{border-bottom:1px solid #eee;padding:9px 8px;font-size:11px}
                .footer{margin-top:40px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px}
            </style></head><body>
            <h1>${kaynak.kaynakAd}${kaynak.kaynakTur!=='-'?` (${kaynak.kaynakTur})`:''}</h1>
            <div class="info"><strong>Öğrenci:</strong> ${sn}<br/>
            <strong>Tamamlanma:</strong> ${kaynak.tamamlananIcerik}/${kaynak.toplamIcerik} konu · %${kaynak.tamamlanmaOrani}<br/>
            <strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}</div>
            <table><thead><tr><th>#</th><th>Konu</th><th>Ödev Tarihi</th><th>Durum</th></tr></thead><tbody>
            ${kaynak.konular.map((k,i)=>`<tr>
                <td>${i+1}</td><td>${k.icerik}</td>
                <td>${k.odevTarihi?new Date(k.odevTarihi).toLocaleDateString('tr-TR'):'-'}</td>
                <td style="color:${!k.odevVarMi?'#999':k.odevDurumu==='Yapıldı'?'#27ae60':k.odevDurumu==='Bekliyor'?'#e67e22':'#e74c3c'};font-weight:bold">
                    ${!k.odevVarMi?'Atanmadı':k.odevDurumu??'-'}
                </td></tr>`).join('')}
            </tbody></table>
            <div class="footer">Özdeta Öğretmen Takip Sistemi</div></body></html>`;
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType:'application/pdf', dialogTitle:`${kaynak.kaynakAd} Detay`, UTI:'com.adobe.pdf' });
        } catch (error) { 
            console.error('Detay PDF Hatası:', error);
            Alert.alert('Hata', 'PDF oluşturulamadı: ' + (error as any).message); 
        } finally { setIsGeneratingPDF(false); }
    };

    // ── WHATSAPP ÖDEV BİLGİ YOLLA ──
    const whatsappOdevBilgiYolla = () => {
        if (!ogrenci) return;
        if (!bilgiOgrenciSecili && !bilgiVeliSecili && !bilgiVeli2Secili) {
            Alert.alert("Uyarı", "Lütfen en az bir alıcı (öğrenci veya veli) seçin.");
            return;
        }

        const filteredOdevler = odevler.filter(o => {
            if (!o.verilmetarihi) return false;
            const t = new Date(o.verilmetarihi).getTime();
            return t >= bilgiBaslangic.setHours(0, 0, 0, 0) && t <= bilgiBitis.setHours(23, 59, 59, 999);
        });

        if (filteredOdevler.length === 0) {
            Alert.alert("Uyarı", "Seçilen tarih aralığında ödev bulunamadı.");
            return;
        }

        const formatla = (isim: string) => {
            let text = `Sayın ${isim}, ${formatTarih(bilgiBaslangic.toISOString())} - ${formatTarih(bilgiBitis.toISOString())} tarihleri arasındaki ödevler şu şekildedir bilginize.\n\n`;
            
            filteredOdevler.forEach(o => {
                text += `Kaynak: ${o.kaynak}\nİçerik: ${o.odev}\n`;
                if (o.aciklama) text += `Konu/Açıklama: ${o.aciklama}\n`;
                text += `Teslim Tarihi: ${o.teslimttarihi ? formatTarih(o.teslimttarihi) : '-'}\n\n`;
            });
            return encodeURIComponent(text);
        };

        const yollaKisi = (tel: string, metin: string) => {
            let formatedTel = tel.replace(/[^0-9]/g, '');
            if (formatedTel.startsWith('0')) formatedTel = '9' + formatedTel;
            else if (!formatedTel.startsWith('90')) formatedTel = '90' + formatedTel;
            const url = `whatsapp://send?phone=${formatedTel}&text=${metin}`;
            Linking.openURL(url).catch(() => {
                Alert.alert("Hata", "WhatsApp uygulaması bulunamadı veya açılamadı.");
            });
        };

        let delay = 0;
        if (bilgiOgrenciSecili && ogrenci.ogrenciTel) {
            yollaKisi(ogrenci.ogrenciTel, formatla(`${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`));
            delay += 1500;
        } else if (bilgiOgrenciSecili) {
            Alert.alert("Uyarı", "Öğrenci numarası kayıtlı değil.");
        }

        if (bilgiVeliSecili && ogrenci.veliTel && ogrenci.veliTel !== '-') {
            setTimeout(() => {
                yollaKisi(ogrenci.veliTel, formatla(ogrenci.veliAd || '1. Veli'));
            }, delay);
            delay += 1500;
        } else if (bilgiVeliSecili) {
            Alert.alert("Uyarı", "1. Veli numarası kayıtlı değil.");
        }

        if (bilgiVeli2Secili && ogrenci.veli2Tel && ogrenci.veli2Tel !== '-') {
            setTimeout(() => {
                yollaKisi(ogrenci.veli2Tel!, formatla(ogrenci.veli2Ad || '2. Veli'));
            }, delay);
        } else if (bilgiVeli2Secili) {
            Alert.alert("Uyarı", "2. Veli numarası kayıtlı değil.");
        }

        setBilgiModalGorunur(false);
    };

    // 🔵 WHATSAPP ÖDEV DURUM YOLLA 🔵
    const whatsappOdevDurumYolla = () => {
        if (!ogrenci) return;
        if (!durumOgrenciSecili && !durumVeliSecili && !durumVeli2Secili) {
            Alert.alert("Uyarı", "Lütfen en az bir alıcı (öğrenci veya veli) seçin.");
            return;
        }

        const filteredOdevler = odevler.filter(o => {
            const oDate = new Date(o.verilmetarihi);
            const basDate = new Date(durumBaslangic);
            basDate.setHours(0, 0, 0, 0);
            const bitDate = new Date(durumBitis);
            bitDate.setHours(23, 59, 59, 999);
            return oDate.getTime() >= basDate.getTime() && oDate.getTime() <= bitDate.getTime();
        });

        if (filteredOdevler.length === 0) {
            Alert.alert("Uyarı", "Seçilen tarih aralığında verilmiş ödev bulunamadı.");
            return;
        }

        const formatla = (isim: string) => {
            let text = `Sayın ${isim}, ${formatTarih(durumBaslangic.toISOString())} - ${formatTarih(durumBitis.toISOString())} tarihleri arasında ${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}'e ait ödev yapılma durumu şu şekildedir bilginize.\n\n`;
            
            filteredOdevler.forEach(o => {
                text += `Kaynak: ${o.kaynak}\nİçerik: ${o.odev}\n`;
                if (o.aciklama) text += `Konu/Açıklama: ${o.aciklama}\n`;
                text += `Durum: ${o.yapilmadurumu}\n\n`;
            });
            return encodeURIComponent(text);
        };

        const yollaKisi = (tel: string, metin: string) => {
            let formatedTel = tel.replace(/[^0-9]/g, '');
            if (formatedTel.startsWith('0')) formatedTel = '9' + formatedTel;
            else if (!formatedTel.startsWith('90')) formatedTel = '90' + formatedTel;
            const url = `whatsapp://send?phone=${formatedTel}&text=${metin}`;
            Linking.openURL(url).catch(() => {
                Alert.alert("Hata", "WhatsApp uygulaması bulunamadı veya açılamadı.");
            });
        };

        let delay = 0;
        if (durumOgrenciSecili && ogrenci.ogrenciTel) {
            yollaKisi(ogrenci.ogrenciTel, formatla(`${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`));
            delay += 1500;
        } else if (durumOgrenciSecili) {
            Alert.alert("Uyarı", "Öğrenci numarası kayıtlı değil.");
        }

        if (durumVeliSecili && ogrenci.veliTel && ogrenci.veliTel !== '-') {
            setTimeout(() => {
                yollaKisi(ogrenci.veliTel, formatla(ogrenci.veliAd || '1. Veli'));
            }, delay);
            delay += 1500;
        } else if (durumVeliSecili) {
            Alert.alert("Uyarı", "1. Veli numarası kayıtlı değil.");
        }

        if (durumVeli2Secili && ogrenci.veli2Tel && ogrenci.veli2Tel !== '-') {
            setTimeout(() => {
                yollaKisi(ogrenci.veli2Tel!, formatla(ogrenci.veli2Ad || '2. Veli'));
            }, delay);
        } else if (durumVeli2Secili) {
            Alert.alert("Uyarı", "2. Veli numarası kayıtlı değil.");
        }

        setDurumModalGorunur(false);
    };

    // ── KAPSAMLI PDF ──
    const kapsamliPdfOlustur = async () => {
        if (!ogrenci || kaynakRaporVerisi.length === 0) return;
        try {
            setIsGeneratingPDF(true);
            const sn = `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}`;
            const seksiyonlar = kaynakRaporVerisi.map(k=>`
                <div class="card">
                    <div class="card-baslik">${k.kaynakAd}${k.kaynakTur!=='-'?` <span class="tur">(${k.kaynakTur})</span>`:''}<span class="ozet">${k.globalKaynakVar?`${k.tamamlananIcerik}/${k.toplamIcerik} · %${k.tamamlanmaOrani}`:'İçerik yok'}</span></div>
                    ${k.konular.length>0?`<table><thead><tr><th>#</th><th>Konu</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>
                    ${k.konular.map((kn,i)=>`<tr><td>${i+1}</td><td>${kn.icerik}</td>
                        <td>${kn.odevTarihi?new Date(kn.odevTarihi).toLocaleDateString('tr-TR'):'-'}</td>
                        <td style="color:${!kn.odevVarMi?'#999':kn.odevDurumu==='Yapıldı'?'#27ae60':kn.odevDurumu==='Bekliyor'?'#e67e22':'#e74c3c'};font-weight:bold">${!kn.odevVarMi?'Atanmadı':kn.odevDurumu??'-'}</td>
                    </tr>`).join('')}</tbody></table>`:'<p class="bos">Konu girilmemiş.</p>'}
                </div>`).join('');
            const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
                body{font-family:Arial,sans-serif;padding:20px;color:#333}
                h1{color:#2c3e50;text-align:center;border-bottom:2px solid #3498db;padding-bottom:10px}
                .info{background:#f8f9fa;padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px}
                .card{margin-bottom:24px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden}
                .card-baslik{background:#34495e;color:white;padding:10px 14px;font-size:14px;font-weight:bold}
                .tur{font-size:11px;opacity:.8}
                .ozet{float:right;font-size:11px;font-weight:normal}
                table{width:100%;border-collapse:collapse}
                th{background:#f0f0f0;color:#555;padding:8px;font-size:11px;text-align:left}
                td{border-bottom:1px solid #f5f5f5;padding:8px;font-size:11px}
                .bos{padding:12px;color:#999;font-style:italic;font-size:12px}
                .footer{margin-top:40px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px}
            </style></head><body>
            <h1>Kapsamlı Kaynak Raporu</h1>
            <div class="info"><strong>Öğrenci:</strong> ${sn}<br/><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}</div>
            ${seksiyonlar}
            <div class="footer">Özdeta Öğretmen Takip Sistemi</div></body></html>`;
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType:'application/pdf', dialogTitle:`${sn} Kapsamlı Rapor`, UTI:'com.adobe.pdf' });
        } catch { Alert.alert('Hata','PDF oluşturulamadı.'); } finally { setIsGeneratingPDF(false); }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Yükleniyor...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        style={styles.content}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Üst Kontrol Paneli */}
                        <View style={styles.topControlPanel}>
                            <View style={styles.switchControl}>
                                <Text style={styles.switchControlLabel}>Ödev Formu</Text>
                                <Switch
                                    value={odevVermeGorunur}
                                    onValueChange={setOdevVermeGorunur}
                                    thumbColor={odevVermeGorunur ? "#4CAF50" : "#f4f3f4"}
                                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <TouchableOpacity
                                    style={[styles.raporButon, { backgroundColor: '#27ae60' }]}
                                    onPress={() => setBilgiModalGorunur(true)}
                                >
                                    <MaterialIcons name="send" size={16} color="white" />
                                    <Text style={styles.raporButonText}>Ödev Bilgi</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.raporButon, { backgroundColor: '#2980b9' }]}
                                    onPress={() => setDurumModalGorunur(true)}
                                >
                                    <MaterialIcons name="analytics" size={16} color="white" />
                                    <Text style={styles.raporButonText}>Durum</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.raporButon}
                                    onPress={async () => {
                                        setRaporTipi('odevler');
                                        setSeciliRaporKaynak(null);
                                        setGenisletilmisKaynak(null);
                                        setRaporModaliGorunur(true);
                                        // Kaynak raporunu arka planda yükle
                                        setKaynakRaporYukleniyor(true);
                                        const r = await getKaynakTamamlanmaRaporu(ogrenciId);
                                        if (r.success) setKaynakRaporVerisi(r.data);
                                        setKaynakRaporYukleniyor(false);
                                    }}
                                >
                                    <MaterialIcons name="assessment" size={16} color="white" />
                                    <Text style={styles.raporButonText}>Rapor</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Ödev Verme Formu - Koşullu Gösterim */}
                        {odevVermeGorunur && (
                            <View style={styles.formContainer}>
                                {/* Aksiyon Butonları */}
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                                    <TouchableOpacity
                                        style={[styles.odevVerButon, { flex: 1, marginTop: 0 }]}
                                        onPress={odevEkle}
                                    >
                                        <MaterialIcons name="assignment" size={20} color="white" />
                                        <Text style={styles.odevVerText}>Ödev Ver</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.kaynakEkleButon, { flex: 1, marginBottom: 0 }]}
                                        onPress={() => navigation.navigate('KaynakYonetimi', {
                                            ogrenciId: ogrenci?.ogrenciId,
                                            ogrenciAd: ogrenci?.ogrenciAd,
                                            ogrenciSoyad: ogrenci?.ogrenciSoyad
                                        })}
                                    >
                                        <MaterialIcons name="book" size={20} color="white" />
                                        <Text style={styles.kaynakEkleText}>Kaynak Yönet</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Kaynak Seçimi veya Serbest Giriş */}
                                {!kayitsizKaynak ? (
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>Kaynak Seç (İsteğe Bağlı)</Text>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={seciliKaynak}
                                                onValueChange={kaynakSecildi}
                                                style={styles.picker}
                                            >
                                                <Picker.Item label="Kaynak seçiniz..." value="" />
                                                {kaynaklar.map((kaynak) => (
                                                    <Picker.Item
                                                        key={kaynak.kaynakId}
                                                        label={kaynak.kaynak}
                                                        value={kaynak.kaynak}
                                                    />
                                                ))}
                                            </Picker>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>Kaynak Adı (İsteğe Bağlı)</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            value={serbetKaynak}
                                            onChangeText={setSerbetKaynak}
                                            placeholder="Kaynak adını yazınız"
                                            multiline={true}
                                        />
                                    </View>
                                )}

                                {/* Kayıtsız Kaynak Switch */}
                                <View style={styles.switchContainer}>
                                    <Text style={styles.switchLabel}>Serbest Kaynak Girişi</Text>
                                    <Switch
                                        value={kayitsizKaynak}
                                        onValueChange={(val) => {
                                            setKayitsizKaynak(val);
                                            setKaynakIcerikleri([]);
                                            setSeciliIcerikler([]);
                                            setKonuModu('elle');
                                            setOdevKonusu('');
                                        }}
                                        thumbColor={kayitsizKaynak ? "#4CAF50" : "#f4f3f4"}
                                        trackColor={{ false: "#767577", true: "#81b0ff" }}
                                    />
                                </View>

                                {/* Ödev Konusu */}
                                <View style={styles.inputContainer}>
                                    <View style={styles.konuHeader}>
                                        <Text style={styles.inputLabel}>Ödev Konusu *</Text>
                                        {/* Mod toggle - sadece içerik varsa göster */}
                                        {kaynakIcerikleri.length > 0 && !kayitsizKaynak && (
                                            <View style={styles.konuModToggle}>
                                                <TouchableOpacity
                                                    style={[styles.konuModBtn, konuModu === 'liste' && styles.konuModBtnAktif]}
                                                    onPress={() => setKonuModu('liste')}
                                                >
                                                    <MaterialIcons name="list" size={14} color={konuModu === 'liste' ? 'white' : '#555'} />
                                                    <Text style={[styles.konuModBtnText, konuModu === 'liste' && { color: 'white' }]}>Listeden</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.konuModBtn, konuModu === 'elle' && styles.konuModBtnAktif]}
                                                    onPress={() => { setKonuModu('elle'); setOdevKonusu(''); }}
                                                >
                                                    <MaterialIcons name="edit" size={14} color={konuModu === 'elle' ? 'white' : '#555'} />
                                                    <Text style={[styles.konuModBtnText, konuModu === 'elle' && { color: 'white' }]}>Elle Yaz</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>

                                    {/* Listeden seçim */}
                                    {konuModu === 'liste' && kaynakIcerikleri.length > 0 && !kayitsizKaynak ? (
                                        <View style={styles.icerikListeContainer}>
                                            {kaynakIcerikleri.map(ic => {
                                                const isSelected = seciliIcerikler.includes(ic.icerik);
                                                const stil = getIcerikStili(ic.icerik, isSelected);
                                                return (
                                                    <TouchableOpacity
                                                        key={ic.id}
                                                        style={[
                                                            styles.icerikSecimChip,
                                                            { backgroundColor: stil.bg, borderColor: stil.border }
                                                        ]}
                                                        onPress={() => {
                                                            if (isSelected) {
                                                                setSeciliIcerikler(prev => prev.filter(item => item !== ic.icerik));
                                                            } else {
                                                                setSeciliIcerikler(prev => [...prev, ic.icerik]);
                                                            }
                                                        }}
                                                    >
                                                        <Text style={[
                                                            styles.icerikSecimChipText,
                                                            { color: stil.text }
                                                        ]}>
                                                            {ic.icerik}
                                                        </Text>
                                                        {isSelected && (
                                                            <MaterialIcons name="check" size={14} color="white" style={{ marginLeft: 4 }} />
                                                        )}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    ) : (
                                        /* Elle yazım */
                                        <TextInput
                                            style={[styles.textInput, styles.textArea]}
                                            value={odevKonusu}
                                            onChangeText={setOdevKonusu}
                                            placeholder="Ödev konusunu yazınız"
                                            multiline={true}
                                            numberOfLines={3}
                                        />
                                    )}
                                </View>

                                {/* Verilme Tarihi */}
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Verilme Tarihi</Text>
                                    <TouchableOpacity
                                        style={styles.dateButton}
                                        onPress={() => setVerilmeTarihPickerAcik(true)}
                                    >
                                        <MaterialIcons name="date-range" size={20} color="#666" />
                                        <Text style={styles.dateText}>{formatTarih(verilmeTarihi)}</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Teslim Tarihi */}
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Teslim Tarihi</Text>
                                    <TouchableOpacity
                                        style={styles.dateButton}
                                        onPress={() => setTeslimTarihPickerAcik(true)}
                                    >
                                        <MaterialIcons name="date-range" size={20} color="#666" />
                                        <Text style={styles.dateText}>{formatTarih(teslimTarihi)}</Text>
                                    </TouchableOpacity>
                                </View>


                            </View>
                        )}

                        {/* Ödevler Listesi */}
                        <View style={styles.odevlerContainer}>
                            <View style={styles.odevlerHeaderContainer}>
                                <Text style={styles.sectionTitle}>
                                    Verilen Ödevler ({filtrelenmisOdevler.length})
                                </Text>

                                {/* Filtreleme Butonları */}
                                <View style={styles.filtreButonlariGrup}>
                                    <TouchableOpacity
                                        style={styles.filtreButon}
                                        onPress={durumFiltresiDegistir}
                                    >
                                        <MaterialIcons name="filter-list" size={14} color="#333" />
                                        <Text style={styles.filtreButonText}>
                                            {durumFiltresi === 'hepsi' ? 'Tümü' : durumFiltresi}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.filtreButon}
                                        onPress={tarihSiralamasiDegistir}
                                    >
                                        <MaterialIcons
                                            name={tarihSiralamasi === 'azalan' ? "arrow-downward" : "arrow-upward"}
                                            size={14}
                                            color="#333"
                                        />
                                        <Text style={styles.filtreButonText}>
                                            {tarihSiralamasi === 'azalan' ? 'En Yeni' : 'En Eski'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {filtrelenmisOdevler.length > 0 ? (
                                <FlatList
                                    data={filtrelenmisOdevler}
                                    renderItem={({ item }) => (
                                        <OdevItem
                                            item={item}
                                            onGuncelle={odevGuncelleKaydet}
                                            onSil={odevSilKaydet}
                                            onDuzenle={handleDuzenlemeBaslat}
                                        />
                                    )}
                                    keyExtractor={item => (item.odevId?.toString() || Math.random().toString())}
                                    scrollEnabled={false}
                                />
                            ) : (
                                <View style={styles.bosListe}>
                                    <MaterialIcons name="assignment" size={40} color="#ddd" />
                                    <Text style={styles.bosListeText}>Ödev bulunamadı</Text>
                                </View>
                            )}
                        </View>

                    </ScrollView>
                </TouchableWithoutFeedback>
                {/* 🔵 ÖDEV DURUM YOLLA MODALI 🔵 */}
            <Modal visible={durumModalGorunur} animationType="fade" transparent={true} onRequestClose={() => setDurumModalGorunur(false)}>
                <View style={styles.modalOverlay}>
                    <ScrollView 
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }} 
                        style={{ width: '100%' }} 
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.reportModalContent, { height: 'auto', padding: 20 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ödev Durumu Yolla (WhatsApp)</Text>
                            <TouchableOpacity onPress={() => setDurumModalGorunur(false)}>
                                <MaterialIcons name="close" size={24} color="#555" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ marginTop: 10, marginBottom: 5, fontWeight: 'bold' }}>Tarih Aralığı Seçin</Text>
                        <View style={styles.dateRangeContainer}>
                            <TouchableOpacity style={styles.reportDateButton} onPress={() => setShowDurumBaslangic(true)}>
                                <MaterialIcons name="date-range" size={16} color="#666" />
                                <Text style={styles.reportDateText}>{formatTarih(durumBaslangic.toISOString())}</Text>
                            </TouchableOpacity>
                            <Text style={{ color: '#aaa', marginHorizontal: 4, alignSelf: 'center' }}>-</Text>
                            <TouchableOpacity style={styles.reportDateButton} onPress={() => setShowDurumBitis(true)}>
                                <MaterialIcons name="date-range" size={16} color="#666" />
                                <Text style={styles.reportDateText}>{formatTarih(durumBitis.toISOString())}</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={{ marginTop: 15, marginBottom: 5, fontWeight: 'bold' }}>Alıcı Seçin</Text>
                        {ogrenci && (
                            <View style={{ marginBottom: 10 }}>
                                <Text style={{ fontSize: 12, color: ogrenci.veli_odev_istiyor_mu === 1 ? '#27ae60' : '#e74c3c', marginBottom: 2, fontStyle: 'italic' }}>
                                    Not: 1. Veli ({ogrenci.veliAd || 'Veli'}) ödev bilgisi {ogrenci.veli_odev_istiyor_mu === 1 ? 'İSTİYOR' : 'İSTEMİYOR'}.
                                </Text>
                                <Text style={{ fontSize: 12, color: ogrenci.veli2_odev_istiyor_mu === 1 ? '#27ae60' : '#e74c3c', marginBottom: 2, fontStyle: 'italic' }}>
                                    Not: 2. Veli ({ogrenci.veli2Ad || '2. Veli'}) ödev bilgisi {ogrenci.veli2_odev_istiyor_mu === 1 ? 'İSTİYOR' : 'İSTEMİYOR'}.
                                </Text>
                            </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: 15, marginBottom: 20, flexWrap: 'wrap' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Switch
                                    value={durumOgrenciSecili}
                                    onValueChange={setDurumOgrenciSecili}
                                />
                                <Text style={{ marginLeft: 8 }}>Öğrenci</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Switch
                                    value={durumVeliSecili}
                                    onValueChange={setDurumVeliSecili}
                                />
                                <Text style={{ marginLeft: 8 }}>1. Veli</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Switch
                                    value={durumVeli2Secili}
                                    onValueChange={setDurumVeli2Secili}
                                />
                                <Text style={{ marginLeft: 8 }}>2. Veli</Text>
                            </View>
                        </View>

                        <Text style={{ marginTop: 5, marginBottom: 5, fontWeight: 'bold' }}>Gönderilecek Durum (Önizleme):</Text>
                        <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#eee' }}>
                            {(() => {
                                const onizlemeDurum = odevler.filter(o => {
                                    const oDate = new Date(o.verilmetarihi);
                                    const basDate = new Date(durumBaslangic);
                                    basDate.setHours(0, 0, 0, 0);
                                    const bitDate = new Date(durumBitis);
                                    bitDate.setHours(23, 59, 59, 999);
                                    return oDate.getTime() >= basDate.getTime() && oDate.getTime() <= bitDate.getTime();
                                });
                                if (onizlemeDurum.length === 0) return <Text style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>Bu tarih aralığında ödev bulunamadı.</Text>;
                                return onizlemeDurum.map((o, idx) => {
                                    const renk = o.yapilmadurumu === 'Yapıldı' ? '#27ae60' : (o.yapilmadurumu === 'Eksik' ? '#e67e22' : '#e74c3c');
                                    return (
                                        <View key={idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#333' }}>{o.kaynak}</Text>
                                            <Text style={{ fontSize: 11, color: '#666' }}>{o.odev} {o.aciklama ? `(${o.aciklama})` : ''}</Text>
                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: renk }}>Durum: {o.yapilmadurumu}</Text>
                                        </View>
                                    );
                                });
                            })()}
                        </ScrollView>

                        <TouchableOpacity style={[styles.raporPdfBtn, { backgroundColor: '#25D366', marginBottom: 0 }]} onPress={whatsappOdevDurumYolla}>
                            <MaterialIcons name="send" size={18} color="white" />
                            <Text style={styles.raporPdfBtnText}>WhatsApp ile Yolla</Text>
                        </TouchableOpacity>
                    </View>
                    </ScrollView>
                </View>

                {showDurumBaslangic && (
                    <DateTimePicker
                        value={durumBaslangic}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => { setShowDurumBaslangic(false); if (date) setDurumBaslangic(date); }}
                    />
                )}
                {showDurumBitis && (
                    <DateTimePicker
                        value={durumBitis}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => { setShowDurumBitis(false); if (date) setDurumBitis(date); }}
                    />
                )}
            </Modal>

            {/* 🔵 ÖDEV DÜZENLEME MODALI 🔵 */}
            <Modal visible={duzenleModalGorunur} animationType="slide" transparent={true} onRequestClose={() => setDuzenleModalGorunur(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.reportModalContent, { height: '80%', padding: 20 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ödev Düzenle</Text>
                            <TouchableOpacity onPress={() => setDuzenleModalGorunur(false)}>
                                <MaterialIcons name="close" size={24} color="#555" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1, marginTop: 10 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            
                            {/* Kaynak Seçimi */}
                            {!duzenleKayitsizKaynak ? (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Kaynak Seç (İsteğe Bağlı)</Text>
                                    <View style={styles.pickerContainer}>
                                        <Picker
                                            selectedValue={duzenleSeciliKaynak}
                                            onValueChange={duzenleKaynakSecildi}
                                            style={styles.picker}
                                        >
                                            <Picker.Item label="Kaynak seçiniz..." value="" />
                                            {kaynaklar.map((kaynak) => (
                                                <Picker.Item
                                                    key={kaynak.kaynakId}
                                                    label={kaynak.kaynak}
                                                    value={kaynak.kaynak}
                                                />
                                            ))}
                                        </Picker>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Kaynak Adı (İsteğe Bağlı)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={duzenleSerbetKaynak}
                                        onChangeText={setDuzenleSerbetKaynak}
                                        placeholder="Kaynak adını yazınız"
                                        multiline={true}
                                    />
                                </View>
                            )}

                            {/* Kayıtsız Kaynak Switch */}
                            <View style={styles.switchContainer}>
                                <Text style={styles.switchLabel}>Serbest Kaynak Girişi</Text>
                                <Switch
                                    value={duzenleKayitsizKaynak}
                                    onValueChange={(val) => {
                                        setDuzenleKayitsizKaynak(val);
                                        setDuzenleKaynakIcerikleri([]);
                                        setDuzenleSeciliIcerikler([]);
                                        setDuzenleKonuModu('elle');
                                        setDuzenleOdevKonusu('');
                                    }}
                                    thumbColor={duzenleKayitsizKaynak ? "#4CAF50" : "#f4f3f4"}
                                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                                />
                            </View>

                            {/* Ödev Konusu */}
                            <View style={styles.inputContainer}>
                                <View style={styles.konuHeader}>
                                    <Text style={styles.inputLabel}>Ödev Konusu *</Text>
                                    {duzenleKaynakIcerikleri.length > 0 && !duzenleKayitsizKaynak && (
                                        <View style={styles.konuModToggle}>
                                            <TouchableOpacity
                                                style={[styles.konuModBtn, duzenleKonuModu === 'liste' && styles.konuModBtnAktif]}
                                                onPress={() => setDuzenleKonuModu('liste')}
                                            >
                                                <MaterialIcons name="list" size={14} color={duzenleKonuModu === 'liste' ? 'white' : '#555'} />
                                                <Text style={[styles.konuModBtnText, duzenleKonuModu === 'liste' && { color: 'white' }]}>Listeden</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.konuModBtn, duzenleKonuModu === 'elle' && styles.konuModBtnAktif]}
                                                onPress={() => { setDuzenleKonuModu('elle'); setDuzenleOdevKonusu(''); }}
                                            >
                                                <MaterialIcons name="edit" size={14} color={duzenleKonuModu === 'elle' ? 'white' : '#555'} />
                                                <Text style={[styles.konuModBtnText, duzenleKonuModu === 'elle' && { color: 'white' }]}>Elle Yaz</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {duzenleKonuModu === 'liste' && duzenleKaynakIcerikleri.length > 0 && !duzenleKayitsizKaynak ? (
                                    <View style={styles.icerikListeContainer}>
                                        {duzenleKaynakIcerikleri.map(ic => {
                                            const isSelected = duzenleSeciliIcerikler.includes(ic.icerik);
                                            const duzenleKaynakValue = duzenleKayitsizKaynak ? duzenleSerbetKaynak : duzenleSeciliKaynak;
                                            const chipStyle = getIcerikStili(ic.icerik, isSelected, duzenleKaynakValue);
                                            return (
                                                <TouchableOpacity
                                                    key={ic.id}
                                                    style={[
                                                        styles.icerikSecimChip,
                                                        { backgroundColor: chipStyle.bg, borderColor: chipStyle.border }
                                                    ]}
                                                    onPress={() => duzenleIcerikTiklandi(ic.icerik)}
                                                >
                                                    <Text style={[styles.icerikSecimChipText, { color: chipStyle.text }]}>
                                                        {ic.icerik}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <TextInput
                                        style={[styles.textInput, { height: 60 }]}
                                        value={duzenleOdevKonusu}
                                        onChangeText={setDuzenleOdevKonusu}
                                        placeholder="Ödev konusunu yazınız..."
                                        multiline={true}
                                    />
                                )}
                            </View>

                            {/* Tarihler */}
                            <Text style={[styles.inputLabel, { marginTop: 10 }]}>Tarih Ayarları</Text>
                            <View style={styles.odevTarihler}>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setDuzenleVerilmeTarihPickerAcik(true)}
                                >
                                    <MaterialIcons name="date-range" size={18} color="#666" />
                                    <Text style={styles.dateText}>Verildi: {formatTarih(duzenleVerilmeTarihi)}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setDuzenleTeslimTarihPickerAcik(true)}
                                >
                                    <MaterialIcons name="date-range" size={18} color="#666" />
                                    <Text style={styles.dateText}>Teslim: {formatTarih(duzenleTeslimTarihi)}</Text>
                                </TouchableOpacity>
                            </View>

                            {duzenleVerilmeTarihPickerAcik && (
                                <DateTimePicker
                                    value={duzenleVerilmeTarihi}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(e, selected) => {
                                        setDuzenleVerilmeTarihPickerAcik(Platform.OS === 'ios');
                                        if (selected) {
                                            setDuzenleVerilmeTarihi(selected);
                                            setDuzenleTeslimTarihi(new Date(selected.getTime() + 7 * 24 * 60 * 60 * 1000));
                                        }
                                    }}
                                />
                            )}

                            {duzenleTeslimTarihPickerAcik && (
                                <DateTimePicker
                                    value={duzenleTeslimTarihi}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(e, selected) => {
                                        setDuzenleTeslimTarihPickerAcik(Platform.OS === 'ios');
                                        if (selected) setDuzenleTeslimTarihi(selected);
                                    }}
                                />
                            )}

                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setDuzenleModalGorunur(false)}
                            >
                                <Text style={styles.cancelButtonText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleDuzenleKaydet}
                            >
                                <Text style={styles.saveButtonText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </KeyboardAvoidingView>

            {/* Date Pickers */}
            {verilmeTarihPickerAcik && (
                <DateTimePicker
                    value={verilmeTarihi}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        setVerilmeTarihPickerAcik(Platform.OS === 'ios');
                        if (selectedDate) {
                            verilmeTarihiDegistir(selectedDate);
                        }
                    }}
                />
            )}

            {teslimTarihPickerAcik && (
                <DateTimePicker
                    value={teslimTarihi}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        setTeslimTarihPickerAcik(Platform.OS === 'ios');
                        if (selectedDate) {
                            setTeslimTarihi(selectedDate);
                        }
                    }}
                />
            )}

            {/* ─── RAPOR MODALı ─── */}
            <Modal
                visible={raporModaliGorunur}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setRaporModaliGorunur(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.reportModalContent}>
                        {/* Başlık */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {ogrenci ? `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}` : 'Rapor'}
                            </Text>
                            <TouchableOpacity onPress={() => setRaporModaliGorunur(false)}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* Sekme Seçici */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.raporSekmeScrView}>
                            <View style={styles.raporSekmeRow}>
                                {([
                                    { key: 'odevler',  label: '📋 Tüm Ödevler' },
                                    { key: 'ozet',     label: '📊 Özet Tablo' },
                                    { key: 'detay',    label: '🔍 Kaynak Detay' },
                                    { key: 'kapsamli', label: '📚 Kapsamlı' },
                                ] as { key: RaporTipi; label: string }[]).map(s => (
                                    <TouchableOpacity
                                        key={s.key}
                                        style={[styles.raporSekmeBtn, raporTipi === s.key && styles.raporSekmeBtnAktif]}
                                        onPress={() => { setRaporTipi(s.key as any); setSeciliRaporKaynak(null); }}
                                    >
                                        <Text style={[styles.raporSekmeBtnText, raporTipi === s.key && styles.raporSekmeBtnTextAktif]}>
                                            {s.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        {/* İçerik */}
                        <ScrollView style={styles.raporIcerik} showsVerticalScrollIndicator={false}>

                            {/* ── SEKME 1: TÜM ÖDEVLER ── */}
                            {raporTipi === 'odevler' && (
                                <View>
                                    <Text style={styles.modalSubtitle}>Tarih aralığı seçiniz:</Text>
                                    <View style={styles.dateRangeContainer}>
                                        <TouchableOpacity style={styles.reportDateButton} onPress={() => setShowRaporBaslangicPicker(true)}>
                                            <Text style={styles.dateLabel}>Başlangıç</Text>
                                            <Text style={styles.dateValue}>{formatTarih(raporBaslangic)}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.reportDateButton} onPress={() => setShowRaporBitisPicker(true)}>
                                            <Text style={styles.dateLabel}>Bitiş</Text>
                                            <Text style={styles.dateValue}>{formatTarih(raporBitis)}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.raporAksiyonlar}>
                                        <TouchableOpacity style={[styles.raporAksiyonButon, { backgroundColor: '#3498db' }]} onPress={() => odevRaporuOlustur('indir')} disabled={isGeneratingPDF}>
                                            <MaterialIcons name="file-download" size={24} color="white" />
                                            <Text style={styles.raporAksiyonText}>İndir / Paylaş</Text>
                                        </TouchableOpacity>
                                        <View style={styles.raporPaylasımGrup}>
                                            <TouchableOpacity style={[styles.paylasimButon, { backgroundColor: '#27ae60' }]} onPress={() => odevRaporuOlustur('ogrenci')} disabled={isGeneratingPDF}>
                                                <MaterialIcons name="person" size={20} color="white" />
                                                <Text style={styles.paylasimText}>Öğrenciye</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.paylasimButon, { backgroundColor: '#8e44ad' }]} onPress={() => odevRaporuOlustur('veli')} disabled={isGeneratingPDF}>
                                                <MaterialIcons name="people" size={20} color="white" />
                                                <Text style={styles.paylasimText}>1. Veliye</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.paylasimButon, { backgroundColor: '#d35400' }]} onPress={() => odevRaporuOlustur('veli2')} disabled={isGeneratingPDF}>
                                                <MaterialIcons name="people" size={20} color="white" />
                                                <Text style={styles.paylasimText}>2. Veliye</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {isGeneratingPDF && (
                                        <View style={{ alignItems: 'center', marginTop: 12 }}>
                                            <ActivityIndicator size="large" color="#3498db" />
                                            <Text style={styles.loadingText}>PDF Oluşturuluyor...</Text>
                                        </View>
                                    )}

                                    {/* Ödev Listesi Gösterimi */}
                                    <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 }}>
                                        <Text style={[styles.modalSubtitle, { marginBottom: 12 }]}>Tarih Aralığındaki Ödevler</Text>
                                        {(() => {
                                            const filtrelenmisOdevler = odevler.filter(o => {
                                                const oDate = new Date(o.verilmetarihi);
                                                return oDate >= raporBaslangic && oDate <= raporBitis;
                                            });

                                            if (filtrelenmisOdevler.length === 0) {
                                                return <Text style={styles.bosRaporText}>Bu tarih aralığında verilmiş ödev bulunamadı.</Text>;
                                            }

                                            return filtrelenmisOdevler.map((odev, index) => {
                                                const bg = odev.yapilmadurumu === 'Yapıldı' ? '#e8f5e9' : (odev.yapilmadurumu === 'Eksik' ? '#fff3e0' : '#f9f9f9');
                                                const border = odev.yapilmadurumu === 'Yapıldı' ? '#81c784' : (odev.yapilmadurumu === 'Eksik' ? '#ffb74d' : '#ddd');
                                                const text = odev.yapilmadurumu === 'Yapıldı' ? '#2e7d32' : (odev.yapilmadurumu === 'Eksik' ? '#e65100' : '#555');
                                                
                                                return (
                                                    <View key={index} style={[styles.detaySatir, { marginBottom: 6, backgroundColor: '#fff', borderRadius: 8, padding: 8, elevation: 1 }]}>
                                                        <View style={{ flex: 3 }}>
                                                            <Text style={[styles.detayColKonu, { fontWeight: 'bold' }]} numberOfLines={2}>
                                                                {odev.kaynak || 'Kaynak'}
                                                            </Text>
                                                            <Text style={{ fontSize: 11, color: '#666' }}>{odev.odev} {odev.aciklama ? `(${odev.aciklama})` : ''}</Text>
                                                        </View>
                                                        <Text style={[styles.detayColTarih, { flex: 2 }]}>{formatTarih(new Date(odev.teslimttarihi))}</Text>
                                                        <View style={[styles.detayColDurum, { flex: 2 }]}>
                                                            <View style={[styles.detayDurumBadge, { backgroundColor: bg, borderColor: border, borderWidth: 1 }]}>
                                                                <Text style={[styles.detayDurumText, { color: text }]}>
                                                                    {odev.yapilmadurumu || 'Bekliyor'}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            });
                                        })()}
                                    </View>
                                </View>
                            )}

                            {/* ── SEKME 2: ÖZET TABLO ── */}
                            {raporTipi === 'ozet' && (
                                <View>
                                    {kaynakRaporYukleniyor ? (
                                        <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 24 }} />
                                    ) : kaynakRaporVerisi.length === 0 ? (
                                        <Text style={styles.bosRaporText}>Öğrenciye kaynak atanmamış.</Text>
                                    ) : (
                                        <>
                                            {/* Tablo Başlığı */}
                                            <View style={[styles.ozetSatir, styles.ozetBaslik]}>
                                                <Text style={[styles.ozetCol, styles.ozetColAd, styles.ozetBaslikText]}>Kaynak</Text>
                                                <Text style={[styles.ozetColSayi, styles.ozetBaslikText]}>İçerik</Text>
                                                <Text style={[styles.ozetColSayi, styles.ozetBaslikText]}>Ödev</Text>
                                                <Text style={[styles.ozetColSayi, styles.ozetBaslikText]}>✓</Text>
                                                <Text style={[styles.ozetColSayi, styles.ozetBaslikText]}>%</Text>
                                            </View>
                                            {kaynakRaporVerisi.map((k, i) => (
                                                <View key={i} style={[styles.ozetSatir, i % 2 === 1 && { backgroundColor: '#f9f9f9' }]}>
                                                    <View style={styles.ozetCol}>
                                                        <Text style={styles.ozetKaynakAd} numberOfLines={1}>{k.kaynakAd}</Text>
                                                        {k.kaynakTur !== '-' && (
                                                            <Text style={styles.ozetKaynakTur}>{k.kaynakTur}</Text>
                                                        )}
                                                    </View>
                                                    <Text style={styles.ozetColSayi}>{k.globalKaynakVar ? k.toplamIcerik : '-'}</Text>
                                                    <Text style={styles.ozetColSayi}>{k.odevVerilenIcerik}</Text>
                                                    <Text style={[styles.ozetColSayi, { color: '#27ae60', fontWeight: '700' }]}>{k.tamamlananIcerik}</Text>
                                                    <Text style={[styles.ozetColSayi, {
                                                        color: k.tamamlanmaOrani >= 80 ? '#27ae60' : k.tamamlanmaOrani >= 40 ? '#e67e22' : '#e74c3c',
                                                        fontWeight: '700'
                                                    }]}>
                                                        {k.globalKaynakVar ? `%${k.tamamlanmaOrani}` : '-'}
                                                    </Text>
                                                </View>
                                            ))}
                                            <TouchableOpacity style={[styles.raporPdfBtn, { marginTop: 16 }]} onPress={() => kaynakOzetPdfOlustur()}>
                                                <MaterialIcons name="picture-as-pdf" size={18} color="white" />
                                                <Text style={styles.raporPdfBtnText}>PDF Olarak Paylaş</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            )}

                            {/* ── SEKME 3: KAYNAK DETAY ── */}
                            {raporTipi === 'detay' && (
                                <View>
                                    {kaynakRaporYukleniyor ? (
                                        <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 24 }} />
                                    ) : (
                                        <>
                                            <Text style={styles.modalSubtitle}>Kaynak seçiniz:</Text>
                                            <View style={styles.kaynakSecimListesi}>
                                                {kaynakRaporVerisi.map((k, i) => (
                                                    <TouchableOpacity
                                                        key={i}
                                                        style={[styles.kaynakSecimChip, seciliRaporKaynak?.kaynakAd === k.kaynakAd && styles.kaynakSecimChipAktif]}
                                                        onPress={() => setSeciliRaporKaynak(k)}
                                                    >
                                                        <Text style={[styles.kaynakSecimChipText, seciliRaporKaynak?.kaynakAd === k.kaynakAd && { color: 'white' }]}>
                                                            {k.kaynakAd}
                                                        </Text>
                                                        {k.kaynakTur !== '-' && (
                                                            <Text style={[styles.kaynakSecimChipTur, seciliRaporKaynak?.kaynakAd === k.kaynakAd && { color: '#cce5ff' }]}>
                                                                {k.kaynakTur}
                                                            </Text>
                                                        )}
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            {seciliRaporKaynak && (
                                                <View style={{ marginTop: 12 }}>
                                                    {!seciliRaporKaynak.globalKaynakVar ? (
                                                        <Text style={styles.bosRaporText}>Bu kaynak için içerik tanımlanmamış.</Text>
                                                    ) : seciliRaporKaynak.konular.length === 0 ? (
                                                        <Text style={styles.bosRaporText}>Bu kaynağa henüz konu eklenmemiş.</Text>
                                                    ) : (
                                                        <>
                                                            <View style={[styles.detaySatir, styles.ozetBaslik]}>
                                                                <Text style={[styles.detayColKonu, styles.ozetBaslikText]}>Konu</Text>
                                                                <Text style={[styles.detayColTarih, styles.ozetBaslikText]}>Ödev Tarihi</Text>
                                                                <Text style={[styles.detayColDurum, styles.ozetBaslikText]}>Durum</Text>
                                                            </View>
                                                            {seciliRaporKaynak.konular.map((konu, ki) => (
                                                                <TouchableOpacity
                                                                    key={ki}
                                                                    style={[styles.detaySatir, ki % 2 === 1 && { backgroundColor: '#f9f9f9' }]}
                                                                    onPress={() => konuTiklandi(seciliRaporKaynak.kaynakAd, konu)}
                                                                >
                                                                    <Text style={styles.detayColKonu} numberOfLines={2}>{konu.icerik}</Text>
                                                                    <Text style={styles.detayColTarih}>{konu.odevTarihi ? formatTarih(konu.odevTarihi) : '-'}</Text>
                                                                    <View style={[styles.detayDurumBadge, {
                                                                        backgroundColor: !konu.odevVarMi ? '#f0f0f0'
                                                                            : konu.odevDurumu === 'Yapıldı' ? '#d4edda'
                                                                            : konu.odevDurumu === 'Bekliyor' ? '#fff3cd'
                                                                            : '#f8d7da'
                                                                    }]}>
                                                                        <Text style={[styles.detayDurumText, {
                                                                            color: !konu.odevVarMi ? '#999'
                                                                                : konu.odevDurumu === 'Yapıldı' ? '#155724'
                                                                                : konu.odevDurumu === 'Bekliyor' ? '#856404'
                                                                                : '#721c24'
                                                                        }]}>
                                                                            {!konu.odevVarMi ? 'Atanmadı' : konu.odevDurumu ?? '-'}
                                                                        </Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            ))}
                                                            <TouchableOpacity style={[styles.raporPdfBtn, { marginTop: 12 }]} onPress={() => kaynakDetayPdfOlustur(seciliRaporKaynak)}>
                                                                <MaterialIcons name="picture-as-pdf" size={18} color="white" />
                                                                <Text style={styles.raporPdfBtnText}>PDF Olarak Paylaş</Text>
                                                            </TouchableOpacity>
                                                        </>
                                                    )}
                                                </View>
                                            )}
                                        </>
                                    )}
                                </View>
                            )}

                            {/* ── SEKME 4: KAPSAMLI ── */}
                            {raporTipi === 'kapsamli' && (
                                <View>
                                    {kaynakRaporYukleniyor ? (
                                        <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 24 }} />
                                    ) : kaynakRaporVerisi.length === 0 ? (
                                        <Text style={styles.bosRaporText}>Kaynak bulunamadı.</Text>
                                    ) : (
                                        <>
                                            {kaynakRaporVerisi.map((k, ki) => (
                                                <View key={ki} style={styles.kapsamliKaynakCard}>
                                                    <TouchableOpacity
                                                        style={styles.kapsamliKaynakBaslik}
                                                        onPress={() => setGenisletilmisKaynak(genisletilmisKaynak === k.kaynakAd ? null : k.kaynakAd)}
                                                    >
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.kapsamliKaynakAd}>{k.kaynakAd}
                                                                {k.kaynakTur !== '-' && <Text style={styles.kapsamliKaynakTur}> ({k.kaynakTur})</Text>}
                                                            </Text>
                                                            <Text style={styles.kapsamliKaynakOzet}>
                                                                {k.globalKaynakVar
                                                                    ? `${k.tamamlananIcerik}/${k.toplamIcerik} tamamlandı · %${k.tamamlanmaOrani}`
                                                                    : 'İçerik tanımlı değil'}
                                                            </Text>
                                                        </View>
                                                        <MaterialIcons
                                                            name={genisletilmisKaynak === k.kaynakAd ? 'expand-less' : 'expand-more'}
                                                            size={22} color="#666"
                                                        />
                                                    </TouchableOpacity>

                                                    {genisletilmisKaynak === k.kaynakAd && k.konular.length > 0 && (
                                                        <View style={styles.kapsamliKonuListe}>
                                                            {k.konular.map((konu, i) => (
                                                                <TouchableOpacity
                                                                    key={i}
                                                                    style={styles.kapsamliKonuSatir}
                                                                    onPress={() => konuTiklandi(k.kaynakAd, konu)}
                                                                >
                                                                    <View style={[styles.konuDurumDot, {
                                                                        backgroundColor: !konu.odevVarMi ? '#ccc'
                                                                            : konu.odevDurumu === 'Yapıldı' ? '#27ae60'
                                                                            : konu.odevDurumu === 'Bekliyor' ? '#f39c12'
                                                                            : '#e74c3c'
                                                                    }]} />
                                                                    <Text style={styles.kapsamliKonuText} numberOfLines={2}>{konu.icerik}</Text>
                                                                    <Text style={styles.kapsamliKonuTarih}>
                                                                        {konu.odevTarihi ? formatTarih(konu.odevTarihi) : '—'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                            ))}
                                            <TouchableOpacity style={[styles.raporPdfBtn, { marginTop: 12 }]} onPress={() => kapsamliPdfOlustur()}>
                                                <MaterialIcons name="picture-as-pdf" size={18} color="white" />
                                                <Text style={styles.raporPdfBtnText}>Kapsamlı PDF Raporu</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            )}

                        </ScrollView>
                    </View>
                </View>

                {showRaporBaslangicPicker && (
                    <DateTimePicker value={raporBaslangic} mode="date" display="default"
                        onChange={(event, date) => { setShowRaporBaslangicPicker(false); if (date) setRaporBaslangic(date); }} />
                )}
                {showRaporBitisPicker && (
                    <DateTimePicker value={raporBitis} mode="date" display="default"
                        onChange={(event, date) => { setShowRaporBitisPicker(false); if (date) setRaporBitis(date); }} />
                )}
            </Modal>

            {/* ── ÖDEV BİLGİ YOLLA MODALI ── */}
            <Modal visible={bilgiModalGorunur} animationType="fade" transparent={true} onRequestClose={() => setBilgiModalGorunur(false)}>
                <View style={styles.modalOverlay}>
                    <ScrollView 
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }} 
                        style={{ width: '100%' }} 
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.reportModalContent, { height: 'auto', padding: 20 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ödev Bilgisi Yolla (WhatsApp)</Text>
                            <TouchableOpacity onPress={() => setBilgiModalGorunur(false)}>
                                <MaterialIcons name="close" size={24} color="#555" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ marginTop: 10, marginBottom: 5, fontWeight: 'bold' }}>Tarih Aralığı Seçin</Text>
                        <View style={styles.dateRangeContainer}>
                            <TouchableOpacity style={styles.reportDateButton} onPress={() => setShowBilgiBaslangic(true)}>
                                <MaterialIcons name="date-range" size={16} color="#666" />
                                <Text style={styles.reportDateText}>{formatTarih(bilgiBaslangic.toISOString())}</Text>
                            </TouchableOpacity>
                            <Text style={{ color: '#aaa', marginHorizontal: 4, alignSelf: 'center' }}>-</Text>
                            <TouchableOpacity style={styles.reportDateButton} onPress={() => setShowBilgiBitis(true)}>
                                <MaterialIcons name="date-range" size={16} color="#666" />
                                <Text style={styles.reportDateText}>{formatTarih(bilgiBitis.toISOString())}</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={{ marginTop: 15, marginBottom: 5, fontWeight: 'bold' }}>Alıcı Seçin</Text>
                        {ogrenci && (
                            <View style={{ marginBottom: 10 }}>
                                <Text style={{ fontSize: 12, color: ogrenci.veli_odev_istiyor_mu === 1 ? '#27ae60' : '#e74c3c', marginBottom: 2, fontStyle: 'italic' }}>
                                    Not: 1. Veli ({ogrenci.veliAd || 'Veli'}) ödev bilgisi {ogrenci.veli_odev_istiyor_mu === 1 ? 'İSTİYOR' : 'İSTEMİYOR'}.
                                </Text>
                                <Text style={{ fontSize: 12, color: ogrenci.veli2_odev_istiyor_mu === 1 ? '#27ae60' : '#e74c3c', marginBottom: 2, fontStyle: 'italic' }}>
                                    Not: 2. Veli ({ogrenci.veli2Ad || '2. Veli'}) ödev bilgisi {ogrenci.veli2_odev_istiyor_mu === 1 ? 'İSTİYOR' : 'İSTEMİYOR'}.
                                </Text>
                            </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: 15, marginBottom: 20, flexWrap: 'wrap' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Switch
                                    value={bilgiOgrenciSecili}
                                    onValueChange={setBilgiOgrenciSecili}
                                />
                                <Text style={{ marginLeft: 8 }}>Öğrenci</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Switch
                                    value={bilgiVeliSecili}
                                    onValueChange={setBilgiVeliSecili}
                                />
                                <Text style={{ marginLeft: 8 }}>1. Veli</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Switch
                                    value={bilgiVeli2Secili}
                                    onValueChange={setBilgiVeli2Secili}
                                />
                                <Text style={{ marginLeft: 8 }}>2. Veli</Text>
                            </View>
                        </View>

                        <Text style={{ marginTop: 5, marginBottom: 5, fontWeight: 'bold' }}>Gönderilecek Ödevler (Önizleme):</Text>
                        <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#eee' }}>
                            {(() => {
                                const onizlemeOdevler = odevler.filter(o => {
                                    if (!o.verilmetarihi) return false;
                                    const t = new Date(o.verilmetarihi).getTime();
                                    const basDate = new Date(bilgiBaslangic);
                                    basDate.setHours(0, 0, 0, 0);
                                    const bitDate = new Date(bilgiBitis);
                                    bitDate.setHours(23, 59, 59, 999);
                                    return t >= basDate.getTime() && t <= bitDate.getTime();
                                });
                                if (onizlemeOdevler.length === 0) return <Text style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>Bu tarih aralığında ödev bulunamadı.</Text>;
                                return onizlemeOdevler.map((o, idx) => (
                                    <View key={idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#333' }}>{o.kaynak}</Text>
                                        <Text style={{ fontSize: 11, color: '#666' }}>{o.odev} {o.aciklama ? `(${o.aciklama})` : ''}</Text>
                                    </View>
                                ));
                            })()}
                        </ScrollView>

                        <TouchableOpacity style={[styles.raporPdfBtn, { backgroundColor: '#25D366', marginBottom: 0 }]} onPress={whatsappOdevBilgiYolla}>
                            <MaterialIcons name="send" size={18} color="white" />
                            <Text style={styles.raporPdfBtnText}>WhatsApp ile Yolla</Text>
                        </TouchableOpacity>
                    </View>
                    </ScrollView>
                </View>

                {showBilgiBaslangic && (
                    <DateTimePicker value={bilgiBaslangic} mode="date" display="default"
                        onChange={(event, date) => { setShowBilgiBaslangic(false); if (date) setBilgiBaslangic(date); }} />
                )}
                {showBilgiBitis && (
                    <DateTimePicker value={bilgiBitis} mode="date" display="default"
                        onChange={(event, date) => { setShowBilgiBitis(false); if (date) setBilgiBitis(date); }} />
                )}
            </Modal>

            {/* ─── DURUM SEÇİM MODALI ─── */}
            <Modal
                visible={durumSecimModalGorunur}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setDurumSecimModalGorunur(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.reportModalContent, { height: 'auto', padding: 20, width: '90%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Durum Ata</Text>
                                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                    {seciliKonuKaynakAd}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setDurumSecimModalGorunur(false)}>
                                <MaterialIcons name="close" size={24} color="#555" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ marginVertical: 15 }}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 10 }}>
                                Konu: <Text style={{ fontWeight: 'normal' }}>{seciliKonu?.icerik}</Text>
                            </Text>

                            <Text style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 15 }}>
                                Lütfen bu içerik/konu için yeni durumu seçin:
                            </Text>

                            <View style={styles.durumAtaButonlarGrup}>
                                <TouchableOpacity
                                    style={[styles.durumAtaButon, { backgroundColor: '#e8f5e9', borderColor: '#81c784' }]}
                                    onPress={() => durumAta('Yapıldı')}
                                >
                                    <View style={[styles.durumAtaDot, { backgroundColor: '#27ae60' }]} />
                                    <Text style={[styles.durumAtaText, { color: '#2e7d32' }]}>Yapıldı</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.durumAtaButon, { backgroundColor: '#fff3e0', borderColor: '#ffb74d' }]}
                                    onPress={() => durumAta('Eksik')}
                                >
                                    <View style={[styles.durumAtaDot, { backgroundColor: '#e67e22' }]} />
                                    <Text style={[styles.durumAtaText, { color: '#e65100' }]}>Eksik</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.durumAtaButon, { backgroundColor: '#f8d7da', borderColor: '#f5c6cb' }]}
                                    onPress={() => durumAta('Yapılmadı')}
                                >
                                    <View style={[styles.durumAtaDot, { backgroundColor: '#c62828' }]} />
                                    <Text style={[styles.durumAtaText, { color: '#721c24' }]}>Yapılmadı</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.durumAtaButon, { backgroundColor: '#e3f2fd', borderColor: '#90caf9' }]}
                                    onPress={() => durumAta('Bekliyor')}
                                >
                                    <View style={[styles.durumAtaDot, { backgroundColor: '#1565c0' }]} />
                                    <Text style={[styles.durumAtaText, { color: '#0d47a1' }]}>Bekliyor</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.durumAtaButon, { backgroundColor: '#f5f5f5', borderColor: '#ddd' }]}
                                    onPress={() => durumAta('Atanmadı')}
                                >
                                    <View style={[styles.durumAtaDot, { backgroundColor: '#777' }]} />
                                    <Text style={[styles.durumAtaText, { color: '#333' }]}>Atanmadı (Ödevi Sil)</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.paylasimButon, { backgroundColor: '#e74c3c', width: '100%', marginTop: 10, flex: 0 }]}
                            onPress={() => setDurumSecimModalGorunur(false)}
                        >
                            <Text style={styles.paylasimText}>Kapat</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e2effcff',
        paddingTop: 0,
        padding:2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e8ed',
        elevation: 2,
    },
    headerTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 16,
        color: '#333',
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 2,
        paddingBottom: 40,
    },
    formContainer: {
        backgroundColor: '#bedffaff',
        borderRadius: 8,
        padding: 6,
        marginBottom: 16,
        elevation: 2,
    },
    kaynakEkleButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3498db',
        padding: 12,
        borderRadius: 6,
        marginBottom: 16,
    },
    kaynakEkleText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 6,
    },
    inputContainer: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 6,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        backgroundColor: '#f7f59fff',
        overflow: 'hidden',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    picker: {
        height: 50,
        color: '#2c3e50',
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    switchLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#333',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 8,
        backgroundColor: '#fff',
    },
    dateText: {
        marginLeft: 8,
        fontSize: 10,
        color: '#333',
    },
    odevVerButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#27ae60',
        padding: 10,
        borderRadius: 6,
        marginTop: 8,
    },
    odevVerText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 12,
    },
    odevlerContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 12,
        elevation: 2,
        marginBottom: 30, // Telefon navigasyon tuşları altında kalmaması için korundu
    },
    odevlerHeaderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
    },
    filtreButonlariGrup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    filtreButon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f2f5',
        paddingVertical: 4,
        paddingHorizontal: 18,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e1e8ed',
    },
    filtreButonText: {
        fontSize: 11,
        color: '#333',
        fontWeight: '600',
        marginLeft: 2,
    },
    bosListe: {
        padding: 30,
        alignItems: 'center',
    },
    bosListeText: {
        color: '#666',
        fontStyle: 'italic',
        marginTop: 8,
        fontSize: 13,
    },
    topControlPanel: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingVertical: 6,
        paddingHorizontal: 1,
        borderRadius: 8,
        marginBottom: 5,
        elevation: 2,
    },
    switchControl: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    switchControlLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 1,
    },
    raporButon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e67e22',
        paddingVertical: 5,
        paddingHorizontal: 5,
        borderRadius: 16,
    },
    raporButonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 4,
        fontSize: 9,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reportModalContent: {
        width: '95%',
        height: '90%',
        backgroundColor: 'white',
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 8,
    },

    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },

    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    dateRangeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    reportDateButton: {
        flex: 0.48,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
    },
    dateLabel: {
        fontSize: 11,
        color: '#7f8c8d',
        marginBottom: 4,
    },
    dateValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    raporAksiyonlar: {
        gap: 12,
    },
    raporAksiyonButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 8,
    },
    raporAksiyonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 10,
        fontSize: 16,
    },
    raporPaylasımGrup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
    },
    paylasimButon: {
        flex: 0.48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
    },
    paylasimText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 13,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    loadingText: {
        marginTop: 10,
        color: '#3498db',
        fontWeight: 'bold',
    },
    // Konu modu (listeden / elle yaz) toggle
    konuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    konuModToggle: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        overflow: 'hidden',
    },
    konuModBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 3,
    },
    konuModBtnAktif: {
        backgroundColor: '#3498db',
    },
    konuModBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#555',
    },
    // İçerik seçim listesi
    icerikListeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingVertical: 4,
    },
    icerikSecimChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#3498db',
        backgroundColor: '#fff',
    },
    icerikSecimChipAktif: {
        backgroundColor: '#3498db',
    },
    icerikSecimChipText: {
        fontSize: 13,
        color: '#3498db',
        fontWeight: '500',
    },
    icerikSecimChipTextAktif: {
        color: 'white',
        fontWeight: '700',
    },

    // ── Rapor Modalı Sekme Stilleri ──
    raporSekmeScrView: { borderBottomWidth: 1, borderBottomColor: '#eee', flexGrow: 0 },
    raporSekmeRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
    raporSekmeBtn: {
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 16, borderWidth: 1, borderColor: '#ddd',
        backgroundColor: '#f5f5f5',
    },
    raporSekmeBtnAktif: { backgroundColor: '#2c3e50', borderColor: '#2c3e50' },
    raporSekmeBtnText: { fontSize: 12, color: '#555', fontWeight: '600' },
    raporSekmeBtnTextAktif: { color: 'white' },
    raporIcerik: { flex: 1, padding: 16, paddingBottom: 40 },

    // Özet tablo
    ozetSatir: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    ozetBaslik: { backgroundColor: '#2c3e50', borderBottomWidth: 0, paddingHorizontal: 4, borderRadius: 6, marginBottom: 4 },
    ozetBaslikText: { color: 'white', fontWeight: '700', fontSize: 11 },
    ozetCol: { flex: 2, paddingHorizontal: 4 },
    ozetColAd: {},
    ozetColSayi: { flex: 1, textAlign: 'center', fontSize: 12, paddingHorizontal: 2, color: '#333' },
    ozetKaynakAd: { fontSize: 12, color: '#2c3e50', fontWeight: '600' },
    ozetKaynakTur: { fontSize: 10, color: '#95a5a6' },
    bosRaporText: { textAlign: 'center', color: '#aaa', fontStyle: 'italic', marginTop: 32, fontSize: 14 },

    // Detay tablo
    detaySatir: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    detayColKonu: { flex: 3, fontSize: 12, color: '#333', paddingRight: 4 },
    detayColTarih: { flex: 2, fontSize: 11, color: '#666', textAlign: 'center' },
    detayColDurum: { flex: 2, textAlign: 'center' },
    detayDurumBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'center' },
    detayDurumText: { fontSize: 10, fontWeight: '700' },
    kaynakSecimListesi: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    kaynakSecimChip: {
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
        borderWidth: 1.5, borderColor: '#3498db', backgroundColor: '#fff',
    },
    kaynakSecimChipAktif: { backgroundColor: '#3498db' },
    kaynakSecimChipText: { fontSize: 13, color: '#3498db', fontWeight: '600' },
    kaynakSecimChipTur: { fontSize: 10, color: '#95a5a6' },

    // Kapsamlı
    kapsamliKaynakCard: {
        borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
        marginBottom: 12, overflow: 'hidden',
    },
    kapsamliKaynakBaslik: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#34495e', padding: 12,
    },
    kapsamliKaynakAd: { fontSize: 14, fontWeight: '700', color: 'white' },
    kapsamliKaynakTur: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '400' },
    kapsamliKaynakOzet: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    kapsamliKonuListe: { backgroundColor: '#fafafa', paddingVertical: 4 },
    kapsamliKonuSatir: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, paddingHorizontal: 12,
        borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    },
    konuDurumDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    kapsamliKonuText: { flex: 1, fontSize: 12, color: '#333' },
    kapsamliKonuTarih: { fontSize: 10, color: '#999', marginLeft: 4 },

    // PDF buton
    raporPdfBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#e74c3c', padding: 12, borderRadius: 8, gap: 6, marginBottom: 30
    },
    raporPdfBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    // Tarih Araligi Secici Stilleri (iOS & Android)
    reportDateText: {
        fontSize: 13,
        color: '#333',
        fontWeight: '500',
    },
    durumAtaButonlarGrup: {
        gap: 10,
    },
    durumAtaButon: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    durumAtaDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 12,
    },
    durumAtaText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    odevTarihler: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
        gap: 10,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fff',
    },
    modalButton: {
        flex: 0.48,
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    cancelButton: {
        backgroundColor: '#f1f2f6',
        borderWidth: 1,
        borderColor: '#ced6e0',
    },
    cancelButtonText: {
        color: '#57606f',
        fontSize: 14,
        fontWeight: 'bold',
    },
    saveButton: {
        backgroundColor: '#2ecc71',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
});




