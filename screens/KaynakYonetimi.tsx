import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import {
    kaynakKaydet,
    kaynakListesi,
    kaynakSil,
    tekOgrenci
} from '../utils/database';
import { getTumKaynaklar } from '../database/homeworkOperations';
import { KaynakType, OgrenciType } from '../types';

export default function KaynakYonetimi() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { ogrenciId } = route.params;

    const [ogrenci, setOgrenci] = useState<OgrenciType | null>(null);
    const [kaynaklar, setKaynaklar] = useState<KaynakType[]>([]);
    const [tumKaynaklar, setTumKaynaklar] = useState<{ id: number; ad: string }[]>([]);
    const [secilenKaynak, setSecilenKaynak] = useState('');
    const [loading, setLoading] = useState(true);
    const [yeniKaynak, setYeniKaynak] = useState(''); // Keep for backward compatibility if needed, but we'll use secilenKaynak

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

            // Global kaynakları al
            const globalResult = await getTumKaynaklar();
            if (globalResult.success) {
                setTumKaynaklar(globalResult.data);
            }

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

    // Kaynak ekleme (Seçilen kaynaktan)
    const handleKaynakEkle = async () => {
        if (!secilenKaynak || secilenKaynak === '0') {
            Alert.alert('Uyarı', 'Lütfen bir kaynak seçiniz');
            return;
        }

        const kaynakAdi = tumKaynaklar.find(k => k.id.toString() === secilenKaynak)?.ad;
        if (!kaynakAdi) return;

        // Aynı kaynak var mı kontrol et
        const mevcutKaynak = kaynaklar.find(k =>
            k.kaynak && k.kaynak.toLowerCase() === kaynakAdi.toLowerCase()
        );

        if (mevcutKaynak) {
            Alert.alert('Uyarı', 'Bu kaynak öğrenciye zaten eklenmiş');
            return;
        }

        try {
            const cleanOgrId = parseInt(ogrenciId.toString());
            const result = await kaynakKaydet({
                ogrenciId: cleanOgrId,
                kaynak: kaynakAdi
            } as any);

            if (result.success) {
                Alert.alert('Başarılı', 'Kaynak başarıyla eklendi');
                setSecilenKaynak('0');
                await kaynaklariYenile();
            } else {
                Alert.alert('Hata', 'Kaynak eklenemedi');
            }
        } catch (error) {
            console.error('Kaynak ekleme hatası:', error);
            Alert.alert('Hata', 'İşlem başarısız');
        }
    };

    // Kaynak silme
    const kaynakSilme = async (kaynak: KaynakType) => {
        Alert.alert(
            'Kaynak Sil',
            `"${kaynak.kaynak}" kaynağını silmek istediğinizden emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await kaynakSil(kaynak.kaynakId!);
                            if (result.success) {
                                Alert.alert('Başarılı', 'Kaynak silindi');
                                await kaynaklariYenile();
                            } else {
                                Alert.alert('Hata', 'Kaynak silinemedi');
                            }
                        } catch (error) {
                            console.error('Kaynak silme hatası:', error);
                            Alert.alert('Hata', 'Kaynak silinemedi');
                        }
                    }
                }
            ]
        );
    };

    // Kaynak render fonksiyonu
    const renderKaynak = ({ item, index }: { item: KaynakType; index: number }) => (
        <View style={styles.kaynakItem}>
            <View style={styles.kaynakInfo}>
                <Text style={styles.kaynakNumara}>{index + 1}.</Text>
                <Text style={styles.kaynakAdi}>{item.kaynak}</Text>
            </View>
            <TouchableOpacity
                style={styles.kaynakSilButon}
                onPress={() => kaynakSilme(item)}
            >
                <MaterialIcons name="delete" size={20} color="#e74c3c" />
            </TouchableOpacity>
        </View>
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
                    {route.params?.ogrenciAd ? `${route.params.ogrenciAd} ${route.params.ogrenciSoyad || ''}` : (ogrenci ? `${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}` : 'Kaynak Yönetimi')}
                </Text>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.content}>
                        <View style={styles.ekleFormContainer}>
                            <Text style={styles.sectionTitle}>Global Listeden Kaynak Seç</Text>
                            <View style={styles.kaynakEkleRow}>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={secilenKaynak}
                                        onValueChange={(itemValue) => setSecilenKaynak(itemValue)}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Kaynak Seçiniz..." value="0" />
                                        {tumKaynaklar.map((k) => (
                                            <Picker.Item key={k.id} label={k.ad} value={k.id.toString()} />
                                        ))}
                                    </Picker>
                                </View>
                                <TouchableOpacity
                                    style={styles.kaynakEkleButon}
                                    onPress={handleKaynakEkle}
                                >
                                    <MaterialIcons name="add" size={24} color="white" />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity 
                                style={styles.manageGlobalBtn}
                                onPress={() => navigation.navigate('GlobalKaynakYonetimi')}
                            >
                                <Text style={styles.manageGlobalText}>+ Yeni Genel Kaynak Ekle</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Mevcut Kaynaklar Listesi */}
                        <View style={styles.listeContainer}>
                            <View style={styles.listeTitleContainer}>
                                <Text style={styles.sectionTitle}>
                                    Mevcut Kaynaklar ({kaynaklar.length})
                                </Text>
                                <MaterialIcons name="library-books" size={24} color="#666" />
                            </View>

                            {kaynaklar.length > 0 ? (
                                <FlatList
                                    data={kaynaklar}
                                    renderItem={renderKaynak}
                                    keyExtractor={item => (item.kaynakId?.toString() || Math.random().toString())}
                                    style={styles.kaynakListesi}
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                />
                            ) : (
                                <View style={styles.bosListe}>
                                    <MaterialIcons name="library-books" size={48} color="#ddd" />
                                    <Text style={styles.bosListeText}>Henüz kaynak eklenmemiş</Text>
                                    <Text style={styles.bosListeAciklama}>
                                        Yukarıdaki formu kullanarak kaynak ekleyebilirsiniz
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
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
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    ekleFormContainer: {
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
    kaynakEkleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    kaynakInput: {
        flex: 1,
        marginRight: 12,
    },
    kaynakEkleButon: {
        backgroundColor: '#27ae60',
        padding: 12,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 48,
        height: 50,
    },
    pickerContainer: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        marginRight: 10,
        backgroundColor: '#fff',
        height: 50,
        justifyContent: 'center',
    },
    picker: {
        width: '100%',
    },
    manageGlobalBtn: {
        marginTop: 12,
        alignItems: 'center',
        padding: 8,
    },
    manageGlobalText: {
        color: '#2980b9',
        fontSize: 14,
        fontWeight: 'bold',
    },
    listeContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        elevation: 2,
        flex: 1,
    },
    listeTitleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    kaynakListesi: {
        flex: 1,
    },
    kaynakItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e1e8ed',
        marginBottom: 8,
    },
    kaynakInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    kaynakNumara: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#666',
        marginRight: 8,
        width: 20,
    },
    kaynakAdi: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    kaynakSilButon: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#ffebee',
    },
    bosListe: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    bosListeText: {
        fontSize: 16,
        color: '#666',
        fontWeight: 'bold',
        marginTop: 12,
        textAlign: 'center',
    },
    bosListeAciklama: {
        fontSize: 14,
        color: '#999',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});
