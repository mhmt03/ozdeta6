import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { OdevType } from '../types';

interface OdevItemProps {
    item: OdevType;
    onGuncelle: (guncelOdev: OdevType) => void;
}

const OdevItem: React.FC<OdevItemProps> = ({ item, onGuncelle }) => {
    const [yapilmaDurumu, setYapilmaDurumu] = useState(item.yapilmadurumu || 'Bekliyor');
    const [verilme, setVerilme] = useState(new Date(item.verilmetarihi));
    const [teslim, setTeslim] = useState(new Date(item.teslimttarihi));
    const [verilmePickerAcik, setVerilmePickerAcik] = useState(false);
    const [teslimPickerAcik, setTeslimPickerAcik] = useState(false);

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

    return (
        <View style={[styles.odevItem, teslimGecmis && { borderColor: 'red', borderWidth: 2 }]}>
            <Text style={styles.odevKonu}>{item.odev}</Text>

            {/* Tarih Seçiciler */}
            <View style={styles.odevTarihler}>
                <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setVerilmePickerAcik(true)}
                >
                    <MaterialIcons name="date-range" size={20} color="#666" />
                    <Text style={styles.dateText}>Verildi: {formatTarih(verilme)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setTeslimPickerAcik(true)}
                >
                    <MaterialIcons name="date-range" size={20} color="#666" />
                    <Text style={styles.dateText}>Teslim: {formatTarih(teslim)}</Text>
                </TouchableOpacity>
            </View>

            {/* Durum */}
            <View style={[styles.durumContainer, { backgroundColor: getDurumRenk(yapilmaDurumu) }]}>
                <Text style={styles.durumLabel}>Durum:</Text>
                <Picker
                    selectedValue={yapilmaDurumu}
                    onValueChange={(val: string) => setYapilmaDurumu(val)}
                    style={styles.durumPicker}
                    dropdownIconColor="white"
                >
                    <Picker.Item label="Bekliyor" value="Bekliyor" color={Platform.OS === 'ios' ? 'white' : '#333'} />
                    <Picker.Item label="Yapıldı" value="Yapıldı" color={Platform.OS === 'ios' ? 'white' : '#333'} />
                    <Picker.Item label="Yapılmadı" value="Yapılmadı" color={Platform.OS === 'ios' ? 'white' : '#333'} />
                    <Picker.Item label="Eksik" value="Eksik" color={Platform.OS === 'ios' ? 'white' : '#333'} />
                </Picker>
            </View>

            {/* Güncelle Butonu */}
            <TouchableOpacity
                style={styles.guncelleButon}
                onPress={() =>
                    onGuncelle({
                        ...item,
                        yapilmadurumu: yapilmaDurumu,
                        verilmetarihi: verilme.toISOString().split('T')[0],
                        teslimttarihi: teslim.toISOString().split('T')[0],
                    })
                }
            >
                <MaterialIcons name="save" size={20} color="white" />
                <Text style={styles.guncelleText}>Güncelle</Text>
            </TouchableOpacity>

            {/* DatePickers */}
            {verilmePickerAcik && (
                <DateTimePicker
                    value={verilme}
                    mode="date"
                    display="default"
                    onChange={(e, selected) => {
                        setVerilmePickerAcik(false);
                        if (selected) setVerilme(selected);
                    }}
                />
            )}
            {teslimPickerAcik && (
                <DateTimePicker
                    value={teslim}
                    mode="date"
                    display="default"
                    onChange={(e, selected) => {
                        setTeslimPickerAcik(false);
                        if (selected) setTeslim(selected);
                    }}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    odevItem: {
        padding: 12,
        marginBottom: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e1e8ed',
    },
    odevKonu: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
    odevTarihler: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 8,
        backgroundColor: '#fff',
    },
    dateText: { marginLeft: 8 },
    durumContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 50,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    durumLabel: { color: 'white', fontWeight: 'bold', fontSize: 14, marginRight: 5 },
    durumPicker: { flex: 1, color: 'white', fontWeight: 'bold' },
    guncelleButon: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#3498db',
        padding: 10,
        borderRadius: 6,
        marginTop: 10,
    },
    guncelleText: { color: 'white', marginLeft: 6, fontWeight: 'bold' },
});

export default OdevItem;
