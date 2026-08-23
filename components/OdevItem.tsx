import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { OdevType } from '../types';

interface OdevItemProps {
    item: OdevType;
    onGuncelle: (guncelOdev: OdevType) => void;
    onSil?: (odevId: number) => void;
    onDuzenle?: (item: OdevType) => void;
}

const OdevItem: React.FC<OdevItemProps> = ({ item, onGuncelle, onSil, onDuzenle }) => {
    const [yapilmaDurumu, setYapilmaDurumu] = useState(item.yapilmadurumu || 'Bekliyor');

    const formatTarih = (tarih: Date | string) => {
        if (!tarih) return '';
        if (typeof tarih === 'string') {
            return new Date(tarih).toLocaleDateString('tr-TR');
        }
        return tarih.toLocaleDateString('tr-TR');
    };

    const teslimGecmis = new Date(item.teslimttarihi) < new Date() && yapilmaDurumu !== 'Yapıldı';

    const getDurumRenk = (durum: string) => {
        switch (durum) {
            case 'Bekliyor': return '#f39c12'; // Turuncu
            case 'Yapıldı': return '#2ecc71';  // Yeşil
            case 'Yapılmadı': return '#e74c3c'; // Kırmızı
            case 'Eksik': return '#34495e';    // Koyu Gri/Mavi
            default: return '#95a5a6';
        }
    };

    const silOnayla = () => {
        if (!item.odevId || !onSil) return;
        Alert.alert(
            'Ödev Sil',
            'Bu ödevi silmek istediğinizden emin misiniz?',
            [
                { text: 'İptal', style: 'cancel' },
                { text: 'Sil', style: 'destructive', onPress: () => onSil(item.odevId!) }
            ]
        );
    };

    return (
        <View style={[styles.odevItem, teslimGecmis && { borderColor: 'red', borderWidth: 2 }]}>
            <Text style={styles.odevKonu}>{item.odev}</Text>
            <Text style={styles.odevKaynak}>{item.kaynak}</Text>
            
            {/* Tarihler (Salt Okunur) */}
            <View style={styles.odevTarihler}>
                <View style={styles.dateTextContainer}>
                    <MaterialIcons name="date-range" size={16} color="#666" style={{ marginRight: 4 }} />
                    <Text style={styles.dateText}>Verildi: {formatTarih(item.verilmetarihi)}</Text>
                </View>

                <View style={styles.dateTextContainer}>
                    <MaterialIcons name="date-range" size={16} color="#666" style={{ marginRight: 4 }} />
                    <Text style={styles.dateText}>Teslim: {formatTarih(item.teslimttarihi)}</Text>
                </View>
            </View>

            {/* Durum + Aksiyonlar Aynı Satırda */}
            <View style={styles.altAksiyonSatiri}>
                <View style={[styles.durumContainer, { backgroundColor: getDurumRenk(yapilmaDurumu) }]}>
                    <Picker
                        selectedValue={yapilmaDurumu}
                        onValueChange={(val: string) => setYapilmaDurumu(val)}
                        style={styles.durumPicker}
                        dropdownIconColor="white"
                    >
                        <Picker.Item label="Bekliyor" value="Bekliyor" color={Platform.OS === 'ios' ? 'white' : '#f51212ff'} />
                        <Picker.Item label="Yapıldı" value="Yapıldı" color={Platform.OS === 'ios' ? 'white' : '#f51212ff'} />
                        <Picker.Item label="Yapılmadı" value="Yapılmadı" color={Platform.OS === 'ios' ? 'white' : '#f51212ff'} />
                        <Picker.Item label="Eksik" value="Eksik" color={Platform.OS === 'ios' ? 'white' : '#f51212ff'} />
                    </Picker>
                </View>

                {/* Güncelle Butonu (Sadece Durumu Kaydeder) */}
                <TouchableOpacity
                    style={styles.guncelleButon}
                    onPress={() =>
                        onGuncelle({
                            ...item,
                            yapilmadurumu: yapilmaDurumu,
                        })
                    }
                >
                    <MaterialIcons name="save" size={14} color="white" />
                    <Text style={styles.guncelleText}>Gncll</Text>
                </TouchableOpacity>
               
                {/* Düzenle Butonu */}
                {onDuzenle && (
                    <TouchableOpacity
                        style={styles.duzenleButon}
                        onPress={() => onDuzenle(item)}
                    >
                        <MaterialIcons name="edit" size={14} color="white" />
                        <Text style={styles.duzenleText}>Düzenle</Text>
                    </TouchableOpacity>
                )}

               

                {/* Sil Butonu */}
                {onSil && (
                    <TouchableOpacity
                        style={styles.silButon}
                        onPress={silOnayla}
                    >
                        <MaterialIcons name="delete" size={14} color="white" />
                        <Text style={styles.silText}>Sil</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    odevItem: {
        padding: 10,
        marginBottom: 10,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e1e8ed',
    },
    odevKonu: { fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: '#2c3e50' },
    odevKaynak: { fontSize: 12, fontWeight: 'normal', marginBottom: 4, color: '#5da7f1ff' },
    odevTarihler: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
        gap: 6,
    },
    dateTextContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    dateText: { fontSize: 12, color: '#666' },
    altAksiyonSatiri: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    durumContainer: {
        flex: 1,
        justifyContent:'flex-start',
        borderRadius: 16,
        height: 48,
        overflow: 'hidden',
        padding: 0,
        margin: 0,
    },
    durumPicker: {
        flex: 1,
        color: '#0c0c0cff',
        fontWeight: "normal",
        fontSize: 8,
        textDecorationColor: "red",
        padding: 0,
        marginTop: -10,
    },
    duzenleButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#9b59b6',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 6,
        height: 38,
    },
    duzenleText: { color: 'white', marginLeft: 2, fontWeight: 'bold', fontSize: 8 },
    guncelleButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3498db',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 6,
        height: 38,
    },
    guncelleText: { color: 'white', marginLeft: 2, fontWeight: 'bold', fontSize: 8 },
    silButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e74c3c',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 6,
        height: 38,
    },
    silText: { color: 'white', marginLeft: 2, fontWeight: 'bold', fontSize: 8 },
});

export default OdevItem;
