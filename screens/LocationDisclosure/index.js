import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProminentDisclosureContent from '../../components/ProminentDisclosureContent';
import {
  LOCATION_DISCLOSURE,
  LOCATION_DISCLOSURE_KEY,
  DISCLOSURE_STORAGE_KEY,
} from '../../constants/monitoringDisclosure';

export default function LocationDisclosure({ navigation }) {
  const handleAccept = async () => {
    await AsyncStorage.setItem(LOCATION_DISCLOSURE_KEY, 'true');
    await AsyncStorage.setItem(DISCLOSURE_STORAGE_KEY, 'true');
    navigation.replace('Permission', { requestLiveLocation: true });
  };

  return (
    <ProminentDisclosureContent
      title={LOCATION_DISCLOSURE.title}
      bannerText={LOCATION_DISCLOSURE.bannerText}
      sections={LOCATION_DISCLOSURE.sections}
      checkboxLabel={LOCATION_DISCLOSURE.checkboxLabel}
      acceptLabel="I agree — enable Live Location"
      requireScrollToEnd={false}
      onDecline={() => navigation.goBack()}
      onAccept={handleAccept}
    />
  );
}
