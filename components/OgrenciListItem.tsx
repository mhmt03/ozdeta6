// OgrenciListItem.tsx
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { OgrenciType } from "../types";

interface OgrenciListItemProps {
    ogrenci: OgrenciType;
    onPress: () => void;
    onEdit: (ogrenci: OgrenciType) => void;
    onDelete: (id: number) => void;
}

const OgrenciListItem: React.FC<OgrenciListItemProps> = ({ ogrenci, onPress, onEdit, onDelete }) => {
    const handleLongPress = () => {
        Alert.alert(
            "Öğrenci İşlemleri",
            `${ogrenci.ogrenciAd} için işlem seçin`,
            [
                { text: "Düzenle", onPress: () => onEdit(ogrenci) },
                { text: "Sil", onPress: () => onDelete(ogrenci.ogrenciId!), style: "destructive" },
                { text: "İptal", style: "cancel" }
            ]
        );
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={handleLongPress}
            style={styles.item}
        >
            <Text style={styles.text}>{ogrenci.ogrenciAd} {ogrenci.ogrenciSoyad}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    item: {
        padding: 15,
        marginVertical: 6,
        marginHorizontal: 12,
        backgroundColor: "#fff",
        borderRadius: 8,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2
    },
    text: {
        fontSize: 16,
        color: "#2c3e50"
    }
});

export default OgrenciListItem;
