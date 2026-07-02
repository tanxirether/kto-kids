import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  View,
  Text,
  Image,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DISCLOSURE_STORAGE_KEY } from '../../constants/monitoringDisclosure';

const WhoseDevices = () => {
  const { width, height } = Dimensions.get("window");
  const navigation = useNavigation();

  const continueKidsFlow = async () => {
    try {
      const trackId = await AsyncStorage.getItem('trackid');
      if (trackId) {
        navigation.navigate("ConnectedScreen");
      } else {
        navigation.navigate("QRCodeScreen");
      }
    } catch (error) {
      console.error("Failed to get trackid from AsyncStorage", error);
      navigation.navigate("QRCodeScreen");
    }
  };

  const handlePressParents = async () => {
    try {
      const accepted = await AsyncStorage.getItem(DISCLOSURE_STORAGE_KEY);
      if (accepted === 'true') {
        await continueKidsFlow();
        return;
      }
      const trackId = await AsyncStorage.getItem('trackid');
      navigation.navigate('MonitoringDisclosure', {
        nextRoute: trackId ? 'ConnectedScreen' : 'QRCodeScreen',
      });
    } catch (error) {
      console.error("Failed to read disclosure state", error);
      navigation.navigate('MonitoringDisclosure', { nextRoute: 'QRCodeScreen' });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <Image
          source={require("../../assets/image1.png")}
          style={[{ width: width * 1, height: height * 0.5 }, styles.mainImage]}
          resizeMode="contain"
        />
        <Image
          source={require("../../assets/image2.png")}
          style={[{ width: width * 0.9, height: 79 }, styles.subImage]}
          resizeMode="contain"
        />
        <Text style={styles.title}>Whose device used?</Text>
        <Text style={styles.notice}>
          K.T.O Kids is a parental monitoring app for child devices. Guardian consent is required.
        </Text>
      </View>

      <View style={styles.buttonWrapper}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => handlePressParents()}>
          <Text style={styles.secondaryButtonText}>Kids’ devices</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 16,
  },
  centerContent: {
    alignItems: "center",
  },
  mainImage: {
    marginBottom: 16,
  },
  subImage: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 16,
    color: "#000",
  },
  notice: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#6B7280',
    paddingHorizontal: 8,
  },
  buttonWrapper: {
    marginTop: 20,
  },
  secondaryButton: {
    borderColor: "#9b1fe8",
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 50,
  },
  secondaryButtonText: {
    color: "#9b1fe8",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default WhoseDevices;
