import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    ScrollView,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import * as Sharing from 'expo-sharing';
import {
    tumKaynakEkle,
    tumKaynakGuncelle,
    getTumKaynaklar,
    tumKaynakSil,
    kaynakIcerikEkle,
    getKaynakIcerikleri,
    kaynakIcerikGuncelle,
    kaynakIcerikSil,
    kaynakTumIcerikleriniSil,
    getTumKaynakTurleri,
    kaynakTuruEkle,
    kaynakTuruGuncelle,
    kaynakTuruSil,
    kaynakTuruKullanimSayisi,
    kaynakIcerikleriniKopyala,
    kaynakIcerikSiraGuncelle,
    type KaynakTuru,
} from '../database/homeworkOperations';

// Dinamik renk paleti — index'e göre renk 
const TUR_RENKLER = ['#3498db','#9b59b6','#27ae60','#16a085','#e67e22','#e74c3c','#f39c12','#1abc9c','#d35400','#8e44ad'];
const turRenk = (ad: string, turleri: KaynakTuru[]): string => {
    const idx = turleri.findIndex(t => t.ad === ad);
    return TUR_RENKLER[idx % TUR_RENKLER.length] ?? '#95a5a6';
};


type GlobalKaynak = { id: number; ad: string; tur: string };
type IcerikItem  = { id: number; kaynakId: number; icerik: string };

export default function GlobalKaynakYonetimi() {
    const navigation = useNavigation<any>();

    // Ana liste
    const [kaynaklar, setKaynaklar]     = useState<GlobalKaynak[]>([]);
    const [yeniKaynak, setYeniKaynak]   = useState('');
    const [secilenTur, setSecilenTur]   = useState('');
    const [loading, setLoading]         = useState(true);

    // Kaynak Türleri
    const [kaynak_turleri, setKaynakTurleri] = useState<KaynakTuru[]>([]);
    const [turModalGorunur, setTurModalGorunur] = useState(false);
    const [yeniTur, setYeniTur]         = useState('');
    const [duzTurId, setDuzTurId]       = useState<number | null>(null);
    const [duzTurAd, setDuzTurAd]       = useState('');
    const [duzTurEskiAd, setDuzTurEskiAd] = useState('');

    // Düzenleme modalı
    const [modalGorunur, setModalGorunur]       = useState(false);
    const [seciliKaynak, setSeciliKaynak]       = useState<GlobalKaynak | null>(null);
    const [duzAd, setDuzAd]                     = useState('');
    const [duzTur, setDuzTur]                   = useState('');
    const [icerikler, setIcerikler]             = useState<IcerikItem[]>([]);
    const [yeniIcerik, setYeniIcerik]           = useState('');
    const [icerikYukleniyor, setIcerikYukleniyor] = useState(false);

    // İçerik düzenleme
    const [duzIcerikId, setDuzIcerikId]         = useState<number | null>(null);
    const [duzIcerikMetin, setDuzIcerikMetin]   = useState('');

    // İçerik kopyalama
    const [kopyalaModalGorunur, setKopyalaModalGorunur] = useState(false);
    const [kopyalaKaynakSecili, setKopyalaKaynakSecili] = useState<GlobalKaynak | null>(null);
    const [kopyalaYukleniyor, setKopyalaYukleniyor] = useState(false);

    useEffect(() => {
        verileriYukle();
    }, []);

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => (
                <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>Global Kaynak Yönetimi</Text>
            ),
            headerTitleAlign: 'left',
            headerRight: () => (
                <TouchableOpacity
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.2)',
                        marginRight: 12,
                    }}
                    onPress={() => { setTurModalGorunur(true); turYukle(); }}
                >
                    <Text style={{ color: '#aef013ff', fontWeight: 'bold', fontSize: 12 }}>Türleri Yönet</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation]);

    const verileriYukle = async () => {
        try {
            setLoading(true);
            const [kRes, tRes] = await Promise.all([getTumKaynaklar(), getTumKaynakTurleri()]);
            if (kRes.success) setKaynaklar(kRes.data as GlobalKaynak[]);
            if (tRes.success) {
                setKaynakTurleri(tRes.data);
                if (tRes.data.length > 0 && !secilenTur) setSecilenTur(tRes.data[0].ad);
            }
        } catch {
            Alert.alert('Hata', 'Kaynaklar yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleEkle = async () => {
        if (!yeniKaynak.trim()) {
            Alert.alert('Uyarı', 'Lütfen kaynak adını giriniz');
            return;
        }
        const mevcut = kaynaklar.find(
            k => k.ad.toLowerCase() === yeniKaynak.trim().toLowerCase() && k.tur === secilenTur
        );
        if (mevcut) {
            Alert.alert('Uyarı', 'Bu kaynak zaten mevcut');
            return;
        }
        const result = await tumKaynakEkle(yeniKaynak.trim(), secilenTur);
        if (result.success) {
            setYeniKaynak('');
            Keyboard.dismiss();
            await verileriYukle();
        } else {
            Alert.alert('Hata', 'Kaynak eklenemedi');
        }
    };

    const handleSil = (kaynak: GlobalKaynak) => {
        Alert.alert(
            'Kaynak Sil',
            `"${kaynak.ad} (${kaynak.tur})" kaynağını silmek istediğinizden emin misiniz?\nBu kaynağa ait tüm içerikler de silinecektir.`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await tumKaynakSil(kaynak.id);
                        if (result.success) {
                            await verileriYukle();
                        } else {
                            Alert.alert('Hata', 'Silme işlemi başarısız');
                        }
                    }
                }
            ]
        );
    };

    const modalAc = async (kaynak: GlobalKaynak) => {
        setSeciliKaynak(kaynak);
        setDuzAd(kaynak.ad);
        setDuzTur(kaynak.tur);
        setYeniIcerik('');
        setDuzIcerikId(null);
        setDuzIcerikMetin('');
        setKopyalaKaynakSecili(null);
        setModalGorunur(true);
        await iceriklerYukle(kaynak.id);
    };

    const modalKapat = () => {
        setModalGorunur(false);
        setSeciliKaynak(null);
        setIcerikler([]);
    };

    const handleKaynakKaydet = async () => {
        if (!duzAd.trim()) {
            Alert.alert('Uyarı', 'Kaynak adı boş olamaz');
            return;
        }
        if (!seciliKaynak) return;
        const result = await tumKaynakGuncelle(seciliKaynak.id, duzAd.trim(), duzTur);
        if (result.success) {
            Alert.alert('Başarılı', 'Kaynak güncellendi');
            await verileriYukle();
            setSeciliKaynak({ ...seciliKaynak, ad: duzAd.trim(), tur: duzTur });
        } else {
            Alert.alert('Hata', 'Güncelleme başarısız');
        }
    };

    const iceriklerYukle = async (kaynakId: number) => {
        setIcerikYukleniyor(true);
        const result = await getKaynakIcerikleri(kaynakId);
        if (result.success) {
            setIcerikler(result.data as IcerikItem[]);
        }
        setIcerikYukleniyor(false);
    };

    const handleIcerikEkle = async () => {
        if (!yeniIcerik.trim() || !seciliKaynak) return;
        const result = await kaynakIcerikEkle(seciliKaynak.id, yeniIcerik.trim());
        if (result.success) {
            setYeniIcerik('');
            Keyboard.dismiss();
            await iceriklerYukle(seciliKaynak.id);
        } else {
            Alert.alert('Hata', 'İçerik eklenemedi');
        }
    };

    const handleExcelIcerikEkle = async () => {
        if (!seciliKaynak) return;

        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
                copyToCacheDirectory: true,
            });

            if (res.canceled) return;
            const file = res.assets[0];

            setIcerikYukleniyor(true);

            // Read file as Base64 using FileSystem
            const fileBase64 = await FileSystem.readAsStringAsync(file.uri, {
                encoding: 'base64',
            });

            // Parse with XLSX
            const workbook = XLSX.read(fileBase64, { type: 'base64' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON array of arrays
            const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

            // Extract contents from first column (A)
            const eklenenIcerikler: string[] = [];
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (row && row.length > 0) {
                    const cellValue = row[0];
                    if (cellValue && String(cellValue).trim() !== '') {
                        eklenenIcerikler.push(String(cellValue).trim());
                    }
                }
            }

            if (eklenenIcerikler.length === 0) {
                Alert.alert('Uyarı', 'Excel dosyasının ilk sütununda (A Sütunu) okunabilir bir içerik bulunamadı.');
                setIcerikYukleniyor(false);
                return;
            }

            // Insert each content to database
            let basariliS = 0;
            for (const icerik of eklenenIcerikler) {
                const r = await kaynakIcerikEkle(seciliKaynak.id, icerik);
                if (r.success) basariliS++;
            }

            Alert.alert('Tamamlandı', `${basariliS} içerik başarıyla eklendi!`);
            await iceriklerYukle(seciliKaynak.id);
            
        } catch (error) {
            console.error('Excel Yükleme Hatası:', error);
            Alert.alert('Hata', 'Excel dosyası okunurken bir sorun oluştu. Lütfen dosya formatını kontrol edin.');
        } finally {
            setIcerikYukleniyor(false);
        }
    };

    const handleIcerikDuzenlemeBaslat = (item: IcerikItem) => {
        setDuzIcerikId(item.id);
        setDuzIcerikMetin(item.icerik);
    };

    const handleIcerikGuncelle = async () => {
        if (!duzIcerikMetin.trim() || duzIcerikId === null) return;
        const result = await kaynakIcerikGuncelle(duzIcerikId, duzIcerikMetin.trim());
        if (result.success) {
            setDuzIcerikId(null);
            setDuzIcerikMetin('');
            if (seciliKaynak) await iceriklerYukle(seciliKaynak.id);
        } else {
            Alert.alert('Hata', 'Güncelleme başarısız');
        }
    };

    const handleIcerikSil = (item: IcerikItem) => {
        Alert.alert('İçerik Sil', `"${item.icerik}" içeriğini silmek istiyor musunuz?`, [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Sil',
                style: 'destructive',
                onPress: async () => {
                    const result = await kaynakIcerikSil(item.id);
                    if (result.success && seciliKaynak) {
                        await iceriklerYukle(seciliKaynak.id);
                    }
                }
            }
        ]);
    };

    const turYukle = async () => {
        const r = await getTumKaynakTurleri();
        if (r.success) setKaynakTurleri(r.data);
    };

    const handleTurEkle = async () => {
        if (!yeniTur.trim()) return;
        const r = await kaynakTuruEkle(yeniTur.trim());
        if (r.success) {
            setYeniTur('');
            Keyboard.dismiss();
            await turYukle();
        } else {
            Alert.alert('Hata', 'Bu tür zaten mevcut olabilir.');
        }
    };

    const handleTurGuncelle = async () => {
        if (!duzTurAd.trim() || duzTurId === null) return;
        const kullanimSayisi = await kaynakTuruKullanimSayisi(duzTurEskiAd);
        if (kullanimSayisi > 0) {
            Alert.alert(
                'Mevcut Kaynaklar Güncellensin mi?',
                `"${duzTurEskiAd}" türünde ${kullanimSayisi} kaynak var. Bu kaynakların türü de "${duzTurAd}" olarak güncellensin mi?`,
                [
                    {
                        text: 'Hayır, Sadece Tür Adını Değiştir',
                        onPress: async () => {
                            await kaynakTuruGuncelle(duzTurId!, duzTurAd, duzTurEskiAd, false);
                            setDuzTurId(null); setDuzTurAd(''); setDuzTurEskiAd('');
                            await turYukle();
                            await verileriYukle();
                        }
                    },
                    {
                        text: 'Evet, Hepsini Güncelle',
                        onPress: async () => {
                            await kaynakTuruGuncelle(duzTurId!, duzTurAd, duzTurEskiAd, true);
                            setDuzTurId(null); setDuzTurAd(''); setDuzTurEskiAd('');
                            await turYukle();
                            await verileriYukle();
                        }
                    },
                    { text: 'Vazgeç', style: 'cancel' }
                ]
            );
        } else {
            await kaynakTuruGuncelle(duzTurId!, duzTurAd, duzTurEskiAd, false);
            setDuzTurId(null); setDuzTurAd(''); setDuzTurEskiAd('');
            await turYukle();
        }
    };

    const handleTurSil = (tur: KaynakTuru) => {
        Alert.alert(
            'Türü Sil',
            `"${tur.ad}" türünü silmek istiyor musunuz?\nBu türe atanmış kaynakların tür bilgisi değişmez.`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        await kaynakTuruSil(tur.id);
                        await turYukle();
                    }
                }
            ]
        );
    };

    const handleIcerikKopyala = async () => {
        if (!kopyalaKaynakSecili || !seciliKaynak) return;
        if (kopyalaKaynakSecili.id === seciliKaynak.id) {
            Alert.alert('Uyarı', 'Aynı kaynakı seçtiniz.');
            return;
        }
        setKopyalaYukleniyor(true);
        const r = await kaynakIcerikleriniKopyala(kopyalaKaynakSecili.id, seciliKaynak.id);
        setKopyalaYukleniyor(false);
        if (r.success) {
            Alert.alert('Tamam', `${r.eklenenSayi} içerik kopyalandı (${r.toplamKaynak - r.eklenenSayi} zaten mevcuttu).`);
            setKopyalaModalGorunur(false);
            setKopyalaKaynakSecili(null);
            await iceriklerYukle(seciliKaynak.id);
        } else {
            Alert.alert('Hata', 'Kopyalama başarısız.');
        }
    };

    const handleTumIceriklerSil = () => {
        if (!seciliKaynak || icerikler.length === 0) return;
        Alert.alert(
            'Tüm İçerikleri Sil',
            `"${seciliKaynak.ad}" kaynağına ait ${icerikler.length} içeriğin tamamı silinecek. Bu işlem geri alınamaz!`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Evet, Hepsini Sil',
                    style: 'destructive',
                    onPress: async () => {
                        setIcerikYukleniyor(true);
                        const r = await kaynakTumIcerikleriniSil(seciliKaynak.id);
                        setIcerikYukleniyor(false);
                        if (r.success) {
                            Alert.alert('Tamam', `${r.silinenSayi} içerik silindi.`);
                            await iceriklerYukle(seciliKaynak.id);
                        } else {
                            Alert.alert('Hata', 'Silme işlemi başarısız.');
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item, index }: { item: GlobalKaynak; index: number }) => (
        <View style={styles.item}>
            <View style={styles.itemInfo}>
                <Text style={styles.numara}>{index + 1}.</Text>
                <Text style={styles.ad}>{item.ad}</Text>
                <View style={[styles.turBadge, { backgroundColor: turRenk(item.tur, kaynak_turleri) }]}>
                    <Text style={styles.turBadgeText}>{item.tur}</Text>
                </View>
            </View>
            <View style={styles.itemActions}>
                <TouchableOpacity onPress={() => modalAc(item)} style={styles.duzButon}>
                    <MaterialIcons name="edit" size={18} color="#3498db" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSil(item)} style={styles.silButon}>
                    <MaterialIcons name="delete" size={18} color="#e74c3c" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderIcerikItem = ({ item, index }: { item: IcerikItem; index: number }) => {
        const duzenlemede = duzIcerikId === item.id;
        const isFirst = index === 0;
        const isLast = index === icerikler.length - 1;
        return (
            <View style={styles.icerikItem}>
                {duzenlemede ? (
                    <View style={styles.icerikDuzRow}>
                        <TextInput
                            style={styles.icerikDuzInput}
                            value={duzIcerikMetin}
                            onChangeText={setDuzIcerikMetin}
                            autoFocus
                        />
                        <TouchableOpacity onPress={handleIcerikGuncelle} style={styles.icerikKaydetBtn}>
                            <MaterialIcons name="check" size={18} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setDuzIcerikId(null); setDuzIcerikMetin(''); }} style={styles.icerikIptalBtn}>
                            <MaterialIcons name="close" size={18} color="#666" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.icerikGosterRow}>
                        <MaterialIcons name="fiber-manual-record" size={8} color="#95a5a6" style={{ marginRight: 8, marginTop: 2 }} />
                        <Text style={styles.icerikText}>{item.icerik}</Text>
                        <View style={styles.icerikBtnGrup}>
                            {/* Yukarı Taşı */}
                            <TouchableOpacity
                                onPress={() => handleIcerikSiraDegistir(item, 'yukari')}
                                style={[styles.icerikEditBtn, isFirst && { opacity: 0.3 }]}
                                disabled={isFirst}
                            >
                                <MaterialIcons name="arrow-upward" size={15} color={isFirst ? '#ccc' : '#3498db'} />
                            </TouchableOpacity>
                            {/* Aşağı Taşı */}
                            <TouchableOpacity
                                onPress={() => handleIcerikSiraDegistir(item, 'asagi')}
                                style={[styles.icerikEditBtn, isLast && { opacity: 0.3 }]}
                                disabled={isLast}
                            >
                                <MaterialIcons name="arrow-downward" size={15} color={isLast ? '#ccc' : '#3498db'} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleIcerikDuzenlemeBaslat(item)} style={styles.icerikEditBtn}>
                                <MaterialIcons name="edit" size={15} color="#3498db" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleIcerikSil(item)} style={styles.icerikSilBtn}>
                                <MaterialIcons name="delete" size={15} color="#e74c3c" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const handleIcerikSiraDegistir = async (item: IcerikItem, yon: 'yukari' | 'asagi') => {
        const index = icerikler.findIndex(ic => ic.id === item.id);
        if (index === -1) return;

        const hedefIndex = yon === 'yukari' ? index - 1 : index + 1;
        if (hedefIndex < 0 || hedefIndex >= icerikler.length) return;

        try {
            setIcerikYukleniyor(true);

            const yeniDizi = [...icerikler];
            const temp = yeniDizi[index];
            yeniDizi[index] = yeniDizi[hedefIndex];
            yeniDizi[hedefIndex] = temp;

            const guncellenecekler = yeniDizi.map((ic, i) => ({
                id: ic.id,
                sira: i,
            }));

            const r = await kaynakIcerikSiraGuncelle(guncellenecekler);
            if (r.success) {
                if (seciliKaynak) await iceriklerYukle(seciliKaynak.id);
            } else {
                Alert.alert('Hata', 'Sıralama güncellenemedi');
            }
        } catch (error) {
            console.error('Sıralama Hatası:', error);
            Alert.alert('Hata', 'Sıralama değiştirilemedi');
        } finally {
            setIcerikYukleniyor(false);
        }
    };

    const handleExcelGlobalKaynakImport = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'],
                copyToCacheDirectory: true,
            });

            if (res.canceled) return;
            const file = res.assets[0];

            setLoading(true);

            // Read file as Base64 using FileSystem
            const fileBase64 = await FileSystem.readAsStringAsync(file.uri, {
                encoding: 'base64',
            });

            // Parse with XLSX
            const workbook = XLSX.read(fileBase64, { type: 'base64' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON array of arrays
            const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

            if (!data || data.length === 0) {
                Alert.alert('Hata', 'Excel dosyası boş veya okunamadı.');
                setLoading(false);
                return;
            }

            // Extract data
            const sistemTurleri = kaynak_turleri.map(t => t.ad.trim().toLowerCase());
            const parsedRows: { kaynakAd: string; kaynakTur: string; icerik: string }[] = [];

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (row && row.length >= 2) {
                    const cellA = row[0] ? String(row[0]).trim() : '';
                    const cellB = row[1] ? String(row[1]).trim() : '';
                    const cellC = row[2] ? String(row[2]).trim() : '';

                    // Skip header row
                    if (
                        cellA.toLowerCase().includes('kaynak ad') ||
                        cellB.toLowerCase().includes('kaynak tür') ||
                        cellC.toLowerCase().includes('içerik') ||
                        cellC.toLowerCase().includes('konu')
                    ) {
                        continue;
                    }

                    if (cellA !== '' && cellB !== '') {
                        parsedRows.push({
                            kaynakAd: cellA,
                            kaynakTur: cellB,
                            icerik: cellC,
                        });
                    }
                }
            }

            if (parsedRows.length === 0) {
                Alert.alert('Uyarı', 'Excel dosyasında eklenebilecek geçerli kaynak veya içerik verisi bulunamadı.');
                setLoading(false);
                return;
            }

            // Validate resource types
            const gecersizSatirlar: string[] = [];
            for (let idx = 0; idx < parsedRows.length; idx++) {
                const row = parsedRows[idx];
                if (!sistemTurleri.includes(row.kaynakTur.toLowerCase())) {
                    gecersizSatirlar.push(`Satır ${idx + 2}: "${row.kaynakAd}" için belirtilen "${row.kaynakTur}" türü sistemde kayıtlı değil.`);
                }
            }

            if (gecersizSatirlar.length > 0) {
                Alert.alert(
                    'İçe Aktarma İptal Edildi',
                    `Sistemde tanımlı olmayan kaynak türleri tespit edildiği için işlem iptal edildi. Lütfen önce bu türleri ekleyin.\n\n` +
                    `Tanımsız Türler:\n${gecersizSatirlar.slice(0, 10).join('\n')}${gecersizSatirlar.length > 10 ? '\n... ve dahası' : ''}\n\n` +
                    `Sistemdeki Kaynak Türleri: ${kaynak_turleri.map(t => t.ad).join(', ')}`
                );
                setLoading(false);
                return;
            }

            // Group contents by resource
            const kaynakGruplari: Record<string, { ad: string; tur: string; icerikler: string[] }> = {};
            for (const row of parsedRows) {
                const key = `${row.kaynakAd.toLowerCase()}|||${row.kaynakTur.toLowerCase()}`;
                if (!kaynakGruplari[key]) {
                    kaynakGruplari[key] = {
                        ad: row.kaynakAd,
                        tur: kaynak_turleri.find(t => t.ad.toLowerCase() === row.kaynakTur.toLowerCase())?.ad || row.kaynakTur,
                        icerikler: [],
                    };
                }
                if (row.icerik && !kaynakGruplari[key].icerikler.includes(row.icerik)) {
                    kaynakGruplari[key].icerikler.push(row.icerik);
                }
            }

            // Validate existing resources to prevent duplicates
            const varOlanKaynaklar: string[] = [];
            for (const key in kaynakGruplari) {
                const group = kaynakGruplari[key];
                const mevcut = kaynaklar.find(
                    k => k.ad.toLowerCase() === group.ad.toLowerCase() && k.tur.toLowerCase() === group.tur.toLowerCase()
                );
                if (mevcut) {
                    varOlanKaynaklar.push(`- "${group.ad}" (${group.tur})`);
                }
            }

            if (varOlanKaynaklar.length > 0) {
                Alert.alert(
                    'İçe Aktarma İptal Edildi',
                    `Excel dosyasındaki bazı kaynaklar sistemde zaten kayıtlı olduğu için çakışmayı önlemek amacıyla işlem iptal edildi.\n\n` +
                    `Sistemde Zaten Kayıtlı Olanlar:\n${varOlanKaynaklar.slice(0, 10).join('\n')}${varOlanKaynaklar.length > 10 ? '\n... ve dahası' : ''}`
                );
                setLoading(false);
                return;
            }

            let eklenenKaynakSayisi = 0;
            let eklenenIcerikSayisi = 0;

            for (const key in kaynakGruplari) {
                const group = kaynakGruplari[key];

                let kaynakId: number;
                const mevcutKaynak = kaynaklar.find(
                    k => k.ad.toLowerCase() === group.ad.toLowerCase() && k.tur.toLowerCase() === group.tur.toLowerCase()
                );

                if (mevcutKaynak) {
                    kaynakId = mevcutKaynak.id;
                } else {
                    const r = await tumKaynakEkle(group.ad, group.tur);
                    if (r.success && r.id) {
                        kaynakId = r.id;
                        eklenenKaynakSayisi++;
                    } else {
                        throw new Error(`"${group.ad}" kaynağı oluşturulurken hata oluştu.`);
                    }
                }

                const mevcutIceriklerResult = await getKaynakIcerikleri(kaynakId);
                const mevcutIcerikMetinleri = mevcutIceriklerResult.success
                    ? (mevcutIceriklerResult.data as IcerikItem[]).map(ic => ic.icerik.trim().toLowerCase())
                    : [];

                for (const icerik of group.icerikler) {
                    if (!mevcutIcerikMetinleri.includes(icerik.trim().toLowerCase())) {
                        const r = await kaynakIcerikEkle(kaynakId, icerik);
                        if (r.success) {
                            eklenenIcerikSayisi++;
                        }
                    }
                }
            }

            Alert.alert(
                'Başarılı',
                `Excel'den içe aktarım tamamlandı!\n` +
                `- ${eklenenKaynakSayisi} yeni ortak kaynak eklendi.\n` +
                `- ${eklenenIcerikSayisi} yeni konu/içerik eklendi.`
            );

            await verileriYukle();

        } catch (error: any) {
            console.error('Excel Import Error:', error);
            Alert.alert('Hata', 'İçe aktarım sırasında bir hata oluştu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExcelSablonuIndir = async () => {
        try {
            const workbook = XLSX.utils.book_new();
            
            const ornekTur = kaynak_turleri.length > 0 ? kaynak_turleri[0].ad : 'TYT';
            const ornekTur2 = kaynak_turleri.length > 1 ? kaynak_turleri[1].ad : 'AYT';

            const veri = [
                ['Kaynak Adı', 'Kaynak Türü', 'İçerik'],
                ['Bilgi Yayınları', ornekTur, 'Fizik Bilimine Giriş'],
                ['Bilgi Yayınları', ornekTur, 'Madde ve Özellikleri'],
                ['Örnek Soru Bankası', ornekTur2, 'Vektörler'],
                ['Örnek Soru Bankası', ornekTur2, 'Kuvvet'],
                ['Örnek Soru Bankası', ornekTur2, 'Dinamik'],
            ];

            const worksheet = XLSX.utils.aoa_to_sheet(veri);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Global Kaynak Şablonu');
            
            const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
            
            const filepath = `${FileSystem.documentDirectory}global_kaynak_sablonu.xlsx`;
            await FileSystem.writeAsStringAsync(filepath, excelBuffer, { encoding: FileSystem.EncodingType.Base64 });
            
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(filepath, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: 'Şablon Excel Dosyasını Paylaş',
                    UTI: 'com.adobe.excel.xlsx'
                });
            } else {
                Alert.alert('Hata', 'Paylaşım özelliği bu cihazda aktif değil.');
            }
        } catch (error: any) {
            console.error('Şablon oluşturma hatası:', error);
            Alert.alert('Hata', 'Şablon dosyası oluşturulamadı: ' + error.message);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView 
                    style={styles.keyboardView}
                    contentContainerStyle={{ padding: 8, paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                        {/* Yeni Kaynak Ekleme Formu */}
                        <View style={styles.form}>
                            <Text style={styles.formTitle}>Yeni Ortak Kaynak Ekle</Text>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    value={yeniKaynak}
                                    onChangeText={setYeniKaynak}
                                    placeholder="Kitap/Kaynak adı giriniz"
                                />
                                <TouchableOpacity style={styles.ekleButon} onPress={handleEkle}>
                                    <MaterialIcons name="add" size={24} color="white" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.turLabel}>Kaynak Türü</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.turScrollView} contentContainerStyle={styles.turRow}>
                                {kaynak_turleri.map(tur => (
                                    <TouchableOpacity
                                        key={tur.id}
                                        style={[
                                            styles.turChip,
                                            { borderColor: turRenk(tur.ad, kaynak_turleri) },
                                            secilenTur === tur.ad && { backgroundColor: turRenk(tur.ad, kaynak_turleri) }
                                        ]}
                                        onPress={() => setSecilenTur(tur.ad)}
                                    >
                                        <Text style={[styles.turChipText, { color: secilenTur === tur.ad ? 'white' : turRenk(tur.ad, kaynak_turleri) }]}>
                                            {tur.ad}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.aciklama}>
                                Buraya eklediğiniz kaynaklar tüm öğrencilerinize ödev verirken veya kaynak seçerken listede görünecektir.
                            </Text>

                            {/* Excel Import / Template Buttons */}
                            <View style={styles.excelAksiyonlarGrup}>
                                <TouchableOpacity style={styles.excelAksiyonBtn} onPress={handleExcelGlobalKaynakImport} disabled={loading}>
                                    {loading ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <MaterialIcons name="file-upload" size={16} color="white" />
                                    )}
                                    <Text style={styles.excelAksiyonBtnText}>
                                        {loading ? 'Yükleniyor...' : 'Excel\'den Yükle'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.excelAksiyonBtn, styles.excelSablonBtn]} onPress={handleExcelSablonuIndir}>
                                    <MaterialIcons name="file-download" size={16} color="#3498db" />
                                    <Text style={[styles.excelAksiyonBtnText, styles.excelSablonBtnText]}>Şablonu İndir</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Kaynaklar Listesi */}
                        <View style={styles.listeContainer}>
                            <Text style={styles.listeTitle}>Sistemdeki Kaynaklar ({kaynaklar.length})</Text>
                            {kaynaklar.length === 0 ? (
                                <View style={styles.bosIcerik}>
                                    <MaterialIcons name="list" size={32} color="#ddd" />
                                    <Text style={styles.bosIcerikText}>Henüz kaynak eklenmemiş</Text>
                                </View>
                            ) : (
                                kaynaklar.map((item, index) => (
                                    <View key={item.id.toString()}>
                                        {renderItem({ item, index })}
                                    </View>
                                ))
                            )}
                        </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ─── DÜZENLEME MODALI ─── */}
            <Modal
                visible={modalGorunur}
                transparent
                animationType="slide"
                onRequestClose={modalKapat}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        style={styles.modalKAV}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View style={styles.modalBox}>
                            {/* Modal Başlık */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Kaynak Düzenle</Text>
                                <TouchableOpacity onPress={modalKapat}>
                                    <MaterialIcons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                {/* Üst: Ad & Tür Düzenleme */}
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalSectionTitle}>Kaynak Bilgileri</Text>

                                    <Text style={styles.fieldLabel}>Kaynak Adı</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={duzAd}
                                        onChangeText={setDuzAd}
                                        placeholder="Kaynak adı"
                                    />

                                    <Text style={styles.fieldLabel}>Kaynak Türü</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.turRow}>
                                        {kaynak_turleri.map(tur => (
                                            <TouchableOpacity
                                                key={tur.id}
                                                style={[
                                                    styles.turChip,
                                                    { borderColor: turRenk(tur.ad, kaynak_turleri) },
                                                    duzTur === tur.ad && { backgroundColor: turRenk(tur.ad, kaynak_turleri) }
                                                ]}
                                                onPress={() => setDuzTur(tur.ad)}
                                            >
                                                <Text style={[styles.turChipText, { color: duzTur === tur.ad ? 'white' : turRenk(tur.ad, kaynak_turleri) }]}>
                                                    {tur.ad}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    <TouchableOpacity style={styles.kaydetBtn} onPress={handleKaynakKaydet}>
                                        <MaterialIcons name="save" size={18} color="white" />
                                        <Text style={styles.kaydetBtnText}>Kaydet</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Ayırıcı */}
                                <View style={styles.divider} />

                                {/* Alt: İçerik Yönetimi */}
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalSectionTitle}>İçerik / Konu Listesi</Text>
                                    <Text style={styles.modalSectionAciklama}>
                                        Ödev verirken bu listeden konu seçilebilecek.
                                    </Text>

                                    {/* Kopyala + Tüm Sil butonları yan yana */}
                                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                                        <TouchableOpacity
                                            style={[styles.kopyalaBtn, { flex: 1, marginBottom: 0 }]}
                                            onPress={() => setKopyalaModalGorunur(true)}
                                        >
                                            <MaterialIcons name="content-copy" size={15} color="#8e44ad" />
                                            <Text style={styles.kopyalaBtnText}>Kaynaktan Kopyala</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.tumSilBtn, { flex: 1, marginBottom: 0, opacity: icerikler.length === 0 ? 0.4 : 1 }]}
                                            onPress={handleTumIceriklerSil}
                                            disabled={icerikler.length === 0}
                                        >
                                            <MaterialIcons name="delete-sweep" size={15} color="#e74c3c" />
                                            <Text style={styles.tumSilBtnText}>Tümünü Sil{icerikler.length > 0 ? ` (${icerikler.length})` : ''}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Yeni İçerik Ekleme */}
                                    <View style={styles.icerikEkleRow}>
                                        <TextInput
                                            style={styles.icerikInput}
                                            value={yeniIcerik}
                                            onChangeText={setYeniIcerik}
                                            placeholder="Konu / içerik giriniz"
                                            multiline={false}
                                        />
                                        <TouchableOpacity style={styles.icerikEkleBtn} onPress={handleIcerikEkle}>
                                            <MaterialIcons name="add" size={22} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.icerikEkleBtn, { backgroundColor: '#27ae60', marginLeft: 6 }]} onPress={handleExcelIcerikEkle}>
                                            <MaterialIcons name="file-upload" size={22} color="white" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* İçerik Listesi */}
                                    {icerikYukleniyor ? (
                                        <ActivityIndicator size="small" color="#3498db" style={{ marginTop: 16 }} />
                                    ) : icerikler.length === 0 ? (
                                        <View style={styles.bosIcerik}>
                                            <MaterialIcons name="list" size={32} color="#ddd" />
                                            <Text style={styles.bosIcerikText}>Henüz içerik eklenmemiş</Text>
                                        </View>
                                    ) : (
                                        icerikler.map((item, index) => (
                                            <View key={item.id}>
                                                {renderIcerikItem({ item, index })}
                                            </View>
                                        ))
                                    )}
                                </View>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* ─── KAYNAK TÜRLERİ MODALI ─── */}
            <Modal visible={turModalGorunur} transparent animationType="fade" onRequestClose={() => setTurModalGorunur(false)}>
                <View style={styles.modalOverlayCenter}>
                    <View style={styles.modalBoxCenter}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Kaynak Türleri</Text>
                            <TouchableOpacity onPress={() => setTurModalGorunur(false)}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ padding: 16 }}>
                            {/* Yeni tür ekleme */}
                            <View style={styles.icerikEkleRow}>
                                <TextInput
                                    style={styles.icerikInput}
                                    value={yeniTur}
                                    onChangeText={setYeniTur}
                                    placeholder="Yeni tür adı (ör: Deneme, LGS...)"
                                />
                                <TouchableOpacity style={styles.icerikEkleBtn} onPress={handleTurEkle}>
                                    <MaterialIcons name="add" size={22} color="white" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.divider} />

                            {/* Tür listesi */}
                            {kaynak_turleri.map(tur => (
                                <View key={tur.id} style={styles.turListeItem}>
                                    {duzTurId === tur.id ? (
                                        <View style={styles.turDuzRow}>
                                            <TextInput
                                                style={styles.turDuzInput}
                                                value={duzTurAd}
                                                onChangeText={setDuzTurAd}
                                                autoFocus
                                            />
                                            <TouchableOpacity onPress={handleTurGuncelle} style={styles.icerikKaydetBtn}>
                                                <MaterialIcons name="check" size={18} color="white" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => { setDuzTurId(null); setDuzTurAd(''); setDuzTurEskiAd(''); }} style={styles.icerikIptalBtn}>
                                                <MaterialIcons name="close" size={18} color="#666" />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.turListeRow}>
                                            <View style={[styles.turRenkDot, { backgroundColor: turRenk(tur.ad, kaynak_turleri) }]} />
                                            <Text style={styles.turListeAd}>{tur.ad}</Text>
                                            <TouchableOpacity onPress={() => { setDuzTurId(tur.id); setDuzTurAd(tur.ad); setDuzTurEskiAd(tur.ad); }} style={styles.icerikEditBtn}>
                                                <MaterialIcons name="edit" size={16} color="#3498db" />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleTurSil(tur)} style={styles.icerikSilBtn}>
                                                <MaterialIcons name="delete" size={16} color="#e74c3c" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── İÇERİK KOPYALAMA MODALI ─── */}
            <Modal visible={kopyalaModalGorunur} transparent animationType="fade" onRequestClose={() => setKopyalaModalGorunur(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, { maxHeight: '75%', margin: 24 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Kaynak Seç — İçerik Kopyala</Text>
                            <TouchableOpacity onPress={() => { setKopyalaModalGorunur(false); setKopyalaKaynakSecili(null); }}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.modalSectionAciklama, { paddingHorizontal: 16, paddingTop: 8 }]}>
                            Hangi kaynağın içeriklerini "{seciliKaynak?.ad}" kaynağına kopyalamak istiyorsunuz?
                        </Text>
                        <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                            {kaynaklar
                                .filter(k => k.id !== seciliKaynak?.id)
                                .map(k => (
                                    <TouchableOpacity
                                        key={k.id}
                                        style={[
                                            styles.kopyalaKaynakItem,
                                            kopyalaKaynakSecili?.id === k.id && styles.kopyalaKaynakItemSecili
                                        ]}
                                        onPress={() => setKopyalaKaynakSecili(k)}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.kopyalaKaynakAd, kopyalaKaynakSecili?.id === k.id && { color: 'white' }]}>{k.ad}</Text>
                                            <Text style={[styles.kopyalaKaynakTur, kopyalaKaynakSecili?.id === k.id && { color: 'rgba(255,255,255,0.7)' }]}>{k.tur}</Text>
                                        </View>
                                        {kopyalaKaynakSecili?.id === k.id && <MaterialIcons name="check-circle" size={20} color="white" />}
                                    </TouchableOpacity>
                                ))
                            }
                        </ScrollView>
                        <View style={{ padding: 16 }}>
                            <TouchableOpacity
                                style={[styles.kaydetBtn, { opacity: !kopyalaKaynakSecili || kopyalaYukleniyor ? 0.5 : 1 }]}
                                onPress={handleIcerikKopyala}
                                disabled={!kopyalaKaynakSecili || kopyalaYukleniyor}
                            >
                                {kopyalaYukleniyor
                                    ? <ActivityIndicator size="small" color="white" />
                                    : <MaterialIcons name="content-copy" size={18} color="white" />
                                }
                                <Text style={styles.kaydetBtnText}>
                                    {kopyalaYukleniyor ? 'Kopyalanıyor...' : 'İçerikleri Kopyala'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles: StyleSheet.NamedStyles<any> = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingBottom: 80,
    },
    header: {
    flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        elevation: 2,
        marginBottom: 6,
    },
    headerTitle: 
    { fontSize: 13, 
        fontWeight: '600', 
        marginLeft: 4, 
        color: '#333' ,
    },
    headerTurYonetimBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f1fa',
        paddingHorizontal: 2,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2d5f8',
    },
    headerTurYonetimBtnText: {
        marginLeft: 1,
        color: '#8e44ad',
        fontWeight: 'normal',
        fontSize: 7,
    },
    keyboardView: { flex: 1 },
    content: { flex: 1, padding: 8 
        },

    // Form
    form: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        elevation: 2,
    },
    formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#2c3e50' },
    inputRow: { flexDirection: 'row', alignItems: 'center' },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginRight: 10,
        backgroundColor: '#f9f9f9',
    },
    ekleButon: {
        backgroundColor: '#2ecc71',
        padding: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    turLabel: { fontSize: 13, fontWeight: '600', color: '#2c3e50', marginTop: 14, marginBottom: 8 },
    turScrollView: { marginBottom: 4 },
    turRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
    turChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1.5,
        backgroundColor: 'transparent',
    },
    turChipText: { fontSize: 13, fontWeight: '600' },
    aciklama: { fontSize: 12, color: '#7f8c8d', marginTop: 12, fontStyle: 'italic' },

    // Liste
    listeContainer: { backgroundColor: 'white', padding: 6, borderRadius: 12, elevation: 2, marginBottom: 20 },
    listeTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 12, color: '#2c3e50' },
    item: { flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
    },
    itemInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    numara: { fontSize: 14, fontWeight: 'bold', color: '#95a5a6', marginRight: 8 },
    ad: { fontSize: 15, color: '#333', flex: 1 },
    turBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginLeft: 6 },
    turBadgeText: { fontSize: 11, fontWeight: '700', color: 'white' },
    itemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    duzButon: { padding: 7, backgroundColor: '#eaf4fc', borderRadius: 6 },
    silButon: { padding: 7, backgroundColor: '#fff5f5', borderRadius: 6 },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalOverlayCenter: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalKAV: { flex: 0 },
    modalBox: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    modalBoxCenter: {
        backgroundColor: 'white',
        borderRadius: 20,
        maxHeight: '80%',
        paddingBottom: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: { fontSize: 15, fontWeight: 'bold', color: '#2c3e50' },
    modalSection: { padding: 10 },
    modalSectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#2c3e50', marginBottom: 2 },
    modalSectionAciklama: { fontSize: 11, color: '#7f8c8d', marginBottom: 8, fontStyle: 'italic' },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 6 },
    modalInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 8,
        backgroundColor: '#f9f9f9',
        fontSize: 13,
    },
    kaydetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#27ae60',
        padding: 9,
        borderRadius: 8,
        marginTop: 8,
        gap: 5,
    },
    kaydetBtnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    divider: { height: 8, backgroundColor: '#f4f6f8' },

    // İçerik
    icerikEkleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    icerikInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        backgroundColor: '#f9f9f9',
        marginRight: 8,
        fontSize: 14,
    },
    icerikEkleBtn: {
        backgroundColor: '#3498db',
        padding: 10,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icerikItem: {
        marginBottom: 4,
    },
    icerikGosterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
    },
    icerikText: { flex: 1, fontSize: 13, color: '#333' },
    icerikBtnGrup: { flexDirection: 'row', gap: 4 },
    icerikEditBtn: { padding: 5, backgroundColor: '#eaf4fc', borderRadius: 5 },
    icerikSilBtn: { padding: 5, backgroundColor: '#fff5f5', borderRadius: 5 },
    icerikDuzRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    icerikDuzInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#3498db',
        borderRadius: 6,
        padding: 8,
        fontSize: 14,
        backgroundColor: '#f0f8ff',
        marginRight: 6,
    },
    icerikKaydetBtn: {
        backgroundColor: '#27ae60',
        padding: 8,
        borderRadius: 6,
        marginRight: 4,
    },
    icerikIptalBtn: {
        backgroundColor: '#f0f0f0',
        padding: 8,
        borderRadius: 6,
    },
    bosIcerik: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    bosIcerikText: { fontSize: 13, color: '#bbb', marginTop: 8 },

    // Tür Yönetim Butonu
    turYonetimBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f1fa',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2d5f8',
        marginBottom: 16,
    },
    turYonetimBtnText: {
        flex: 1,
        marginLeft: 8,
        color: '#8e44ad',
        fontWeight: 'bold',
        fontSize: 14,
    },
    
    // Tür Listesi (Modal İçi)
    turListeItem: {
        marginBottom: 8,
    },
    turListeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    turRenkDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 10,
    },
    turListeAd: {
        flex: 1,
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    turDuzRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    turDuzInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#3498db',
        borderRadius: 6,
        padding: 8,
        fontSize: 14,
        backgroundColor: '#f0f8ff',
        marginRight: 6,
    },
    
    // Kopyalama
    kopyalaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f4f1fa',
        padding: 8,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2d5f8',
    },
    kopyalaBtnText: {
        color: '#8e44ad',
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 12,
    },
    tumSilBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff5f5',
        padding: 8,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ffc5c5',
    },
    tumSilBtnText: {
        color: '#e74c3c',
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 12,
    },
    kopyalaKaynakItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
        marginBottom: 8,
        backgroundColor: '#f9f9f9',
    },
    kopyalaKaynakItemSecili: {
        backgroundColor: '#3498db',
        borderColor: '#3498db',
    },
    kopyalaKaynakAd: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
    },
    kopyalaKaynakTur: {
        fontSize: 11,
        color: '#7f8c8d',
        marginTop: 2,
    },
    excelAksiyonlarGrup: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#f1f1f1',
        paddingTop: 12,
    },
    excelAksiyonBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#27ae60',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    excelAksiyonBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    excelSablonBtn: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#3498db',
    },
    excelSablonBtnText: {
        color: '#3498db',
    },
})
