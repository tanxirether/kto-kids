/**
 * @format
 */

import './fixWarnings';

import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';
import { handleFCMCommand } from './services/FCMCommandHandler';

import App from './App';
import { name as appName } from './app.json';

// Notifee: required when using notifications (suppresses "no background event handler" warning)
notifee.onBackgroundEvent(async () => {});

// FCM: when parent sends SCREENSHOT via /control/send-command, this runs even if app is in background/killed
const messaging = getMessaging();
setBackgroundMessageHandler(messaging, async (remoteMessage) => {
  handleFCMCommand(remoteMessage, { isBackground: true });
});

// alert: false - prevents popup when native emits "error" on service stop (e.g. Strict Mode cleanup)
ReactNativeForegroundService.register({
  config: {
    alert: false,
    onServiceErrorCallBack: () => {},
  },
});

AppRegistry.registerComponent(appName, () => App);
