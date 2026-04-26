
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

    // Yeni Özellikler State'leri
    const [odevVermeGorunur, setOdevVermeGorunur] = useState(false);
    const [raporModaliGorunur, setRaporModaliGorunur] = useState(false);
    const [raporBaslangic, setRaporBaslangic] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const [raporBitis, setRaporBitis] = useState(new Date());
    const [showRaporBaslangicPicker, setShowRaporBaslangicPicker] = useState(false);
    const [showRaporBitisPicker, setShowRaporBitisPicker] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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

    // PDF Raporu Oluştur ve Paylaş/İndir
    const odevRaporuOlustur = async (hedef: 'indir' | 'ogrenci' | 'veli') => {
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
            // Temporary rename logic if possible? expo-print generates a random name.
            // sharing logic:
            
            if (await Sharing.isAvailableAsync()) {
                let shareOptions: Sharing.SharingOptions = {
                    mimeType: 'application/pdf',
                    dialogTitle: `${studentName} Ödev Raporu`,
                    UTI: 'com.adobe.pdf'
                };

                // WhatsApp için metin hazırla
                if (hedef === 'ogrenci' || hedef === 'veli') {
                    const mesaj = `${studentName} e ait ödev raporu ektedir.`;
                    // Bazı sistemlerde dialogTitle WhatsApp caption olarak gidebilir.
                    // Tam otomasyon için bazen 'message' alanı kullanılır (bazı versiyonlarda).
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
                        {/* Üst Kontrol Paneli */}
                        <View style={styles.topControlPanel}>
                            <View style={styles.switchControl}>
                                <Text style={styles.switchControlLabel}>Ödev Verme Formu</Text>
                                <Switch
                                    value={odevVermeGorunur}
                                    onValueChange={setOdevVermeGorunur}
                                    thumbColor={odevVermeGorunur ? "#4CAF50" : "#f4f3f4"}
                                    trackColor={{ false: "#767577", true: "#81b0ff" }}
                                />
                            </View>
                            <TouchableOpacity 
                                style={styles.raporButon}
                                onPress={() => setRaporModaliGorunur(true)}
                            >
                                <MaterialIcons name="assessment" size={20} color="white" />
                                <Text style={styles.raporButonText}>Rapor Al</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Ödev Verme Formu - Koşullu Gösterim */}
                        {odevVermeGorunur && (
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
                                            <Picker.Item label="Kaynak seçiniz..." value="" color="#333" />
                                            {kaynaklar.map((kaynak) => (
                                                <Picker.Item
                                                    key={kaynak.kaynakId}
                                                    label={kaynak.kaynak}
                                                    value={kaynak.kaynak}
                                                    color="#333"
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
                        )}

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

            {/* Rapor Modalı */}
            <Modal
                visible={raporModaliGorunur}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setRaporModaliGorunur(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.reportModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ödev Raporu Oluştur</Text>
                            <TouchableOpacity onPress={() => setRaporModaliGorunur(false)}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>Tarih aralığı seçiniz:</Text>

                        <View style={styles.dateRangeContainer}>
                            <TouchableOpacity 
                                style={styles.reportDateButton}
                                onPress={() => setShowRaporBaslangicPicker(true)}
                            >
                                <Text style={styles.dateLabel}>Başlangıç</Text>
                                <Text style={styles.dateValue}>{formatTarih(raporBaslangic)}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.reportDateButton}
                                onPress={() => setShowRaporBitisPicker(true)}
                            >
                                <Text style={styles.dateLabel}>Bitiş</Text>
                                <Text style={styles.dateValue}>{formatTarih(raporBitis)}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.raporAksiyonlar}>
                            <TouchableOpacity 
                                style={[styles.raporAksiyonButon, { backgroundColor: '#3498db' }]}
                                onPress={() => odevRaporuOlustur('indir')}
                                disabled={isGeneratingPDF}
                            >
                                <MaterialIcons name="file-download" size={24} color="white" />
                                <Text style={styles.raporAksiyonText}>İndir / Paylaş</Text>
                            </TouchableOpacity>

                            <View style={styles.raporPaylasımGrup}>
                                <TouchableOpacity 
                                    style={[styles.paylasimButon, { backgroundColor: '#27ae60' }]}
                                    onPress={() => odevRaporuOlustur('ogrenci')}
                                    disabled={isGeneratingPDF}
                                >
                                    <MaterialIcons name="person" size={20} color="white" />
                                    <Text style={styles.paylasimText}>Öğrenciye</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.paylasimButon, { backgroundColor: '#8e44ad' }]}
                                    onPress={() => odevRaporuOlustur('veli')}
                                    disabled={isGeneratingPDF}
                                >
                                    <MaterialIcons name="people" size={20} color="white" />
                                    <Text style={styles.paylasimText}>Veliye</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {isGeneratingPDF && (
                            <View style={styles.loadingOverlay}>
                                <ActivityIndicator size="large" color="#3498db" />
                                <Text style={styles.loadingText}>PDF Oluşturuluyor...</Text>
                            </View>
                        )}
                    </View>
                </View>

                {showRaporBaslangicPicker && (
                    <DateTimePicker
                        value={raporBaslangic}
                        mode="date"
                        display="default"
                        onChange={(event, date) => {
                            setShowRaporBaslangicPicker(false);
                            if (date) setRaporBaslangic(date);
                        }}
                    />
                )}

                {showRaporBitisPicker && (
                    <DateTimePicker
                        value={raporBitis}
                        mode="date"
                        display="default"
                        onChange={(event, date) => {
                            setShowRaporBitisPicker(false);
                            if (date) setRaporBitis(date);
                        }}
                    />
                )}
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        paddingTop: 16,
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
        paddingBottom: 80,
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
        borderColor: '#ced4da',
        borderRadius: 8,
        backgroundColor: '#fff',
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
    topControlPanel: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        elevation: 2,
    },
    switchControl: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    switchControlLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 8,
    },
    raporButon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e67e22',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    raporButonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 13,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reportModalContent: {
        width: '85%',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
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
    }
});
