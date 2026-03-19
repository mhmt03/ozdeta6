// PaymentPopup.js
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ogrencininOdemeleri, odemeKaydet } from '../database/financeOperations';

interface PaymentPopupProps {
    visible: boolean;
    onClose: (success: boolean) => void;
}

const PaymentPopup: React.FC<PaymentPopupProps> = ({ visible, onClose }) => {
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [amount, setAmount] = useState('');
    const [toplamDers, setToplamDers] = useState(0);
    const [toplamOdeme, setToplamOdeme] = useState(0);

    useEffect(() => {
        if (visible) {
            // Popup açılınca verileri çek
            (async () => {
                // Not: Bu bileşen ogrenciId almıyor, şimdilik statik bir değer veya hata almasını engellemek için 0 kullanıyoruz.
                // Eğer bu bileşen genel bir rapor ise farklı bir fonskiyon gerekebilir.
                const res = await ogrencininOdemeleri(0);
                if (res.success) {
                    // Toplamları hesapla
                    const dersTop = res.dersler.reduce((acc, d) => acc + (parseFloat(d.ucret) || 0), 0);
                    const odemeTop = res.odemeler.reduce((acc, o) => acc + (parseFloat(o.alinanucret) || 0), 0);
                    setToplamDers(dersTop);
                    setToplamOdeme(odemeTop);
                }
            })();
        }
    }, [visible]);

    const handleSave = async () => {
        if (!amount) return Alert.alert("Uyarı", "Lütfen ücret giriniz!");
        await odemeKaydet({
            ogrenciId: 0, // Geçici
            alinanucret: amount,
            odemetarih: date.toISOString().split('T')[0],
            odemeturu: 'Nakit',
            aciklama: 'Hızlı Ödeme'
        });
        onClose(true); // başarıyla kapat
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                <View style={styles.popup}>
                    <Text style={styles.title}>Ödeme Al</Text>

                    <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                        <Text style={styles.label}>Tarih: {date.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display="default"
                            onChange={(e, selectedDate) => {
                                setShowDatePicker(false);
                                if (selectedDate) setDate(selectedDate);
                            }}
                        />
                    )}

                    <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                        <Text style={styles.label}>Saat: {date.toLocaleTimeString()}</Text>
                    </TouchableOpacity>
                    {showTimePicker && (
                        <DateTimePicker
                            value={date}
                            mode="time"
                            display="default"
                            onChange={(e, selectedDate) => {
                                setShowTimePicker(false);
                                if (selectedDate) setDate(selectedDate);
                            }}
                        />
                    )}

                    <TextInput
                        style={styles.input}
                        placeholder="Ücret giriniz"
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                    />

                    <View style={styles.summaryBox}>
                        <Text style={styles.summary}>Toplam Ders: {toplamDers}₺</Text>
                        <Text style={styles.summary}>Toplam Ödeme: {toplamOdeme}₺</Text>
                        <Text style={styles.summary}>Kalan: {toplamDers - toplamOdeme}₺</Text>
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => onClose(false)}>
                            <Text style={styles.btnText}>Vazgeç</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.btnText}>Kaydet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
    popup: { backgroundColor: "white", padding: 20, borderRadius: 15, width: "90%" },
    title: { fontSize: 20, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
    label: { fontSize: 16, marginVertical: 8 },
    input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginVertical: 10 },
    summaryBox: { backgroundColor: "#f9f9f9", padding: 10, borderRadius: 8, marginVertical: 10 },
    summary: { fontSize: 14 },
    buttonRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 15 },
    cancelBtn: { flex: 1, marginRight: 5, padding: 12, backgroundColor: "#aaa", borderRadius: 8, alignItems: "center" },
    saveBtn: { flex: 1, marginLeft: 5, padding: 12, backgroundColor: "#4CAF50", borderRadius: 8, alignItems: "center" },
    btnText: { color: "white", fontWeight: "bold" },
});

export default PaymentPopup;
