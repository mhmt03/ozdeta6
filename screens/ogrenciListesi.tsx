import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal } from "react-native";
import { FAB } from 'react-native-paper'
import { useEffect, useState, useLayoutEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { ogrencileriListele, ogrenciSil } from "../utils/database";
import OgrenciListItem from "../components/OgrenciListItem";
import { StackScreenProps, StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { OgrenciType } from '../types';
import { MaterialIcons } from '@expo/vector-icons';

type Props = StackScreenProps<RootStackParamList, 'ogrenciListesi'>;

export default function OgrenciListesi({ navigation: propNavigation }: Props) {
    const [ogrenciler, setOgrenciler] = useState<OgrenciType[]>([]);
    const [pasifGor, setPasifGor] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    
    // Custom action sheet state
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [selectedOgrenci, setSelectedOgrenci] = useState<OgrenciType | null>(null);

    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity
                    onPress={() => navigation.navigate('GlobalKaynakYonetimi')}
                    style={{ marginRight: 15 }}
                >
                    <MaterialIcons name="library-books" size={24} color="white" />
                    <Text style={{ color: 'white', fontSize: 10, textAlign: 'center' }}>Kaynaklar</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation]);

    useEffect(() => {
        const unsubscribe = propNavigation.addListener('focus', () => {
            verileriYenile();
        });

        verileriYenile();

        return unsubscribe;
    }, [navigation, pasifGor]);

    const verileriYenile = async () => {
        try {
            setRefreshing(true);
            const result = await ogrencileriListele(pasifGor);

            if (result.success && result.data) {
                setOgrenciler(result.data);
            } else {
                setOgrenciler([]);
            }
        } catch (error) {
            console.error("Öğrenci listesi alınamadı:", error);
            Alert.alert("Hata", "Öğrenci listesi yüklenirken bir hata oluştu");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const togglePasifGor = () => {
        setPasifGor(!pasifGor);
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text>Yükleniyor...</Text>
            </View>
        );
    }

    const handleEdit = (ogrenci: OgrenciType) => {
        navigation.navigate('yeniKayit', { ogrenci });
    };

    const handleDelete = (ogrenci: OgrenciType) => {
        Alert.alert(
            "Öğrenci Silme Onayı",
            `"${ogrenci.ogrenciAd} ${ogrenci.ogrenciSoyad}" adlı öğrenciyi silmek istediğinize emin misiniz?`,
            [
                { text: "Hayır", style: "cancel" },
                {
                    text: "Evet",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await ogrenciSil(ogrenci.ogrenciId!);
                            verileriYenile();
                        } catch (error) {
                            Alert.alert("Hata", "Öğrenci silinirken bir hata oluştu");
                        }
                    }
                }
            ]
        );
    };

    const handleLongPress = (ogrenci: OgrenciType) => {
        setSelectedOgrenci(ogrenci);
        setActionModalVisible(true);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={[styles.toggleButton, pasifGor && styles.toggleButtonActive]}
                    onPress={togglePasifGor}
                >
                    <Text style={styles.toggleButtonText}>
                        {pasifGor ? 'Pasif Öğrenciler' : 'Aktif Öğrenciler'}
                    </Text>
                </TouchableOpacity>

                <Text style={{ fontSize: 10, color: '#aaa', fontStyle: 'italic', flex: 1, textAlign: 'center' }}>
                    düzenlemek için basılı tutun
                </Text>

                <TouchableOpacity style={styles.headerHomeBtn} onPress={() => navigation.navigate('AnaSayfa')}>
                    <MaterialIcons name="home" size={24} color="#ec7819ff" />
                </TouchableOpacity>
            </View>

            {ogrenciler.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Text style={styles.emptyText}>Kayıtlı öğrenci bulunamadı</Text>
                    <Text style={styles.emptySubText}>Yeni öğrenci eklemek için alttaki + butonuna tıklayın</Text>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => navigation.navigate('yeniKayit', {})}
                    >
                        <Text style={styles.addButtonText}>Yeni Öğrenci Ekle</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={ogrenciler}
                    keyExtractor={item => item.ogrenciId?.toString() ?? Math.random().toString()}
                    renderItem={({ item }) => (
                        <OgrenciListItem
                            ogrenci={item}
                            onPress={() => navigation.navigate('ogrenciDetay', { ogrenci: item })}
                            onLongPress={() => handleLongPress(item)}
                        />
                    )}
                    refreshing={refreshing}
                    onRefresh={verileriYenile}
                    contentContainerStyle={styles.listContent}
                />
            )}

            <FAB
                icon="plus"
                style={styles.fab}
                onPress={() => navigation.navigate('yeniKayit', {})}
                color="white"
            />
            
            {/* Custom Action Modal for Long Press */}
            <Modal
                visible={actionModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setActionModalVisible(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setActionModalVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderLine} />
                        <Text style={styles.modalTitle}>{selectedOgrenci?.ogrenciAd} {selectedOgrenci?.ogrenciSoyad}</Text>
                        <Text style={styles.modalSubtitle}>Bu öğrenci için bir işlem seçin</Text>
                        
                        <TouchableOpacity 
                            style={styles.modalActionBtn}
                            onPress={() => {
                                setActionModalVisible(false);
                                if (selectedOgrenci) handleEdit(selectedOgrenci);
                            }}
                        >
                            <View style={[styles.modalIconBg, { backgroundColor: '#e3f2fd' }]}>
                                <MaterialIcons name="edit" size={22} color="#1976d2" />
                            </View>
                            <Text style={styles.modalActionText}>Düzenle</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.modalActionBtn}
                            onPress={() => {
                                setActionModalVisible(false);
                                if (selectedOgrenci) handleDelete(selectedOgrenci);
                            }}
                        >
                            <View style={[styles.modalIconBg, { backgroundColor: '#ffebee' }]}>
                                <MaterialIcons name="delete" size={22} color="#d32f2f" />
                            </View>
                            <Text style={[styles.modalActionText, { color: '#d32f2f' }]}>Sil</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#f5f5f5',
        paddingTop: 16,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#ddd' },
    toggleButton: { padding: 10, backgroundColor: '#e0e0e0', borderRadius: 20 },
    toggleButtonActive: { backgroundColor: '#4CAF50' },
    toggleButtonText: { color: '#333', fontSize: 12, fontWeight: 'bold' },
    listContent: { padding: 8, paddingBottom: 80 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 18, color: '#666', marginBottom: 10, textAlign: 'center', fontWeight: 'bold' },
    emptySubText: { fontSize: 14, color: '#888', marginBottom: 20, textAlign: 'center' },
    addButton: { backgroundColor: '#f01394ff', padding: 15, borderRadius: 8, marginTop: 0, marginBottom: 50 },
    addButtonText: { color: 'blue', fontWeight: 'bold', fontSize: 26 },
    headerHomeBtn: {
        padding: 6,
        backgroundColor: '#f9f9f9',
        borderRadius: 20,
        elevation: 2,
    },
    fab: { position: 'absolute', margin: 16, right: 0, bottom: 50, backgroundColor: '#2196F3' },
    
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalHeaderLine: {
        width: 40,
        height: 4,
        backgroundColor: '#e0e0e0',
        borderRadius: 2,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 24,
    },
    modalActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingVertical: 12,
        marginBottom: 8,
    },
    modalIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    modalActionText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    }
});
