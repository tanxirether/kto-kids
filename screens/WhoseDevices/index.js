import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProminentDisclosureModal from '../../components/ProminentDisclosureModal';
import {
  DISCLOSURE_STORAGE_KEY,
  MONITORING_DISCLOSURE,
} from '../../constants/monitoringDisclosure';

const WhoseDevices = () => {
  const { width, height } = Dimensions.get("window");
  const navigation = useNavigation();
  const [showDisclosure, setShowDisclosure] = useState(false);

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
      setShowDisclosure(true);
    } catch (error) {
      console.error("Failed to read disclosure state", error);
      setShowDisclosure(true);
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
      </View>

      {/* <View style={styles.buttonWrapper}>
        <TouchableOpacity
          onPress={() => navigation.navigate("Auth")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Parents’ devices</Text>
        </TouchableOpacity> */}
      {/* </View> */}

      <View style={styles.buttonWrapper}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => handlePressParents()}>
          <Text style={styles.secondaryButtonText}>Kids’ devices</Text>
        </TouchableOpacity>
      </View>

      <ProminentDisclosureModal
        visible={showDisclosure}
        title={MONITORING_DISCLOSURE.title}
        sections={MONITORING_DISCLOSURE.sections}
        checkboxLabel={MONITORING_DISCLOSURE.checkboxLabel}
        onDecline={() => setShowDisclosure(false)}
        onAccept={async () => {
          await AsyncStorage.setItem(DISCLOSURE_STORAGE_KEY, 'true');
          setShowDisclosure(false);
          await continueKidsFlow();
        }}
      />
    </SafeAreaView>
  );
}

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
  buttonWrapper: {
    marginTop: 20,
  },
  primaryButton: {
    backgroundColor: "#9b1fe8",
    paddingVertical: 12,
    borderRadius: 50,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
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
