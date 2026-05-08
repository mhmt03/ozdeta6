import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    TouchableWithoutFeedback,
    Linking, // Added Linking for SMS/WhatsApp
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons, FontAwesome5, Entypo } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';
import { sendSMS, sendWhatsApp } from '../utils/messaging';
import { ogrencileriListele, ajandaGuncelle, randevuIptal, ajandaGrupGuncelle, ajandaSil, ajandaSiradakiKayitlariSil } from '../utils/database'; // Added randevuIptal, ajandaSil, ajandaSiradakiKayitlariSil
import { OgrenciType, AjandaType } from '../types';
import { tekOgrenci } from '../utils/database'; // Assuming tekOgrenci is also in utils/database or similar

export default function AjandaRandevuDuzenle({ route, navigation }: any) {
    const { randevu } = route.params;
    const insets = useSafeAreaInsets();

    const [date, setDate] = useState(new Date(randevu.tarih + ' ' + randevu.saat));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [kalanTekrar, setKalanTekrar] = useState(parseInt(randevu.kalanTekrarSayisi) || 1);
    const [periyot, setPeriyot] = useState(7); // DB'de periyot tutulmadığı için undefined dönüyor ve 1'e düşüyordu. Varsayılan 7 yaptık.

    const [ogrenciTip, setOgrenciTip] = useState(randevu.ogrenciId ? 'kayitli' : 'kayıtsız');
    const [ogrenciList, setOgrenciList] = useState<OgrenciType[]>([]);
    const [selectedOgrenci, setSelectedOgrenci] = useState(randevu.ogrenciId || null);
    const [kayıtsızInput, setKayitsizInput] = useState(randevu.ogrAdsoyad || '');
    const [ogrenci, setOgrenci] = useState<OgrenciType | null>(null); // Added ogrenci state

    const [degisiklikTipi, setDegisiklikTipi] = useState('sadeceBu'); // sadeceBu / tumKayitlar
    const [mesajHedef, setMesajHedef] = useState<'veli' | 'ogrenci'>('ogrenci');

    useEffect(() => {
        fetchOgrenciler(); // Fetch the list of students for the dropdown
        if (randevu.ogrenciId) {
            fetchOgrenciDetay(randevu.ogrenciId);
        }
    }, []);

    const fetchOgrenciler = async () => {
        const result = await ogrencileriListele(false);
        if (result?.success) {
            setOgrenciList(result.data ?? []);
        }
    };

    const fetchOgrenciDetay = async (ogrenciId: number) => {
        const result = await tekOgrenci(ogrenciId);
        if (result?.success) {
            setOgrenci(result.data ?? null);
        }
    };

    const handleKaydet = async () => {
        try {
            const yerelTarihString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            const saatStr = date.toTimeString().slice(0, 5);

            console.log(`[AjandaRandevuDuzenle.tsx] handleKaydet called. degisiklikTipi: ${degisiklikTipi}`);

            // 1. Her durumda mevcut kaydı güncelliyoruz
            const updatedRandevu: AjandaType = {
                ...randevu,
                tarih: yerelTarihString,
                saat: saatStr,
                ogrenciId: ogrenciTip === 'kayitli' ? selectedOgrenci : null,
                ogrAdsoyad: ogrenciTip === 'kayıtsız' ? kayıtsızInput : randevu.ogrAdsoyad,
                kalanTekrarSayisi: degisiklikTipi === 'tumKayitlar' ? kalanTekrar.toString() : randevu.kalanTekrarSayisi,
                tekrarsayisi: degisiklikTipi === 'tumKayitlar' ? kalanTekrar.toString() : (randevu.tekrarsayisi || '1'),
                tamamlanma: randevu.tamamlanma || '0',
                tamamlandiMi: randevu.tamamlandiMi || 0
            };

            console.log(`[AjandaRandevuDuzenle.tsx] Calling ajandaGuncelle with:`, updatedRandevu);
            await ajandaGuncelle(randevu.ajandaId!, updatedRandevu);

            // 2. Eğer tüm kayıtları etkileyecekse grubu güncelliyoruz
            if (degisiklikTipi === 'tumKayitlar' && randevu.olusmaAni) {
                console.log(`[AjandaRandevuDuzenle.tsx] Calling ajandaGrupGuncelle... olusmaAni: ${randevu.olusmaAni}, yerelTarihString: ${yerelTarihString}, kalanTekrar: ${kalanTekrar}`);

                // yerelTarihString, grup güncellemesinin "seciliTarih" parametresi olur
                const guncelleResult = await ajandaGrupGuncelle(randevu.olusmaAni, yerelTarihString, kalanTekrar, saatStr, periyot);
                if (!guncelleResult.success) {
                    throw new Error(guncelleResult.error);
                }
            }

            Alert.alert('Başarılı', 'Randevu kaydedildi');
            navigation.goBack();
        } catch (error) {
            console.error('[AjandaRandevuDuzenle.tsx] handleKaydet error:', error);
            Alert.alert('Hata', 'Güncelleme sırasında bir hata oluştu');
        }
    };

    // SMS gönder
    const gonderSms = () => {
        if (!ogrenci) return;
        const telefon = mesajHedef === 'veli' ? (ogrenci.veliTel || ogrenci.ogrenciTel) : (ogrenci.ogrenciTel || ogrenci.veliTel);
        if (!telefon || telefon === '-') {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }

        let mesaj = '';
        if (mesajHedef === 'veli') {
            if (randevu.iptal === 1) { // Assuming randevu.iptal exists and 1 means cancelled
                mesaj = `Sayın Veli, ${randevu.ogrAdsoyad} adlı öğrencinin ${randevu.tarih} tarihindeki dersi öğrenci talebi üzerine iptal edilmiştir. Bilginize...`;
            } else {
                mesaj = `Sayın Veli, ${randevu.ogrAdsoyad} adlı öğrencinin yeni ders randevusu: ${date.toLocaleDateString()} saat ${date.toTimeString().slice(0, 5)} olarak güncellenmiştir.`;
            }
        } else {
            if (randevu.iptal === 1) {
                mesaj = `${randevu.ogrAdsoyad}, ${randevu.tarih} tarihindeki dersin iptal edilmiştir. Bilginize...`;
            } else {
                mesaj = `${randevu.ogrAdsoyad}, yeni ders randevun: ${date.toLocaleDateString()} saat ${date.toTimeString().slice(0, 5)} olarak güncellenmiştir.`;
            }
        }

        const url = `sms:${telefon}?body=${encodeURIComponent(mesaj)}`;
        Linking.openURL(url);
    };

    // WhatsApp gönder
    const gonderWhatsApp = () => {
        if (!ogrenci) return;
        const telefon = mesajHedef === 'veli' ? (ogrenci.veliTel || ogrenci.ogrenciTel) : (ogrenci.ogrenciTel || ogrenci.veliTel);
        if (!telefon || telefon === '-') {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }

        let mesaj = '';
        if (mesajHedef === 'veli') {
            if (randevu.iptal === 1) { // Assuming randevu.iptal exists and 1 means cancelled
                mesaj = `Sayın Veli, ${randevu.ogrAdsoyad} adlı öğrencinin ${randevu.tarih} tarihindeki dersi öğrenci talebi üzerine iptal edilmiştir. Bilginize...`;
            } else {
                mesaj = `Sayın Veli, ${randevu.ogrAdsoyad} adlı öğrencinin yeni ders randevusu: ${date.toLocaleDateString()} saat ${date.toTimeString().slice(0, 5)} olarak güncellenmiştir.`;
            }
        } else {
            if (randevu.iptal === 1) {
                mesaj = `${randevu.ogrAdsoyad}, ${randevu.tarih} tarihindeki dersin iptal edilmiştir. Bilginize...`;
            } else {
                mesaj = `${randevu.ogrAdsoyad}, yeni ders randevun: ${date.toLocaleDateString()} saat ${date.toTimeString().slice(0, 5)} olarak güncellenmiştir.`;
            }
        }

        const temizTel = telefon.replace(/\D/g, '');
        const tamTel = temizTel.startsWith('90') ? temizTel : `90${temizTel}`;
        const url = `whatsapp://send?phone=${tamTel}&text=${encodeURIComponent(mesaj)}`;
        Linking.openURL(url).catch(() => Alert.alert('Hata', 'WhatsApp açılamadı'));
    };

    // Randevu İptal Et
    const randevuIptalEt = () => {
        Alert.alert(
            'Randevu İptal',
            'Bu randevuyu iptal etmek istediğinizden emin misiniz? (Kayıt silinmeyecek, sadece iptal olarak işaretlenecek)',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'İptal Et',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await randevuIptal(randevu.ajandaId);
                        if (result.success) {
                            Alert.alert('Başarılı', 'Randevu iptal edildi');
                            navigation.goBack();
                        } else {
                            Alert.alert('Hata', 'Randevu iptal edilirken bir hata oluştu.');
                        }
                    }
                }
            ]
        );
    };

    // Randevu Sil
    const handleSil = () => {
        if (degisiklikTipi === 'sadeceBu' || !randevu.olusmaAni) {
            Alert.alert(
                'Randevu Sil',
                'Bu randevuyu tamamen silmek istediğinizden emin misiniz?',
                [
                    { text: 'Vazgeç', style: 'cancel' },
                    {
                        text: 'Sil',
                        style: 'destructive',
                        onPress: async () => {
                            const result = await ajandaSil(randevu.ajandaId);
                            if (result.success) {
                                Alert.alert('Başarılı', 'Randevu silindi');
                                navigation.goBack();
                            } else {
                                Alert.alert('Hata', 'Silme işlemi başarısız oldu');
                            }
                        }
                    }
                ]
            );
        } else {
            // degisiklikTipi === 'tumKayitlar' ve olusmaAni var
            Alert.alert(
                'Randevu Sil',
                'Seçili randevuyu VE sonraki tüm tekrarlarını silmek istediğinizden emin misiniz?',
                [
                    { text: 'Vazgeç', style: 'cancel' },
                    {
                        text: 'Hepsini Sil',
                        style: 'destructive',
                        onPress: async () => {
                            const result = await ajandaSiradakiKayitlariSil(randevu.olusmaAni, randevu.tarih);
                            if (result.success) {
                                Alert.alert('Başarılı', 'Sıradaki tüm randevular silindi');
                                navigation.goBack();
                            } else {
                                Alert.alert('Hata', 'Silme işlemi başarısız oldu');
                            }
                        }
                    }
                ]
            );
        }
    };

    const formatDateWithDay = (date: Date) => {
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        const dayName = days[date.getDay()];
        return `${date.toLocaleDateString()} ${dayName}`;
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >

            <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom + 20, 100) }}>
                <Text style={styles.label}>Tarih</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateTimeButton}>
                    {/* <Text>{date.toLocaleDateString()}</Text> */}
                    <Text>{formatDateWithDay(date)}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker
                        value={date}
                        mode="date"
                        display="default"
                        onChange={(e, selectedDate) => {
                            setShowDatePicker(false);
                            if (selectedDate) setDate(new Date(date.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())));
                        }}
                    />
                )}

                <Text style={styles.label}>Saat</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dateTimeButton}>
                    <Text>{date.toTimeString().slice(0, 5)}</Text>
                </TouchableOpacity>
                {showTimePicker && (
                    <DateTimePicker
                        value={date}
                        mode="time"
                        display="default"
                        onChange={(e, selectedTime) => {
                            setShowTimePicker(false);
                            if (selectedTime) setDate(new Date(date.setHours(selectedTime.getHours(), selectedTime.getMinutes())));
                        }}
                    />
                )}

                <View style={styles.row}>
                    <View style={styles.column}>
                        <Text style={styles.label}>Kalan Tekrar</Text>
                        <View style={styles.stepInputContainer}>
                            <TouchableOpacity
                                style={styles.stepButton}
                                onPress={() => {
                                    setKalanTekrar((prev: number) => Math.max(1, prev - 1));
                                    setDegisiklikTipi('tumKayitlar');
                                }}
                            >
                                <MaterialIcons name="remove" size={20} color="#3498db" />
                            </TouchableOpacity>
                            <TextInput
                                style={styles.inputStep}
                                keyboardType="numeric"
                                value={kalanTekrar.toString()}
                                onChangeText={(t) => setKalanTekrar(parseInt(t) || 0)}
                            />
                            <TouchableOpacity
                                style={styles.stepButton}
                                onPress={() => {
                                    setKalanTekrar((prev: number) => prev + 1);
                                    setDegisiklikTipi('tumKayitlar');
                                }}
                            >
                                <MaterialIcons name="add" size={20} color="#3498db" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.column}>
                        <Text style={styles.label}>Periyot (gün)</Text>
                        <TextInput
                            style={styles.inputSmall}
                            keyboardType="numeric"
                            value={periyot.toString()}
                            onChangeText={(t) => setPeriyot(parseInt(t) || 0)}
                        />
                    </View>
                </View>

                <Text style={styles.label}>Öğrenci</Text>
                <View style={styles.radioContainer}>
                    <TouchableOpacity style={styles.radioButton} onPress={() => setOgrenciTip('kayitli')}>
                        <View style={[styles.radioCircle, ogrenciTip === 'kayitli' && styles.radioSelected]} />
                        <Text style={styles.radioLabel}>Kayıtlı Öğrenci</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.radioButton} onPress={() => setOgrenciTip('kayıtsız')}>
                        <View style={[styles.radioCircle, ogrenciTip === 'kayıtsız' && styles.radioSelected]} />
                        <Text style={styles.radioLabel}>Kayıtsız Öğrenci</Text>
                    </TouchableOpacity>
                </View>

                {ogrenciTip === 'kayitli' ? (
                    <RNPickerSelect
                        onValueChange={(value) => setSelectedOgrenci(value)}
                        items={ogrenciList.map(o => ({ label: `${o.ogrenciAd} ${o.ogrenciSoyad}`, value: o.ogrenciId }))}
                        value={selectedOgrenci}
                        style={{ inputIOS: styles.input, inputAndroid: styles.input }}
                    />
                ) : (
                    <TextInput
                        placeholder="Öğrenci adı soyadı"
                        style={styles.input}
                        value={kayıtsızInput}
                        onChangeText={setKayitsizInput}
                    />
                )}

                <Text style={styles.label}>Değişiklik Tipi</Text>
                <View style={styles.radioContainer}>
                    <TouchableOpacity style={styles.radioButton} onPress={() => setDegisiklikTipi('sadeceBu')}>
                        <View style={[styles.radioCircle, degisiklikTipi === 'sadeceBu' && styles.radioSelected]} />
                        <Text style={styles.radioLabel}>Sadece Bu Kayıt</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.radioButton} onPress={() => setDegisiklikTipi('tumKayitlar')}>
                        <View style={[styles.radioCircle, degisiklikTipi === 'tumKayitlar' && styles.radioSelected]} />
                        <Text style={styles.radioLabel}>Sıradaki Tüm Kayıtlar</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.buttonGrid}>
                    <TouchableOpacity style={[styles.buttonSmall, { backgroundColor: '#3498db' }]} onPress={handleKaydet}>
                        <MaterialIcons name="save" size={18} color="white" />
                        <Text style={styles.buttonText}>Kaydet</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.buttonSmall, { backgroundColor: '#95a5a6' }]} onPress={() => navigation.goBack()}>
                        <Entypo name="cross" size={18} color="white" />
                        <Text style={styles.buttonText}>Vazgeç</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.buttonSmall, styles.iptalButon]}
                        onPress={randevuIptalEt}
                    >
                        <MaterialIcons name="cancel" size={18} color="white" />
                        <Text style={styles.buttonText}>Randevu İptal</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.buttonSmall, { backgroundColor: '#e74c3c' }]}
                        onPress={handleSil}
                    >
                        <MaterialIcons name="delete" size={18} color="white" />
                        <Text style={styles.buttonText}>Randevu Sil</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.label}>Mesaj Hedefi</Text>
                <View style={styles.radioContainer}>

                    <TouchableOpacity style={styles.radioButton} onPress={() => setMesajHedef('veli')}>
                        <View style={[styles.radioCircle, mesajHedef === 'veli' && styles.radioSelected]} />
                        <Text style={styles.radioLabel}>Veliye</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.radioButton} onPress={() => setMesajHedef('ogrenci')}>
                        <View style={[styles.radioCircle, mesajHedef === 'ogrenci' && styles.radioSelected]} />
                        <Text style={styles.radioLabel}>Öğrenciye</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.buttonGrid}>


                    <TouchableOpacity style={[styles.buttonSmall, { backgroundColor: '#27ae60' }]} onPress={gonderSms}>
                        <MaterialIcons name="sms" size={18} color="white" />
                        <Text style={styles.buttonText}>SMS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.buttonSmall, { backgroundColor: '#075E54' }]} onPress={gonderWhatsApp}>
                        <FontAwesome5 name="whatsapp" size={18} color="white" />
                        <Text style={styles.buttonText}>WhatsApp</Text>
                    </TouchableOpacity>


                </View>
            </ScrollView>

        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f7f7f7',
        paddingTop: 16,
        paddingBottom: 16,
    },
    label: { fontWeight: 'bold', marginTop: 15 },
    input: {
        backgroundColor: 'white',
        padding: 8,
        borderRadius: 8,
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#ced4da',
        color: '#2c3e50',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    inputSmall: {
        backgroundColor: 'white',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        marginTop: 5,
        width: 100,
        textAlign: 'center'
    },
    stepInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
        backgroundColor: 'white',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        overflow: 'hidden',
    },
    stepButton: {
        padding: 10,
        backgroundColor: '#f0f7ff',
    },
    inputStep: {
        flex: 1,
        height: 40,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    column: { flex: 1, marginHorizontal: 5 },
    radioContainer: { flexDirection: 'row', marginTop: 10 },
    radioButton: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
    radioCircle: {
        height: 18,
        width: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#3498db',
        marginRight: 5,
    },
    radioSelected: { backgroundColor: '#3498db' },
    radioLabel: { fontSize: 14 },
    buttonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 25,
    },
    iptalButon: {
        backgroundColor: '#f39c12',
    },
    buttonSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 12,
        width: '47%',
    },
    buttonText: { color: 'white', marginLeft: 5, fontWeight: 'bold', fontSize: 13 },
    dateTimeButton: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 8,
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center'
    }
});
