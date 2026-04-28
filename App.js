import React, { useRef, useEffect } from "react";
import { AppState, Dimensions, StatusBar, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
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
import { startLocationSync } from "./services/LocationSyncService";
import { sendFamilyActivityAlert } from "./services/FamilyAlertNotification";
import { recordKeywordActivityContext } from "./services/MonitoringSnapshotService";
import { configureScreenShareRealtime, initScreenShareRuntime } from "./services/ScreenShareService";

const Stack = createNativeStackNavigator();

/** Opaque backgrounds — transparent navigator + native stack defaults can look “blank” on Android. */
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#ffffff",
    card: "#ffffff",
  },
};

const { width: initialWindowW, height: initialWindowH } = Dimensions.get("window");
/** Ensures SafeAreaProvider always has insets on first paint (otherwise it renders null until native fires). */
const safeAreaInitialMetrics =
  initialWindowMetrics ?? {
    frame: { x: 0, y: 0, width: initialWindowW, height: initialWindowH },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  };

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
        // eslint-disable-next-line no-console
        console.log("KeywordDetected", data);
        recordKeywordActivityContext(data);
        sendFamilyActivityAlert();
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
    const stop = startLocationSync();
    return () => stop?.();
  }, []);

  useEffect(() => {
    configureScreenShareRealtime({
      key: "deca346055651392a9a6",
      cluster: "ap4",
      forceTLS: true,
      enabledTransports: ["ws", "wss"],
    });
  }, []);

  useEffect(() => {
    const stop = initScreenShareRuntime();
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
    <ViewShot
      ref={viewShotRef}
      options={{ format: "jpg", quality: 0.9 }}
      style={{ flex: 1, backgroundColor: "#ffffff" }}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaProvider style={{ flex: 1 }} initialMetrics={safeAreaInitialMetrics}>
        <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
          <NavigationContainer
            ref={navigationRef}
            theme={navigationTheme}
            onReady={() => {
              navReadyRef.current = true;
              restorePendingFromStorage().then((pending) => {
                if (pending && navigationRef.current) {
                  navigationRef.current.navigate("Permission");
                }
              });
            }}
          >
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                animation: "default",
                contentStyle: { flex: 1, backgroundColor: "#ffffff" },
              }}
            >
              <Stack.Screen name="Onboarding" component={Onboarding} />
            <Stack.Screen name="WhoseDevices" component={WhoseDevices} />
            <Stack.Screen name="QRCodeScreen" component={QRCodeScreen} />
            <Stack.Screen name="ConnectedScreen" component={ConnectedScreen} />
            <Stack.Screen name="Permission" component={Permission} />
            <Stack.Screen name="UsageDebug" component={UsageDebug} />
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </SafeAreaProvider>
    </ViewShot>
  );
}
