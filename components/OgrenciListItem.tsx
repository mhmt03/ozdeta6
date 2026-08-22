// OgrenciListItem.tsx
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { OgrenciType } from "../types";

interface OgrenciListItemProps {
    ogrenci: OgrenciType;
    onPress: () => void;
    onLongPress: () => void;
}

const OgrenciListItem: React.FC<OgrenciListItemProps> = ({ ogrenci, onPress, onLongPress }) => {

    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.item}
        >
            <Text style={styles.text}>{ogrenci.ogrenciAd.toUpperCase()} {ogrenci.ogrenciSoyad.toUpperCase()}</Text>
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
