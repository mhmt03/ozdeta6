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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons, FontAwesome5, Entypo } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';
import { sendSMS, sendWhatsApp } from '../utils/messaging';
import { ogrencileriListele, ajandaGuncelle } from '../utils/database';
import { OgrenciType, AjandaType } from '../types';

export default function AjandaRandevuDuzenle({ route, navigation }: any) {
    const { randevu } = route.params;

    const [date, setDate] = useState(new Date(randevu.tarih + ' ' + randevu.saat));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [kalanTekrar, setKalanTekrar] = useState(randevu.kalanTekrarSayisi || 1);
    const [periyot, setPeriyot] = useState(randevu.periyot || 1);

    const [ogrenciTip, setOgrenciTip] = useState(randevu.ogrenciId ? 'kayitli' : 'kayıtsız');
    const [ogrenciList, setOgrenciList] = useState<OgrenciType[]>([]);
    const [selectedOgrenci, setSelectedOgrenci] = useState(randevu.ogrenciId || null);
    const [kayıtsızInput, setKayitsizInput] = useState(randevu.ogrAdsoyad || '');

    const [degisiklikTipi, setDegisiklikTipi] = useState('sadeceBu'); // sadeceBu / tumKayitlar

    useEffect(() => {
        fetchOgrenciler();
    }, []);

    const fetchOgrenciler = async () => {
        const result = await ogrencileriListele(false);
        if (result?.success) {
            setOgrenciList(result.data ?? []);
        }
    };

    const handleKaydet = async () => {
        try {
            const updatedRandevu: AjandaType = {
                ...randevu,
                tarih: date.toISOString().split('T')[0],
                saat: date.toTimeString().slice(0, 5),
                ogrenciId: ogrenciTip === 'kayitli' ? selectedOgrenci : null,
                ogrAdsoyad: ogrenciTip === 'kayıtsız' ? kayıtsızInput : randevu.ogrAdsoyad,
                kalanTekrarSayisi: kalanTekrar.toString(),
                tekrarsayisi: randevu.tekrarsayisi || '1',
                tamamlanma: randevu.tamamlanma || '0'
            };

            await ajandaGuncelle(randevu.ajandaId!, updatedRandevu);
            Alert.alert('Başarılı', 'Randevu güncellendi');
            navigation.goBack();
        } catch (error) {
            console.error(error);
            Alert.alert('Hata', 'Güncelleme sırasında bir hata oluştu');
        }
    };

    const handleSMSSend = () => {
        if (!randevu.ogrenciTel) {
            Alert.alert('Hata', 'Öğrencinin telefonu sistemde kayıtlı değil!');
            return;
        }
        const mesaj = `Randevunuz: ${date.toLocaleDateString()} ${date.toTimeString().slice(0, 5)}`;
        sendSMS(randevu.ogrenciTel, mesaj);
    };

    const handleWhatsAppSend = () => {
        if (!randevu.ogrenciTel) {
            Alert.alert('Hata', 'Öğrencinin telefonu sistemde kayıtlı değil!');
            return;
        }
        const mesaj = `Randevunuz: ${date.toLocaleDateString()} ${date.toTimeString().slice(0, 5)}`;
        sendWhatsApp(randevu.ogrenciTel, mesaj);
    };
    const formatDateWithDay = (date: Date) => {
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        const dayName = days[date.getDay()];
        return `${date.toLocaleDateString()} ${dayName}`;
    };

    // Kullanımı:
    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateTimeButton}>
        <Text>{formatDateWithDay(date)}</Text>
    </TouchableOpacity>
    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >

            <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
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
                        <TextInput
                            style={styles.inputSmall}
                            keyboardType="numeric"
                            value={kalanTekrar.toString()}
                            onChangeText={(t) => setKalanTekrar(parseInt(t))}
                        />
                    </View>

                    <View style={styles.column}>
                        <Text style={styles.label}>Periyot (gün)</Text>
                        <TextInput
                            style={styles.inputSmall}
                            keyboardType="numeric"
                            value={"7"}
                            onChangeText={(t) => setPeriyot(parseInt(t))}
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

                    <TouchableOpacity style={[styles.buttonSmall, { backgroundColor: '#27ae60' }]} onPress={handleSMSSend}>
                        <MaterialIcons name="sms" size={18} color="white" />
                        <Text style={styles.buttonText}>SMS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.buttonSmall, { backgroundColor: '#075E54' }]} onPress={handleWhatsAppSend}>
                        <FontAwesome5 name="whatsapp" size={18} color="white" />
                        <Text style={styles.buttonText}>WhatsApp</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f7f7f7' },
    label: { fontWeight: 'bold', marginTop: 15 },
    input: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 8,
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#ccc'
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
