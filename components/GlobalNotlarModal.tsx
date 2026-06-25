import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { globalNotlariGetir, globalNotEkle, globalNotGuncelle, globalNotSil, GlobalNoteType } from '../utils/database';

interface GlobalNotlarModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function GlobalNotlarModal({ visible, onClose }: GlobalNotlarModalProps) {
    const [notlar, setNotlar] = useState<GlobalNoteType[]>([]);
    const [isEkleModalVisible, setIsEkleModalVisible] = useState(false);
    const [seciliNot, setSeciliNot] = useState<GlobalNoteType | null>(null);
    const [notMetni, setNotMetni] = useState('');

    useEffect(() => {
        if (visible) {
            notlariYukle();
        }
    }, [visible]);

    const notlariYukle = async () => {
        const response = await globalNotlariGetir();
        if (response.success && response.data) {
            setNotlar(response.data);
        }
    };

    const handleKaydet = async () => {
        if (!notMetni.trim()) {
            Alert.alert('Hata', 'Lütfen bir not giriniz.');
            return;
        }

        const simdi = new Date();
        const tarihSaat = simdi.toLocaleDateString('tr-TR') + ' ' + simdi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        if (seciliNot && seciliNot.id) {
            // Güncelle
            const response = await globalNotGuncelle(seciliNot.id, notMetni, tarihSaat);
            if (response.success) {
                notlariYukle();
                kapatEkleModal();
            } else {
                Alert.alert('Hata', 'Not güncellenemedi.');
            }
        } else {
            // Ekle
            const response = await globalNotEkle(notMetni, tarihSaat);
            if (response.success) {
                notlariYukle();
                kapatEkleModal();
            } else {
                Alert.alert('Hata', 'Not eklenemedi.');
            }
        }
    };

    const handleSil = (id: number) => {
        Alert.alert('Emin misiniz?', 'Bu notu silmek istediğinize emin misiniz?', [
            { text: 'İptal', style: 'cancel' },
            {
                text: 'Sil',
                style: 'destructive',
                onPress: async () => {
                    const response = await globalNotSil(id);
                    if (response.success) {
                        notlariYukle();
                    }
                }
            }
        ]);
    };

    const kapatEkleModal = () => {
        setIsEkleModalVisible(false);
        setSeciliNot(null);
        setNotMetni('');
    };

    const acEkleModal = (not?: GlobalNoteType) => {
        if (not) {
            setSeciliNot(not);
            setNotMetni(not.not_metni);
        } else {
            setSeciliNot(null);
            setNotMetni('');
        }
        setIsEkleModalVisible(true);
    };

    const renderNotItem = ({ item }: { item: GlobalNoteType }) => (
        <View style={styles.notItem}>
            <View style={styles.notİcerik}>
                <Text style={styles.notMetni}>{item.not_metni}</Text>
                <Text style={styles.notTarih}>{item.tarih_saat}</Text>
            </View>
            <View style={styles.notAksiyonlar}>
                <TouchableOpacity onPress={() => acEkleModal(item)} style={styles.iconButton}>
                    <MaterialIcons name="edit" size={20} color="#3498db" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => item.id && handleSil(item.id)} style={styles.iconButton}>
                    <MaterialIcons name="delete" size={20} color="#e74c3c" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalBackground}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Notlar</Text>
                        <View style={styles.headerRight}>
                            <TouchableOpacity onPress={() => acEkleModal()} style={styles.addButton}>
                                <MaterialIcons name="add" size={28} color="#2c3e50" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <MaterialIcons name="close" size={28} color="#e74c3c" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {notlar.length === 0 ? (
                        <View style={styles.bosDurum}>
                            <MaterialIcons name="speaker-notes-off" size={50} color="#bdc3c7" />
                            <Text style={styles.bosMetin}>Henüz not eklenmemiş.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={notlar}
                            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                            renderItem={renderNotItem}
                            contentContainerStyle={styles.liste}
                        />
                    )}
                </View>
            </View>

            {/* Ekle / Düzenle Modal */}
            <Modal visible={isEkleModalVisible} animationType="fade" transparent={true} onRequestClose={kapatEkleModal}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackground}>
                    <View style={styles.ekleModalContainer}>
                        <Text style={styles.ekleModalBaslik}>{seciliNot ? 'Notu Düzenle' : 'Yeni Not Ekle'}</Text>
                        
                        <TextInput
                            style={styles.textInput}
                            multiline
                            placeholder="Notunuzu buraya yazın..."
                            value={notMetni}
                            onChangeText={setNotMetni}
                            autoFocus
                        />
                        
                        <View style={styles.ekleModalButonlar}>
                            <TouchableOpacity style={[styles.buton, styles.iptalButon]} onPress={kapatEkleModal}>
                                <Text style={styles.butonText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.buton, styles.kaydetButon]} onPress={handleKaydet}>
                                <Text style={styles.kaydetButonText}>Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContainer: {
        width: '90%',
        height: '80%',
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
        paddingBottom: 10,
        marginBottom: 10
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2c3e50'
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    addButton: {
        marginRight: 15,
        backgroundColor: '#ecf0f1',
        borderRadius: 20,
        padding: 4
    },
    closeButton: {
        padding: 4
    },
    liste: {
        paddingBottom: 20
    },
    notItem: {
        flexDirection: 'row',
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        alignItems: 'center',
        borderLeftWidth: 4,
        borderLeftColor: '#f1c40f'
    },
    notİcerik: {
        flex: 1
    },
    notMetni: {
        fontSize: 16,
        color: '#2c3e50',
        marginBottom: 8
    },
    notTarih: {
        fontSize: 12,
        color: '#95a5a6'
    },
    notAksiyonlar: {
        flexDirection: 'row',
        marginLeft: 10
    },
    iconButton: {
        padding: 8,
        marginLeft: 5,
        backgroundColor: '#fff',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2
    },
    bosDurum: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    bosMetin: {
        marginTop: 10,
        fontSize: 16,
        color: '#7f8c8d'
    },
    ekleModalContainer: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    ekleModalBaslik: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 15
    },
    textInput: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ecf0f1',
        padding: 15,
        minHeight: 120,
        textAlignVertical: 'top',
        fontSize: 16,
        marginBottom: 20
    },
    ekleModalButonlar: {
        flexDirection: 'row',
        justifyContent: 'flex-end'
    },
    buton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginLeft: 10
    },
    iptalButon: {
        backgroundColor: '#ecf0f1'
    },
    kaydetButon: {
        backgroundColor: '#2ecc71'
    },
    butonText: {
        color: '#2c3e50',
        fontWeight: 'bold'
    },
    kaydetButonText: {
        color: '#fff',
        fontWeight: 'bold'
    }
});
