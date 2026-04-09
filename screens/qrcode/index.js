import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import React, { useState, useEffect } from 'react'
import instance from '../../api/api_instance';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { setLinkedTrackId } from '../../services/AccessibilityServiceBridge';


const QRCodeScreen = ({ navigation }) => {
  const [inputValue, setInputValue] = useState('')
  const [deviceId, setDeviceId] = useState({ id: null, brand: null, token: null })


  useEffect(() => {
    const getDeviceInfo = async () => {
      const id = await DeviceInfo.getUniqueId();
      const brand = DeviceInfo.getBrand();
      const token = await messaging().getToken();
      setDeviceId({ id, brand, token });

    };
    getDeviceInfo();
  }, [])


  const handleConfirm = async () => {
  if (!inputValue.trim()) return;

  try {
    const code = inputValue.trim();
    // 1️⃣ Bind device API
    const response = await instance.post('/devices/bind', {
      trackId: code,
      track_id: code,
      pairingCode: code,
      deviceId: deviceId.id,
      deviceToken: deviceId.token,
      deviceBrand: deviceId.brand,
    });

    const track_id =
      response?.data?.data?.child?.track_id ||
      response?.data?.data?.child?.trackId ||
      response?.data?.data?.track_id ||
      response?.data?.data?.trackId ||
      code;
    await AsyncStorage.setItem('trackid', String(track_id));
      await setLinkedTrackId(track_id);
      navigation.navigate('ConnectedScreen');
    

  } catch (error) {
    console.error('Error binding device:', error);
    const apiMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Failed to connect device';
    Alert.alert('Connect failed', String(apiMessage));
  }
};


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Image
            source={require("../../assets/angle-small-left.png")}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect Device</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Main Content Area */}
        <View style={styles.contentArea}>
          {/* Display Area */}
          <View style={styles.displayArea}>
            <View style={styles.codeDisplay}>
              <Text style={styles.codeLabel}>🔐 Pairing Code</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="Enter pairing code"
                placeholderTextColor="#CCCCCC"
                value={inputValue}
                onChangeText={setInputValue}
                maxLength={8}
                editable={true}
              />

            </View>
          </View>

          {/* Info Box */}

        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>


          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleConfirm}>
            <Text style={[styles.buttonText, styles.primaryButtonText]}>✓ Confirm</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 24,
  },
  keyboardView: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Display Area
  displayArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    justifyContent: 'center',
  },

  // Code Display
  codeDisplay: {
    gap: 20,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  codeInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#9B1FE8',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  codeShowBox: {
    width: '100%',
    paddingVertical: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#9B1FE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeShowText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#9B1FE8',
    letterSpacing: 4,
  },

  displayHint: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
  },

  // Info Box
  infoBox: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
  },

  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  primaryButton: {
    borderColor: '#9B1FE8',
    backgroundColor: '#9B1FE8',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666666',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
})

export default QRCodeScreen 