import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    FlatList,
    Alert,
    Linking
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    ogrencininOdemeleri,
    tekOgrenci,
    dersSil,
    odemeSil,
    dersGuncelle,
    odemeGuncelle,
    tumYapilanDersler,
    tumOdemeleriGetir
} from '../utils/database';
import { DersType, OdemeType, OgrenciType } from '../types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Modal, TextInput, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function DersRapor() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const ogrenciId = route.params?.ogrenciId;
    const isGeneralReport = !ogrenciId;

    const [ogrenci, setOgrenci] = useState<OgrenciType | null>(null);
    const [dersler, setDersler] = useState<DersType[]>([]);
    const [odemeler, setOdemeler] = useState<OdemeType[]>([]);
    const [odemeRaporAcik, setOdemeRaporAcik] = useState(false);
    const [seciliOdeme, setSeciliOdeme] = useState<OdemeType | null>(null);
    const [loading, setLoading] = useState(true);

    // Düzenleme State'leri
    const [duzenleDersModal, setDuzenleDersModal] = useState(false);
    const [duzenleOdemeModal, setDuzenleOdemeModal] = useState(false);
    const [duzenlenenDers, setDuzenlenenDers] = useState<DersType | null>(null);
    const [duzenlenenOdeme, setDuzenlenenOdeme] = useState<OdemeType | null>(null);

    // Form State'leri
    const [formTarih, setFormTarih] = useState(new Date());
    const [formSaat, setFormSaat] = useState(new Date());
    const [formUcret, setFormUcret] = useState('');
    const [formKonu, setFormKonu] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        veriAl();
    }, []);

    const veriAl = async () => {
        try {
            setLoading(true);

            if (ogrenciId) {
                // Tek Öğrenci Modu
                const ogrenciResult = await tekOgrenci(ogrenciId);
                if (ogrenciResult.success) {
                    setOgrenci(ogrenciResult.data ?? null);
                }

                const { odemeler, dersler } = await ogrencininOdemeleri(ogrenciId);

                const siralanmisDersler = dersler
                    .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

                const siralanmisOdemeler = odemeler
                    .sort((a, b) => new Date(b.odemetarih).getTime() - new Date(a.odemetarih).getTime());

                setDersler(siralanmisDersler);
                setOdemeler(siralanmisOdemeler);
                if (siralanmisOdemeler.length > 0) setSeciliOdeme(siralanmisOdemeler[0]);
            } else {
                // Genel Rapor Modu
                const derslerResult = await tumYapilanDersler();
                const odemelerResult = await tumOdemeleriGetir();

                if (derslerResult.success) {
                    setDersler(derslerResult.yapilanDersler.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime()));
                }
                if (odemelerResult.success) {
                    setOdemeler(odemelerResult.odemeler.sort((a, b) => new Date(b.odemetarih).getTime() - new Date(a.odemetarih).getTime()));
                }
            }

        } catch (error) {
            console.error('Veri alma hatası:', error);
            Alert.alert('Hata', 'Veriler alınamadı');
        } finally {
            setLoading(false);
        }
    };

    // PDF Raporu Oluştur
    const generatePDF = async (type: 'ders' | 'odeme') => {
        try {
            const title = type === 'ders' ? 'Ders Raporu' : 'Ödeme Raporu';
            const studentName = ogrenci ? `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}` : 'Tüm Öğrenciler';

            let htmlContent = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                        h1 { color: #2c3e50; text-align: center; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
                        .info { margin-bottom: 20px; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background-color: #3498db; color: white; padding: 10px; text-align: left; font-size: 12px; }
                        td { border-bottom: 1px solid #eee; padding: 10px; font-size: 12px; }
                        .total { margin-top: 30px; text-align: right; font-weight: bold; font-size: 16px; color: #e74c3c; }
                        .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #95a5a6; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <div class="info">
                        <p><strong>Öğrenci:</strong> ${studentName}</p>
                        <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                ${type === 'ders'
                    ? '<th>Tarih</th>' + (isGeneralReport ? '<th>Öğrenci</th>' : '') + '<th>Konu</th><th>Ücret</th>'
                    : '<th>Tarih</th>' + (isGeneralReport ? '<th>Öğrenci</th>' : '') + '<th>Tür</th><th>Açıklama</th><th>Miktar</th>'
                }
                            </tr>
                        </thead>
                        <tbody>
                            ${type === 'ders'
                    ? dersler.map(d => `
                                    <tr>
                                        <td>${formatTarih(d.tarih)}</td>
                                        ${isGeneralReport ? `<td>${d.ogrenciAdSoyad || '-'}</td>` : ''}
                                        <td>${d.konu || '-'}</td>
                                        <td>${d.ucret} TL</td>
                                    </tr>
                                `).join('')
                    : odemeler.map(o => `
                                    <tr>
                                        <td>${formatTarih(o.odemetarih)}</td>
                                        ${isGeneralReport ? `<td>${o.ogrenciAdSoyad || '-'}</td>` : ''}
                                        <td>${o.odemeturu || '-'}</td>
                                        <td>${o.aciklama || '-'}</td>
                                        <td>${o.alinanucret} TL</td>
                                    </tr>
                                `).join('')
                }
                        </tbody>
                    </table>
                    <div class="total">
                        Toplam ${type === 'ders' ? 'Ders Ücreti' : 'Tahsilat'}: ${type === 'ders' ? toplamDersUcreti() : toplamOdeme()} TL
                    </div>
                    <div class="footer">
                        Özdeta Öğretmen Takip Sistemi tarafından oluşturulmuştur.
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `${studentName} ${title}`,
                    UTI: 'com.adobe.pdf'
                });
            } else {
                Alert.alert('Hata', 'Paylaşım özelliği bu cihazda kullanılamıyor.');
            }
        } catch (error) {
            console.error('PDF Hatası:', error);
            Alert.alert('Hata', 'PDF raporu oluşturulamadı');
        }
    };

    // Teşekkür WhatsApp Mesajı Gönder
    const tesekkurWhatsAppGonder = () => {
        if (!seciliOdeme || !ogrenci) {
            Alert.alert('Hata', 'Seçili ödeme veya öğrenci bilgisi bulunamadı');
            return;
        }

        const miktar = parseInt(seciliOdeme.alinanucret) || 0;
        const dersUcreti = ogrenci.ucret || 0;
        const dersSayisi = dersUcreti > 0 ? Math.floor(miktar / dersUcreti) : 0;

        const mesaj = `Gönderdiğiniz emaneti aldım, teşekkür ederim. (${dersSayisi} ders)`;
        const telefonNo = ogrenci.veliTel || ogrenci.ogrenciTel;

        if (!telefonNo || telefonNo === '-') {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }

        // Telefon numarasını temizle (sadece rakamlar)
        const temizTelefon = telefonNo.replace(/\D/g, '');
        // Türkiye için prefix ekle (eğer yoksa)
        const tamTelefon = temizTelefon.startsWith('90') ? temizTelefon : `90${temizTelefon}`;

        const wsUrl = `whatsapp://send?phone=${tamTelefon}&text=${encodeURIComponent(mesaj)}`;

        Linking.openURL(wsUrl).catch(() => {
            Alert.alert('Hata', 'WhatsApp uygulaması açılamadı');
        });
    };


    // Tarih formatını düzenle
    const formatTarih = (tarihStr: string | null | undefined) => {
        if (!tarihStr) return '-';
        const tarih = new Date(tarihStr);
        return tarih.toLocaleDateString('tr-TR');
    };

    // Toplam ders ücreti hesapla
    const toplamDersUcreti = () => {
        return dersler.reduce((toplam, ders) => {
            return toplam + (parseInt(ders.ucret) || 0);
        }, 0);
    };

    // Toplam ödeme miktarı hesapla
    const toplamOdeme = () => {
        return odemeler.reduce((toplam, odeme) => {
            return toplam + (parseInt(odeme.alinanucret) || 0);
        }, 0);
    };

    // Kalan ücret hesapla
    const kalanUcret = () => {
        return toplamDersUcreti() - toplamOdeme();
    };

    // SMS gönder
    const odemeSmsGonder = () => {
        if (!seciliOdeme || !ogrenci) {
            Alert.alert('Hata', 'Seçili ödeme veya öğrenci bilgisi bulunamadı');
            return;
        }

        const mesaj = `Sayın ${ogrenci.veliAd || 'Veli'},\n\n${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad} adlı öğrencinizden ${formatTarih(seciliOdeme.odemetarih)} tarihinde ${seciliOdeme.alinanucret} TL ödeme alınmıştır.\n\nTeşekkür ederiz.`;

        const telefonNo = ogrenci.veliTel || ogrenci.ogrenciTel;

        if (!telefonNo || telefonNo === '-') {
            Alert.alert('Hata', 'Telefon numarası bulunamadı');
            return;
        }

        const smsUrl = `sms:${telefonNo}?body=${encodeURIComponent(mesaj)}`;

        Alert.alert(
            'SMS Gönder',
            `${telefonNo} numarasına ödeme SMS'i gönderilecek. Devam etmek istiyor musunuz?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Gönder',
                    onPress: () => Linking.openURL(smsUrl)
                }
            ]
        );
    };

    // Ders Sil
    const handleDersSil = (dersId: number) => {
        Alert.alert(
            'Dersi Sil',
            'Bu ders kaydını silmek istediğinizden emin misiniz?',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await dersSil(dersId);
                        if (result.success) {
                            Alert.alert('Başarılı', 'Ders kaydı silindi');
                            veriAl();
                        } else {
                            Alert.alert('Hata', 'Ders silinemedi');
                        }
                    }
                }
            ]
        );
    };

    // Ödeme Sil
    const handleOdemeSil = (odemeId: number) => {
        Alert.alert(
            'Ödemeyi Sil',
            'Bu ödeme kaydını silmek istediğinizden emin misiniz?',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await odemeSil(odemeId);
                        if (result.success) {
                            Alert.alert('Başarılı', 'Ödeme kaydı silindi');
                            veriAl();
                        } else {
                            Alert.alert('Hata', 'Ödeme silinemedi');
                        }
                    }
                }
            ]
        );
    };

    // Ders Düzenleme Modalını Aç
    const duzenleDersAc = (ders: DersType) => {
        setDuzenlenenDers(ders);
        setFormTarih(new Date(ders.tarih));
        // Saat bilgisini parse et (HH:mm formatında varsayıyoruz)
        const [hh, mm] = ders.saat.split(':');
        const d = new Date();
        d.setHours(parseInt(hh), parseInt(mm));
        setFormSaat(d);
        setFormUcret(ders.ucret.toString());
        setFormKonu(ders.konu || '');
        setDuzenleDersModal(true);
    };

    // Ödeme Düzenleme Modalını Aç
    const duzenleOdemeAc = (odeme: OdemeType) => {
        setDuzenlenenOdeme(odeme);
        setFormTarih(new Date(odeme.odemetarih));
        if (odeme.odemesaati) {
            const [hh, mm] = odeme.odemesaati.split(':');
            const d = new Date();
            d.setHours(parseInt(hh), parseInt(mm));
            setFormSaat(d);
        }
        setFormUcret(odeme.alinanucret.toString());
        setFormKonu(odeme.aciklama || '');
        setDuzenleOdemeModal(true);
    };

    // Ders Güncelle
    const handleDersGuncelle = async () => {
        if (!duzenlenenDers || !duzenlenenDers.dersId) return;

        const guncelDers: DersType = {
            ...duzenlenenDers,
            tarih: formTarih.toISOString().split('T')[0],
            saat: formSaat.toTimeString().slice(0, 5),
            ucret: formUcret,
            konu: formKonu
        };

        const result = await dersGuncelle(duzenlenenDers.dersId, guncelDers);
        if (result.success) {
            Alert.alert('Başarılı', 'Ders güncellendi');
            setDuzenleDersModal(false);
            veriAl();
        } else {
            Alert.alert('Hata', 'Güncelleme başarısız');
        }
    };

    // Ödeme Güncelle
    const handleOdemeGuncelle = async () => {
        if (!duzenlenenOdeme || !duzenlenenOdeme.odemeId) return;

        const guncelOdeme: OdemeType = {
            ...duzenlenenOdeme,
            odemetarih: formTarih.toISOString().split('T')[0],
            odemesaati: formSaat.toTimeString().slice(0, 5),
            alinanucret: formUcret,
            aciklama: formKonu
        };

        const result = await odemeGuncelle(duzenlenenOdeme.odemeId, guncelOdeme);
        if (result.success) {
            Alert.alert('Başarılı', 'Ödeme güncellendi');
            setDuzenleOdemeModal(false);
            veriAl();
        } else {
            Alert.alert('Hata', 'Güncelleme başarısız');
        }
    };

    // Ders listesi render
    const renderDers = ({ item }: { item: DersType }) => (
        <View style={styles.listItem}>
            <View style={styles.itemHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <MaterialIcons name="school" size={20} color="#3498db" />
                    <Text style={styles.itemTarih}>{formatTarih(item.tarih)}</Text>
                </View>
                <View style={styles.itemActions}>
                    <Text style={[styles.itemUcret, { marginRight: 10 }]}>{item.ucret} TL</Text>
                    <TouchableOpacity onPress={() => duzenleDersAc(item)} style={styles.actionIcon}>
                        <MaterialIcons name="edit" size={20} color="#3498db" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDersSil(item.dersId!)} style={styles.actionIcon}>
                        <MaterialIcons name="delete" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                </View>
            </View>
            {isGeneralReport && item.ogrenciAdSoyad && (
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 }}>
                    {item.ogrenciAdSoyad}
                </Text>
            )}
            <Text style={styles.itemKonu}>{item.konu || 'Konu belirtilmemiş'}</Text>
            <Text style={styles.itemSaat}>Saat: {item.saat}</Text>
        </View>
    );

    // Ödeme listesi render
    const renderOdeme = ({ item }: { item: OdemeType }) => (
        <TouchableOpacity
            style={[
                styles.listItem,
                seciliOdeme && seciliOdeme.odemeId === item.odemeId && styles.seciliItem
            ]}
            onPress={() => setSeciliOdeme(item)}
        >
            <View style={styles.itemHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <MaterialIcons name="payment" size={20} color="#27ae60" />
                    <Text style={styles.itemTarih}>{formatTarih(item.odemetarih)}</Text>
                </View>
                <View style={styles.itemActions}>
                    <Text style={[styles.itemUcret, { marginRight: 10 }]}>{item.alinanucret} TL</Text>
                    <TouchableOpacity onPress={() => duzenleOdemeAc(item)} style={styles.actionIcon}>
                        <MaterialIcons name="edit" size={20} color="#3498db" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleOdemeSil(item.odemeId!)} style={styles.actionIcon}>
                        <MaterialIcons name="delete" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                </View>
            </View>
            <Text style={styles.itemAciklama}>{item.aciklama || 'Açıklama yok'}</Text>
            <Text style={styles.itemSaat}>
                {item.odemesaati ? `Saat: ${item.odemesaati}` : ''}
            </Text>
        </TouchableOpacity>
    );

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
                    {isGeneralReport ? 'Genel Ders Raporu' : (ogrenci ? `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}` : 'Ders Raporu')}
                </Text>
            </View>

            {/* Rapor PDF Butonları */}
            <View style={styles.pdfButtonsContainer}>
                <TouchableOpacity
                    style={[styles.pdfButton, { backgroundColor: '#e67e22' }]}
                    onPress={() => generatePDF('ders')}
                >
                    <MaterialCommunityIcons name="file-pdf-box" size={20} color="white" />
                    <Text style={styles.pdfButtonText}>Ders PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.pdfButton, { backgroundColor: '#27ae60' }]}
                    onPress={() => generatePDF('odeme')}
                >
                    <MaterialCommunityIcons name="file-pdf-box" size={20} color="white" />
                    <Text style={styles.pdfButtonText}>Ödeme PDF</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Özet Bilgiler */}
                <View style={styles.ozetContainer}>
                    <View style={styles.ozetItem}>
                        <Text style={styles.ozetLabel}>Toplam Ders</Text>
                        <Text style={styles.ozetDeger}>{dersler.length}</Text>
                    </View>
                    <View style={styles.ozetItem}>
                        <Text style={styles.ozetLabel}>Ders Ücreti</Text>
                        <Text style={styles.ozetDeger}>{toplamDersUcreti()} TL</Text>
                    </View>
                    <View style={styles.ozetItem}>
                        <Text style={styles.ozetLabel}>Ödenen</Text>
                        <Text style={styles.ozetDeger}>{toplamOdeme()} TL</Text>
                    </View>
                    <View style={styles.ozetItem}>
                        <Text style={styles.ozetLabel}>Kalan</Text>
                        <Text style={[styles.ozetDeger, { color: kalanUcret() > 0 ? '#e74c3c' : '#27ae60' }]}>
                            {kalanUcret()} TL
                        </Text>
                    </View>
                </View>

                {/* Dersler Bölümü */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Yapılan Dersler ({dersler.length})</Text>
                    {dersler.length > 0 ? (
                        <FlatList
                            data={dersler}
                            renderItem={renderDers}
                            keyExtractor={item => (item.dersId?.toString() || Math.random().toString())}
                            scrollEnabled={false}
                        />
                    ) : (
                        <View style={styles.bosListe}>
                            <Text style={styles.bosListeText}>Henüz ders kaydı bulunmamaktadır</Text>
                        </View>
                    )}
                </View>

                {/* Ödeme Rapor Butonu */}
                <TouchableOpacity
                    style={styles.odemeRaporButon}
                    onPress={() => setOdemeRaporAcik(!odemeRaporAcik)}
                >
                    <MaterialIcons
                        name={odemeRaporAcik ? "expand-less" : "expand-more"}
                        size={24}
                        color="white"
                    />
                    <Text style={styles.odemeRaporButonText}>Ödeme Rapor</Text>
                </TouchableOpacity>

                {/* Ödemeler Bölümü */}
                {odemeRaporAcik && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Alınan Ödemeler ({odemeler.length})</Text>
                        {odemeler.length > 0 ? (
                            <>
                                <Text style={styles.secimBilgi}>
                                    * Ödemeye dokunarak seçebilirsiniz
                                </Text>
                                <FlatList
                                    data={odemeler}
                                    renderItem={renderOdeme}
                                    keyExtractor={item => (item.odemeId?.toString() || Math.random().toString())}
                                    scrollEnabled={false}
                                />
                            </>
                        ) : (
                            <View style={styles.bosListe}>
                                <Text style={styles.bosListeText}>Henüz ödeme kaydı bulunmamaktadır</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Alt Buton - Ödeme SMS */}
            {odemeRaporAcik && seciliOdeme && (
                <View style={styles.altButonContainer}>
                    <TouchableOpacity
                        style={[styles.smsButon, { backgroundColor: '#25D366', marginBottom: 10 }]}
                        onPress={tesekkurWhatsAppGonder}
                    >
                        <MaterialCommunityIcons name="whatsapp" size={20} color="white" />
                        <Text style={styles.smsButonText}>Teşekkür (WhatsApp)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.smsButon}
                        onPress={odemeSmsGonder}
                    >
                        <MaterialIcons name="sms" size={20} color="white" />
                        <Text style={styles.smsButonText}>Ödeme SMS Gönder</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Düzenleme Modalı (Ders ve Ödeme için ortak tasarım) */}
            <Modal
                visible={duzenleDersModal || duzenleOdemeModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setDuzenleDersModal(false);
                    setDuzenleOdemeModal(false);
                }}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        setDuzenleDersModal(false);
                        setDuzenleOdemeModal(false);
                    }}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={{ width: '100%', alignItems: 'center' }}
                    >
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalBaslik}>
                                        {duzenleDersModal ? 'Ders Düzenle' : 'Ödeme Düzenle'}
                                    </Text>
                                    <TouchableOpacity onPress={() => {
                                        setDuzenleDersModal(false);
                                        setDuzenleOdemeModal(false);
                                    }}>
                                        <MaterialIcons name="close" size={24} color="#666" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.modalBody}>
                                    {/* Tarih */}
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>Tarih</Text>
                                        <TouchableOpacity
                                            style={styles.dateTimeButton}
                                            onPress={() => setShowDatePicker(true)}
                                        >
                                            <MaterialIcons name="date-range" size={20} color="#666" />
                                            <Text style={styles.dateTimeText}>{formatTarih(formTarih.toISOString())}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Saat */}
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>Saat</Text>
                                        <TouchableOpacity
                                            style={styles.dateTimeButton}
                                            onPress={() => setShowTimePicker(true)}
                                        >
                                            <MaterialIcons name="access-time" size={20} color="#666" />
                                            <Text style={styles.dateTimeText}>{formSaat.toTimeString().slice(0, 5)}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Ücret / Miktar */}
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>
                                            {duzenleDersModal ? 'Ders Ücreti (TL)' : 'Alınan Ücret (TL)'}
                                        </Text>
                                        <TextInput
                                            style={styles.textInput}
                                            value={formUcret}
                                            onChangeText={setFormUcret}
                                            keyboardType="numeric"
                                        />
                                    </View>

                                    {/* Konu / Açıklama */}
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>
                                            {duzenleDersModal ? 'Konu' : 'Açıklama'}
                                        </Text>
                                        <TextInput
                                            style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                                            value={formKonu}
                                            onChangeText={setFormKonu}
                                            multiline={true}
                                        />
                                    </View>
                                </ScrollView>

                                <View style={styles.modalFooter}>
                                    <TouchableOpacity
                                        style={[styles.modalButon, styles.vazgecButon]}
                                        onPress={() => {
                                            setDuzenleDersModal(false);
                                            setDuzenleOdemeModal(false);
                                        }}
                                    >
                                        <Text style={styles.vazgecButonText}>Vazgeç</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalButon, styles.kaydetButon]}
                                        onPress={duzenleDersModal ? handleDersGuncelle : handleOdemeGuncelle}
                                    >
                                        <Text style={styles.kaydetButonText}>Güncelle</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </KeyboardAvoidingView>
                </TouchableOpacity>

                {showDatePicker && (
                    <DateTimePicker
                        value={formTarih}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setShowDatePicker(false);
                            if (selectedDate) setFormTarih(selectedDate);
                        }}
                    />
                )}
                {showTimePicker && (
                    <DateTimePicker
                        value={formSaat}
                        mode="time"
                        display="default"
                        onChange={(event, selectedTime) => {
                            setShowTimePicker(false);
                            if (selectedTime) setFormSaat(selectedTime);
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
        backgroundColor: '#f8f9fa',
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
    pdfButtonsContainer: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: 'white',
        justifyContent: 'space-around',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    pdfButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        elevation: 2,
    },
    pdfButtonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 5,
        fontSize: 13,
    },
    content: {
        flex: 1,
        padding: 16,
        paddingBottom: 80,
    },
    ozetContainer: {
        flexDirection: 'row',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        elevation: 2,
    },
    ozetItem: {
        flex: 1,
        alignItems: 'center',
    },
    ozetLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    ozetDeger: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    section: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    secimBilgi: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
        marginBottom: 8,
    },
    listItem: {
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e1e8ed',
    },
    seciliItem: {
        backgroundColor: '#e3f2fd',
        borderColor: '#2196f3',
        borderWidth: 2,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    itemTarih: {
        fontSize: 14,
        color: '#666',
        flex: 1,
        marginLeft: 8,
    },
    itemUcret: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
    },
    itemKonu: {
        fontSize: 14,
        color: '#333',
        marginBottom: 2,
    },
    itemAciklama: {
        fontSize: 14,
        color: '#333',
        marginBottom: 2,
    },
    itemSaat: {
        fontSize: 12,
        color: '#666',
    },
    bosListe: {
        padding: 20,
        alignItems: 'center',
    },
    bosListeText: {
        color: '#666',
        fontStyle: 'italic',
    },
    odemeRaporButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3498db',
        padding: 12,
        borderRadius: 8,
        marginBottom: 96,
    },
    odemeRaporButonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    altButonContainer: {
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e1e8ed',
    },
    smsButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#27ae60',
        padding: 14,
        borderRadius: 8,
    },
    smsButonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    itemActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIcon: {
        padding: 5,
        marginLeft: 5,
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
        width: '90%',
        maxHeight: '80%',
        elevation: 10,
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
    modalBody: {
        padding: 20,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    inputContainer: {
        marginBottom: 15,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
    },
    dateTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
    },
    dateTimeText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#333',
    },
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
        fontWeight: 'bold',
    },
    kaydetButonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});
