
// /*1. Klavye Sorunları Çözüldü:

// KeyboardAvoidingView'i doğru yere taşıdı ve keyboardVerticalOffset ekledi
// keyboardShouldPersistTaps="handled" ekledi ki ScrollView içindeki butonlara klavye açıkken tıklanabilsin
// Modal içinde de KeyboardAvoidingView ve TouchableWithoutFeedback ekledi*/


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
    Platform
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
    ogrenciOdevleri,
    tekOgrenci
} from '../utils/database';
import { KaynakType, OdevType, OgrenciType } from '../types';


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

    useEffect(() => {
        veriAl();
    }, []);

    const veriAl = async () => {
        try {
            setLoading(true);

            // Öğrenci bilgilerini al
            const ogrenciResult = await tekOgrenci(ogrenciId);
            if (ogrenciResult.success) {
                setOgrenci(ogrenciResult.data ?? null);
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
        if (!odevKonusu.trim()) {
            Alert.alert('Uyarı', 'Lütfen ödev konusunu giriniz');
            return;
        }

        try {
            const kaynakValue = kayitsizKaynak ? serbetKaynak : seciliKaynak;

            const odevVerisi = {
                ogrenciId: ogrenciId,
                kaynak: kaynakValue || 'Belirtilmemiş',
                odev: odevKonusu.trim(),
                verilmetarihi: verilmeTarihi.toISOString().split('T')[0],
                teslimttarihi: teslimTarihi.toISOString().split('T')[0],
                yapilmadurumu: 'Bekliyor',
                aciklama: `${formatTarih(verilmeTarihi)} tarihinde verildi`
            };

            const result = await odevKaydet(odevVerisi);

            if (result.success) {
                Alert.alert('Başarılı', 'Ödev başarıyla verildi');
                formuTemizle();
                await odevleriYenile();
            } else {
                Alert.alert('Hata', 'Ödev kaydedilemedi');
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
        setVerilmeTarihi(new Date());
        setTeslimTarihi(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    };

    // Ödev güncelleme fonksiyonu
    const odevGuncelleKaydet = async (odev: OdevType) => {
        try {
            const result = await odevGuncelle(odev.odevId!, odev);
            if (result.success) {
                Alert.alert('Başarılı', 'Ödev güncellendi');
                await odevleriYenile();
            } else {
                Alert.alert('Hata', 'Ödev güncellenemedi');
            }
        } catch (error) {
            console.error('Ödev güncelleme hatası:', error);
            Alert.alert('Hata', 'Güncelleme yapılamadı');
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

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Yükleniyor...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {ogrenci ? `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad} - Ödev Ver` : 'Ödev Ver'}
                </Text>
            </View>

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
                        {/* Ödev Verme Formu */}
                        <View style={styles.formContainer}>
                            {/* Kaynak Yönetimi Butonu */}
                            <TouchableOpacity
                                style={styles.kaynakEkleButon}
                                onPress={() => navigation.navigate('KaynakYonetimi', { 
                                    ogrenciId: ogrenci?.ogrenciId, 
                                    ogrenciAd: ogrenci?.ogrenciAd, 
                                    ogrenciSoyad: ogrenci?.ogrenciSoyad 
                                })}
                            >
                                <MaterialIcons name="add" size={20} color="white" />
                                <Text style={styles.kaynakEkleText}>Kaynak Yönet</Text>
                            </TouchableOpacity>

                            {/* Kaynak Seçimi veya Serbest Giriş */}
                            {!kayitsizKaynak ? (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Kaynak Seç (İsteğe Bağlı)</Text>
                                    <View style={styles.pickerContainer}>
                                        <Picker
                                            selectedValue={seciliKaynak}
                                            onValueChange={setSeciliKaynak}
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
                                    />
                                </View>
                            )}

                            {/* Kayıtsız Kaynak Switch */}
                            <View style={styles.switchContainer}>
                                <Text style={styles.switchLabel}>Serbest Kaynak Girişi</Text>
                                <Switch
                                    value={kayitsizKaynak}
                                    onValueChange={setKayitsizKaynak}
                                    thumbColor={kayitsizKaynak ? "#4CAF50" : "#f4f3f4"}
                                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                                />
                            </View>

                            {/* Ödev Konusu */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Ödev Konusu *</Text>
                                <TextInput
                                    style={[styles.textInput, styles.textArea]}
                                    value={odevKonusu}
                                    onChangeText={setOdevKonusu}
                                    placeholder="Ödev konusunu yazınız"
                                    multiline={true}
                                    numberOfLines={3}
                                />
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

                            {/* Ödev Ver Butonu */}
                            <TouchableOpacity
                                style={styles.odevVerButon}
                                onPress={odevEkle}
                            >
                                <MaterialIcons name="assignment" size={20} color="white" />
                                <Text style={styles.odevVerText}>Ödev Ver</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Ödevler Listesi */}
                        <View style={styles.odevlerContainer}>
                            <Text style={styles.sectionTitle}>
                                Verilen Ödevler ({odevler.length})
                            </Text>

                            {odevler.length > 0 ? (
                                <FlatList
                                    data={odevler}
                                    renderItem={({ item }) => (
                                        <OdevItem
                                            item={item}
                                            onGuncelle={odevGuncelleKaydet}
                                        />
                                    )}
                                    keyExtractor={item => (item.odevId?.toString() || Math.random().toString())}
                                    scrollEnabled={false}
                                />
                            ) : (
                                <View style={styles.bosListe}>
                                    <MaterialIcons name="assignment" size={40} color="#ddd" />
                                    <Text style={styles.bosListeText}>Henüz ödev verilmemiş</Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e8ed',
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
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
        padding: 16,
    },
    formContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
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
        fontSize: 14,
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
        borderColor: '#ddd',
        borderRadius: 6,
        backgroundColor: '#fff',
    },
    picker: {
        height: 50,
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    switchLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 12,
        backgroundColor: '#fff',
    },
    dateText: {
        marginLeft: 8,
        fontSize: 16,
        color: '#333',
    },
    odevVerButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#27ae60',
        padding: 14,
        borderRadius: 6,
        marginTop: 8,
    },
    odevVerText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 16,
    },
    odevlerContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        elevation: 2,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    bosListe: {
        padding: 40,
        alignItems: 'center',
    },
    bosListeText: {
        color: '#666',
        fontStyle: 'italic',
        marginTop: 8,
    },
});
