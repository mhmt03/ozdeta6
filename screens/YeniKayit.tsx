import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { View, Text, StyleSheet, TouchableWithoutFeedback, ScrollView, TouchableOpacity, Keyboard } from "react-native";
import { ogrenciKaydet, ogrenciGuncelle } from "../utils/database";
import OgrenciForm from "../components/OgrenciForm";
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { OgrenciType } from '../types';

type Props = StackScreenProps<RootStackParamList, 'yeniKayit'>;

export default function YeniKayit({ route, navigation }: Props) {
    const existing = route.params?.ogrenci as OgrenciType | undefined;
    const [ogrenci, setOgrenci] = useState<OgrenciType>({
        ogrenciAd: '',
        ogrenciSoyad: '',
        ogrenciTel: '',
        okul: '',
        veliAd: '',
        veliTel: '',
        ucret: 0,
        kayitTarihi: new Date().toISOString().split('T')[0],
        aktifmi: 1,
        aciklama1: '',
        aciklama2: '',
        sinif: ''
    });

    useEffect(() => {
        if (existing) {
            setOgrenci(existing);
        }
    }, [existing]);

    const kaydetClick = async () => {
        try {
            if (!ogrenci.ogrenciAd) {
                Alert.alert("Eksik bilgi");
                return;
            }

            if (existing && existing.ogrenciId) {
                await ogrenciGuncelle(existing.ogrenciId, ogrenci)
            } else {
                await ogrenciKaydet(ogrenci);
            }
            navigation.goBack();

        } catch (error) {
            console.error('Kayıt hatası:', error);
            Alert.alert("Hata", "Kayıt sırasında hata oluştu: " + (error as any).message);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
                    <OgrenciForm ogrenci={ogrenci} setOgrenci={setOgrenci} />

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={() => navigation.goBack()}
                        >
                            <Text style={styles.buttonText}>Vazgeç</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={kaydetClick}
                        >
                            <Text style={styles.buttonText}>Kaydet</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    scrollContent: { padding: 16, paddingBottom: 30 },
    buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
    button: { borderRadius: 8, paddingVertical: 14, paddingHorizontal: 25, minWidth: '45%', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
    cancelButton: { backgroundColor: '#e74c3c' },
    saveButton: { backgroundColor: '#2ecc71' },
    buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});
