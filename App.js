import React, { useRef, useEffect } from "react";
import { AppState } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import notifee, { EventType } from "@notifee/react-native";
import { getMessaging, onMessage } from "@react-native-firebase/messaging";
import Onboarding from "./screens/onboarding";
import WhoseDevices from "./screens/WhoseDevices";
import QRCodeScreen from "./screens/qrcode";
import Permission from "./screens/Permission";
import ConnectedScreen from "./screens/connected";
import UsageDebug from "./screens/UsageDebug";
import { register as registerCapture, unregister as unregisterCapture, getViewShotCapture } from "./services/ScreenshotCaptureRegistry";
import { isPending, clearPending } from "./services/PendingScreenshotManager";
import { restorePendingFromStorage } from "./services/PendingCameraCaptureManager";
import { uploadScreenshot } from "./services/ScreenshotService";
import { handleFCMCommand } from "./services/FCMCommandHandler";
import { initForegroundServiceManager } from "./services/ForegroundServiceManager";
import { getTodayUsageMs } from "./services/AccessibilityServiceBridge";
import { restoreMonitoringRules, subscribeMonitoringEvents } from "./services/MonitoringRulesSync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setLinkedTrackId } from "./services/AccessibilityServiceBridge";
import { startPolicySync } from "./services/PolicySync";

const Stack = createNativeStackNavigator();

export default function App() {
  const viewShotRef = useRef(null);
  const navigationRef = useRef(null);
  const navReadyRef = useRef(false);
  const openedFromNotificationRef = useRef(false);

  useEffect(() => {
    const captureFn = () => viewShotRef.current?.capture?.();
    registerCapture(captureFn);
    const cleanup = initForegroundServiceManager();
    return () => {
      unregisterCapture();
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const t = (await AsyncStorage.getItem("trackid"))?.trim();
        if (t) await setLinkedTrackId(t);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    restoreMonitoringRules();
    const cleanup = subscribeMonitoringEvents({
      onForegroundEvent: (data) => {
        // You can forward app-open events to backend here
        // eslint-disable-next-line no-console
        console.log("AccessibilityEventDetected", data);
      },
      onKeywordDetected: (data) => {
        // You can forward keyword alerts to backend or trigger local notice here
        // eslint-disable-next-line no-console
        console.log("KeywordDetected", data);
      },
    });
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    // Poll policy so Postman updates take effect without FCM.
    const stop = startPolicySync({ intervalMs: 20000 });
    return () => stop?.();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const usage = await getTodayUsageMs();
        // eslint-disable-next-line no-console
        console.log("Today usage (ms):", usage);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("getTodayUsageMs failed:", e);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        restorePendingFromStorage().then((pending) => {
          if (pending && navReadyRef.current && navigationRef.current) {
            navigationRef.current.navigate("Permission");
          }
        });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const messaging = getMessaging();
    const unsubscribe = onMessage(messaging, (message) => {
      handleFCMCommand(message, { isBackground: false });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (!isPending()) return;
      const capture = getViewShotCapture();
      if (!capture) return;
      (async () => {
        try {
          const uri = await capture();
          const u = typeof uri === "string" ? uri : uri?.uri ?? uri?.path;
          if (u) {
            await uploadScreenshot(u);
          }
        } catch (e) {
          console.warn("Pending screenshot capture/upload failed:", e);
        } finally {
          clearPending();
        }
      })();
    });
    return () => sub.remove();
  }, []);

  return (
    <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            navReadyRef.current = true;
            restorePendingFromStorage().then((pending) => {
              if (pending && navigationRef.current) {
                navigationRef.current.navigate("Permission");
              }
            });
          }}
        >
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Onboarding" component={Onboarding} />
            <Stack.Screen name="WhoseDevices" component={WhoseDevices} />
            <Stack.Screen name="QRCodeScreen" component={QRCodeScreen} />
            <Stack.Screen name="ConnectedScreen" component={ConnectedScreen} />
            <Stack.Screen name="Permission" component={Permission} />
            <Stack.Screen name="UsageDebug" component={UsageDebug} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ViewShot>
  );
}
