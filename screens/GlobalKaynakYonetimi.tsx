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
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import {
    tumKaynakEkle,
    getTumKaynaklar,
    tumKaynakSil
} from '../database/homeworkOperations';

export default function GlobalKaynakYonetimi() {
    const navigation = useNavigation<any>();
    const [kaynaklar, setKaynaklar] = useState<{ id: number; ad: string }[]>([]);
    const [yeniKaynak, setYeniKaynak] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        verileriYukle();
    }, []);

    const verileriYukle = async () => {
        try {
            setLoading(true);
            const result = await getTumKaynaklar();
            if (result.success) {
                setKaynaklar(result.data);
            }
        } catch (error) {
            console.error('Veri yükleme hatası:', error);
            Alert.alert('Hata', 'Kaynaklar yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleEkle = async () => {
        if (!yeniKaynak.trim()) {
            Alert.alert('Uyarı', 'Lütfen kaynak adını giriniz');
            return;
        }

        // Aynı kaynak var mı kontrol et
        const mevcut = kaynaklar.find(k => k.ad.toLowerCase() === yeniKaynak.trim().toLowerCase());
        if (mevcut) {
            Alert.alert('Uyarı', 'Bu kaynak zaten mevcut');
            return;
        }

        try {
            const result = await tumKaynakEkle(yeniKaynak.trim());
            if (result.success) {
                setYeniKaynak('');
                await verileriYukle();
                Keyboard.dismiss();
            } else {
                Alert.alert('Hata', 'Kaynak eklenemedi');
            }
        } catch (error) {
            Alert.alert('Hata', 'İşlem başarısız');
        }
    };

    const handleSil = (id: number, ad: string) => {
        Alert.alert(
            'Kaynak Sil',
            `"${ad}" kaynağını silmek istediğinizden emin misiniz? Bu kaynak öğrenci kayıtlarından silinmez ancak listeden çıkarılır.`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await tumKaynakSil(id);
                        if (result.success) {
                            await verileriYukle();
                        } else {
                            Alert.alert('Hata', 'Silme işlemi başarısız');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item, index }: { item: { id: number; ad: string }; index: number }) => (
        <View style={styles.item}>
            <View style={styles.itemInfo}>
                <Text style={styles.numara}>{index + 1}.</Text>
                <Text style={styles.ad}>{item.ad}</Text>
            </View>
            <TouchableOpacity onPress={() => handleSil(item.id, item.ad)} style={styles.silButon}>
                <MaterialIcons name="delete" size={20} color="#e74c3c" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Global Kaynak Yönetimi</Text>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.content}>
                        <View style={styles.form}>
                            <Text style={styles.formTitle}>Yeni Ortak Kaynak Ekle</Text>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.input}
                                    value={yeniKaynak}
                                    onChangeText={setYeniKaynak}
                                    placeholder="Kitap/Kaynak adı giriniz"
                                />
                                <TouchableOpacity style={styles.ekleButon} onPress={handleEkle}>
                                    <MaterialIcons name="add" size={24} color="white" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.aciklama}>
                                Buraya eklediğiniz kaynaklar tüm öğrencilerinize ödev verirken veya kaynak seçerken listede görünecektir.
                            </Text>
                        </View>

                        <View style={styles.listeContainer}>
                            <Text style={styles.listeTitle}>Sistemdeki Kaynaklar ({kaynaklar.length})</Text>
                            <FlatList
                                data={kaynaklar}
                                renderItem={renderItem}
                                keyExtractor={item => item.id.toString()}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            />
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        elevation: 2,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 16, color: '#333' },
    keyboardView: { flex: 1 },
    content: { flex: 1, padding: 16 },
    form: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        elevation: 2,
    },
    formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#2c3e50' },
    inputRow: { flexDirection: 'row', alignItems: 'center' },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginRight: 10,
        backgroundColor: '#f9f9f9',
    },
    ekleButon: {
        backgroundColor: '#2ecc71',
        padding: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    aciklama: { fontSize: 12, color: '#7f8c8d', marginTop: 10, fontStyle: 'italic' },
    listeContainer: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 12, elevation: 2 },
    listeTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#2c3e50' },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
    },
    itemInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    numara: { fontSize: 14, fontWeight: 'bold', color: '#95a5a6', marginRight: 10 },
    ad: { fontSize: 16, color: '#333', flex: 1 },
    silButon: { padding: 8, backgroundColor: '#fff5f5', borderRadius: 6 },
});
