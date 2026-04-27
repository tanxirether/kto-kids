import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  PermissionsAndroid,
  Linking,
  AppState,
  NativeModules,
  Alert,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { check, PERMISSIONS, RESULTS } from 'react-native-permissions'
import { Camera, useCameraDevice, useCameraFormat } from 'react-native-vision-camera'
import ViewShot from 'react-native-view-shot'
import notifee, { AndroidImportance } from '@notifee/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { register as registerCameraCapture, unregister as unregisterCameraCapture } from '../../services/CameraCaptureRegistry'
import { getPending as getPendingCameraCapture, clearPending as clearPendingCameraCapture } from '../../services/PendingCameraCaptureManager'
import { uploadCameraPhoto } from '../../services/CameraPhotoService'
import { debugStartForegroundService, debugStopForegroundService } from '../../services/ForegroundServiceManager'
import { isAccessibilityEnabled, openAccessibilitySettings, hasUsageAccess, openUsageAccessSettings } from '../../services/AccessibilityServiceBridge'
import { getScreenShareState, startScreenShare, stopScreenShare } from '../../services/ScreenShareService'
import { getScreenShareRuntimeState } from '../../services/ScreenShareService'
import { getWebRTCScreenShareLogs } from '../../services/ScreenShareWebRTC'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

const { ScreenLock, ScreenCaptureModule } = NativeModules

const Permission = ({ navigation }) => {

  const cameraRef = useRef(null)
  const frontDevice = useCameraDevice('front')
  const backDevice = useCameraDevice('back')
  const viewShotRef = useRef(null)
  /* ================= STATE ================= */

  const [permissions, setPermissions] = useState({
    accessibilityService: false,
    usageLimits: false,
    displayOverApps: false,
    remoteCamera: false,
    oneWayAudio: false,
    liveLocation: false,
    usageReport: false,
    keepBackground: false,
    superBattery: false,
    /** Android: MediaProjection screen-capture consent for parent screen view / casting */
    screenCasting: Platform.OS !== 'android',
  })
  const [cameraError, setCameraError] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [activeCameraType, setActiveCameraType] = useState('front')
  const [pendingCapture, setPendingCapture] = useState(null)
  const [screenShareStatus, setScreenShareStatus] = useState('idle')
  const [screenShareRuntime, setScreenShareRuntime] = useState(null)
  const [screenShareLogs, setScreenShareLogs] = useState([])
  const isCapturingRef = useRef(false)
  const captureResolveRef = useRef(null)

  const device = activeCameraType === 'back' && backDevice ? backDevice : frontDevice
  const format = useCameraFormat(device, [{ photoResolution: { width: 1280, height: 720 } }])

  /* ================= HELPERS ================= */

  const updatePermission = (key, value) => {
    setPermissions(prev => ({ ...prev, [key]: value }))
  }

  /* ================= FCM COMMAND HANDLER (foreground) ================= */

  const takePhotoAndUpload = async (cameraType) => {
    if (isCapturingRef.current || !device) return
    if (!cameraRef.current) {
      setPendingCapture(null)
      captureResolveRef.current?.()
      captureResolveRef.current = null
      return
    }
    if (!cameraReady) {
      setPendingCapture(cameraType)
      if (activeCameraType !== cameraType && (cameraType === 'back' ? backDevice : frontDevice)) {
        setActiveCameraType(cameraType)
      }
      captureResolveRef.current?.()
      captureResolveRef.current = null
      return
    }
    isCapturingRef.current = true
    try {
      const photo = await cameraRef.current.takePhoto({ enableShutterSound: false })
      const path = photo?.path || photo?.uri
      if (path) {
        await uploadCameraPhoto(path, cameraType)
        console.log('Photo captured and uploaded:', cameraType, path)
      } else {
        console.warn('No path in photo result:', photo)
      }
      captureResolveRef.current?.()
      captureResolveRef.current = null
    } catch (e) {
      console.error('Failed to take/upload photo', e)
      captureResolveRef.current?.()
      captureResolveRef.current = null
      if (Alert?.alert) Alert.alert('Camera error', e?.message || 'Could not take or upload photo')
      throw e
    } finally {
      isCapturingRef.current = false
      setPendingCapture(null)
    }
  }

  const handleCameraCaptureRequest = (cameraType) => {
    const targetDevice = cameraType === 'back' && backDevice ? backDevice : frontDevice
    if (!targetDevice) {
      return takePhotoAndUpload('front')
    }
    if (activeCameraType === cameraType) {
      return takePhotoAndUpload(cameraType)
    }
    return new Promise((resolve) => {
      captureResolveRef.current = resolve
      setPendingCapture(cameraType)
      setActiveCameraType(cameraType)
    })
  }

  /* ================= REAL PERMISSION HANDLER ================= */

  const handlePermission = async (key) => {
    switch (key) {

      case "remoteCamera": {
        let granted = false
        try {
          const res = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA
          )
          granted = res === PermissionsAndroid.RESULTS.GRANTED
          if (granted && Camera?.requestCameraPermission) {
            const visionResult = await Camera.requestCameraPermission()
            granted = visionResult === 'granted'
          }
        } catch (e) {
          console.warn('Camera permission request failed', e)
        }
        updatePermission(key, granted)
        break
      }

      case "oneWayAudio": {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        )
        updatePermission(key, res === PermissionsAndroid.RESULTS.GRANTED)
        break
      }

      case "liveLocation": {
        let granted = false
        try {
          const res = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          )
          granted = res === PermissionsAndroid.RESULTS.GRANTED
          if (granted && Platform.OS === 'android' && Platform.Version >= 29) {
            const bg = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
            )
            granted = bg === PermissionsAndroid.RESULTS.GRANTED
          }
        } catch (e) {
          console.warn('Location permission request failed', e)
        }
        updatePermission(key, granted)
        break
      }

      case "accessibilityService":
        openAccessibilitySettings()
        break

      case "usageReport":
        openUsageAccessSettings()
        break

      case "usageLimits":
        Linking.openSettings()
        break

      case "displayOverApps":
        Linking.openSettings()
        break

      case "keepBackground":
      case "superBattery":
        Linking.openSettings()
        break

      case "screenCasting": {
        if (Platform.OS !== 'android' || !ScreenCaptureModule?.requestScreenCaptureConsent) break
        try {
          const granted = await ScreenCaptureModule.requestScreenCaptureConsent()
          updatePermission(key, Boolean(granted))
        } catch (e) {
          console.warn('Screen capture consent failed', e)
        }
        break
      }

      default:
        break
    }
  }

  /* ================= RECHECK PERMISSIONS ================= */

  const recheckPermissions = async () => {
    const [camera, audio, fineLocation, bgLocation, accEnabled, usageAccess] = await Promise.all([
      check(PERMISSIONS.ANDROID.CAMERA),
      check(PERMISSIONS.ANDROID.RECORD_AUDIO),
      check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION),
      Platform.OS === 'android' && Platform.Version >= 29
        ? check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION).catch(() => RESULTS.DENIED)
        : Promise.resolve(RESULTS.GRANTED),
      isAccessibilityEnabled().catch(() => false),
      hasUsageAccess().catch(() => false),
    ])

    updatePermission("remoteCamera", camera === RESULTS.GRANTED)
    updatePermission("oneWayAudio", audio === RESULTS.GRANTED)
    updatePermission(
      "liveLocation",
      fineLocation === RESULTS.GRANTED && bgLocation === RESULTS.GRANTED
    )
    updatePermission("accessibilityService", Boolean(accEnabled))
    updatePermission("usageReport", Boolean(usageAccess))

    if (Platform.OS === 'android' && ScreenCaptureModule?.hasScreenCaptureConsent) {
      try {
        const casting = await ScreenCaptureModule.hasScreenCaptureConsent()
        updatePermission("screenCasting", Boolean(casting))
      } catch (e) {
        console.warn('hasScreenCaptureConsent failed', e)
      }
    } else if (Platform.OS !== 'android') {
      updatePermission("screenCasting", true)
    }
  }

  /* ================= EFFECTS ================= */

  useEffect(() => {
    recheckPermissions()

    const pending = getPendingCameraCapture()
    if (pending) {
      clearPendingCameraCapture()
      setPendingCapture(pending)
      setActiveCameraType(pending === 'back' && backDevice ? 'back' : 'front')
    }
  }, [])

  useEffect(() => {
    setCameraReady(false)
  }, [device?.id])

  useEffect(() => {
    if (!permissions.remoteCamera || !device) setCameraReady(false)
  }, [permissions.remoteCamera, device])

  useEffect(() => {
    registerCameraCapture(handleCameraCaptureRequest)
    return () => unregisterCameraCapture()
  }, [activeCameraType, permissions.remoteCamera, backDevice])

  useEffect(() => {
    if (!pendingCapture || pendingCapture !== activeCameraType || !device || isCapturingRef.current || !cameraReady) return
    const t = setTimeout(() => {
      if (cameraRef.current && cameraReady) {
        takePhotoAndUpload(pendingCapture)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [pendingCapture, activeCameraType, device, cameraReady])

  useEffect(() => {
    recheckPermissions()
    const sub = AppState.addEventListener("change", state => {
      if (state === "active") recheckPermissions()
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!__DEV__) return undefined
    const updateDebug = () => {
      try {
        setScreenShareRuntime(getScreenShareRuntimeState())
        setScreenShareLogs(getWebRTCScreenShareLogs(12))
      } catch {}
    }
    updateDebug()
    const timer = setInterval(updateDebug, 1000)
    return () => clearInterval(timer)
  }, [])

  const allAllowed = Object.values(permissions).every(v => v === true)

  const handleDebugStartService = async () => {
    try {
      await debugStartForegroundService()
      Alert.alert('Service test', 'Foreground service start requested. Check notification panel.')
    } catch (e) {
      try {
        await notifee.requestPermission()
        const channelId = await notifee.createChannel({
          id: 'debug_fg_service_fallback',
          name: 'Debug Foreground Service',
          importance: AndroidImportance.HIGH,
        })
        await notifee.displayNotification({
          id: 'debug-fg-fallback',
          title: 'KTO Kids Monitoring (fallback)',
          body: 'Foreground fallback is running. If you see this, notification path is healthy.',
          android: {
            channelId,
            asForegroundService: true,
            ongoing: true,
            importance: AndroidImportance.HIGH,
            pressAction: { id: 'default' },
          },
        })
        Alert.alert(
          'Service fallback started',
          `Primary foreground service failed, fallback started.\n\nError: ${e?.message || 'unknown'}`,
        )
      } catch (fallbackErr) {
        Alert.alert(
          'Service test failed',
          `Primary error: ${e?.message || 'unknown'}\nFallback error: ${fallbackErr?.message || 'unknown'}`,
        )
      }
    }
  }

  const handleDebugStopService = async () => {
    try {
      await debugStopForegroundService()
      await notifee.stopForegroundService().catch(() => {})
      await notifee.cancelNotification('debug-fg-fallback').catch(() => {})
      Alert.alert('Service test', 'Foreground service stop requested.')
    } catch (e) {
      Alert.alert('Service stop failed', e?.message || 'Could not stop foreground service')
    }
  }

  const handleDebugLocalNotification = async () => {
    try {
      await notifee.requestPermission()
      const channelId = await notifee.createChannel({
        id: 'debug_service_test',
        name: 'Debug Service Test',
        importance: AndroidImportance.HIGH,
      })
      await notifee.displayNotification({
        title: 'KTO Debug Notification',
        body: 'If you can see this, Android notifications are working.',
        android: {
          channelId,
          pressAction: { id: 'default' },
          importance: AndroidImportance.HIGH,
        },
      })
      Alert.alert('Debug notification', 'Local test notification sent.')
    } catch (e) {
      Alert.alert('Debug notification failed', e?.message || 'Could not send local notification')
    }
  }

  const handleScreenShareServiceOnlyTest = async () => {
    try {
      setScreenShareStatus('starting-service-only...')
      const result = await startScreenShare({ skipTransport: true, intervalMs: 2500 })
      setScreenShareStatus(`service-only active (${result?.trackId || 'no-track'})`)
      Alert.alert('Screen share test', 'Service-only screen share started (no WebRTC transport).')
    } catch (e) {
      setScreenShareStatus(`error: ${e?.message || 'unknown'}`)
      Alert.alert('Screen share test failed', e?.message || 'Could not start service-only test')
    }
  }

  const handleScreenShareFullTest = async () => {
    try {
      setScreenShareStatus('starting-full-session...')
      const result = await startScreenShare({ intervalMs: 2500 })
      setScreenShareStatus(`full session active (${result?.trackId || 'no-track'})`)
      Alert.alert('Screen share test', 'Full session started. This requires signaling/parent side to connect.')
    } catch (e) {
      const msg = String(e?.message || 'Could not start full screen share session')
      if (msg.toLowerCase().includes('signaling socket')) {
        try {
          const fallback = await startScreenShare({ skipTransport: true, intervalMs: 2500 })
          setScreenShareStatus(`service-only active (${fallback?.trackId || 'no-track'})`)
          Alert.alert(
            'Full session unavailable',
            'Signaling/parent is not connected yet. Started service-only mode so you can test kid app flow now.',
          )
          return
        } catch (fallbackErr) {
          setScreenShareStatus(`error: ${fallbackErr?.message || msg}`)
          Alert.alert(
            'Screen share test failed',
            fallbackErr?.message || 'Full and service-only modes both failed',
          )
          return
        }
      }
      setScreenShareStatus(`error: ${msg}`)
      Alert.alert('Full session failed', msg)
    }
  }

  const handleScreenShareStopTest = async () => {
    try {
      await stopScreenShare()
      setScreenShareStatus('stopped')
      Alert.alert('Screen share test', 'Screen share stopped.')
    } catch (e) {
      setScreenShareStatus(`error: ${e?.message || 'unknown'}`)
      Alert.alert('Stop failed', e?.message || 'Could not stop screen share')
    }
  }

  const handleScreenShareStatusTest = async () => {
    try {
      const state = await getScreenShareState()
      const label = state?.active
        ? `active | trackId=${state?.trackId || ''} | interval=${state?.intervalMs || 0}`
        : 'inactive'
      setScreenShareStatus(label)
      Alert.alert('Screen share status', label)
    } catch (e) {
      setScreenShareStatus(`error: ${e?.message || 'unknown'}`)
      Alert.alert('Status failed', e?.message || 'Could not fetch screen share state')
    }
  }

  /* ================= UI ITEM ================= */

  const PermissionItem = ({ title, subtitle, permissionKey, iconName }) => (
    <View style={styles.permissionItem}>
      <View style={styles.permissionLeft}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={iconName} size={22} color="#7C3AED" />
        </View>
        <View style={styles.permissionText}>
          <Text style={styles.permissionTitle}>{title}</Text>
          <Text style={styles.permissionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={permissions[permissionKey]}
        onValueChange={() => handlePermission(permissionKey)}
        trackColor={{ false: '#E0E0E0', true: '#9B1FE8' }}
        thumbColor="#FFFFFF"
      />
    </View>
  )

  /* ================= RENDER ================= */

  return (
    <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Hidden Camera for remote capture (omit when restricted by OS/device policy) */}
        {permissions.remoteCamera && device && !cameraError && (
          <Camera
            ref={cameraRef}
            style={styles.hiddenCamera}
            device={device}
            format={format}
            isActive={true}
            photo={true}
            captureAudio={false}
            onInitialized={() => setCameraReady(true)}
            onError={(err) => {
              const msg = err?.message ?? String(err)
              if (!msg.includes('camera-is-restricted')) {
                console.warn('Camera error', err)
              }
              setCameraError(true)
            }}
          />
        )}

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Image source={require("../../assets/angle-small-left.png")} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Permissions</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Intro */}
        <View style={styles.headerSection}>
          <Text style={styles.headerIcon}>🔒</Text>
          <Text style={styles.headerText}>App Permissions</Text>
          <Text style={styles.headerSubtext}>
            All permissions must be enabled to continue
          </Text>
        </View>

        <ScrollView>
          <View style={styles.permissionsList}>
            {__DEV__ ? (
              <View style={styles.debugInlineContainer}>
                <View style={styles.debugButtonsRow}>
                  <TouchableOpacity style={styles.debugButtonPrimary} onPress={handleDebugStartService}>
                    <Text style={styles.debugButtonText}>Test Service Notification</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.debugButtonSecondary} onPress={handleDebugStopService}>
                    <Text style={styles.debugButtonText}>Stop Service</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.debugButtonsRow}>
                  <TouchableOpacity style={styles.debugButtonPrimary} onPress={handleScreenShareServiceOnlyTest}>
                    <Text style={styles.debugButtonText}>Start Screen Share (Service-only)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.debugButtonSecondary} onPress={handleScreenShareFullTest}>
                    <Text style={styles.debugButtonText}>Start Screen Share (Full)</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.debugButtonsRow}>
                  <TouchableOpacity style={styles.debugButtonSecondary} onPress={handleScreenShareStopTest}>
                    <Text style={styles.debugButtonText}>Stop Screen Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.debugButtonNeutral} onPress={handleScreenShareStatusTest}>
                    <Text style={styles.debugButtonText}>Get Screen Share Status</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.debugStatusText}>ScreenShare Debug: {screenShareStatus}</Text>
                <View style={styles.webrtcDebugPanel}>
                  <Text style={styles.webrtcDebugTitle}>WebRTC Runtime</Text>
                  <Text style={styles.webrtcDebugLine}>state: {screenShareRuntime?.state || '-'}</Text>
                  <Text style={styles.webrtcDebugLine}>sessionId: {screenShareRuntime?.sessionId || '-'}</Text>
                  <Text style={styles.webrtcDebugLine}>peer: {screenShareRuntime?.webrtc?.peerState || 'none'}</Text>
                  <Text style={styles.webrtcDebugLine}>
                    ice sent/recv: {screenShareRuntime?.webrtc?.iceSentCount || 0}/{screenShareRuntime?.webrtc?.iceReceivedCount || 0}
                  </Text>
                  <Text style={styles.webrtcDebugTitle}>Recent WebRTC Logs</Text>
                  {screenShareLogs.length === 0 ? (
                    <Text style={styles.webrtcDebugLine}>No logs yet</Text>
                  ) : (
                    screenShareLogs.map((item, idx) => (
                      <Text key={`${item.at}-${idx}`} style={styles.webrtcDebugLogLine}>
                        [{String(item.at || '').slice(11, 19)}] {item.message}
                      </Text>
                    ))
                  )}
                </View>
              </View>
            ) : null}
            <PermissionItem title="Accessibility Service" subtitle="Enable KTO Kids monitoring service" permissionKey="accessibilityService" iconName="human" />
            <PermissionItem title="Usage Limits" subtitle="Control screen & app time" permissionKey="usageLimits" iconName="timer-outline" />
            <PermissionItem title="Display Over Apps" subtitle="Show alerts over apps" permissionKey="displayOverApps" iconName="layers-outline" />
            {Platform.OS === 'android' ? (
              <PermissionItem
                title="Screen casting"
                subtitle="Allow screen capture so a parent can view the device screen"
                permissionKey="screenCasting"
                iconName="cast"
              />
            ) : null}
            <PermissionItem title="Remote Camera" subtitle="Allow photo capture" permissionKey="remoteCamera" iconName="camera-outline" />
            <PermissionItem title="One-Way Audio" subtitle="Allow microphone access" permissionKey="oneWayAudio" iconName="microphone-outline" />
            <PermissionItem title="Live Location" subtitle="Track device location" permissionKey="liveLocation" iconName="map-marker-outline" />
            <PermissionItem title="Usage Report" subtitle="View app usage" permissionKey="usageReport" iconName="chart-bar" />
            <PermissionItem title="Run in Background" subtitle="Keep monitoring active" permissionKey="keepBackground" iconName="refresh" />
            <PermissionItem title="Battery Optimization" subtitle="Prevent system kill" permissionKey="superBattery" iconName="battery-charging" />
          </View>
        </ScrollView>

        {/* Confirm */}
        <View style={styles.buttonContainer}>
          {__DEV__ ? (
            <TouchableOpacity style={styles.debugButtonNeutral} onPress={handleDebugLocalNotification}>
              <Text style={styles.debugButtonText}>Send Local Debug Notification</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            disabled={!allAllowed}
            style={[styles.confirmButton, { opacity: allAllowed ? 1 : 0.5 }]}
            onPress={() => navigation.navigate("Home")}
          >
            <Text style={styles.confirmButtonText}>✓ Confirm all permissions</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ViewShot>
  )
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    height: 56, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 16,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB"
  },
  backIcon: { width: 24, height: 24 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },

  headerSection: {
    alignItems: "center", paddingVertical: 24, backgroundColor: "#FFF", marginBottom: 8
  },
  headerIcon: { fontSize: 40 },
  headerText: { fontSize: 20, fontWeight: "700" },
  headerSubtext: { fontSize: 14, color: "#6B7280" },

  permissionsList: { padding: 16, paddingBottom: 120 },
  debugInlineContainer: {
    marginBottom: 12,
  },
  debugStatusText: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  webrtcDebugPanel: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  webrtcDebugTitle: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  webrtcDebugLine: {
    color: '#D1D5DB',
    fontSize: 11,
    marginBottom: 2,
  },
  webrtcDebugLogLine: {
    color: '#93C5FD',
    fontSize: 10,
    marginBottom: 2,
  },
  permissionItem: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#FFF", padding: 14, borderRadius: 12, marginBottom: 12
  },
  permissionLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  permissionIcon: { fontSize: 24, marginRight: 12 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F5F3FF', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  permissionText: { flex: 1 },
  permissionTitle: { fontSize: 16, fontWeight: "600" },
  permissionSubtitle: { fontSize: 13, color: "#6B7280" },

  buttonContainer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#E5E7EB"
  },
  debugButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  debugButtonPrimary: {
    flex: 1,
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  debugButtonSecondary: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  debugButtonNeutral: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmButton: {
    backgroundColor: "#2563EB", paddingVertical: 14, borderRadius: 12, alignItems: "center"
  },
  confirmButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  hiddenCamera: {
    width: Platform.OS === 'android' ? 64 : 1,
    height: Platform.OS === 'android' ? 64 : 1,
    position: 'absolute',
    top: -200,
    left: -200,
    opacity: 0.01,
  }
})

export default Permission
