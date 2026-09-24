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
    useWindowDimensions,
    ScrollView,
    PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

// Database util'leri (projede mevcut olan fonksiyonlar)
import { ogrencileriListele, initDatabase } from '../utils/database';
import { gunlukAjandaGetir, tarihAraligiAjandaGetir } from '../utils/ajandaDatabase';
import { getSetting, saveSetting } from '../database/settingsOperations';
import { AjandaWithOgrenciType, OgrenciType } from '../types';

interface CalendarDayType {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    hasEvent: boolean;
    eventCount?: number;
}

/* ---------------------- Sabitler ve yardımcı fonksiyonlar --------------------- */

const { width } = Dimensions.get('window');
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
    const [haftalikRandevular, setHaftalikRandevular] = useState<AjandaWithOgrenciType[]>([]);

    // yükleniyor göstergesi
    const [loading, setLoading] = useState(true);
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isLandscape = windowWidth > windowHeight;

    const [showSevenDayPopup, setShowSevenDayPopup] = useState(false);
    const [sevenDayData, setSevenDayData] = useState<{ [key: string]: AjandaWithOgrenciType[] }>({});
    const [sevenDayDates, setSevenDayDates] = useState<string[]>([]);
    const [showEventCounts, setShowEventCounts] = useState(true);

    // Kaydırma jestleri (Swipe) için PanResponder
    const panResponder = React.useMemo(() =>
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Sadece belirgin kaydırmalarda (swipe) aktif ol
                return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
            },
            onPanResponderRelease: (evt, gestureState) => {
                const { dx, dy } = gestureState;
                if (Math.abs(dx) > Math.abs(dy)) {
                    // Yatay kaydırma
                    if (dx > 50) {
                        // Sağa kaydırma -> Önceki gün
                        setSelectedDate(prev => {
                            const next = new Date(prev);
                            next.setDate(next.getDate() - 1);
                            return next;
                        });
                    } else if (dx < -50) {
                        // Sola kaydırma -> Sonraki gün
                        setSelectedDate(prev => {
                            const next = new Date(prev);
                            next.setDate(next.getDate() + 1);
                            return next;
                        });
                    }
                } else {
                    // Dikey kaydırma
                    if (dy > 50) {
                        // Aşağı kaydırma -> Önceki ay / hafta
                        if (isWeekView) changeWeek(-1);
                        else changeMonth(-1);
                    } else if (dy < -50) {
                        // Yukarı kaydırma -> Sonraki ay / hafta
                        if (isWeekView) changeWeek(1);
                        else changeMonth(1);
                    }
                }
            },
        }),
    [isWeekView]);

    /* useEffect: component mount / dependency değişimi */
    useEffect(() => {
        const loadSettings = async () => {
            const savedView = await getSetting('calendar_view', 'month');
            setIsWeekView(savedView === 'week');
        };
        loadSettings();
    }, []);

    useEffect(() => {
        // DB init sadece bir kere yapılmalı; burada çalıştırıyoruz
        initDatabase();

        const loadCalendar = async () => {
            if (isWeekView) {
                await generateWeekDays();
            } else {
                await generateCalendarDaysMonth();
            }
        };
        loadCalendar();
    }, [currentMonth, currentWeek, isWeekView, selectedDate]);

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

    const fetchSevenDayData = async () => {
        try {
            setLoading(true);
            const dates: string[] = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(selectedDate);
                d.setDate(selectedDate.getDate() + i);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                dates.push(`${year}-${month}-${day}`);
            }

            const startDate = dates[0];
            const endDate = dates[6];
            const res = await tarihAraligiAjandaGetir(startDate, endDate);

            if (res?.success) {
                const grouped: { [key: string]: AjandaWithOgrenciType[] } = {};
                dates.forEach(date => {
                    grouped[date] = (res.data as AjandaWithOgrenciType[]).filter(item => item.tarih === date);
                });
                setSevenDayData(grouped);
                setSevenDayDates(dates);
                setShowSevenDayPopup(true);
            }
        } catch (err) {
            console.error('7 günlük veri alınamadı:', err);
        } finally {
            setLoading(false);
        }
    };

    const ogrenciListesiAc = async () => {
        try {
            const monday = getMonday(selectedDate);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            
            const startStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
            const endStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
            
            const res = await tarihAraligiAjandaGetir(startStr, endStr);
            if (res?.success) {
                setHaftalikRandevular(res.data as AjandaWithOgrenciType[]);
            } else {
                setHaftalikRandevular([]);
            }
        } catch(e) {
            console.error("Haftalik randevu hatasi", e);
            setHaftalikRandevular([]);
        }
        setShowOgrenciList(true);
    };

    /* --------------------------- Takvim üretme fonksiyonları ------------------- */

    // Ay görünümü: 42 hücre (6x7) dolduruyoruz. Küçük hücrelerle daha az yer kaplar.
    const generateCalendarDaysMonth = async () => {
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
            days.push({ date, isCurrentMonth: false, isToday: false, hasEvent: false, eventCount: 0 });
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
                eventCount: 0
            });
        }

        // Sonraki aydan kalan hücreler (42'yi tamamla)
        const remaining = 42 - days.length;
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        for (let i = 1; i <= remaining; i++) {
            const date = new Date(nextYear, nextMonth, i);
            date.setHours(12, 0, 0, 0);
            days.push({ date, isCurrentMonth: false, isToday: false, hasEvent: false, eventCount: 0 });
        }

        if (days.length > 0) {
            const startDateStr = `${days[0].date.getFullYear()}-${String(days[0].date.getMonth() + 1).padStart(2, '0')}-${String(days[0].date.getDate()).padStart(2, '0')}`;
            const endDateStr = `${days[days.length - 1].date.getFullYear()}-${String(days[days.length - 1].date.getMonth() + 1).padStart(2, '0')}-${String(days[days.length - 1].date.getDate()).padStart(2, '0')}`;
            
            try {
                const eventsRes = await tarihAraligiAjandaGetir(startDateStr, endDateStr);
                if (eventsRes?.success && eventsRes.data) {
                    const eventData = eventsRes.data as AjandaWithOgrenciType[];
                    days.forEach(day => {
                        const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
                        const count = eventData.filter(e => e.tarih === dateStr).length;
                        day.eventCount = count;
                    });
                }
            } catch (error) {
                console.error("Takvim randevu sayilari alinamadi", error);
            }
        }

        setCalendarDays(days);
    };

    // Hafta görünümü: 7 hücre
    const generateWeekDays = async () => {
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
                eventCount: 0
            });
        }

        if (days.length > 0) {
            const startDateStr = `${days[0].date.getFullYear()}-${String(days[0].date.getMonth() + 1).padStart(2, '0')}-${String(days[0].date.getDate()).padStart(2, '0')}`;
            const endDateStr = `${days[days.length - 1].date.getFullYear()}-${String(days[days.length - 1].date.getMonth() + 1).padStart(2, '0')}-${String(days[days.length - 1].date.getDate()).padStart(2, '0')}`;
            
            try {
                const eventsRes = await tarihAraligiAjandaGetir(startDateStr, endDateStr);
                if (eventsRes?.success && eventsRes.data) {
                    const eventData = eventsRes.data as AjandaWithOgrenciType[];
                    days.forEach(day => {
                        const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
                        const count = eventData.filter(e => e.tarih === dateStr).length;
                        day.eventCount = count;
                    });
                }
            } catch (error) {
                console.error("Takvim randevu sayilari alinamadi", error);
            }
        }

        setCalendarDays(days);
    };

    /* --------------------------- Kullanıcı etkileşimleri ---------------------- */

    // Ayı/haftayı değiştir
    const changeMonth = (direction: number) => {
        setCurrentMonth(prevMonth => {
            const next = new Date(prevMonth);
            next.setMonth(next.getMonth() + direction);
            
            // seçili gün farklı aydaysa ayın 1.'sine taşı
            setSelectedDate(prevSel => {
                if (prevSel.getMonth() !== next.getMonth() || prevSel.getFullYear() !== next.getFullYear()) {
                    return new Date(next.getFullYear(), next.getMonth(), 1, 12, 0, 0);
                }
                return prevSel;
            });

            return next;
        });
    };

    const changeWeek = (direction: number) => {
        setCurrentWeek(prevWeek => {
            const next = new Date(prevWeek);
            next.setDate(prevWeek.getDate() + direction * 7);
            return next;
        });

        setSelectedDate(prevSel => {
            const newSel = new Date(prevSel);
            newSel.setDate(prevSel.getDate() + direction * 7);
            return newSel;
        });
    };

    // Görünüm toggle'ı: hafta/ay
    const toggleView = async (value: boolean) => {
        setIsWeekView(value);
        await saveSetting('calendar_view', value ? 'week' : 'month');
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

        // Seçilen tarih mevcut görünümdeki aydan farklı ise takvim ayını güncelle
        if (sel.getMonth() !== currentMonth.getMonth() || sel.getFullYear() !== currentMonth.getFullYear()) {
            setCurrentMonth(new Date(sel.getFullYear(), sel.getMonth(), 1, 12, 0, 0));
        }

        // Hafta görünümündeyse haftayı da güncelle
        if (isWeekView) {
            setCurrentWeek(getMonday(sel));
        }

        await fetchRandevularForDate(sel);
    };

    /* --------------------------- Render yardımcıları -------------------------- */

    // Randevu item render'ı (FlatList için)
    const renderRandevuItem = ({ item }: { item: AjandaWithOgrenciType }) => {
        const isCompleted = item.dersYapildiMi === 1 || item.tamamlandiMi === 1 || item.tamamlanma === '1' || item.sutun1 === 'tamamlandı';
        const isCancelled = item.iptal === 1;

        return (
            <TouchableOpacity onPress={() => navigation.navigate('AjandaRandevuDuzenle', { randevu: item })}>
                <View style={[
                    styles.eventCard,
                    isCompleted && styles.completedEvent,
                    isCancelled && styles.cancelledEvent
                ]}>
                    <View style={styles.eventInfo}>
                        <View style={styles.nameRow}>
                            <Text style={[
                                styles.eventTitle,
                                isCompleted && styles.completedText,
                                isCancelled && styles.cancelledText
                            ]}>
                                {item.ogrAdsoyad} {isCancelled && <Text style={styles.iptalBadge}>(İPTAL)</Text>}
                            </Text>
                            {item.kalanTekrarSayisi && <Text style={styles.remainingText}>(Kalan: {item.kalanTekrarSayisi})</Text>}
                        </View>
                        <Text style={styles.eventTime}>{item.saat}</Text>
                        {item.konu ? <Text style={styles.randevuKonu}>{item.konu}</Text> : null}
                    </View>
                    <View style={styles.randevuDurum}>
                        {isCompleted ? (
                            <MaterialIcons name="check-circle" size={20} color="#27ae60" />
                        ) : (
                            <MaterialIcons name="schedule" size={20} color="#f39c12" />
                        )}
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
                {showEventCounts && day.eventCount && day.eventCount > 0 ? (
                    <View style={styles.eventCountBadge}>
                        <Text style={styles.eventCountText}>{day.eventCount}</Text>
                    </View>
                ) : null}
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

                    <TouchableOpacity
                        style={[styles.bugunButton, { backgroundColor: '#3498db' }]}
                        onPress={fetchSevenDayData}
                    >
                        <Text style={[styles.bugunButtonText, { color: 'white' }]}>7 Günlük</Text>
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
                <View style={styles.calendarGrid} {...panResponder.panHandlers}>
                    {calendarDays.map((day, index) => renderCalendarDay(day, index))}
                </View>

                <View style={styles.selectedDateContainer}>
                    <TouchableOpacity onPress={() => {
                        const prev = new Date(selectedDate);
                        prev.setDate(prev.getDate() - 1);
                        selectDay({ date: prev, isCurrentMonth: true, isToday: false, hasEvent: false });
                    }}>
                        <MaterialIcons name="chevron-left" size={34} color="#fa1818ff" />
                    </TouchableOpacity>

                    <Text style={styles.selectedDateText}>
                        {selectedDate.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>

                    <TouchableOpacity onPress={() => {
                        const next = new Date(selectedDate);
                        next.setDate(next.getDate() + 1);
                        selectDay({ date: next, isCurrentMonth: true, isToday: false, hasEvent: false });
                    }}>
                        <MaterialIcons name="chevron-right" size={34} color="#fa1818ff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* BUTONLAR - aşağı kaydırıldı (marginTop artırıldı) */}
            <View style={styles.butonlarContainer}>
                <TouchableOpacity style={[styles.ortaButon, { backgroundColor: '#3498db' }]} onPress={() => navigation.navigate('AjandaKayitEkle', { selectedDate: selectedDate.toISOString() })}>
                    <MaterialIcons name="add" size={16} color="white" />
                    <Text style={styles.ortaButonText}>Yeni Kayıt</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.iconButon, { backgroundColor: '#e74c3c' }]} onPress={ogrenciListesiAc}>
                    <FontAwesome5 name="user-graduate" size={16} color="white" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.iconButon, { backgroundColor: '#9b59b6' }]} onPress={() => setShowEventCounts(!showEventCounts)}>
                    <MaterialIcons name={showEventCounts ? "visibility" : "visibility-off"} size={20} color="white" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.iconButon, { backgroundColor: '#2ecc71' }]} onPress={() => navigation.navigate('AnaSayfa')}>
                    <MaterialIcons name="home" size={22} color="white" />
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
                                    <FlatList data={ogrenciler} renderItem={({ item, index }: { item: OgrenciType, index: number }) => {
                                        const ogrenciRandevulari = haftalikRandevular.filter(r => r.ogrenciId === item.ogrenciId && r.iptal !== 1);
                                        let baloncukRengi = null;
                                        if (ogrenciRandevulari.length > 0) {
                                            const seciliTarihSifirlanmis = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
                                            const hasFutureOrToday = ogrenciRandevulari.some(r => {
                                                if (!r.tarih) return false;
                                                const rDate = new Date(r.tarih);
                                                const rDateSifirlanmis = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate()).getTime();
                                                return rDateSifirlanmis >= seciliTarihSifirlanmis;
                                            });
                                            baloncukRengi = hasFutureOrToday ? '#2ecc71' : '#f1c40f'; // yeşil (sonra/bugün) veya sarı (önce)
                                        }

                                        return (
                                            <TouchableOpacity 
                                                style={[styles.ogrenciItem, { backgroundColor: index % 2 === 0 ? '#f8f9fa' : '#ffffff', paddingHorizontal: 12, borderRadius: 6 }]} 
                                                onPress={() => { setShowOgrenciList(false); navigation.navigate('ogrenciDetay', { ogrenci: item }); }}
                                            >
                                                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                                                    <Text style={styles.ogrenciText}>{item.ogrenciAd} {item.ogrenciSoyad}</Text>
                                                    {baloncukRengi && (
                                                        <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: baloncukRengi, marginLeft: 8}} />
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }} keyExtractor={(item) => item.ogrenciId?.toString() || Math.random().toString()} />
                                ) : (
                                    <Text style={styles.bosOgrenciText}>Kayıtlı öğrenci bulunamadı</Text>
                                )}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
            {/* MODAL: 7 Günlük Randevu Listesi */}
            <Modal visible={showSevenDayPopup} transparent animationType="fade" onRequestClose={() => setShowSevenDayPopup(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.sevenDayModalContent, isLandscape && styles.landscapeModal]}>
                        {/* Header */}
                        <View style={styles.sevenDayHeader}>
                            <Text style={styles.sevenDayTitle}>7 Günlük Program</Text>
                            <TouchableOpacity onPress={() => setShowSevenDayPopup(false)} style={[styles.closeButton, { marginRight: isLandscape ? 40 : 15, backgroundColor: isLandscape ? '#98fa94ff' : '#29b6f7ff' }]}>
                                <MaterialIcons name="close" size={24} color="#2c3e50" />
                            </TouchableOpacity>

                        </View>

                        <ScrollView
                            horizontal={isLandscape}
                            showsVerticalScrollIndicator={!isLandscape}
                            showsHorizontalScrollIndicator={isLandscape}
                        >
                            <View style={[styles.sevenDayContainer, isLandscape && styles.landscapeContainer]}>
                                {sevenDayDates.map((dateStr) => {
                                    const dateObj = new Date(dateStr);
                                    const dayName = dateObj.toLocaleDateString('tr-TR', { weekday: 'short' });
                                    const dayNum = dateObj.getDate();
                                    const appointments = sevenDayData[dateStr] || [];

                                    if (isLandscape) {
                                        // YATAY (Landscape): Günler yan yana, Randevular alt alta
                                        return (
                                            <View key={dateStr} style={styles.landscapeDayColumn}>
                                                <View style={styles.dayHeaderBox}>
                                                    <Text style={styles.dayNameText}>{dayName}</Text>
                                                    <Text style={styles.dayNumText}>{dayNum}</Text>
                                                </View>
                                                <View style={styles.appsVerticalList}>
                                                    {appointments.length > 0 ? (
                                                        appointments.sort((a, b) => a.saat.localeCompare(b.saat)).map((app, idx) => (
                                                            <View key={idx} style={styles.appCardVertical}>
                                                                <Text style={styles.appTimeText}>{app.saat}</Text>
                                                                <Text style={styles.appStudentTextAbbr} numberOfLines={1}>
                                                                    {(() => {
                                                                        const parts = app.ogrAdsoyad?.split(' ') || [];
                                                                        if (parts.length < 2) return app.ogrAdsoyad;
                                                                        const firstName = parts.slice(0, -1).join(' ');
                                                                        const lastName = parts[parts.length - 1];
                                                                        return `${firstName} ${lastName[0]}.`;
                                                                    })()}
                                                                </Text>
                                                            </View>
                                                        ))
                                                    ) : (
                                                        <Text style={styles.noAppText}>-</Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    } else {
                                        // DIKEY (Portrait): Günler alt alta, Randevular yan yana (scrollable)
                                        return (
                                            <View key={dateStr} style={styles.portraitDayRow}>
                                                <View style={styles.dayInfoLeft}>
                                                    <Text style={styles.dayNameTextRow}>{dayName}</Text>
                                                    <Text style={styles.dayNumTextRow}>{dayNum}</Text>
                                                </View>
                                                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.appsHorizontalList}>
                                                    {appointments.length > 0 ? (
                                                        appointments.sort((a, b) => a.saat.localeCompare(b.saat)).map((app, idx) => (
                                                            <View key={idx} style={styles.appCardHorizontal}>
                                                                <Text style={styles.appTimeText}>{app.saat}</Text>
                                                            </View>
                                                        ))
                                                    ) : (
                                                        <Text style={styles.noAppTextSmall}>Randevu yok</Text>
                                                    )}
                                                </ScrollView>
                                            </View>
                                        );
                                    }
                                })}
                            </View>
                        </ScrollView>
                        <Text style={{ textAlign: 'center', color: '#7f8c8d', fontSize: 10 }}> {isLandscape ? "Dar görünüm için dik çevir..." : "Geniş görünüm için yan çevir..."}</Text>
                    </View>
                </View>
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
        backgroundColor: '#F8F9FA', // modern soft light gray
        justifyContent: 'flex-start',
        padding: 0,
        paddingTop: 0,
        marginTop: -10, // Üstteki boşluğu azaltmak için
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    loadingText: {
        marginTop: 1,
        color: '#7f8c8d',
        fontSize: 10,
    },

    takvimContainer: {
        marginTop: 0,
        backgroundColor: '#FFFFFF', // clean white
        padding: 0, 
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: '#4A5568',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        maxHeight: 370, // daha da azaltıldı, sarkmayı önlemek için
    },

    ustBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2, 
        paddingHorizontal: 8,
        paddingTop: 2,
        backgroundColor: 'transparent',
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    switchLabel: {
        fontSize: 11, // küçültüldü
        color: '#6445eeff',
        marginHorizontal: 6,
        fontWeight: '500',
    },
    bugunButton: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 10,
    },
    bugunButtonText: {
        fontSize: 11, 
        color: '#475569',
        fontWeight: '600',
    },

    ayNavigasyon: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
        paddingHorizontal: 10,
    },
    navButton: {
        padding: 4,
        borderRadius: 10,
        margin: 0,
        width: 40,
        height: 28,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ayText: {
        fontSize: 13, 
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
        flex: 1,
    },

    weekDaysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 2, 
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingBottom: 2,
    },
    weekDayText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#7f8c8d',
        width: '14.28%', // Yüzde ile 7 eşit parça
        textAlign: 'center',
    },

    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },

    calendarDay: {
        width: '14.28%', // Yüzde ile 7 eşit parça
        height: CELL_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
        borderRadius: 8,
    },
    nonCurrentMonthDay: {
        opacity: 0.4,
    },
    selectedDay: {
        backgroundColor: '#6366F1', // elegant indigo
    },
    today: {
        borderWidth: 1,
        borderColor: '#F43F5E', // soft rose
    },
    dayText: {
        fontSize: 10, 
        color: '#334155',
        fontWeight: '600',
    },
    nonCurrentMonthText: {
        color: '#94A3B8',
    },
    selectedDayText: {
        color: 'white',
        fontWeight: 'bold',
    },
    todayText: {
        color: '#F43F5E',
        fontWeight: 'bold',
    },
    eventCountBadge: {
        position: 'absolute',
        top: 1,
        right: 1,
        backgroundColor: '#F43F5E',
        borderRadius: 7,
        width: 14,
        height: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    eventCountText: {
        color: 'white',
        fontSize: 9,
        fontWeight: 'bold',
    },

    selectedDateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
        paddingHorizontal: 10,
        marginTop: 2,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        marginHorizontal: 8,
        marginBottom: 4,
    },
    selectedDateText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2c3e50',
        flex: 1,
        textAlign: 'center',
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
        paddingHorizontal: 16,
        height: 36,
        borderRadius: 18,
        flexDirection: 'row',
    },
    iconButon: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 18,
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
        paddingBottom: 80,
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
    randevuBaslikSatir: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    kalanTekrarText: {
        fontSize: 11,
        color: '#e67e22',
        fontWeight: '600',
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
    eventCard: {
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
    completedEvent: {
        backgroundColor: '#f8f9fa',
        borderLeftColor: '#27ae60',
    },
    cancelledEvent: {
        backgroundColor: '#ffebee',
        borderLeftColor: '#e74c3c',
    },
    eventInfo: {
        flex: 1,
        marginLeft: 5,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    eventTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#2c3e50',
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#888',
    },
    cancelledText: {
        color: '#c0392b',
        fontStyle: 'italic',
    },
    iptalBadge: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#e74c3c',
        marginLeft: 4,
    },
    remainingText: {
        fontSize: 11,
        color: '#e67e22',
        fontWeight: '600',
        marginLeft: 4,
    },
    eventTime: {
        fontSize: 12,
        color: '#7f8c8d',
        marginTop: 2,
    },

    // 7 GÜNLÜK POPUP STİLLERİ
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)', // Daha koyu yarı saydam arka plan
        justifyContent: 'center',
        alignItems: 'center',
    },
    sevenDayModalContent: {
        backgroundColor: 'white', // Tam opak beyaz arka plan
        borderRadius: 24,
        padding: 10,
        width: '94%',
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    landscapeModal: {
        width: '96%',
        maxHeight: '94%',
    },
    sevenDayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 2,
        borderBottomColor: '#8b878bff',
        paddingBottom: 10,
    },
    sevenDayTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#2c3e50',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    closeButton: {
        padding: 4,
        backgroundColor: '#4c6ff8ff',
        borderRadius: 20,
        marginRight: 40,
    },
    sevenDayContainer: {
        paddingBottom: 20,
    },
    landscapeContainer: {
        flexDirection: 'row',
    },
    // Portrait (Dikey) - Günler alt alta, Randevular yan yana
    portraitDayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        marginBottom: 12,
        borderRadius: 12,
        padding: 5,
        borderWidth: 1,
        borderColor: '#edf2f7',
        // Gölgelendirme
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    dayInfoLeft: {
        width: 35,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: '#edf2f7',
        paddingRight: 10,
        marginRight: 10,
    },
    dayNameTextRow: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#7f8c8d',
        textTransform: 'uppercase',
    },
    dayNumTextRow: {
        fontSize: 9,
        fontWeight: '900',
        color: '#3498db',
    },
    appsHorizontalList: {
        alignItems: 'center',
    },
    appCardHorizontal: {
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#bbdefb',
    },
    noAppTextSmall: {
        fontSize: 11,
        color: '#bdc3c7',
        fontStyle: 'italic',
    },
    // Landscape (Yatay) - Günler yan yana, Randevular alt alta
    landscapeDayColumn: {
        width: 80, // Küçültüldü
        marginRight: 3, // Küçültüldü
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 2, // Küçültüldü
        borderWidth: 1,
        borderColor: '#e2e5e9ff',
        minHeight: 120, // Küçültüldü
    },
    dayHeaderBox: {
        alignItems: 'center',
        marginBottom: 8, // Küçültüldü
        borderBottomWidth: 1,
        borderBottomColor: '#f1f2f6',
        paddingBottom: 4, // Küçültüldü
    },
    dayNameText: {
        fontSize: 10, // Küçültüldü
        fontWeight: 'bold',
        color: '#7f8c8d',
        textTransform: 'uppercase',
    },
    dayNumText: {
        fontSize: 9, // Küçültüldü
        fontWeight: '900',
        color: '#3498db',
    },
    appsVerticalList: {
        width: '100%',
    },
    appCardVertical: {
        backgroundColor: '#f1f8ff', // Hafif mavi tonu
        padding: 2, // Küçültüldü
        borderRadius: 6, // Küçültüldü
        marginBottom: 6, // Küçültüldü
        borderWidth: 1,
        borderColor: '#d0e1f9',
        alignItems: 'center',
    },
    appTimeText: {
        fontSize: 11, // Küçültüldü
        fontWeight: 'bold',
        color: '#1976d2',
    },
    appStudentTextAbbr: {
        fontSize: 8, // Küçültüldü
        color: '#546e7a',
        marginTop: 1, // Küçültüldü
        textAlign: 'center',
        fontWeight: '600',
    },
    noAppText: {
        fontSize: 12,
        color: '#bdc3c7',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
