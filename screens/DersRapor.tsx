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
import { MaterialIcons } from '@expo/vector-icons';
import { ogrencininOdemeleri, tekOgrenci } from '../utils/database';
import { DersType, OdemeType, OgrenciType } from '../types';

export default function DersRapor() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { ogrenciId } = route.params;

    const [ogrenci, setOgrenci] = useState<OgrenciType | null>(null);
    const [dersler, setDersler] = useState<DersType[]>([]);
    const [odemeler, setOdemeler] = useState<OdemeType[]>([]);
    const [odemeRaporAcik, setOdemeRaporAcik] = useState(false);
    const [seciliOdeme, setSeciliOdeme] = useState<OdemeType | null>(null);
    const [loading, setLoading] = useState(true);

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

            // Ders ve ödeme verilerini al
            const { odemeler, dersler } = await ogrencininOdemeleri(ogrenciId);

            // Dersleri tarihe göre sırala (en yeni önce)
            const siralanmisDersler = dersler
                .filter(ders => ders.ogrenciId === ogrenciId)
                .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

            // Ödemeleri tarihe göre sırala (en yeni önce)
            const siralanmisOdemeler = odemeler
                .sort((a, b) => new Date(b.odemetarih).getTime() - new Date(a.odemetarih).getTime());

            setDersler(siralanmisDersler);
            setOdemeler(siralanmisOdemeler);

            // En son ödemeyi varsayılan olarak seç
            if (siralanmisOdemeler.length > 0) {
                setSeciliOdeme(siralanmisOdemeler[0]);
            }

        } catch (error) {
            console.error('Veri alma hatası:', error);
            Alert.alert('Hata', 'Veriler alınamadı');
        } finally {
            setLoading(false);
        }
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

    // Ders listesi render
    const renderDers = ({ item }: { item: DersType }) => (
        <View style={styles.listItem}>
            <View style={styles.itemHeader}>
                <MaterialIcons name="school" size={20} color="#3498db" />
                <Text style={styles.itemTarih}>{formatTarih(item.tarih)}</Text>
                <Text style={styles.itemUcret}>{item.ucret} TL</Text>
            </View>
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
                <MaterialIcons name="payment" size={20} color="#27ae60" />
                <Text style={styles.itemTarih}>{formatTarih(item.odemetarih)}</Text>
                <Text style={styles.itemUcret}>{item.alinanucret} TL</Text>
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
                    {ogrenci ? `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}` : 'Ders Raporu'}
                </Text>
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
                        style={styles.smsButon}
                        onPress={odemeSmsGonder}
                    >
                        <MaterialIcons name="sms" size={20} color="white" />
                        <Text style={styles.smsButonText}>Ödeme SMS Gönder</Text>
                    </TouchableOpacity>
                </View>
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
    },
    content: {
        flex: 1,
        padding: 16,
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
        marginBottom: 16,
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
});
