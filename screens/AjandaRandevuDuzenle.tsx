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
    Linking,
    Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons, FontAwesome5, Entypo } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';
import { sendSMS, sendWhatsApp } from '../utils/messaging';
import { ogrencileriListele, ajandaGuncelle, randevuIptal, ajandaGrupGuncelle, ajandaSil, ajandaSiradakiKayitlariSil } from '../utils/database';
import { OgrenciType, AjandaType } from '../types';
import { tekOgrenci } from '../utils/database';
import { getSetting } from '../database/settingsOperations';
import { scheduleRandevuNotification, cancelRandevuNotification } from '../utils/notifications';

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

    // 🔔 Bildirim state'leri
    const [globalBildirimAcik, setGlobalBildirimAcik] = useState(true);
    const [randevuBildirimIste, setRandevuBildirimIste] = useState(false);
    const [bildirimDakika, setBildirimDakika] = useState(15);
    const [bildirimSesli, setBildirimSesli] = useState(true);

    useEffect(() => {
        fetchOgrenciler();
        if (randevu.ogrenciId) {
            fetchOgrenciDetay(randevu.ogrenciId);
        }
        loadBildirimAyarlari();
    }, []);

    // Global bildirim ayarları + bu randevu için varsayılan değerleri yükle
    const loadBildirimAyarlari = async () => {
        try {
            const enabled = await getSetting('notifications_enabled', '1');
            const mins = await getSetting('notification_minutes', '15');
            const sound = await getSetting('notification_sound', '1');
            setGlobalBildirimAcik(enabled === '1');
            setBildirimDakika(parseInt(mins) || 15);
            setBildirimSesli(sound === '1');
            // Eğer global açıksa, bu randevu için de bildirimi varsayılan açık yap
            setRandevuBildirimIste(enabled === '1');
        } catch (error) {
            console.error('Bildirim ayarları okunamadı:', error);
        }
    };

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

            // ajandaGuncelle zaten bildirim planlar, biz önce onu çağırıp sonra override edeceğiz
            await ajandaGuncelle(randevu.ajandaId!, updatedRandevu);

            // Bildirim ayarına göre yeniden düzenle
            if (randevu.ajandaId) {
                const bildirimGonder = globalBildirimAcik && randevuBildirimIste;
                if (bildirimGonder) {
                    await scheduleRandevuNotification(
                        randevu.ajandaId,
                        yerelTarihString,
                        saatStr,
                        updatedRandevu.ogrAdsoyad,
                        bildirimDakika,
                        bildirimSesli
                    );
                } else {
                    // Kullanıcı bildirimi istemedi → planlanmış bildirimi iptal et
                    await cancelRandevuNotification(randevu.ajandaId);
                }
            }

            // Tüm kayıtları etkileyecekse grubu güncelle
            if (degisiklikTipi === 'tumKayitlar' && randevu.olusmaAni) {
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

                {/* 🔔 BİLDİRİM AYARI BÖLÜMÜ */}
                <View style={styles.bildirimSection}>
                    <Text style={styles.label}>🔔 Bildirim Ayarı</Text>

                    {/* Global bildirim kapalıysa uyarı */}
                    {!globalBildirimAcik && (
                        <View style={styles.bildirimUyariBox}>
                            <MaterialIcons name="notifications-off" size={16} color="#e67e22" />
                            <Text style={styles.bildirimUyariText}>
                                Bildirimler Ayarlar'dan kapalı.
                            </Text>
                        </View>
                    )}

                    {/* Açık/Kapalı toggle */}
                    <View style={styles.bildirimToggleRow}>
                        <Text style={[
                            styles.bildirimToggleLabel,
                            !globalBildirimAcik && styles.disabledText
                        ]}>
                            Bu randevu için bildirim
                        </Text>
                        <Switch
                            value={randevuBildirimIste}
                            onValueChange={(val) => setRandevuBildirimIste(val)}
                            disabled={!globalBildirimAcik}
                            trackColor={{ false: '#ccc', true: '#3498db' }}
                            thumbColor={randevuBildirimIste ? '#2980b9' : '#f4f3f4'}
                        />
                    </View>

                    {/* Detaylar (sadece açıksa ve global açıksa) */}
                    {randevuBildirimIste && globalBildirimAcik && (
                        <View style={styles.bildirimDetayBox}>
                            {/* Dakika sayacı */}
                            <View style={styles.dakikaRow}>
                                <Text style={styles.bildirimToggleLabel}>Kaç dakika önce:</Text>
                                <View style={styles.dakikaControls}>
                                    <TouchableOpacity
                                        style={styles.dakikaBtn}
                                        onPress={() => setBildirimDakika(prev => Math.max(1, prev - 5))}
                                    >
                                        <MaterialIcons name="remove" size={18} color="#e74c3c" />
                                    </TouchableOpacity>
                                    <Text style={styles.dakikaValue}>{bildirimDakika}</Text>
                                    <TouchableOpacity
                                        style={styles.dakikaBtn}
                                        onPress={() => setBildirimDakika(prev => prev + 5)}
                                    >
                                        <MaterialIcons name="add" size={18} color="#2ecc71" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Ses seçimi */}
                            <View style={styles.bildirimToggleRow}>
                                <Text style={styles.bildirimToggleLabel}>Bildirim türü:</Text>
                                <View style={styles.sesSecenekler}>
                                    <TouchableOpacity
                                        style={[styles.sesButon, bildirimSesli && styles.sesButonAktif]}
                                        onPress={() => setBildirimSesli(true)}
                                    >
                                        <MaterialIcons name="volume-up" size={16}
                                            color={bildirimSesli ? 'white' : '#7f8c8d'} />
                                        <Text style={[styles.sesButonText, bildirimSesli && styles.sesButonTextAktif]}>Sesli</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.sesButon, !bildirimSesli && styles.sesButonAktif]}
                                        onPress={() => setBildirimSesli(false)}
                                    >
                                        <MaterialIcons name="notifications-none" size={16}
                                            color={!bildirimSesli ? 'white' : '#7f8c8d'} />
                                        <Text style={[styles.sesButonText, !bildirimSesli && styles.sesButonTextAktif]}>Sessiz</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
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
    },

    // 🔔 Bildirim stilleri
    bildirimSection: {
        marginTop: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#ecf0f1',
        elevation: 1,
    },
    bildirimUyariBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef9e7',
        borderRadius: 6,
        padding: 8,
        marginTop: 6,
        marginBottom: 8,
        gap: 6,
        borderLeftWidth: 3,
        borderLeftColor: '#e67e22',
    },
    bildirimUyariText: {
        flex: 1,
        fontSize: 12,
        color: '#e67e22',
    },
    bildirimToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    bildirimToggleLabel: {
        fontSize: 14,
        color: '#2c3e50',
        fontWeight: '500',
    },
    disabledText: {
        color: '#bdc3c7',
    },
    bildirimDetayBox: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#ecf0f1',
        paddingTop: 10,
    },
    dakikaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dakikaControls: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dakikaBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ecf0f1',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    dakikaValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2c3e50',
        minWidth: 28,
        textAlign: 'center',
    },
    sesSecenekler: {
        flexDirection: 'row',
        gap: 8,
    },
    sesButon: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#bdc3c7',
        gap: 4,
        backgroundColor: '#f4f6f7',
    },
    sesButonAktif: {
        backgroundColor: '#3498db',
        borderColor: '#3498db',
    },
    sesButonText: {
        fontSize: 12,
        color: '#7f8c8d',
        fontWeight: '500',
    },
    sesButonTextAktif: {
        color: 'white',
    },
});
