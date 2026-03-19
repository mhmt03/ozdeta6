

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { ogrencininOdemeleri, tekOgrenci, tumYapilanDersler } from '../utils/database';
import { tarihAraligiAjandaGetir } from '../utils/ajandaDatabase';

import { AjandaType } from '../types';
import { AjandaWithOgrenciType } from '../utils/ajandaDatabase';
import { DersType } from '../types';

export default function AnaSayfa() {
    const navigation = useNavigation<any>();
    const [aktifTarih, setAktifTarih] = useState(new Date());
    const [aktifTarihRandevulari, setAktifTarihRandevulari] = useState<AjandaWithOgrenciType[]>([]);
    const [sonDersler, setSonDersler] = useState<DersType[]>([]);

    // Tarih formatı (gün.ay.yıl)
    const formatTarih = (tarih: Date) => {
        return tarih.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Tarih karşılaştırma fonksiyonu
    const tarihleriKarsilastir = (tarih1: Date, tarih2: Date) => {
        const t1 = new Date(tarih1.getFullYear(), tarih1.getMonth(), tarih1.getDate());
        const t2 = new Date(tarih2.getFullYear(), tarih2.getMonth(), tarih2.getDate());
        return t1.getTime() === t2.getTime();
    };

    // Randevuları getir 
    const randevulariGetir = (tarih: Date) => {
        // Örnek randevu verileri - gerçekte veritabanından gelecek
        const tumRandevular = [
            { id: 1, ogrenciAdi: 'Ahmet Yılmaz', ogrenciId: 101, saat: '14:00', ders: 'Matematik', tarih: new Date() },
            { id: 2, ogrenciAdi: 'Ayşe Demir', ogrenciId: 102, saat: '16:30', ders: 'Fizik', tarih: new Date() },
            { id: 3, ogrenciAdi: 'Mehmet Öz', ogrenciId: 103, saat: '10:00', ders: 'Kimya', tarih: new Date(Date.now() + 24 * 60 * 60 * 1000) }, // yarın
            { id: 4, ogrenciAdi: 'Fatma Kaya', ogrenciId: 104, saat: '15:00', ders: 'Biyoloji', tarih: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // dün
        ];

        // Seçili tarihe ait randevuları filtrele
        const filtreliRandevular = tumRandevular.filter(randevu =>
            tarihleriKarsilastir(randevu.tarih, tarih)
        );

        return filtreliRandevular;
    };

    // Önceki güne git
    const oncekiGun = () => {
        const yeniTarih = new Date(aktifTarih);
        yeniTarih.setDate(yeniTarih.getDate() - 1);
        setAktifTarih(yeniTarih);
    };

    // Sonraki güne git
    const sonrakiGun = () => {
        const yeniTarih = new Date(aktifTarih);
        yeniTarih.setDate(yeniTarih.getDate() + 1);
        setAktifTarih(yeniTarih);
    };

    useEffect(() => {
        // Aktif tarihe göre randevuları güncelle

        const asyncFonksion = async () => {
            try {
                const randevular = await tarihAraligiAjandaGetir(aktifTarih.toISOString().split('T')[0], aktifTarih.toISOString().split('T')[0]);
                setAktifTarihRandevulari(randevular.data || []);
                console.log("anasayfa_randevular", randevular.data);
            } catch (error) {
                console.log("anasayfa_randevu alma hatası:", error);
            }
        }
        asyncFonksion();

    }, [aktifTarih]);

    useEffect(() => {
        // Son yapılan dersler 
        const asyncFonksion = async () => {
            try {
                const yapilanDersler = await tumYapilanDersler();

                setSonDersler(yapilanDersler.yapilanDersler);
            } catch (error) {
                console.error("Ders verileri alınamadı:", error);
            }
        }
        asyncFonksion();
    }, []);

    // Tarih fonksiyonu
    const getTodayDate = () => {
        const today = new Date();
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return today.toLocaleDateString('tr-TR', options);
    };

    const renderRandevuItem = ({ item }: { item: AjandaWithOgrenciType }) => (
        <TouchableOpacity
            style={styles.randevuItem}
            onPress={async () => {
                try {
                    const ogrenciResult = await tekOgrenci(item.ogrenciId);
                    if (ogrenciResult.success && ogrenciResult.data) {
                        navigation.navigate('ogrenciDetay', { ogrenci: ogrenciResult.data });
                    } else {
                        console.error('Öğrenci bulunamadı:', ogrenciResult.error);
                    }
                } catch (error) {
                    console.error('Öğrenci bilgisi alınamadı:', error);
                }
            }}
        >
            <View style={styles.randevuSaat}>
                <Text style={styles.randevuSaatText}>{item.saat}</Text>
            </View>
            <View style={styles.randevuBilgi}>
                <Text style={styles.randevuOgrenci}>{item.ogrAdsoyad}</Text>
            <Text style={styles.randevuDers}>{item.saat}</Text>
            </View>
            <MaterialIcons name="arrow-forward-ios" size={16} color="#666" />
        </TouchableOpacity>
    );

    const renderDersItem = ({ item }: { item: DersType }) => (
        <View style={styles.dersItem}>
            <View style={styles.dersIcon}>
                <Ionicons name="school" size={20} color="#3498db" />
            </View>
            <View style={styles.dersBilgi}>
                <Text style={styles.dersOgrenci}>{item.ogrenciId} {item.ogrenciAdSoyad}</Text>
                <Text style={styles.dersDetay}>{item.tarih} </Text>
                <Text style={styles.dersTarih}>{item.saat}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Başlık */}
            <View style={styles.header}>

                <Text style={styles.headerDate}>{getTodayDate()}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Bugünün Randevuları */}
                <View style={styles.randevularContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Randevular</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Ajanda')}>
                            <Text style={styles.tumunuGor}>Tümünü Gör</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tarih Navigasyonu */}
                    <View style={styles.tarihNavigasyon}>
                        <TouchableOpacity onPress={oncekiGun} style={styles.tarihOk}>
                            <MaterialIcons name="chevron-left" size={24} color="#3498db" />
                        </TouchableOpacity>

                        <View style={styles.tarihContainer}>
                            <Text style={styles.tarihText}>{formatTarih(aktifTarih)}</Text>
                            <Text style={styles.tarihGunText}>
                                {aktifTarih.toLocaleDateString('tr-TR', { weekday: 'long' })}
                            </Text>
                        </View>

                        <TouchableOpacity onPress={sonrakiGun} style={styles.tarihOk}>
                            <MaterialIcons name="chevron-right" size={24} color="#3498db" />
                        </TouchableOpacity>
                    </View>

                    {aktifTarihRandevulari.length > 0 ? (
                        <FlatList
                            data={aktifTarihRandevulari}
                            renderItem={renderRandevuItem}
                            keyExtractor={item => (item.ajandaId?.toString() ?? Math.random().toString())}
                            scrollEnabled={false}
                        />
                    ) : (
                        <View style={styles.bosRandevu}>
                            <MaterialIcons name="event-available" size={40} color="#ddd" />
                            <Text style={styles.bosRandevuText}>Bu tarih için randevu bulunmamaktadır</Text>
                        </View>
                    )}
                </View>

                {/* Ana Butonlar */}
                <View style={styles.butonlarContainer}>
                    <TouchableOpacity
                        style={styles.buton}
                        onPress={() => navigation.navigate('Ayarlar')}
                    >
                        <View style={[styles.butonIcon, { backgroundColor: '#e74c3c' }]}>
                            <Ionicons name="settings" size={24} color="white" />
                        </View>
                        <Text style={styles.butonText}>Ayarlar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.buton}
                        onPress={() => navigation.navigate('ogrenciListesi')}
                    >
                        <View style={[styles.butonIcon, { backgroundColor: '#3498db' }]}>
                            <FontAwesome5 name="user-graduate" size={24} color="white" />
                        </View>
                        <Text style={styles.butonText}>Öğrenci Listesi</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.buton}
                        onPress={() => navigation.navigate('Ajanda')}
                    >
                        <View style={[styles.butonIcon, { backgroundColor: '#2ecc71' }]}>
                            <MaterialIcons name="event-note" size={24} color="white" />
                        </View>
                        <Text style={styles.butonText}>Ajanda</Text>
                    </TouchableOpacity>
                </View>

                {/* Son Yapılan Dersler */}
                <View style={styles.derslerContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Son Yapılan Dersler</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('DersRapor')}>
                            <Text style={styles.tumunuGor}>Tümünü Gör</Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={sonDersler}
                        renderItem={renderDersItem}
                        keyExtractor={item => (item.dersId?.toString() ?? Math.random().toString())}
                        scrollEnabled={false}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingBottom: 50,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 30,
    },
    header: {
        backgroundColor: '#2c3e50',
        padding: 20,
        paddingTop: 40,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        marginBottom: 5,
    },
    headerDate: {
        fontSize: 16,
        color: '#ecf0f1',
        textAlign: 'center',
    },
    randevularContainer: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    tumunuGor: {
        color: '#3498db',
        fontWeight: '600',
    },
    tarihNavigasyon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 10,
        marginBottom: 10,
        backgroundColor: '#f8f9fa',
        borderRadius: 10,
    },
    tarihOk: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tarihContainer: {
        alignItems: 'center',
        flex: 1,
    },
    tarihText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    tarihGunText: {
        fontSize: 12,
        color: '#7f8c8d',
        marginTop: 2,
    },
    randevuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f2f6',
    },
    randevuSaat: {
        backgroundColor: '#3498db',
        padding: 8,
        borderRadius: 8,
        marginRight: 15,
        minWidth: 60,
        alignItems: 'center',
    },
    randevuSaatText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    randevuBilgi: {
        flex: 1,
    },
    randevuOgrenci: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 2,
    },
    randevuDers: {
        fontSize: 14,
        color: '#7f8c8d',
    },
    bosRandevu: {
        alignItems: 'center',
        padding: 30,
    },
    bosRandevuText: {
        marginTop: 10,
        color: '#95a5a6',
        textAlign: 'center',
    },
    butonlarContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    buton: {
        alignItems: 'center',
        width: '30%',
    },
    butonIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    butonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2c3e50',
        textAlign: 'center',
    },
    derslerContainer: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 15,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    dersItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f2f6',
    },
    dersIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ecf0f1',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    dersBilgi: {
        flex: 1,
    },
    dersOgrenci: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 2,
    },
    dersDetay: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 2,
    },
    dersTarih: {
        fontSize: 12,
        color: '#95a5a6',
    },
});
