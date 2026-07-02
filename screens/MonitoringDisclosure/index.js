import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProminentDisclosureContent from '../../components/ProminentDisclosureContent';
import {
  DISCLOSURE_STORAGE_KEY,
  MONITORING_DISCLOSURE,
} from '../../constants/monitoringDisclosure';
import { notifyMonitoringConsentGranted } from '../../services/MonitoringConsentGate';

export default function MonitoringDisclosure({ navigation, route }) {
  const nextRoute = route.params?.nextRoute || 'WhoseDevices';

  const handleAccept = async () => {
    await AsyncStorage.setItem(DISCLOSURE_STORAGE_KEY, 'true');
    await notifyMonitoringConsentGranted();
    if (nextRoute === 'goBack') {
      navigation.goBack();
      return;
    }
    navigation.replace(nextRoute);
  };

  return (
    <ProminentDisclosureContent
      title={MONITORING_DISCLOSURE.title}
      bannerText={MONITORING_DISCLOSURE.bannerText}
      sections={MONITORING_DISCLOSURE.sections}
      checkboxLabel={MONITORING_DISCLOSURE.checkboxLabel}
      acceptLabel="I agree — continue setup"
      onDecline={() => navigation.goBack()}
      onAccept={handleAccept}
    />
  );
}
