import React, { Dispatch, SetStateAction } from 'react';
import { View, Switch, Text, TextInput, Keyboard, TouchableWithoutFeedback, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { OgrenciType } from '../types';

type OgrenciFormProps = {
    ogrenci: OgrenciType;
    setOgrenci: Dispatch<SetStateAction<OgrenciType>>;
    onSave?: () => void;
    onCancel?: () => void;
};

export default function OgrenciForm({ ogrenci, setOgrenci, onSave, onCancel }: OgrenciFormProps) {
    const metinDegisti = (bolge: keyof OgrenciType, deger: any) => {
        setOgrenci(onceki => ({ ...onceki, [bolge]: deger }));
    };

    const sayiDegisti = (bolge: keyof OgrenciType, deger: string) => {
        const numerik = deger.replace(/[^0-9]/g, '');
        metinDegisti(bolge, numerik === '' ? 0 : parseInt(numerik, 10));
    }

    const handleSave = () => {
        if (!ogrenci.ogrenciAd || !ogrenci.ogrenciSoyad) {
            Alert.alert('Uyarı', 'Öğrenci adı ve soyadı gereklidir.');
            return;
        }
        if (onSave) onSave();
    }

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={styles.sectionTitle}>Öğrenci Bilgileri</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Ad</Text>
                        <TextInput
                            value={ogrenci.ogrenciAd ?? ''}
                            style={styles.input}
                            onChangeText={text => metinDegisti('ogrenciAd', text)}
                            placeholder="Öğrenci adını girin"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Soyad</Text>
                        <TextInput
                            value={ogrenci.ogrenciSoyad ?? ''}
                            onChangeText={text => metinDegisti('ogrenciSoyad', text)}
                            style={styles.input}
                            placeholder="Öğrenci soyadını girin"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Okulu</Text>
                        <TextInput
                            value={ogrenci.okul ?? ''}
                            onChangeText={text => metinDegisti('okul', text)}
                            style={styles.input}
                            placeholder="Okul adını girin"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Öğrenci Telefon</Text>
                        <TextInput
                            value={(ogrenci.ogrenciTel ?? '').toString()}
                            onChangeText={text => metinDegisti('ogrenciTel', text)}
                            style={styles.input}
                            keyboardType="phone-pad"
                            placeholder="5XX XXX XX XX"
                        />
                    </View>

                    <Text style={styles.sectionTitle}>Veli Bilgileri</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Veli Adı</Text>
                        <TextInput
                            value={ogrenci.veliAd ?? ''}
                            onChangeText={text => metinDegisti('veliAd', text)}
                            style={styles.input}
                            placeholder="Veli adını girin"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Veli Telefon</Text>
                        <TextInput
                            value={(ogrenci.veliTel ?? '').toString()}
                            onChangeText={text => metinDegisti('veliTel', text)}
                            style={styles.input}
                            keyboardType="phone-pad"
                            placeholder="5XX XXX XX XX"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Ücret</Text>
                        <TextInput
                            value={ogrenci.ucret == null ? '0' : ogrenci.ucret.toString()}
                            onChangeText={text => sayiDegisti('ucret', text)}
                            style={styles.input}
                            keyboardType="numeric"
                            placeholder="TL cinsinden girin"
                        />
                    </View>

                    <Text style={styles.sectionTitle}>Diğer Bilgiler</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Açıklama 1</Text>
                        <TextInput
                            value={ogrenci.aciklama1 ?? ''}
                            onChangeText={text => metinDegisti('aciklama1', text)}
                            style={[styles.input, styles.multilineInput]}
                            multiline
                            placeholder="Açıklama girin"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Açıklama 2</Text>
                        <TextInput
                            value={ogrenci.aciklama2 ?? ''}
                            onChangeText={text => metinDegisti('aciklama2', text)}
                            style={[styles.input, styles.multilineInput]}
                            multiline
                            placeholder="Açıklama girin"
                        />
                    </View>

                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Aktif Öğrenci</Text>
                        <Switch
                            value={ogrenci.aktifmi === 1}
                            onValueChange={value => metinDegisti('aktifmi', value ? 1 : 0)}
                            thumbColor={ogrenci.aktifmi === 1 ? "#4CAF50" : "#f4f3f4"}
                            trackColor={{ false: "#767577", true: "#81b0ff" }}
                        />
                    </View>
                </ScrollView>
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10, color: '#2c3e50', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#ddd' },
    inputGroup: { marginBottom: 15 },
    label: { fontSize: 16, marginBottom: 5, fontWeight: '600', color: '#34495e' },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#fff', fontSize: 16 },
    multilineInput: { minHeight: 100, textAlignVertical: 'top' },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 20, padding: 15, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
    switchLabel: { fontSize: 16, fontWeight: '600', color: '#34495e' },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 30 },
    button: { borderRadius: 8, paddingVertical: 14, paddingHorizontal: 25, minWidth: '45%', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
    cancelButton: { backgroundColor: '#e74c3c' },
    saveButton: { backgroundColor: '#2ecc71' },
    buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});
