import { useNavigation } from "@react-navigation/native";
import React, { useRef, useState } from "react";
import {
    View,
    Text,
    FlatList,
    Image,
    TouchableOpacity,
    Dimensions,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const slides = [
    {
        id: "1",
        title: "Welcome to KTO",
        description: "Discover amazing features in our app.",
        image: require("../../assets/onboarding.png")
    },
    {
        id: "2",
        title: "Stay Connected",
        description: "Stay in touch with your friends and family.",
        image: require("../../assets/onboarding.png")
    },
    {
        id: "3",
        title: "Get Started",
        description: "Let’s begin your journey with us today!",
        image: require("../../assets/onboarding.png")
    },
];

export default function Onboarding() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef(null);
    const navigation = useNavigation();

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current.scrollToIndex({ index: currentIndex + 1 });
        } else {
            navigation.navigate("WhoseDevices");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Slides */}
            <FlatList
                data={slides}
                ref={flatListRef}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(index);
                }}
                renderItem={({ item }) => (
                    <View style={[styles.slide, { width }]}>
                        <Image
                            source={item.image}
                            style={styles.image}
                            resizeMode="cover"
                        />
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.description}>{item.description}</Text>
                    </View>
                )}
            />

            {/* Dot Indicators */}
            <View style={styles.dotContainer}>
                {slides.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            index === currentIndex ? styles.activeDot : styles.inactiveDot
                        ]}
                    />
                ))}
            </View>

            {/* Button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity onPress={handleNext} style={styles.button}>
                    <Text style={styles.buttonText}>
                        {currentIndex === slides.length - 1 ? "Start" : "Next"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    slide: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    image: {
        width: width,
        height: height * 0.6,
        alignSelf: "center",
        resizeMode: "contain",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
        marginVertical: 8,
        textAlign: "center",
    },
    description: {
        fontSize: 16,
        color: "#6b7280", // gray-500 equivalent
        textAlign: "center",
        paddingHorizontal: 20,
    },
    dotContainer: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 24,
    },
    dot: {
        height: 8,
        width: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    activeDot: {
        backgroundColor: "#9b1fe8",
    },
    inactiveDot: {
        backgroundColor: "#d1d5db", // gray-300 equivalent
    },
    buttonContainer: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    button: {
        backgroundColor: "#9b1fe8",
        paddingVertical: 12,
        borderRadius: 30,
    },
    buttonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        textAlign: "center",
    },
});
