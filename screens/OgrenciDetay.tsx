//ogrencidetay.js

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ogrenciSil } from '../database/studentOperations';
import { odemeSil, odemeKaydet, dersiKaydet, getOdemeler, getDersler, dersSil, getSonDers } from '../database/financeOperations';
import { getBekleyenOdevSayisi } from '../database/homeworkOperations';
import { OgrenciType, DersType, OdemeType } from '../types';

export default function OgrenciDetay() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { ogrenci } = route.params as { ogrenci: OgrenciType };
    console.log("ogrenciDetay_ogrenci:", ogrenci);

    const [detayGoster, setDetayGoster] = useState(false);
    const [sagMenuAcik, setSagMenuAcik] = useState(false);
    const [dersPopupAcik, setDersPopupAcik] = useState(false);
    const [odemePopupAcik, setOdemePopupAcik] = useState(false);

    // Ders popup state'leri
    const [dersKonu, setDersKonu] = useState('');
    const [dersTarih, setDersTarih] = useState(new Date());
    const [dersSaat, setDersSaat] = useState(new Date());
    const [dersUcret, setDersUcret] = useState(ogrenci.ucret?.toString() || '0');
    const [dersAciklama, setDersAciklama] = useState('');
    const [tarihPickerAcik, setTarihPickerAcik] = useState(false);
    const [saatPickerAcik, setSaatPickerAcik] = useState(false);

    // Ödeme popup state'leri
    const [odemeTarih, setOdemeTarih] = useState(new Date());
    const [odemeSaat, setOdemeSaat] = useState(new Date());
    const [odemeUcret, setOdemeUcret] = useState('');
    const [odemeTarihPickerAcik, setOdemeTarihPickerAcik] = useState(false);
    const [odemeSaatPickerAcik, setOdemeSaatPickerAcik] = useState(false);
    const [kalanUcret, setKalanUcret] = useState(0);
    const [sonDers, setSonDers] = useState<DersType | null>(null);
    const [bekleyenOdevler, setBekleyenOdevler] = useState(0);


    // Telefon arama fonksiyonu
    const telefonEt = (numara: string) => {
        if (!numara) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }
        Linking.openURL(`tel:${numara}`);
    };

    // SMS gönderme fonksiyonu
    const smsGonder = (numara: string) => {
        if (!numara) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }
        Linking.openURL(`sms:${numara}`);
    };

    // WhatsApp mesajı gönderme fonksiyonu
    const whatsappGonder = (numara: string) => {
        if (!numara) {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }

        // Türkiye numaraları için +90 ekleme
        const formattedNumber = numara.startsWith('0') ? `+90${numara.substring(1)}` : numara;
        Linking.openURL(`https://wa.me/${formattedNumber}`);
    };

    // Ders popup açma fonksiyonu
    const dersPopupAc = () => {
        setDersKonu('');
        setDersTarih(new Date());
        setDersSaat(new Date());
        setDersUcret(ogrenci.ucret?.toString() || '0');
        setDersAciklama('');
        setDersPopupAcik(true);
    };

    // Ödeme popup açma fonksiyonu
    const odemePopupAc = async () => {
        setOdemeTarih(new Date());
        setOdemeSaat(new Date());
        setOdemeUcret('');

        // Kalan ücreti hesapla
        await kalanUcretiHesapla();

        setOdemePopupAcik(true);
    };

    // Ödeme popup kapatma fonksiyonu
    const odemePopupKapat = (e?: any) => {
        setOdemePopupAcik(false);
        setOdemeTarihPickerAcik(false);
        setOdemeSaatPickerAcik(false);
    };

    // Kalan ücret hesaplama fonksiyonu
    const kalanUcretiHesapla = async () => {
        try {

            //! async fonksiyonlarda mutlaka metot çağırırken await kullan

            if (!ogrenci.ogrenciId) return;
            const odemeler = await getOdemeler(ogrenci.ogrenciId);
            const dersler = await getDersler(ogrenci.ogrenciId);

            let toplamodeme = 0;
            odemeler?.forEach((odeme: OdemeType) => {
                toplamodeme += parseInt(odeme.alinanucret) ?? 0;
            });
            //todo: int string sorunu var

            let toplamucret = 0;
            dersler?.forEach((ders: DersType) => toplamucret += parseInt(ders.ucret) ?? 0);


            const kalan = toplamucret - toplamodeme;
            setKalanUcret(kalan);

            odemeler.forEach((odeme: OdemeType) => console.log("odeme", odeme.alinanucret));
            dersler.forEach((ders: DersType) => console.log("ucret", ders.ucret));

        } catch (error) {
            console.log('Kalan ücret hesaplama hatası:', error);
            setKalanUcret(0);
        }
    };

    // Son ders bilgisini getirme
    const fetchSonDers = async () => {
        if (!ogrenci.ogrenciId) return;
        try {
            const result = await getSonDers(ogrenci.ogrenciId);
            setSonDers(result);
        } catch (error) {
            console.error('Son ders getirme hatası:', error);
        }
    };

    // Bekleyen ödevleri getirme
    const fetchBekleyenOdevler = async () => {
        if (!ogrenci.ogrenciId) return;
        try {
            const count = await getBekleyenOdevSayisi(ogrenci.ogrenciId);
            setBekleyenOdevler(count);
        } catch (error) {
            console.error('Bekleyen ödevler getirme hatası:', error);
        }
    };

    // Sayfa açıldığında verileri yükle
    React.useEffect(() => {
        kalanUcretiHesapla();
        fetchSonDers();
        fetchBekleyenOdevler();
    }, [ogrenci.ogrenciId]);


    // Ders popup kapatma fonksiyonu
    const dersPopupKapat = () => {
        setDersPopupAcik(false);
        setTarihPickerAcik(false);
        setSaatPickerAcik(false);
    };

    // Ödeme kaydetme fonksiyonu
    const kaydetOdeme = async () => {
        if (!odemeUcret.trim() || parseFloat(odemeUcret) <= 0) {
            Alert.alert('Hata', 'Lütfen geçerli bir ücret giriniz');
            return;
        }

        try {
            const odemeVerisi: OdemeType = {
                ogrenciId: ogrenci.ogrenciId!,
                alinanucret: odemeUcret,
                odemetarih: odemeTarih.toISOString().split('T')[0], // YYYY-MM-DD formatı
                odemeturu: 'Nakit', // Varsayılan değer
                aciklama: `${formatTarih(odemeTarih)} ${formatSaat(odemeSaat)} tarihinde alınan ödeme`,
                sutun1: dersSaat.toTimeString().split(' ')[0] // Saat bilgisi
            };

            console.log('Kaydedilecek ödeme verisi:', odemeVerisi);


            const result = await odemeKaydet(odemeVerisi);

            Alert.alert('Başarılı', 'Ödeme başarıyla kaydedildi', [
                { text: 'Tamam', onPress: odemePopupKapat }
            ]);
        } catch (error: any) {
            Alert.alert('Hata', 'Ödeme kaydedilemedi: ' + error.message);
        }
    };
    // Ders kaydetme işlemi
    const finalizeDersKayit = async (dersVerisi: DersType) => {
        try {
            await dersiKaydet(dersVerisi);
            Alert.alert('Başarılı', 'Ders başarıyla kaydedildi', [
                {
                    text: 'Tamam', onPress: () => {
                        dersPopupKapat();
                        kalanUcretiHesapla();
                        fetchSonDers();
                    }
                }
            ]);
        } catch (error: any) {
            Alert.alert('Hata', 'Ders kaydedilemedi: ' + error.message);
        }
    };

    // Ders kaydetme butonu
    const dersKaydet = async () => {
        const konu = dersKonu.trim() || 'Konu Girilmemiş';

        try {
            const dersVerisi: DersType = {
                ogrenciId: ogrenci.ogrenciId!,
                dersturu: 'Ders',
                konu: konu,
                tarih: dersTarih.toISOString().split('T')[0],
                saat: dersSaat.toTimeString().split(' ')[0],
                ucret: dersUcret,
                sutun1: dersAciklama,
                ogrenciAdSoyad: ogrenci.ogrenciAd + " " + ogrenci.ogrenciSoyad
            };

            console.log('Ders kaydı başlatılıyor:', dersVerisi.tarih);

            // Mükerrer ders kontrolü
            const mevcutDersler = await getDersler(ogrenci.ogrenciId!);
            const ayniGunDers = mevcutDersler.find(d => d.tarih === dersVerisi.tarih);

            if (ayniGunDers) {
                Alert.alert(
                    'Mükerrer Ders Uyarısı',
                    `Bu öğrenci için ${formatTarih(dersTarih)} tarihinde zaten bir ders kaydı (Konu: ${ayniGunDers.konu}) mevcut. Yeni bir ders daha eklemek istediğinize emin misiniz?`,
                    [
                        { text: 'Vazgeç', style: 'cancel' },
                        { text: 'Evet, eklemek istiyorum', onPress: () => finalizeDersKayit(dersVerisi) }
                    ]
                );
            } else {
                await finalizeDersKayit(dersVerisi);
            }
        } catch (error: any) {
            console.log("Ders kaydı hatası:", error);
            Alert.alert('Hata', 'Bir sorun oluştu: ' + error.message);
        }
    };
    // Tarih formatını güzelleştirme
    const formatTarih = (tarih: Date) => {
        return tarih.toLocaleDateString('tr-TR');
    };

    // Saat formatını güzelleştirme
    const formatSaat = (saat: Date) => {
        return saat.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    // Üst menü butonları
    const menuButonlari = [
        { id: 1, text: 'Ders Yap', icon: 'school', action: dersPopupAc },
        { id: 2, text: 'Ödeme Al', icon: 'payment', action: odemePopupAc },
        { id: 3, text: 'Ana Sayfa', icon: 'home', sayfa: 'AnaSayfa' },
        { id: 4, text: 'Not Yaz', icon: 'note', sayfa: 'NotEkle', parametre: { ogrenciId: ogrenci.ogrenciId } },
        { id: 5, text: 'Ödevler', icon: 'assignment', sayfa: 'OdevEkle', parametre: { ogrenciId: ogrenci.ogrenciId } },
        { id: 6, text: 'Ders Rapor', icon: 'assessment', sayfa: 'DersRapor', parametre: { ogrenciId: ogrenci.ogrenciId } },
        { id: 7, text: 'Kaynaklar', icon: 'book', sayfa: 'KaynakYonetimi', parametre: { ogrenciId: ogrenci.ogrenciId, ogrenciAd: ogrenci.ogrenciAd, ogrenciSoyad: ogrenci.ogrenciSoyad } },
    ];

    // Sağ üst menü seçenekleri
    const sagUstMenu = [
        { id: 2, text: 'Ödeme Rapor', sayfa: 'DersRapor', parametre: { ogrenciId: ogrenci.ogrenciId }, icon: 'receipt' },
        { id: 3, text: 'Notlar', sayfa: 'NotListesi', parametre: { ogrenciId: ogrenci.ogrenciId }, icon: 'note' },
    ];



    //!
    return (
        <View style={styles.container}>
            {/* Üst Menü Butonları */}
            <View style={styles.ustMenu}>
                {menuButonlari.map((buton) => (
                    <TouchableOpacity
                        key={buton.id}
                        style={styles.menuButon}
                        onPress={() => {
                            if (buton.action) {
                                buton.action();
                            } else {
                                navigation.navigate(buton.sayfa, buton.parametre || {});
                            }
                        }}
                    >
                        <MaterialIcons name={buton.icon as any} size={20} color="#333" />
                        <Text style={styles.menuButonText}>{buton.text}</Text>
                    </TouchableOpacity>
                ))}

                {/* Sağ Üst Menü (Üç nokta) */}
                <View style={styles.menuButon}>
                    <TouchableOpacity
                        style={styles.ucNoktaButon}
                        onPress={() => setSagMenuAcik(!sagMenuAcik)}
                    >
                        <MaterialIcons name="more-vert" size={24} color="#333" />
                        <Text style={styles.menuButonText}>Diğer</Text>
                    </TouchableOpacity>

                    {/* Dropdown Menü */}
                    {sagMenuAcik && (
                        <View style={styles.dropdownMenu}>
                            {sagUstMenu.map((menu) => (
                                <TouchableOpacity
                                    key={menu.id}
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                        setSagMenuAcik(false);
                                        navigation.navigate(menu.sayfa, menu.parametre || {});
                                    }}
                                >
                                    <MaterialIcons name={menu.icon as any} size={20} color="#555" />
                                    <Text style={styles.dropdownItemText}>{menu.text}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Öğrenci Bilgileri */}
                <View style={styles.baslikBolumu}>
                    <Text style={styles.ogrenciAdi}>
                        {ogrenci.ogrenciAd} {ogrenci.ogrenciSoyad}
                    </Text>
                    <Text style={styles.okul}>{ogrenci.okul}</Text>
                    {sonDers && (
                        <View style={styles.sonDersBilgi}>
                            <Text style={styles.sonDersLabel}>Son Ders:</Text>
                            <Text style={styles.sonDersText}>{sonDers.konu} ({formatTarih(new Date(sonDers.tarih))})</Text>
                        </View>
                    )}
                    {bekleyenOdevler > 0 && (
                        <View style={styles.bekleyenOdevContainer}>
                            <MaterialIcons name="assignment-late" size={14} color="#e67e22" />
                            <Text style={styles.bekleyenOdevText}>{bekleyenOdevler} adet bekleyen ödev</Text>
                        </View>
                    )}
                </View>

                {/* Detay Göster Switch */}
                <View style={styles.switchContainer}>
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Detayları Göster</Text>
                        <Switch
                            value={detayGoster}
                            onValueChange={setDetayGoster}
                            trackColor={{ false: "#d1d1d1", true: "#81b0ff" }}
                            thumbColor={detayGoster ? "#2196F3" : "#f4f3f4"}
                        />
                    </View>
                </View>

                {/* Detaylı Bilgiler */}
                {detayGoster && (
                    <View style={styles.detaylarContainer}>
                        <View style={styles.bilgiKarti}>
                            <Text style={styles.kartBaslik}>Öğrenci Bilgileri</Text>

                            <View style={styles.bilgiSatiri}>
                                <Text style={styles.bilgiEtiket}>Öğrenci No:</Text>
                                <Text style={styles.bilgiDeger}>{ogrenci.ogrenciId}</Text>
                            </View>

                            <View style={styles.bilgiSatiri}>
                                <Text style={styles.bilgiEtiket}>Sınıf:</Text>
                                <Text style={styles.bilgiDeger}>{ogrenci.sinif || 'Belirtilmemiş'}</Text>
                            </View>

                            <View style={styles.bilgiSatiri}>
                                <Text style={styles.bilgiEtiket}>Ücret:</Text>
                                <Text style={styles.bilgiDeger}>{ogrenci.ucret || 0} TL</Text>
                            </View>

                            <View style={styles.bilgiSatiri}>
                                <Text style={styles.bilgiEtiket}>Kayıt Tarihi:</Text>
                                <Text style={styles.bilgiDeger}>{ogrenci.kayitTarihi || 'Belirtilmemiş'}</Text>
                            </View>

                            <View style={styles.bilgiSatiri}>
                                <Text style={styles.bilgiEtiket}>Durum:</Text>
                                <Text style={[styles.bilgiDeger, ogrenci.aktifmi ? styles.aktif : styles.pasif]}>
                                    {ogrenci.aktifmi ? 'Aktif' : 'Pasif'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.bilgiKarti}>
                            <Text style={styles.kartBaslik}>İletişim Bilgileri</Text>

                            {/* Öğrenci Telefon */}
                            <View style={styles.telefonContainer}>
                                <View style={styles.telefonBilgi}>
                                    <Text style={styles.bilgiEtiket}>Öğrenci Tel:</Text>
                                    <Text style={styles.bilgiDeger}>{ogrenci.ogrenciTel || 'Belirtilmemiş'}</Text>
                                </View>
                                {ogrenci.ogrenciTel && (
                                    <View style={styles.telefonButonlari}>
                                        <TouchableOpacity
                                            style={styles.telefonButon}
                                            onPress={() => telefonEt(ogrenci.ogrenciTel)}
                                        >
                                            <MaterialIcons name="call" size={20} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.smsButon}
                                            onPress={() => smsGonder(ogrenci.ogrenciTel)}
                                        >
                                            <MaterialIcons name="sms" size={20} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.whatsappButon}
                                            onPress={() => whatsappGonder(ogrenci.ogrenciTel)}
                                        >
                                            <MaterialIcons name="chat" size={20} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Veli Bilgileri */}
                            <View style={styles.bilgiSatiri}>
                                <Text style={styles.bilgiEtiket}>Veli Adı:</Text>
                                <Text style={styles.bilgiDeger}>{ogrenci.veliAd || 'Belirtilmemiş'}</Text>
                            </View>

                            {/* Veli Telefon */}
                            <View style={styles.telefonContainer}>
                                <View style={styles.telefonBilgi}>
                                    <Text style={styles.bilgiEtiket}>Veli Tel:</Text>
                                    <Text style={styles.bilgiDeger}>{ogrenci.veliTel || 'Belirtilmemiş'}</Text>
                                </View>
                                {ogrenci.veliTel && (
                                    <View style={styles.telefonButonlari}>
                                        <TouchableOpacity
                                            style={styles.telefonButon}
                                            onPress={() => telefonEt(ogrenci.veliTel)}
                                        >
                                            <MaterialIcons name="call" size={20} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.smsButon}
                                            onPress={() => smsGonder(ogrenci.veliTel)}
                                        >
                                            <MaterialIcons name="sms" size={20} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.whatsappButon}
                                            onPress={() => whatsappGonder(ogrenci.veliTel)}
                                        >
                                            <MaterialIcons name="chat" size={20} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Açıklamalar */}
                        {(ogrenci.aciklama1 || ogrenci.aciklama2) && (
                            <View style={styles.bilgiKarti}>
                                <Text style={styles.kartBaslik}>Açıklamalar</Text>
                                {ogrenci.aciklama1 && (
                                    <View style={styles.bilgiSatiri}>
                                        <Text style={styles.bilgiEtiket}>Açıklama 1:</Text>
                                        <Text style={styles.bilgiDeger}>{ogrenci.aciklama1}</Text>
                                    </View>
                                )}
                                {ogrenci.aciklama2 && (
                                    <View style={styles.bilgiSatiri}>
                                        <Text style={styles.bilgiEtiket}>Açıklama 2:</Text>
                                        <Text style={styles.bilgiDeger}>{ogrenci.aciklama2}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Ders Popup */}
            <Modal
                visible={dersPopupAcik}
                transparent={true}
                animationType="fade"
                onRequestClose={dersPopupKapat}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={dersPopupKapat}
                >
                    <TouchableOpacity
                        style={styles.modalContent}
                        activeOpacity={1}
                        onPress={() => { }} // Popup içeriğine tıklamada kapanmaması için
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalBaslik}>Ders Ekle</Text>
                            <TouchableOpacity onPress={dersPopupKapat}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Ders Konusu */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Dersin Konusu *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={dersKonu}
                                    onChangeText={setDersKonu}
                                    placeholder="Ders konusunu giriniz"
                                    multiline={true}
                                    numberOfLines={2}
                                    defaultValue='-'
                                />
                            </View>

                            {/* Tarih Seçici */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Tarih</Text>
                                <TouchableOpacity
                                    style={styles.dateTimeButton}
                                    onPress={() => setTarihPickerAcik(true)}
                                >
                                    <MaterialIcons name="date-range" size={20} color="#666" />
                                    <Text style={styles.dateTimeText}>{formatTarih(dersTarih)}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Saat Seçici */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Saat</Text>
                                <TouchableOpacity
                                    style={styles.dateTimeButton}
                                    onPress={() => setSaatPickerAcik(true)}
                                >
                                    <MaterialIcons name="access-time" size={20} color="#666" />
                                    <Text style={styles.dateTimeText}>{formatSaat(dersSaat)}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Ücret */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Ücret (TL)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={dersUcret}
                                    onChangeText={setDersUcret}
                                    placeholder="Ücret giriniz"
                                    keyboardType="numeric"
                                />
                            </View>

                            {/* Açıklama */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Açıklama</Text>
                                <TextInput
                                    style={[styles.textInput, styles.textArea]}
                                    value={dersAciklama}
                                    onChangeText={setDersAciklama}
                                    placeholder="Ders hakkında notlar..."
                                    multiline={true}
                                    numberOfLines={3}
                                />
                            </View>
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButon, styles.vazgecButon]}
                                onPress={dersPopupKapat}
                            >
                                <Text style={styles.vazgecButonText}>Vazgeç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButon, styles.kaydetButon]}
                                onPress={dersKaydet}
                            >
                                <Text style={styles.kaydetButonText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>

                {/* Tarih Picker */}
                {tarihPickerAcik && (
                    <DateTimePicker
                        value={dersTarih}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                            setTarihPickerAcik(Platform.OS === 'ios');
                            if (selectedDate) {
                                setDersTarih(selectedDate);
                            }
                        }}
                    />
                )}

                {/* Saat Picker */}
                {saatPickerAcik && (
                    <DateTimePicker
                        value={dersSaat}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedTime) => {
                            setSaatPickerAcik(Platform.OS === 'ios');
                            if (selectedTime) {
                                setDersSaat(selectedTime);
                            }
                        }}
                    />
                )}
            </Modal>

            {/* Ödeme Popup */}
            <Modal
                visible={odemePopupAcik}
                transparent={true}
                animationType="fade"
                onRequestClose={odemePopupKapat}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={odemePopupKapat}
                >
                    <TouchableOpacity
                        style={styles.modalContent}
                        activeOpacity={1}
                        onPress={() => { }}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalBaslik}>Ödeme Al</Text>
                            <TouchableOpacity onPress={odemePopupKapat}>
                                <MaterialIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* Kalan Ücret Bilgisi */}
                        <View style={styles.kalanUcretContainer}>
                            <Text style={styles.kalanUcretText}>
                                Kalan Ücret: <Text style={styles.kalanUcretMiktar}>{kalanUcret} TL</Text>
                            </Text>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Ödeme Tarihi */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Tarih</Text>
                                <TouchableOpacity
                                    style={styles.dateTimeButton}
                                    onPress={() => setOdemeTarihPickerAcik(true)}
                                >
                                    <MaterialIcons name="date-range" size={20} color="#666" />
                                    <Text style={styles.dateTimeText}>{formatTarih(odemeTarih)}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Ödeme Saati */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Saat</Text>
                                <TouchableOpacity
                                    style={styles.dateTimeButton}
                                    onPress={() => setOdemeSaatPickerAcik(true)}
                                >
                                    <MaterialIcons name="access-time" size={20} color="#666" />
                                    <Text style={styles.dateTimeText}>{formatSaat(odemeSaat)}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Ödeme Ücreti */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Alınan Ücret (TL) *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={odemeUcret}
                                    onChangeText={setOdemeUcret}
                                    placeholder="Alınan ücreti giriniz"
                                    keyboardType="numeric"
                                />
                            </View>
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButon, styles.vazgecButon]}
                                onPress={odemePopupKapat}
                            >
                                <Text style={styles.vazgecButonText}>Vazgeç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButon, styles.kaydetButon]}
                                onPress={kaydetOdeme}
                            >
                                <Text style={styles.kaydetButonText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>

                {/* Ödeme Tarih Picker */}
                {odemeTarihPickerAcik && (
                    <DateTimePicker
                        value={odemeTarih}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                            setOdemeTarihPickerAcik(Platform.OS === 'ios');
                            if (selectedDate) {
                                setOdemeTarih(selectedDate);
                            }
                        }}
                    />
                )}

                {/* Ödeme Saat Picker */}
                {odemeSaatPickerAcik && (
                    <DateTimePicker
                        value={odemeSaat}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedTime) => {
                            setOdemeSaatPickerAcik(Platform.OS === 'ios');
                            if (selectedTime) {
                                setOdemeSaat(selectedTime);
                            }
                        }}
                    />
                )}
            </Modal>

            {/* Sağ menü açıkken overlay */}
            {sagMenuAcik && (
                <TouchableOpacity
                    style={styles.menuOverlay}
                    onPress={() => setSagMenuAcik(false)}
                />
            )}
        </View>
    );
    //!
};



const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 30,
    },
    ustMenu: {
        flexDirection: 'row',
        flexWrap: 'wrap', // İki sıra olmasını sağlar
        justifyContent: 'flex-start',
        padding: 5,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    menuButon: {
        width: '25%', // 4 buton yan yana (2 sıra)
        alignItems: 'center',
        paddingVertical: 8,
    },
    menuButonText: {
        fontSize: 10,
        marginTop: 2,
        color: '#333',
        textAlign: 'center',
    },
    ucNoktaButon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Dropdown Menü Stilleri
    dropdownMenu: {
        position: 'absolute',
        top: 35,
        right: 0,
        backgroundColor: 'white',
        borderRadius: 8,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        minWidth: 150,
        zIndex: 1001,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    dropdownItemText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#333',
    },
    menuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
    },
    // Modal Stilleri
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 15,
        width: '100%',
        maxHeight: '80%',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalBaslik: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    sonDersBilgi: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e3f2fd',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 15,
    },
    sonDersLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1976d2',
        marginRight: 5,
    },
    sonDersText: {
        fontSize: 12,
        color: '#333',
    },
    bekleyenOdevContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 5,
        backgroundColor: '#fff3e0',
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 10,
        alignSelf: 'center',
    },
    bekleyenOdevText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#e67e22',
        marginLeft: 5,
    },
    modalBody: {
        maxHeight: 400,
        paddingHorizontal: 20,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    kalanUcretContainer: {
        padding: 10,
        backgroundColor: '#e3f2fd',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#bbdefb',
    },
    kalanUcretText: {
        fontSize: 16,
        color: '#1976d2',
        fontWeight: '500',
    },
    kalanUcretMiktar: {
        fontWeight: 'bold',
        fontSize: 18,
    },
    // Input Stilleri
    inputContainer: {
        marginVertical: 10,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#34495e',
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        backgroundColor: '#f9f9f9',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    dateTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#f9f9f9',
    },
    dateTimeText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#333',
    },
    // Modal Buton Stilleri
    modalButon: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    vazgecButon: {
        backgroundColor: '#ecf0f1',
    },
    kaydetButon: {
        backgroundColor: '#3498db',
    },
    vazgecButonText: {
        color: '#7f8c8d',
        fontWeight: '600',
        fontSize: 16,
    },
    kaydetButonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    // Mevcut stiller
    baslikBolumu: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        marginBottom: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    ogrenciAdi: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 5,
    },
    okul: {
        fontSize: 16,
        color: '#7f8c8d',
    },
    switchContainer: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    switchLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#34495e',
    },
    detaylarContainer: {
        marginBottom: 20,
    },
    bilgiKarti: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    kartBaslik: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 15,
        paddingBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    bilgiSatiri: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    bilgiEtiket: {
        fontSize: 14,
        fontWeight: '600',
        color: '#34495e',
        flex: 1,
    },
    bilgiDeger: {
        fontSize: 14,
        color: '#7f8c8d',
        flex: 2,
        textAlign: 'right',
    },
    aktif: {
        color: '#27ae60',
        fontWeight: 'bold',
    },
    pasif: {
        color: '#e74c3c',
        fontWeight: 'bold',
    },
    telefonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    telefonBilgi: {
        flex: 1,
    },
    telefonButonlari: {
        flexDirection: 'row',
        marginLeft: 10,
    },
    telefonButon: {
        backgroundColor: '#27ae60',
        padding: 8,
        borderRadius: 5,
        marginLeft: 5,
    },
    smsButon: {
        backgroundColor: '#3498db',
        padding: 8,
        borderRadius: 5,
        marginLeft: 5,
    },
    whatsappButon: {
        backgroundColor: '#25D366',
        padding: 8,
        borderRadius: 5,
        marginLeft: 5,
    },
});
