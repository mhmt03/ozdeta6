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
import { scheduleRandevuNotification, cancelRandevuNotification, rescheduleAllRandevuNotifications } from '../utils/notifications';

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

            let secilenOgrenciAdSoyad = randevu.ogrAdsoyad;
            if (ogrenciTip === 'kayitli' && selectedOgrenci) {
                const secilenOgr = ogrenciList.find(o => o.ogrenciId === selectedOgrenci);
                if (secilenOgr) {
                    secilenOgrenciAdSoyad = `${secilenOgr.ogrenciAd} ${secilenOgr.ogrenciSoyad}`;
                }
            } else if (ogrenciTip === 'kayıtsız') {
                secilenOgrenciAdSoyad = kayıtsızInput;
            }

            const updatedRandevu: AjandaType = {
                ...randevu,
                tarih: yerelTarihString,
                saat: saatStr,
                ogrenciId: ogrenciTip === 'kayitli' ? selectedOgrenci : null,
                ogrAdsoyad: secilenOgrenciAdSoyad,
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
                // Tüm kayıtlar güncellendiği için bildirimleri yeniden planla
                await rescheduleAllRandevuNotifications();
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
            style={{ flex: 1, backgroundColor: '#F3F4F6' }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView 
                style={styles.container} 
                contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom + 20, 100) }}
                showsVerticalScrollIndicator={false}
            >
                {/* TARİH & SAAT KARTI */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="event" size={20} color="#4F46E5" />
                        <Text style={styles.cardTitle}>Zaman Bilgileri</Text>
                    </View>
                    
                    <View style={styles.row}>
                        <View style={styles.column}>
                            <Text style={styles.label}>Tarih</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateTimeButton}>
                                <Text style={styles.dateTimeText}>{formatDateWithDay(date)}</Text>
                                <MaterialIcons name="calendar-today" size={16} color="#6B7280" style={styles.inputIcon} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.column}>
                            <Text style={styles.label}>Saat</Text>
                            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dateTimeButton}>
                                <Text style={styles.dateTimeText}>{date.toTimeString().slice(0, 5)}</Text>
                                <MaterialIcons name="access-time" size={16} color="#6B7280" style={styles.inputIcon} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

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

                {/* TEKRAR VE PERİYOT KARTI */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="repeat" size={20} color="#4F46E5" />
                        <Text style={styles.cardTitle}>Tekrar & Periyot</Text>
                    </View>
                    <View style={styles.row}>
                        <View style={[styles.column, { marginRight: 8 }]}>
                            <Text style={styles.label}>Kalan Tekrar</Text>
                            <View style={styles.stepInputContainer}>
                                <TouchableOpacity
                                    style={styles.stepButton}
                                    onPress={() => {
                                        setKalanTekrar((prev: number) => Math.max(1, prev - 1));
                                        setDegisiklikTipi('tumKayitlar');
                                    }}
                                >
                                    <MaterialIcons name="remove" size={20} color="#4F46E5" />
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
                                    <MaterialIcons name="add" size={20} color="#4F46E5" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={[styles.column, { marginLeft: 8 }]}>
                            <Text style={styles.label}>Periyot (Gün)</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.inputSmall}
                                    keyboardType="numeric"
                                    value={periyot.toString()}
                                    onChangeText={(t) => setPeriyot(parseInt(t) || 0)}
                                />
                                <MaterialIcons name="loop" size={16} color="#6B7280" style={styles.inputIcon} />
                            </View>
                        </View>
                    </View>
                </View>

                {/* ÖĞRENCİ KARTI */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <FontAwesome5 name="user-graduate" size={18} color="#4F46E5" />
                        <Text style={styles.cardTitle}>Öğrenci Bilgileri</Text>
                    </View>
                    <View style={styles.radioContainer}>
                        <TouchableOpacity style={[styles.radioButton, ogrenciTip === 'kayitli' && styles.radioSelectedContainer]} onPress={() => setOgrenciTip('kayitli')}>
                            <View style={[styles.radioCircle, ogrenciTip === 'kayitli' && styles.radioSelected]} />
                            <Text style={[styles.radioLabel, ogrenciTip === 'kayitli' && styles.radioLabelSelected]}>Kayıtlı</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.radioButton, ogrenciTip === 'kayıtsız' && styles.radioSelectedContainer]} onPress={() => setOgrenciTip('kayıtsız')}>
                            <View style={[styles.radioCircle, ogrenciTip === 'kayıtsız' && styles.radioSelected]} />
                            <Text style={[styles.radioLabel, ogrenciTip === 'kayıtsız' && styles.radioLabelSelected]}>Kayıtsız</Text>
                        </TouchableOpacity>
                    </View>

                    {ogrenciTip === 'kayitli' ? (
                        <View style={styles.pickerContainer}>
                            <RNPickerSelect
                                onValueChange={(value) => setSelectedOgrenci(value)}
                                items={ogrenciList.map(o => ({ label: `${o.ogrenciAd} ${o.ogrenciSoyad}`, value: o.ogrenciId }))}
                                value={selectedOgrenci}
                                style={{
                                    inputIOS: styles.pickerInput,
                                    inputAndroid: styles.pickerInput,
                                    iconContainer: { top: 12, right: 12 },
                                }}
                                Icon={() => <MaterialIcons name="arrow-drop-down" size={24} color="#6B7280" />}
                            />
                        </View>
                    ) : (
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="person-outline" size={20} color="#6B7280" style={{marginLeft: 10}}/>
                            <TextInput
                                placeholder="Öğrenci Adı Soyadı"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                value={kayıtsızInput}
                                onChangeText={setKayitsizInput}
                            />
                        </View>
                    )}
                </View>

                {/* DEĞİŞİKLİK TİPİ KARTI */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="edit" size={20} color="#4F46E5" />
                        <Text style={styles.cardTitle}>Değişiklik Kapsamı</Text>
                    </View>
                    <View style={styles.radioContainer}>
                        <TouchableOpacity style={[styles.radioButton, degisiklikTipi === 'sadeceBu' && styles.radioSelectedContainer]} onPress={() => setDegisiklikTipi('sadeceBu')}>
                            <View style={[styles.radioCircle, degisiklikTipi === 'sadeceBu' && styles.radioSelected]} />
                            <Text style={[styles.radioLabel, degisiklikTipi === 'sadeceBu' && styles.radioLabelSelected]}>Sadece Bu Kayıt</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.radioButton, degisiklikTipi === 'tumKayitlar' && styles.radioSelectedContainer]} onPress={() => setDegisiklikTipi('tumKayitlar')}>
                            <View style={[styles.radioCircle, degisiklikTipi === 'tumKayitlar' && styles.radioSelected]} />
                            <Text style={[styles.radioLabel, degisiklikTipi === 'tumKayitlar' && styles.radioLabelSelected]}>Sonraki Tüm Kayıtlar</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* BİLDİRİM AYARI KARTI */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="notifications-active" size={20} color="#4F46E5" />
                        <Text style={styles.cardTitle}>Bildirim Ayarları</Text>
                    </View>

                    {!globalBildirimAcik && (
                        <View style={styles.bildirimUyariBox}>
                            <MaterialIcons name="notifications-off" size={18} color="#D97706" />
                            <Text style={styles.bildirimUyariText}>
                                Genel bildirimler Ayarlar'dan kapalı durumda.
                            </Text>
                        </View>
                    )}

                    <View style={styles.bildirimToggleRow}>
                        <Text style={[styles.bildirimToggleLabel, !globalBildirimAcik && styles.disabledText]}>
                            Bu randevu için bildirim al
                        </Text>
                        <Switch
                            value={randevuBildirimIste}
                            onValueChange={setRandevuBildirimIste}
                            disabled={!globalBildirimAcik}
                            trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                            thumbColor={randevuBildirimIste ? '#4F46E5' : '#F9FAFB'}
                        />
                    </View>

                    {randevuBildirimIste && globalBildirimAcik && (
                        <View style={styles.bildirimDetayBox}>
                            <View style={styles.dakikaRow}>
                                <Text style={styles.bildirimToggleLabel}>Öncesinde uyar (dk):</Text>
                                <View style={styles.dakikaControls}>
                                    <TouchableOpacity style={styles.dakikaBtn} onPress={() => setBildirimDakika(prev => Math.max(1, prev - 5))}>
                                        <MaterialIcons name="remove" size={18} color="#EF4444" />
                                    </TouchableOpacity>
                                    <Text style={styles.dakikaValue}>{bildirimDakika}</Text>
                                    <TouchableOpacity style={styles.dakikaBtn} onPress={() => setBildirimDakika(prev => prev + 5)}>
                                        <MaterialIcons name="add" size={18} color="#10B981" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={[styles.dakikaRow, { marginTop: 12 }]}>
                                <Text style={styles.bildirimToggleLabel}>Ses durumu:</Text>
                                <View style={styles.sesSecenekler}>
                                    <TouchableOpacity style={[styles.sesButon, bildirimSesli && styles.sesButonAktif]} onPress={() => setBildirimSesli(true)}>
                                        <MaterialIcons name="volume-up" size={18} color={bildirimSesli ? 'white' : '#6B7280'} />
                                        <Text style={[styles.sesButonText, bildirimSesli && styles.sesButonTextAktif]}>Sesli</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.sesButon, !bildirimSesli && styles.sesButonAktif]} onPress={() => setBildirimSesli(false)}>
                                        <MaterialIcons name="volume-off" size={18} color={!bildirimSesli ? 'white' : '#6B7280'} />
                                        <Text style={[styles.sesButonText, !bildirimSesli && styles.sesButonTextAktif]}>Sessiz</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* AKSİYON BUTONLARI */}
                <View style={styles.actionCard}>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#4F46E5' }]} onPress={handleKaydet}>
                        <MaterialIcons name="save" size={20} color="white" />
                        <Text style={styles.actionButtonText}>Kaydet</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#6B7280' }]} onPress={() => navigation.goBack()}>
                        <MaterialIcons name="close" size={20} color="white" />
                        <Text style={styles.actionButtonText}>Vazgeç</Text>
                    </TouchableOpacity>
                </View>
                
                <View style={styles.actionCard}>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#F59E0B' }]} onPress={randevuIptalEt}>
                        <MaterialIcons name="event-busy" size={20} color="white" />
                        <Text style={styles.actionButtonText}>Randevuyu İptal Et</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#EF4444' }]} onPress={handleSil}>
                        <MaterialIcons name="delete-forever" size={20} color="white" />
                        <Text style={styles.actionButtonText}>Tamamen Sil</Text>
                    </TouchableOpacity>
                </View>

                {/* MESAJLAŞMA KARTI */}
                <View style={[styles.card, { marginTop: 8 }]}>
                    <View style={styles.cardHeader}>
                        <MaterialIcons name="message" size={20} color="#4F46E5" />
                        <Text style={styles.cardTitle}>Hızlı Mesaj Gönder</Text>
                    </View>
                    
                    <Text style={styles.label}>Mesaj Hedefi</Text>
                    <View style={styles.radioContainer}>
                        <TouchableOpacity style={[styles.radioButton, mesajHedef === 'veli' && styles.radioSelectedContainer]} onPress={() => setMesajHedef('veli')}>
                            <View style={[styles.radioCircle, mesajHedef === 'veli' && styles.radioSelected]} />
                            <Text style={[styles.radioLabel, mesajHedef === 'veli' && styles.radioLabelSelected]}>Veliye</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.radioButton, mesajHedef === 'ogrenci' && styles.radioSelectedContainer]} onPress={() => setMesajHedef('ogrenci')}>
                            <View style={[styles.radioCircle, mesajHedef === 'ogrenci' && styles.radioSelected]} />
                            <Text style={[styles.radioLabel, mesajHedef === 'ogrenci' && styles.radioLabelSelected]}>Öğrenciye</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.messageButtonsContainer}>
                        <TouchableOpacity style={[styles.messageBtn, { backgroundColor: '#10B981' }]} onPress={gonderSms}>
                            <MaterialIcons name="sms" size={20} color="white" />
                            <Text style={styles.messageBtnText}>SMS</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.messageBtn, { backgroundColor: '#25D366' }]} onPress={gonderWhatsApp}>
                            <FontAwesome5 name="whatsapp" size={20} color="white" />
                            <Text style={styles.messageBtnText}>WhatsApp</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingBottom: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
        marginLeft: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 6,
    },
    row: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        marginBottom: 12 
    },
    column: { 
        flex: 1 
    },
    dateTimeButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
    },
    dateTimeText: {
        fontSize: 15,
        color: '#111827',
        fontWeight: '500',
    },
    inputIcon: {
        opacity: 0.7,
        marginRight: 4,
    },
    stepInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    stepButton: {
        padding: 12,
        backgroundColor: '#EEF2FF',
    },
    inputStep: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flex: 1,
    },
    inputSmall: {
        flex: 1,
        padding: 12,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    pickerContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginTop: 4,
    },
    pickerInput: {
        fontSize: 15,
        paddingVertical: 12,
        paddingHorizontal: 16,
        color: '#111827',
        paddingRight: 40,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        fontSize: 15,
        color: '#111827',
    },
    radioContainer: { 
        flexDirection: 'row', 
        marginBottom: 12,
        gap: 8,
    },
    radioButton: { 
        flex: 1,
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    radioSelectedContainer: {
        backgroundColor: '#EEF2FF',
        borderColor: '#4F46E5',
    },
    radioCircle: {
        height: 16,
        width: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#9CA3AF',
        marginRight: 6,
    },
    radioSelected: { 
        borderColor: '#4F46E5',
        backgroundColor: '#4F46E5',
    },
    radioLabel: { 
        fontSize: 12,
        color: '#4B5563',
        fontWeight: '500',
    },
    radioLabelSelected: {
        color: '#4F46E5',
        fontWeight: '600',
    },
    actionCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        gap: 6,
    },
    actionButtonText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 15 
    },
    messageButtonsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    messageBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    messageBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    bildirimUyariBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
        gap: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    bildirimUyariText: {
        flex: 1,
        fontSize: 13,
        color: '#B45309',
        fontWeight: '500',
    },
    bildirimToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bildirimToggleLabel: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '600',
    },
    disabledText: {
        color: '#9CA3AF',
    },
    bildirimDetayBox: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    dakikaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dakikaControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dakikaBtn: {
        padding: 8,
        paddingHorizontal: 12,
    },
    dakikaValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111827',
        minWidth: 32,
        textAlign: 'center',
    },
    sesSecenekler: {
        flexDirection: 'row',
        gap: 8,
    },
    sesButon: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 4,
        backgroundColor: '#F9FAFB',
    },
    sesButonAktif: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5',
    },
    sesButonText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '600',
    },
    sesButonTextAktif: {
        color: 'white',
    },
});
