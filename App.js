import React, { useRef, useEffect } from "react";
import { AppState, StatusBar, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import { getMessaging, onMessage } from "@react-native-firebase/messaging";
import Onboarding from "./screens/onboarding";
import WhoseDevices from "./screens/WhoseDevices";
import QRCodeScreen from "./screens/qrcode";
import Permission from "./screens/Permission";
import ConnectedScreen from "./screens/connected";
import UsageDebug from "./screens/UsageDebug";
import MonitoringDisclosure from "./screens/MonitoringDisclosure";
import AccessibilityDisclosure from "./screens/AccessibilityDisclosure";
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
import { createMonitoringGate, hasMonitoringConsent } from "./services/MonitoringConsentGate";

const Stack = createNativeStackNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#ffffff",
    card: "#ffffff",
  },
};

export default function App() {
  const viewShotRef = useRef(null);
  const navigationRef = useRef(null);
  const navReadyRef = useRef(false);
  const monitoringGateRef = useRef(null);

  useEffect(() => {
    const captureFn = () => viewShotRef.current?.capture?.();
    registerCapture(captureFn);
    return () => unregisterCapture();
  }, []);

  useEffect(() => {
    monitoringGateRef.current = createMonitoringGate(() => {
      const fgCleanup = initForegroundServiceManager();
      const rulesCleanup = restoreMonitoringRules();
      const eventsCleanup = subscribeMonitoringEvents({
        onForegroundEvent: (data) => {
          console.log("AccessibilityEventDetected", data);
        },
        onKeywordDetected: (data) => {
          console.log("KeywordDetected", data);
          recordKeywordActivityContext(data);
          sendFamilyActivityAlert();
        },
      });
      const policyStop = startPolicySync({ intervalMs: 20000 });
      const locationStop = startLocationSync();
      const screenShareStop = initScreenShareRuntime();

      return () => {
        fgCleanup?.();
        rulesCleanup?.();
        eventsCleanup?.();
        policyStop?.();
        locationStop?.();
        screenShareStop?.();
      };
    });

    monitoringGateRef.current.start();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        monitoringGateRef.current?.start();
      }
    });

    return () => {
      sub.remove();
      monitoringGateRef.current?.stop();
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
    configureScreenShareRealtime({
      key: "deca346055651392a9a6",
      cluster: "ap4",
      forceTLS: true,
      enabledTransports: ["ws", "wss"],
    });
  }, []);

  useEffect(() => {
    (async () => {
      if (!(await hasMonitoringConsent())) return;
      try {
        const usage = await getTodayUsageMs();
        console.log("Today usage (ms):", usage);
      } catch (e) {
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
      <SafeAreaProvider style={{ flex: 1 }} initialMetrics={initialWindowMetrics}>
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
              <Stack.Screen
                name="MonitoringDisclosure"
                component={MonitoringDisclosure}
                options={{ gestureEnabled: false }}
              />
              <Stack.Screen
                name="AccessibilityDisclosure"
                component={AccessibilityDisclosure}
                options={{ gestureEnabled: false }}
              />
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
