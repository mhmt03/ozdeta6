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
    Modal,
    ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { tekOgrenci } from '../utils/database';
import { getTumSinavTurleri } from '../database/examTypeOperations';
import { denemeEkle, getDenemeler, denemeSil, denemeGuncelle } from '../database/denemeOperations';
import { DenemeType, OgrenciType, SinavTuruType } from '../types';

export default function Denemeler() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { ogrenciId } = route.params;

    const [ogrenci, setOgrenci] = useState<OgrenciType | null>(null);
    const [sinavTurleri, setSinavTurleri] = useState<SinavTuruType[]>([]);
    const [denemeler, setDenemeler] = useState<DenemeType[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [denemeGiris, setDenemeGiris] = useState(false);
    const [denemeAd, setDenemeAd] = useState('');
    const [seciliSinavTuru, setSeciliSinavTuru] = useState<number | ''>('');
    const [denemeTarih, setDenemeTarih] = useState(new Date());
    const [dogruSayisi, setDogruSayisi] = useState('');
    const [yanlisSayisi, setYanlisSayisi] = useState('');
    const [tarihPickerAcik, setTarihPickerAcik] = useState(false);

    // Filtre & Sıralama
    const [sortTip, setSortTip] = useState<'tarihDesc' | 'tarihAsc' | 'dogruDesc'>('tarihDesc');
    const [filterSinavTuru, setFilterSinavTuru] = useState<number | ''>('');

    // Güncelleme Modalı State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingDeneme, setEditingDeneme] = useState<DenemeType | null>(null);

    // Raporlama State
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

            // Öğrenci
            const ogrenciResult = await tekOgrenci(ogrenciId);
            if (ogrenciResult.success) {
                setOgrenci(ogrenciResult.data ?? null);
            }

            // Sınav türleri
            const turlerResult = await getTumSinavTurleri();
            if (turlerResult.success) {
                setSinavTurleri(turlerResult.data);
            }

            // Denemeler
            await denemeleriYenile();

        } catch (error) {
            console.error('Veri alma hatası:', error);
            Alert.alert('Hata', 'Veriler alınamadı');
        } finally {
            setLoading(false);
        }
    };

    const denemeleriYenile = async () => {
        try {
            const result = await getDenemeler(ogrenciId);
            if (result.success) {
                setDenemeler(result.data || []);
            }
        } catch (error) {
            console.error('Denemeler alınamadı:', error);
        }
    };

    const handleDenemeEkle = async () => {
        if (!seciliSinavTuru || !dogruSayisi || !yanlisSayisi) {
            Alert.alert('Uyarı', 'Lütfen tüm alanları doldurunuz (Sınav türü, doğru, yanlış).');
            return;
        }

        const dogru = parseInt(dogruSayisi);
        const yanlis = parseInt(yanlisSayisi);

        if (isNaN(dogru) || isNaN(yanlis)) {
            Alert.alert('Uyarı', 'Doğru ve yanlış sayıları rakam olmalıdır.');
            return;
        }

        const yeniDeneme: DenemeType = {
            ogrenciId,
            sinavTuruId: Number(seciliSinavTuru),
            denemeAd: denemeAd.trim() || 'İsimsiz Deneme',
            tarih: denemeTarih.toISOString().split('T')[0],
            dogru,
            yanlis
        };

        const result = await denemeEkle(yeniDeneme);
        if (result.success) {
            Alert.alert('Başarılı', 'Deneme sonucu başarıyla kaydedildi.');
            formuTemizle();
            await denemeleriYenile();
        } else {
            Alert.alert('Hata', 'Kayıt başarısız: ' + result.error);
        }
    };

    const formuTemizle = () => {
        setDenemeAd('');
        setSeciliSinavTuru('');
        setDenemeTarih(new Date());
        setDogruSayisi('');
        setYanlisSayisi('');
    };

    const handleDelete = (id: number) => {
        Alert.alert(
            "Emin misiniz?",
            "Bu deneme kaydı silinecek.",
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Sil", style: "destructive", onPress: async () => {
                        const result = await denemeSil(id);
                        if (result.success) {
                            denemeleriYenile();
                        } else {
                            Alert.alert('Hata', 'Kayıt silinemedi.');
                        }
                    }
                }
            ]
        );
    };

    const handleGuncelleClick = (item: DenemeType) => {
        setEditingDeneme(item);
        setEditModalVisible(true);
    };

    const handleGuncelleKaydet = async () => {
        if (!editingDeneme) return;

        const dogru = parseInt(editingDeneme.dogru.toString());
        const yanlis = parseInt(editingDeneme.yanlis.toString());

        if (isNaN(dogru) || isNaN(yanlis)) {
            Alert.alert('Uyarı', 'Doğru ve yanlış sayıları rakam olmalıdır.');
            return;
        }

        const guncelData: Partial<DenemeType> = {
            sinavTuruId: editingDeneme.sinavTuruId,
            denemeAd: editingDeneme.denemeAd,
            tarih: editingDeneme.tarih,
            dogru,
            yanlis
        };

        const result = await denemeGuncelle(editingDeneme.id!, guncelData);
        if (result.success) {
            Alert.alert('Başarılı', 'Kayıt güncellendi.');
            setEditModalVisible(false);
            setEditingDeneme(null);
            denemeleriYenile();
        } else {
            Alert.alert('Hata', 'Güncelleme başarısız: ' + result.error);
        }
    };

    // PDF Raporu Oluştur ve Paylaş/İndir
    const denemeRaporuOlustur = async (hedef: 'indir' | 'ogrenci' | 'veli') => {
        if (!ogrenci) return;

        try {
            setIsGeneratingPDF(true);

            const filtrelenmis = denemeler.filter(d => {
                const dDate = new Date(d.tarih);
                return dDate >= raporBaslangic && dDate <= raporBitis;
            });

            if (filtrelenmis.length === 0) {
                Alert.alert('Uyarı', 'Seçilen tarih aralığında deneme bulunamadı.');
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
                        .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #95a5a6; border-top: 1px solid #eee; padding-top: 10px; }
                    </style>
                </head>
                <body>
                    <h1>Deneme Sınavları Raporu</h1>
                    <div class="info">
                        <p><strong>Öğrenci:</strong> ${studentName}</p>
                        <p><strong>Tarih Aralığı:</strong> ${rangeText}</p>
                        <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Tarih</th>
                                <th>Sınav Türü</th>
                                <th>Deneme Adı</th>
                                <th>Doğru</th>
                                <th>Yanlış</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtrelenmis.map(d => `
                                <tr>
                                    <td>${formatTarih(d.tarih)}</td>
                                    <td>${d.sinavTuruAd || '-'}</td>
                                    <td>${d.denemeAd || 'İsimsiz'}</td>
                                    <td style="color: #27ae60; font-weight: bold;">${d.dogru}</td>
                                    <td style="color: #e74c3c; font-weight: bold;">${d.yanlis}</td>
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

            if (await Sharing.isAvailableAsync()) {
                let shareOptions: Sharing.SharingOptions = {
                    mimeType: 'application/pdf',
                    dialogTitle: `${studentName} Deneme Raporu`,
                    UTI: 'com.adobe.pdf'
                };

                if (hedef === 'ogrenci' || hedef === 'veli') {
                    (shareOptions as any).message = `${studentName} e ait deneme sonuç raporu ektedir.`;
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

    const formatTarih = (tarih: string | Date) => {
        if (!tarih) return '-';
        if (typeof tarih === 'string') {
            return new Date(tarih).toLocaleDateString('tr-TR');
        }
        return tarih.toLocaleDateString('tr-TR');
    };

    // Filtreleme ve Sıralama işlemleri
    const filteredAndSortedData = React.useMemo(() => {
        let data = [...denemeler];

        if (filterSinavTuru) {
            data = data.filter(d => d.sinavTuruId === Number(filterSinavTuru));
        }

        data.sort((a, b) => {
            if (sortTip === 'tarihDesc') {
                return new Date(b.tarih).getTime() - new Date(a.tarih).getTime();
            } else if (sortTip === 'tarihAsc') {
                return new Date(a.tarih).getTime() - new Date(b.tarih).getTime();
            } else if (sortTip === 'dogruDesc') {
                return b.dogru - a.dogru;
            }
            return 0;
        });

        return data;
    }, [denemeler, filterSinavTuru, sortTip]);


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
                    {ogrenci ? `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad} - Denemeler` : 'Denemeler'}
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
                                <Text style={styles.switchControlLabel}>Deneme Giriş</Text>
                                <Switch
                                    value={denemeGiris}
                                    onValueChange={setDenemeGiris}
                                    thumbColor={denemeGiris ? "#4CAF50" : "#f4f3f4"}
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

                        {/* Form Gösterimi */}
                        {denemeGiris ? (
                            <View style={styles.formContainer}>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Deneme Adı</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={denemeAd}
                                        onChangeText={setDenemeAd}
                                        placeholder="Örn: Türkiye Geneli Deneme 1"
                                    />
                                </View>


                                <View style={{ flexDirection: 'row' }}>
                                    <View style={[styles.inputContainer, { width: '50%' }]}>
                                        <Text style={styles.inputLabel}>Sınav Türü Seç</Text>
                                        <View style={styles.pickerContainer}>
                                            <Picker
                                                selectedValue={seciliSinavTuru}
                                                onValueChange={(val) => setSeciliSinavTuru(val)}
                                                style={styles.picker}
                                            >
                                                <Picker.Item label="Sınav türü seçiniz..." value="" color="#333" />
                                                {sinavTurleri.map((tur) => (
                                                    <Picker.Item
                                                        key={tur.id}
                                                        label={tur.ad}
                                                        value={tur.id}
                                                        color="#f31717ff"

                                                    />
                                                ))}
                                            </Picker>
                                        </View>
                                    </View>

                                    <View style={[styles.inputContainer, { width: '50%', paddingLeft: 20 }]}>
                                        <Text style={styles.inputLabel}>Tarih</Text>
                                        <TouchableOpacity
                                            style={[styles.dateButton, { width: '100%' }]}
                                            onPress={() => setTarihPickerAcik(true)}
                                        >
                                            <MaterialIcons name="date-range" size={20} color="#666" />
                                            <Text style={styles.dateText}>{formatTarih(denemeTarih)}</Text>
                                        </TouchableOpacity>

                                    </View>

                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View style={[styles.inputContainer, { flex: 0.48 }]}>
                                        <Text style={styles.inputLabel}>Doğru Sayısı</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            value={dogruSayisi}
                                            onChangeText={setDogruSayisi}
                                            placeholder="Örn: 10"
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={[styles.inputContainer, { flex: 0.48 }]}>
                                        <Text style={styles.inputLabel}>Yanlış Sayısı</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            value={yanlisSayisi}
                                            onChangeText={setYanlisSayisi}
                                            placeholder="Örn: 2"
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.kaydetButon}
                                    onPress={handleDenemeEkle}
                                >
                                    <MaterialIcons name="save" size={20} color="white" />
                                    <Text style={styles.kaydetButonText}>Kaydet</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            /* Liste Gösterimi */
                            <View style={styles.listContainer}>
                                <Text style={styles.sectionTitle}>
                                    Geçmiş Denemeler ({filteredAndSortedData.length})
                                </Text>

                                {/* Filtre ve Sıralama */}
                                <View style={styles.filterRow}>
                                    <View style={[styles.pickerContainer, { flex: 1, marginRight: 8 }]}>
                                        <Picker
                                            selectedValue={filterSinavTuru}
                                            onValueChange={(val) => setFilterSinavTuru(val)}
                                        // style={{ height: 40 }}
                                        >
                                            <Picker.Item label="Tümü (Sınav Türü)" value="" />
                                            {sinavTurleri.map(t => (
                                                <Picker.Item key={t.id} label={t.ad} value={t.id} />
                                            ))}
                                        </Picker>
                                    </View>
                                    <View style={[styles.pickerContainer, { flex: 1 }]}>
                                        <Picker
                                            selectedValue={sortTip}
                                            onValueChange={(val) => setSortTip(val)}
                                        // style={{ height: 80 }}
                                        >
                                            <Picker.Item label="Yeniden Eskiye" value="tarihDesc" />
                                            <Picker.Item label="Eskiden Yeniye" value="tarihAsc" />
                                            <Picker.Item label="En Çok Doğru" value="dogruDesc" />
                                        </Picker>
                                    </View>
                                </View>

                                {filteredAndSortedData.length > 0 ? (
                                    <FlatList
                                        data={filteredAndSortedData}
                                        renderItem={({ item }) => (
                                            <View style={styles.denemeItem}>
                                                <View style={styles.denemeInfo}>
                                                    <View style={styles.denemeHeaderRow}>
                                                        <Text style={styles.denemeTypeTxt}>{item.sinavTuruAd}</Text>
                                                        <Text style={styles.denemeDateTxt}>{formatTarih(item.tarih)}</Text>
                                                    </View>
                                                    <Text style={styles.denemeAdTxt}>{item.denemeAd}</Text>
                                                    <View style={styles.denemeStats}>
                                                        <Text style={styles.statCorrect}>{item.dogru} Doğru</Text>
                                                        <Text style={styles.statWrong}>{item.yanlis} Yanlış</Text>

                                                        <View style={{ flexDirection: 'row', marginLeft: 'auto', gap: 12 }}>
                                                            <TouchableOpacity
                                                                style={styles.editBtn}
                                                                onPress={() => handleGuncelleClick(item)}
                                                            >
                                                                <MaterialIcons name="edit" size={24} color="#3498db" />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={styles.deleteBtn}
                                                                onPress={() => handleDelete(item.id!)}
                                                            >
                                                                <MaterialIcons name="delete" size={24} color="#e74c3c" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                </View>

                                            </View>
                                        )}
                                        keyExtractor={item => item.id?.toString() || Math.random().toString()}
                                        scrollEnabled={false}
                                    />
                                ) : (
                                    <View style={styles.bosListe}>
                                        <MaterialIcons name="assessment" size={40} color="#ddd" />
                                        <Text style={styles.bosListeText}>Kayıt bulunamadı</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {/* Date Picker (Add Form) */}
            {tarihPickerAcik && (
                <DateTimePicker
                    value={denemeTarih}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        setTarihPickerAcik(Platform.OS === 'ios');
                        if (selectedDate) {
                            setDenemeTarih(selectedDate);
                        }
                    }}
                />
            )}

            {/* Güncelleme Modalı */}
            <Modal
                visible={editModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.editModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Deneme Güncelle</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {editingDeneme && (
                            <ScrollView>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Deneme Adı</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={editingDeneme.denemeAd}
                                        onChangeText={(val) => setEditingDeneme({ ...editingDeneme, denemeAd: val })}
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Sınav Türü Seç</Text>
                                    <View style={[styles.pickerContainer, { height: 50, padding: 0 }]}>
                                        <Picker
                                            selectedValue={editingDeneme.sinavTuruId}
                                            onValueChange={(val) => setEditingDeneme({ ...editingDeneme, sinavTuruId: val })}
                                        >
                                            {sinavTurleri.map((tur) => (
                                                <Picker.Item key={tur.id} label={tur.ad} value={tur.id!} />
                                            ))}
                                        </Picker>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View style={[styles.inputContainer, { flex: 0.48 }]}>
                                        <Text style={styles.inputLabel}>Doğru Sayısı</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            value={String(editingDeneme.dogru)}
                                            onChangeText={(val) => setEditingDeneme({ ...editingDeneme, dogru: parseInt(val) || 0 })}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={[styles.inputContainer, { flex: 0.48 }]}>
                                        <Text style={styles.inputLabel}>Yanlış Sayısı</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            value={String(editingDeneme.yanlis)}
                                            onChangeText={(val) => setEditingDeneme({ ...editingDeneme, yanlis: parseInt(val) || 0 })}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.kaydetButon} onPress={handleGuncelleKaydet}>
                                    <Text style={styles.kaydetButonText}>Kaydet</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

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
                            <Text style={styles.modalTitle}>Deneme Raporu Oluştur</Text>
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
                                onPress={() => denemeRaporuOlustur('indir')}
                                disabled={isGeneratingPDF}
                            >
                                <MaterialIcons name="file-download" size={24} color="white" />
                                <Text style={styles.raporAksiyonText}>İndir / Paylaş</Text>
                            </TouchableOpacity>

                            <View style={styles.raporPaylasımGrup}>
                                <TouchableOpacity
                                    style={[styles.paylasimButon, { backgroundColor: '#27ae60' }]}
                                    onPress={() => denemeRaporuOlustur('ogrenci')}
                                    disabled={isGeneratingPDF}
                                >
                                    <MaterialIcons name="person" size={20} color="white" />
                                    <Text style={styles.paylasimText}>Öğrenciye</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.paylasimButon, { backgroundColor: '#8e44ad' }]}
                                    onPress={() => denemeRaporuOlustur('veli')}
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
        backgroundColor: '#f5f5f5',
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
        paddingTop: Platform.OS === 'ios' ? 40 : 16,
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
        marginRight: 10,
        color: '#333',
    },
    raporButon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#9b59b6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
    },
    raporButonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 4,
    },
    formContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
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
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        backgroundColor: '#bbe0f5ff',
        overflow: 'hidden',
        justifyContent: 'center',
        height: 50,
        padding: 18
    },
    picker: {
        height: 75,
        color: '#032c55ff',
        fontSize: 10,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 12,
        backgroundColor: '#facbcbff',
    },
    dateText: {
        marginLeft: 8,
        fontSize: 12,
        color: '#333',
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    kaydetButon: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        backgroundColor: '#27ae60',
        padding: 14,
        borderRadius: 6,
        marginTop: 8,
        width: '40%',
        alignSelf: 'flex-end',
    },
    kaydetButonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 16,
    },
    listContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        elevation: 2,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 26,
        height: 50,
    },
    denemeItem: {
        flexDirection: 'row',
        padding: 12,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#f5e4e4ff',
        alignItems: 'center',
    },
    denemeInfo: {
        flex: 1,
    },
    denemeHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    denemeTypeTxt: {
        fontWeight: 'bold',
        fontSize: 15,
        color: '#2980b9',
    },
    denemeDateTxt: {
        color: '#7f8c8d',
        fontSize: 12,
    },
    denemeAdTxt: {
        fontSize: 14,
        color: '#34495e',
        marginBottom: 8,
        fontStyle: 'italic',
    },
    denemeStats: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statCorrect: {
        color: '#27ae60',
        fontWeight: 'bold',
        marginRight: 16,
    },
    statWrong: {
        color: '#e74c3c',
        fontWeight: 'bold',
    },
    editBtn: {
        padding: 8,
    },
    deleteBtn: {
        padding: 8,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    editModalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        maxHeight: '80%',
    },
    reportModalContent: {
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
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 10,
    },
    dateRangeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 10,
    },
    reportDateButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#f8f9fa',
    },
    dateLabel: {
        fontSize: 12,
        color: '#7f8c8d',
        marginBottom: 4,
    },
    dateValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    raporAksiyonlar: {
        gap: 10,
    },
    raporAksiyonButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 8,
        elevation: 2,
    },
    raporAksiyonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 8,
        fontSize: 16,
    },
    raporPaylasımGrup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    paylasimButon: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        elevation: 2,
    },
    paylasimText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 6,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    loadingText: {
        marginTop: 10,
        color: '#3498db',
        fontWeight: 'bold',
    },
});
