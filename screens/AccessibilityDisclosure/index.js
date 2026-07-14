import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProminentDisclosureContent from '../../components/ProminentDisclosureContent';
import { openAccessibilitySettings } from '../../services/AccessibilityServiceBridge';
import {
  ACCESSIBILITY_DISCLOSURE,
  ACCESSIBILITY_DISCLOSURE_KEY,
  DISCLOSURE_STORAGE_KEY,
} from '../../constants/monitoringDisclosure';

export default function AccessibilityDisclosure({ navigation }) {
  const handleAccept = async () => {
    await AsyncStorage.setItem(ACCESSIBILITY_DISCLOSURE_KEY, 'true');
    await AsyncStorage.setItem(DISCLOSURE_STORAGE_KEY, 'true');
    openAccessibilitySettings();
    navigation.goBack();
  };

  return (
    <ProminentDisclosureContent
      title={ACCESSIBILITY_DISCLOSURE.title}
      bannerText={ACCESSIBILITY_DISCLOSURE.bannerText}
      sections={ACCESSIBILITY_DISCLOSURE.sections}
      checkboxLabel={ACCESSIBILITY_DISCLOSURE.checkboxLabel}
      dataTypesLabel={ACCESSIBILITY_DISCLOSURE.dataTypesLabel}
      dataTypes={ACCESSIBILITY_DISCLOSURE.dataTypes}
      acceptLabel="Continue — open Accessibility settings"
      requireScrollToEnd
      onDecline={() => navigation.goBack()}
      onAccept={handleAccept}
    />
  );
}
