import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    FlatList
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { notKaydet, notGuncelle, notSil, ogrenciNotlari, tekOgrenci } from '../utils/database';
import { NotType, OgrenciType } from '../types';

export default function NotEkle() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { ogrenciId } = route.params;

    const [ogrenci, setOgrenci] = useState<OgrenciType | null>(null);
    const [notMetni, setNotMetni] = useState('');
    const [notlar, setNotlar] = useState<NotType[]>([]);
    const [seciliNot, setSeciliNot] = useState<NotType | null>(null);
    const [duzenlemeMode, setDuzenlemeMode] = useState(false);
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

            // Notları al
            await notlariYenile();

        } catch (error) {
            console.error('Veri alma hatası:', error);
            Alert.alert('Hata', 'Veriler alınamadı');
        } finally {
            setLoading(false);
        }
    };

    const notlariYenile = async () => {
        try {
            const notlarResult = await ogrenciNotlari(ogrenciId);
            if (notlarResult.success) {
                // Notları tarihe göre sırala (en yeni önce)
                const siralanmisNotlar = notlarResult.data.sort((a: NotType, b: NotType) =>
                    new Date(b.tarih).getTime() - new Date(a.tarih).getTime()
                );
                setNotlar(siralanmisNotlar);
            }
        } catch (error) {
            console.error('Notlar alınamadı:', error);
        }
    };

    const notKaydetVeyaGuncelle = async () => {
        if (!notMetni.trim()) {
            Alert.alert('Uyarı', 'Lütfen not metnini giriniz');
            return;
        }

        try {
            if (duzenlemeMode && seciliNot) {
                // Güncelleme işlemi
                const guncellenecekNot = {
                    ...seciliNot,
                    not1: notMetni.trim(),
                    tarih: new Date().toISOString().split('T')[0] // Güncelleme tarihi
                };

                const result = await notGuncelle(seciliNot.notlarimId!, guncellenecekNot);

                if (result.success) {
                    Alert.alert('Başarılı', 'Not başarıyla güncellendi');
                    formuTemizle();
                    await notlariYenile();
                } else {
                    Alert.alert('Hata', 'Not güncellenemedi');
                }
            } else {
                // Yeni not ekleme işlemi
                const yeniNot = {
                    ogrenciId: ogrenciId,
                    tarih: new Date().toISOString().split('T')[0],
                    not1: notMetni.trim()
                };

                const result = await notKaydet(yeniNot);

                if (result.success) {
                    Alert.alert('Başarılı', 'Not başarıyla kaydedildi');
                    formuTemizle();
                    await notlariYenile();
                } else {
                    Alert.alert('Hata', 'Not kaydedilemedi');
                }
            }
        } catch (error) {
            console.error('Not işlem hatası:', error);
            Alert.alert('Hata', 'İşlem tamamlanamadı: ' + (error as any).message);
        }
    };

    const formuTemizle = () => {
        setNotMetni('');
        setSeciliNot(null);
        setDuzenlemeMode(false);
    };

    const notSecVeyaDuzenle = (not: NotType) => {
        setSeciliNot(not);
        setNotMetni(not.not1 || '');
        setDuzenlemeMode(true);
    };

    const notSilIslemi = (not: NotType) => {
        Alert.alert(
            'Not Sil',
            'Bu notu silmek istediğinizden emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await notSil(not.notlarimId!);
                            if (result.success) {
                                Alert.alert('Başarılı', 'Not başarıyla silindi');
                                formuTemizle();
                                await notlariYenile();
                            } else {
                                Alert.alert('Hata', 'Not silinemedi');
                            }
                        } catch (error) {
                            console.error('Not silme hatası:', error);
                            Alert.alert('Hata', 'Not silinemedi');
                        }
                    }
                }
            ]
        );
    };

    // Tarih formatını düzenle
    const formatTarih = (tarihStr: string | null | undefined) => {
        if (!tarihStr) return '-';
        const tarih = new Date(tarihStr);
        return tarih.toLocaleDateString('tr-TR');
    };

    // Not render fonksiyonu
    const renderNot = ({ item }: { item: NotType }) => (
        <TouchableOpacity
            style={[
                styles.notItem,
                seciliNot && seciliNot.notlarimId === item.notlarimId && styles.seciliNot
            ]}
            onPress={() => notSecVeyaDuzenle(item)}
            onLongPress={() => notSilIslemi(item)}
        >
            <View style={styles.notHeader}>
                <MaterialIcons name="note" size={18} color="#666" />
                <Text style={styles.notTarih}>{formatTarih(item.tarih)}</Text>
            </View>
            <Text style={styles.notMetin} numberOfLines={3}>
                {item.not1 || 'Not metni yok'}
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
                    {ogrenci ? `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad} - Notlar` : 'Notlar'}
                </Text>
            </View>

            <View style={styles.content}>
                {/* Not Girişi */}
                <View style={styles.notGirisContainer}>
                    <Text style={styles.sectionTitle}>
                        {duzenlemeMode ? 'Not Düzenle' : 'Yeni Not Ekle'}
                    </Text>

                    {duzenlemeMode && (
                        <View style={styles.duzenlemeInfo}>
                            <MaterialIcons name="edit" size={16} color="#f39c12" />
                            <Text style={styles.duzenlemeText}>Düzenleme modunda</Text>
                            <TouchableOpacity onPress={formuTemizle}>
                                <MaterialIcons name="close" size={16} color="#e74c3c" />
                            </TouchableOpacity>
                        </View>
                    )}

                    <TextInput
                        style={styles.notInput}
                        value={notMetni}
                        onChangeText={setNotMetni}
                        placeholder="Not yazınız..."
                        multiline={true}
                        numberOfLines={4}
                        textAlignVertical="top"
                    />

                    <View style={styles.butonContainer}>
                        {duzenlemeMode && (
                            <TouchableOpacity
                                style={styles.iptalButon}
                                onPress={formuTemizle}
                            >
                                <MaterialIcons name="cancel" size={18} color="white" />
                                <Text style={styles.iptalButonText}>İptal</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.kaydetButon}
                            onPress={notKaydetVeyaGuncelle}
                        >
                            <MaterialIcons
                                name={duzenlemeMode ? "update" : "save"}
                                size={18}
                                color="white"
                            />
                            <Text style={styles.kaydetButonText}>
                                {duzenlemeMode ? 'Güncelle' : 'Kaydet'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Notlar Listesi */}
                <View style={styles.notlarContainer}>
                    <Text style={styles.sectionTitle}>
                        Kayıtlı Notlar ({notlar.length})
                    </Text>

                    {notlar.length > 0 ? (
                        <>
                            <Text style={styles.kullanımBilgi}>
                                * Düzenlemek için nota dokunun, silmek için basılı tutun
                            </Text>
                            <FlatList
                                data={notlar}
                                renderItem={renderNot}
                                keyExtractor={item => (item.notlarimId?.toString() || Math.random().toString())}
                                style={styles.notlarListe}
                                showsVerticalScrollIndicator={false}
                            />
                        </>
                    ) : (
                        <View style={styles.bosListe}>
                            <MaterialIcons name="note-add" size={40} color="#ddd" />
                            <Text style={styles.bosListeText}>Henüz not eklenmemiş</Text>
                        </View>
                    )}
                </View>
            </View>
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
    content: {
        flex: 1,
        padding: 16,
    },
    notGirisContainer: {
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
    duzenlemeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff3cd',
        padding: 8,
        borderRadius: 4,
        marginBottom: 12,
    },
    duzenlemeText: {
        color: '#856404',
        marginLeft: 6,
        flex: 1,
        fontSize: 12,
    },
    notInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 12,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        backgroundColor: '#fff',
    },
    butonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
    },
    iptalButon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6c757d',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
        marginRight: 8,
    },
    iptalButonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 4,
    },
    kaydetButon: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#28a745',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
    },
    kaydetButonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 4,
    },
    notlarContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        flex: 1,
        elevation: 2,
    },
    kullanımBilgi: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
        marginBottom: 12,
    },
    notlarListe: {
        flex: 1,
    },
    notItem: {
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e1e8ed',
    },
    seciliNot: {
        backgroundColor: '#e3f2fd',
        borderColor: '#2196f3',
        borderWidth: 2,
    },
    notHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    notTarih: {
        fontSize: 12,
        color: '#666',
        marginLeft: 6,
    },
    notMetin: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
    },
    bosListe: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    bosListeText: {
        color: '#666',
        fontStyle: 'italic',
        marginTop: 8,
    },
});
