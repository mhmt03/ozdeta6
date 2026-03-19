/**
 * Ajanda.js — güncelleme:
 * - Takvim hücreleri küçültüldü (CELL_HEIGHT, yazı boyutları)
 * - Header daha kompakt (padding/font boyutları azaltıldı)
 * - Takvim kapsayıcısının yüksekliği azaltıldı (takvim daha tepede)
 * - Butonlar aşağı kaydırıldı (buton konteynerine marginTop eklendi)
 *
 * Yapıştırıp kaydedin, uygulamayı yeniden başlatın.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TouchableWithoutFeedback,
    Dimensions,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

// Database util'leri (projede mevcut olan fonksiyonlar)
import { ogrencileriListele, initDatabase } from '../utils/database';
import { gunlukAjandaGetir } from '../utils/ajandaDatabase';
import { AjandaWithOgrenciType, OgrenciType } from '../types';

interface CalendarDayType {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    hasEvent: boolean;
}

/* ---------------------- Sabitler ve yardımcı fonksiyonlar --------------------- */

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = 28; // azaltıldı -> hücreler biraz daha sıkışık
const CELL_WIDTH = Math.floor((width - HORIZONTAL_PADDING) / 7);
const CELL_HEIGHT = 30; // küçültüldü: daha kompakt ızgara

const DAY_NAMES = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

/**
 * getDayIndex
 * - JavaScript Date.getDay(): 0 = Pazar ... 6 = Cumartesi
 * - Bu fonksiyon: Pazartesi=0 olacak şekilde dönüştürür
 */
const getDayIndex = (date: Date) => {
    const jsDay = date.getDay();
    return (jsDay + 6) % 7;
};

/**
 * getMonday
 * - Verilen tarihten haftanın Pazartesi gününü hesaplar.
 * - Tarih objesiyle çalışırken dikkat: setDate mutasyon yapar, bu yüzden yeni Date kopyası alıyoruz.
 */
const getMonday = (date: Date) => {
    const jsDay = date.getDay();
    const monday = new Date(date);
    if (jsDay === 0) {
        monday.setDate(date.getDate() - 6);
    } else {
        monday.setDate(date.getDate() - (jsDay - 1));
    }
    // saat dilimi/saati sorunlarını azaltmak için öğlen saatine sabitle
    monday.setHours(12, 0, 0, 0);
    return monday;
};

/* ----------------------------- Ana Bileşen ---------------------------------- */

export default function Ajanda() {
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();

    // State açıklamaları:
    // selectedDate: kullanıcı tarafından seçilmiş tarih
    // currentMonth/currentWeek: takvim görünümünü kontrol etmek için
    // isWeekView: ay/hafta görünümü toggle'ı
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [currentWeek, setCurrentWeek] = useState(getMonday(new Date()));
    const [isWeekView, setIsWeekView] = useState(false);

    // data state'leri
    const [calendarDays, setCalendarDays] = useState<CalendarDayType[]>([]); // 42 hücre veya 7 hücre
    const [randevular, setRandevular] = useState<AjandaWithOgrenciType[]>([]);
    const [ogrenciler, setOgrenciler] = useState<OgrenciType[]>([]);
    const [showOgrenciList, setShowOgrenciList] = useState(false);

    // yükleniyor göstergesi
    const [loading, setLoading] = useState(true);

    /* useEffect: component mount / dependency değişimi */
    useEffect(() => {
        // DB init sadece bir kere yapılmalı; burada çalıştırıyoruz
        initDatabase();

        // Takvim hücrelerini üret (ay/hafta görünümüne göre)
        if (isWeekView) {
            generateWeekDays();
        } else {
            generateCalendarDaysMonth();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMonth, currentWeek, isWeekView]);

    // Focus olduğunda verileri güncelle
    useEffect(() => {
        if (isFocused) {
            fetchOgrenciler();
            fetchRandevularForDate(selectedDate);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFocused]);

    // Seçilen tarih değiştiğinde randevuları çek
    useEffect(() => {
        fetchRandevularForDate(selectedDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]);

    /* --------------------------- Veritabanı çağrıları --------------------------- */

    // Öğrencileri al (async/await; try/catch)
    const fetchOgrenciler = async () => {
        setLoading(true);
        try {
            const res = await ogrencileriListele(false);
            if (res?.success) setOgrenciler(res.data || []);
        } catch (err) {
            console.error('ogrenciler alınamadı:', err);
            setOgrenciler([]);
        } finally {
            setLoading(false);
        }
    };

    // Seçili tarihe ait randevuları getirir.
    // Tarih formatı: YYYY-MM-DD (veritabanı eşleşmesi için uygun format)
    const fetchRandevularForDate = async (date: Date) => {
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;
            const res = await gunlukAjandaGetir(formattedDate);
            setRandevular((res?.data as AjandaWithOgrenciType[]) || []);
        } catch (err) {
            console.error('randevular alınamadı:', err);
            setRandevular([]);
        }
    };

    /* --------------------------- Takvim üretme fonksiyonları ------------------- */

    // Ay görünümü: 42 hücre (6x7) dolduruyoruz. Küçük hücrelerle daha az yer kaplar.
    const generateCalendarDaysMonth = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const days: CalendarDayType[] = [];
        const today = new Date();
        today.setHours(12, 0, 0, 0);

        const startDayIndex = getDayIndex(firstDayOfMonth); // Pazartesi=0

        // Önceki aydan kalan hücreler
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();

        for (let i = startDayIndex - 1; i >= 0; i--) {
            const date = new Date(prevYear, prevMonth, prevMonthLastDay - i);
            date.setHours(12, 0, 0, 0);
            days.push({ date, isCurrentMonth: false, isToday: false, hasEvent: false });
        }

        // Bu ay günleri
        for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
            const date = new Date(year, month, d);
            date.setHours(12, 0, 0, 0);
            days.push({
                date,
                isCurrentMonth: true,
                isToday: date.getTime() === today.getTime(),
                hasEvent: false,
            });
        }

        // Sonraki aydan kalan hücreler (42'yi tamamla)
        const remaining = 42 - days.length;
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        for (let i = 1; i <= remaining; i++) {
            const date = new Date(nextYear, nextMonth, i);
            date.setHours(12, 0, 0, 0);
            days.push({ date, isCurrentMonth: false, isToday: false, hasEvent: false });
        }

        setCalendarDays(days);
    };

    // Hafta görünümü: 7 hücre
    const generateWeekDays = () => {
        const days: CalendarDayType[] = [];
        const monday = new Date(currentWeek);
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            date.setHours(12, 0, 0, 0);
            days.push({
                date,
                isCurrentMonth: true,
                isToday: new Date().toDateString() === date.toDateString(),
                hasEvent: false,
            });
        }
        setCalendarDays(days);
    };

    /* --------------------------- Kullanıcı etkileşimleri ---------------------- */

    // Ayı/haftayı değiştir
    const changeMonth = (direction: number) => {
        const next = new Date(currentMonth);
        next.setMonth(next.getMonth() + direction);
        setCurrentMonth(next);

        // seçili gün farklı aydaysa ayın 1.'sine taşı (veya uygun ay seçimi)
        if (selectedDate.getMonth() !== next.getMonth() || selectedDate.getFullYear() !== next.getFullYear()) {
            setSelectedDate(new Date(next.getFullYear(), next.getMonth(), 1, 12, 0, 0));
        }
    };

    const changeWeek = (direction: number) => {
        const next = new Date(currentWeek);
        next.setDate(currentWeek.getDate() + direction * 7);
        setCurrentWeek(next);

        const newSel = new Date(selectedDate);
        newSel.setDate(selectedDate.getDate() + direction * 7);
        setSelectedDate(newSel);
    };

    // Görünüm toggle'ı: hafta/ay
    const toggleView = (value: boolean) => {
        setIsWeekView(value);
        if (value) {
            setCurrentWeek(getMonday(selectedDate));
        } else {
            setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12, 0, 0));
        }
    };

    // Gün seçimi: selectDay ile state güncellenir ve randevular çekilir
    const selectDay = async (day: CalendarDayType) => {
        // Saat dilimi sorunlarını azaltmak için öğle saatine sabitle
        const sel = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), 12, 0, 0, 0);
        setSelectedDate(sel);
        await fetchRandevularForDate(sel);
    };

    /* --------------------------- Render yardımcıları -------------------------- */

    // Randevu item render'ı (FlatList için)
    const renderRandevuItem = ({ item }: { item: AjandaWithOgrenciType }) => {
        const isCompleted = item.sutun1 === 'tamamlandı';
        return (
            <TouchableOpacity onPress={() => navigation.navigate('AjandaRandevuDuzenle', { randevu: item })}>
                <View style={[styles.randevuItem, isCompleted && styles.tamamlandiItem]}>
                    <View style={styles.randevuSaat}>
                        <Text style={styles.randevuSaatText}>{item.saat}</Text>
                    </View>
                    <View style={styles.randevuBilgi}>
                        <Text style={styles.randevuOgrenci}>{item.ogrAdsoyad}</Text>
                        {item.konu ? <Text style={styles.randevuKonu}>{item.konu}</Text> : null}
                    </View>
                    <View style={styles.randevuDurum}>
                        {isCompleted ? <MaterialIcons name="check-circle" size={20} color="#27ae60" /> : <MaterialIcons name="schedule" size={20} color="#f39c12" />}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Takvim hücresi (küçük, sade) render fonksiyonu
    const renderCalendarDay = (day: CalendarDayType, index: number) => {
        const dayDateOnly = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());
        const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        const isSelected = dayDateOnly.getTime() === selectedDateOnly.getTime();
        const dayNumber = day.date.getDate();

        return (
            <TouchableOpacity
                key={index}
                style={[
                    styles.calendarDay,
                    !day.isCurrentMonth && styles.nonCurrentMonthDay,
                    day.isToday && styles.today,
                    isSelected && styles.selectedDay,
                ]}
                onPress={() => selectDay(day)}
            >
                <Text style={[styles.dayText, !day.isCurrentMonth && styles.nonCurrentMonthText, day.isToday && styles.todayText, isSelected && styles.selectedDayText]}>
                    {dayNumber}
                </Text>
            </TouchableOpacity>
        );
    };

    /* --------------------------- Loading kontrolü ----------------------------- */

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
        );
    }

    /* --------------------------- JSX render ---------------------------------- */

    return (
        <SafeAreaView style={styles.container}>
            {/* TAKVIM BÖLÜMÜ - daha kompakt header ve az margin */}
            <View style={styles.takvimContainer}>
                <View style={styles.ustBar}>
                    <View style={styles.switchContainer}>
                        <Text style={styles.switchLabel}>Ay</Text>
                        <Switch value={isWeekView} onValueChange={toggleView} trackColor={{ false: '#ecf0f1', true: '#3498db' }} thumbColor={isWeekView ? '#ffffff' : '#bdc3c7'} />
                        <Text style={styles.switchLabel}>Hafta</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.bugunButton}
                        onPress={() => {
                            const today = new Date();
                            today.setHours(12, 0, 0, 0);
                            setSelectedDate(today);
                            if (isWeekView) setCurrentWeek(getMonday(today));
                            else setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0));
                        }}
                    >
                        <Text style={styles.bugunButtonText}>Bugün</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.ayNavigasyon}>
                    <TouchableOpacity onPress={() => (isWeekView ? changeWeek(-1) : changeMonth(-1))} style={styles.navButton}>
                        <MaterialIcons name="chevron-left" size={20} color="#2c3e50" />
                    </TouchableOpacity>

                    <Text style={styles.ayText}>{isWeekView ? `${currentWeek.getDate()} ${currentWeek.toLocaleString('tr-TR', { month: 'short' })}` : currentMonth.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })}</Text>

                    <TouchableOpacity onPress={() => (isWeekView ? changeWeek(1) : changeMonth(1))} style={styles.navButton}>
                        <MaterialIcons name="chevron-right" size={20} color="#2c3e50" />
                    </TouchableOpacity>
                </View>

                {/* Haftanın başlıkları */}
                <View style={styles.weekDaysContainer}>
                    {DAY_NAMES.map((name, i) => (
                        <Text key={i} style={styles.weekDayText}>
                            {name}
                        </Text>
                    ))}
                </View>

                {/* Takvim ızgarası: maxHeight sınırlı -> randevu listesi aşağıda görünür */}
                <View style={styles.calendarGrid}>
                    {calendarDays.map((day, index) => renderCalendarDay(day, index))}
                </View>

                <View style={styles.selectedDateContainer}>
                    <Text style={styles.selectedDateText}>
                        {selectedDate.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                </View>
            </View>

            {/* BUTONLAR - aşağı kaydırıldı (marginTop artırıldı) */}
            <View style={styles.butonlarContainer}>
                <TouchableOpacity style={[styles.ortaButon, { backgroundColor: '#3498db' }]} onPress={() => navigation.navigate('AjandaKayitEkle', { selectedDate: selectedDate.toISOString() })}>
                    <MaterialIcons name="add" size={14} color="white" />
                    <Text style={styles.ortaButonText}>Yeni Kayıt</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.ortaButon, { backgroundColor: '#e74c3c' }]} onPress={() => setShowOgrenciList(true)}>
                    <FontAwesome5 name="user-graduate" size={16} color="white" />
                    <Text style={styles.ortaButonText}>Öğrenciler</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.ortaButon, { backgroundColor: '#2ecc71' }]} onPress={() => navigation.navigate('AnaSayfa')}>
                    <MaterialIcons name="home" size={18} color="white" />
                    <Text style={styles.ortaButonText}>Ana Sayfa</Text>
                </TouchableOpacity>
            </View>

            {/* ALT: Randevu listesi */}
            <View style={styles.randevuListContainer}>
                <Text style={styles.listeBaslik}>{selectedDate.toLocaleDateString('tr-TR', { weekday: 'long' })} Randevuları</Text>

                {randevular.length > 0 ? (
                    <FlatList data={randevular} renderItem={renderRandevuItem} keyExtractor={(item) => item.ajandaId?.toString() || Math.random().toString()} contentContainerStyle={styles.listeContent} showsVerticalScrollIndicator={false} />
                ) : (
                    <View style={styles.bosListe}>
                        <MaterialIcons name="event-busy" size={44} color="#ddd" />
                        <Text style={styles.bosListeText}>Bu tarihte randevu bulunmamaktadır</Text>
                    </View>
                )}
            </View>

            {/* MODAL: Öğrenci listesi */}
            <Modal visible={showOgrenciList} transparent animationType="fade" onRequestClose={() => setShowOgrenciList(false)}>
                <TouchableWithoutFeedback onPress={() => setShowOgrenciList(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={() => { }}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Öğrenci Listesi ({ogrenciler.length})</Text>
                                {ogrenciler.length > 0 ? (
                                    <FlatList data={ogrenciler} renderItem={({ item }: { item: OgrenciType }) => (
                                        <TouchableOpacity style={styles.ogrenciItem} onPress={() => setShowOgrenciList(false)}>
                                            <Text style={styles.ogrenciText}>{item.ogrenciAd} {item.ogrenciSoyad}</Text>
                                        </TouchableOpacity>
                                    )} keyExtractor={(item) => item.ogrenciId?.toString() || Math.random().toString()} />
                                ) : (
                                    <Text style={styles.bosOgrenciText}>Kayıtlı öğrenci bulunamadı</Text>
                                )}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}

/* ------------------------------- STYLES -------------------------------------- */
/* Stil açıklamaları:
   - flex: 1 -> container'ın kalan alanı kaplamasını sağlar
   - maxHeight -> takvimin çok yer kaplamasını engeller
   - CELL_WIDTH/CELL_HEIGHT küçük tutularak daha sıkışık grid elde edildi
   - FlatList performanslıdır; ScrollView yerine tercih edin
*/
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#bed9f3ff',
        justifyContent: 'flex-start',
        padding: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#15e427ff',
    },
    loadingText: {
        marginTop: 1,
        color: '#7f8c8d',
        fontSize: 10,
    },

    takvimContainer: {
        marginTop: 1,
        backgroundColor: 'white',
        padding: 1, // küçültüldü -> header daha kompakt
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
        maxHeight: 380, // azaltıldı -> takvim daha tepede, randevu listesi görünür olur,
    },

    ustBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 1, // azaltıldı,
        backgroundColor: 'transparent',
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    switchLabel: {
        fontSize: 11, // küçültüldü
        color: '#7f8c8d',
        marginHorizontal: 6,
        fontWeight: '500',
    },
    bugunButton: {
        backgroundColor: '#ecf0f1',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 14,
    },
    bugunButtonText: {
        fontSize: 11, // küçültüldü
        color: '#2c3e50',
        fontWeight: '600',
    },

    ayNavigasyon: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    navButton: {
        padding: 6,
        borderRadius: 12,
    },
    ayText: {
        fontSize: 14, // küçültüldü
        fontWeight: '700',
        color: '#2c3e50',
        textAlign: 'center',
        flex: 1,
    },

    weekDaysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 4, // azaltıldı
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
        paddingBottom: 4,
    },
    weekDayText: {
        fontSize: 10, // küçültüldü
        fontWeight: '600',
        color: '#7f8c8d',
        width: CELL_WIDTH,
        textAlign: 'center',
    },

    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },

    calendarDay: {
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        borderRadius: 6,
    },
    nonCurrentMonthDay: {
        opacity: 0.35,
    },
    selectedDay: {
        backgroundColor: '#3498db',
    },
    today: {
        borderWidth: 1,
        borderColor: '#e74c3c',
    },
    dayText: {
        fontSize: 10, // küçültüldü
        color: '#2c3e50',
        fontWeight: '600',
    },
    nonCurrentMonthText: {
        color: '#bdc3c7',
    },
    selectedDayText: {
        color: 'white',
        fontWeight: '700',
    },
    todayText: {
        color: '#e74c3c',
        fontWeight: '700',
    },

    selectedDateContainer: {
        alignItems: 'center',
        padding: 6, // azaltıldı
        marginTop: 4, // azaltıldı
        backgroundColor: '#ecf0f1',
        borderRadius: 8,
    },
    selectedDateText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2c3e50',
    },

    butonlarContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 2,
        backgroundColor: 'white',
        marginTop: 2, // butonları aşağı kaydırmak için artırıldı
        marginHorizontal: 10,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    },
    ortaButon: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 98,
        height: 36,
        borderRadius: 18,
        flexDirection: 'row',
    },
    ortaButonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 12,
        marginLeft: 6,
    },

    randevuListContainer: {
        flex: 1,
        padding: 14,
    },
    listeBaslik: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2c3e50',
        marginBottom: 8,
        textAlign: 'center',
    },
    listeContent: {
        paddingBottom: 24,
    },

    randevuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 8,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    tamamlandiItem: {
        opacity: 0.75,
        backgroundColor: '#f8f9fa',
    },
    randevuSaat: {
        backgroundColor: '#3498db',
        padding: 6,
        borderRadius: 6,
        marginRight: 10,
        minWidth: 52,
        alignItems: 'center',
    },
    randevuSaatText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 12,
    },
    randevuBilgi: {
        flex: 1,
    },
    randevuOgrenci: {
        fontSize: 13,
        fontWeight: '700',
        color: '#2c3e50',
    },
    randevuKonu: {
        fontSize: 12,
        color: '#7f8c8d',
        marginTop: 2,
    },
    randevuDurum: {
        marginLeft: 8,
    },

    bosListe: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
    },
    bosListeText: {
        marginTop: 8,
        color: '#95a5a6',
        textAlign: 'center',
        fontSize: 13,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        width: '82%',
        maxHeight: '60%',
    },
    modalTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#2c3e50',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalList: {
        paddingBottom: 8,
    },
    ogrenciItem: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    ogrenciText: {
        fontSize: 14,
        color: '#2c3e50',
    },
    bosOgrenciText: {
        textAlign: 'center',
        color: '#95a5a6',
        fontStyle: 'italic',
        padding: 16,
    },
});

