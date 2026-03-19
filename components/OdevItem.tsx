import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

    const teslimGecmis = new Date(item.teslimttarihi) < new Date();

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
            <View style={styles.durumContainer}>
                <Text style={styles.durumLabel}>Durum:</Text>
                <Picker
                    selectedValue={yapilmaDurumu}
                    onValueChange={(val: string) => setYapilmaDurumu(val)}
                    style={styles.durumPicker}
                >
                    <Picker.Item label="Bekliyor" value="Bekliyor" />
                    <Picker.Item label="Yapıldı" value="Yapıldı" />
                    <Picker.Item label="Yapılmadı" value="Yapılmadı" />
                    <Picker.Item label="Eksik" value="Eksik" />
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
        margin: 10, backgroundColor: 'gray'
    },
    durumLabel: { marginRight: 8, fontWeight: 'bold' },
    durumPicker: { flex: 1, height: 50 },
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
