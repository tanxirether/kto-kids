import React, { useCallback, useState } from 'react'
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    Alert,
    ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native'
import {
    getLastActivitiesSyncMsMerged,
    getLastLocationSyncMsMerged,
    setLinkedTrackId,
} from '../../services/AccessibilityServiceBridge'
import { sendSos } from '../../services/SosService'
const { width } = Dimensions.get('window')

// Stops accidental repeat presses from flooding the parents with alerts.
const SOS_COOLDOWN_MS = 30 * 1000

function formatLastSync(tsMs) {
    if (tsMs == null || tsMs <= 0) return 'Not yet'
    try {
        return new Date(tsMs).toLocaleString()
    } catch {
        return 'Not yet'
    }
}

const ConnectedScreen = ({ navigation }) => {
    const [connectedDevice, setConnectedDevice] = useState(null);
    const [lastActivitiesSync, setLastActivitiesSync] = useState(null)
    const [lastLocationSync, setLastLocationSync] = useState(null)
    const [sosSending, setSosSending] = useState(false)
    const [lastSosAt, setLastSosAt] = useState(0)

    const triggerSos = async () => {
        setSosSending(true)
        try {
            const { hasLocation } = await sendSos()
            setLastSosAt(Date.now())
            Alert.alert(
                'SOS sent',
                hasLocation
                    ? 'Your parents were notified with your location.'
                    : 'Your parents were notified. Your location could not be read.'
            )
        } catch (error) {
            const message =
                error?.response?.data?.message || error?.message || 'Could not send SOS. Try again.'
            Alert.alert('SOS failed', String(message))
        } finally {
            setSosSending(false)
        }
    }

    const onSosPress = () => {
        if (sosSending) return
        if (Date.now() - lastSosAt < SOS_COOLDOWN_MS) {
            Alert.alert('SOS already sent', 'Your parents were just notified. Please wait a moment.')
            return
        }
        Alert.alert('Send SOS?', 'This will alert your parents and share your location.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send SOS', style: 'destructive', onPress: triggerSos },
        ])
    }

    useFocusEffect(
        useCallback(() => {
            let cancelled = false
            ;(async () => {
                try {
                    const deviceData = await AsyncStorage.getItem('trackid')
                    if (!cancelled && deviceData) {
                        setConnectedDevice(deviceData)
                        await setLinkedTrackId(deviceData)
                    }
                } catch (error) {
                    console.error('Error fetching connected device:', error)
                }
                try {
                    const ts = await getLastActivitiesSyncMsMerged()
                    if (!cancelled) {
                        setLastActivitiesSync(typeof ts === 'number' ? ts : 0)
                    }
                } catch {
                    if (!cancelled) setLastActivitiesSync(0)
                }
                try {
                    const ts = await getLastLocationSyncMsMerged()
                    if (!cancelled) {
                        setLastLocationSync(typeof ts === 'number' ? ts : 0)
                    }
                } catch {
                    if (!cancelled) setLastLocationSync(0)
                }
            })()
            return () => {
                cancelled = true
            }
        }, [])
    )

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.checkmarkCircle}>
                        <Text style={styles.checkmark}>✓</Text>
                    </View>
                    <Text style={styles.title}>Device Connected!</Text>
                    <Text style={styles.subtitle}>Successfully paired with parents</Text>
                </View>

                {/* Connected Device Info */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Device Name</Text>
                        <Text style={styles.infoValue}>My Device</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Status</Text>
                        <View style={styles.statusBadge}>
                            {connectedDevice ? (
                                <View style={styles.onlineDot} />
                            ) : (
                                <View style={styles.offlineDot} />
                            )}
                            {connectedDevice ? (
                                <Text style={styles.statusText}> Connected</Text>
                            ) : (
                                <Text style={{ color: 'red' }}> Disconnected</Text>
                            )}
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Last activities sync</Text>
                        <Text style={[styles.infoValue, styles.syncValue]} numberOfLines={2}>
                            {formatLastSync(lastActivitiesSync)}
                        </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Last location sync</Text>
                        <Text style={[styles.infoValue, styles.syncValue]} numberOfLines={2}>
                            {formatLastSync(lastLocationSync)}
                        </Text>
                    </View>
                </View>



                {/* SOS */}
                <View style={styles.sosWrap}>
                    <TouchableOpacity
                        style={[styles.sosButton, sosSending && styles.sosButtonBusy]}
                        onPress={onSosPress}
                        activeOpacity={0.85}
                        disabled={sosSending}
                    >
                        {sosSending ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.sosText}>SOS</Text>
                        )}
                    </TouchableOpacity>
                    <Text style={styles.sosHint}>Press in an emergency to alert your parents</Text>
                </View>

                {/* What's Next */}
                <View style={styles.section}>
                    <View style={styles.features}>
                        <TouchableOpacity style={styles.featureItem} onPress={() => {navigation.navigate('Permission')}}>
                            <Text style={styles.featureText}>Allow the required permissions 🔒</Text>
                        </TouchableOpacity>

                        {__DEV__ ? (
                            <TouchableOpacity style={styles.featureItem} onPress={() => { navigation.navigate('UsageDebug') }}>
                                <Text style={styles.featureText}>Usage Debug (dev)</Text>
                            </TouchableOpacity>
                        ) : null}

                    </View>
                </View>
            </ScrollView>

            {/* Action Button */}

        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    sosWrap: {
        alignItems: 'center',
        marginBottom: 28,
    },
    sosButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#e53935',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#e53935',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    sosButtonBusy: {
        opacity: 0.7,
    },
    sosText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: 2,
    },
    sosHint: {
        marginTop: 12,
        fontSize: 13,
        color: '#6b7280',
    },
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        paddingBottom: 100,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    checkmarkCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#9b1fe8',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    checkmark: {
        fontSize: 48,
        color: '#fff',
        fontWeight: 'bold',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    infoCard: {
        marginHorizontal: 20,
        marginBottom: 32,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    infoLabel: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '600',
    },
    syncValue: {
        flex: 1,
        marginLeft: 12,
        textAlign: 'right',
        fontSize: 12,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        color: '#10b981',
        fontWeight: '600',
    },
    section: {
        marginHorizontal: 20,
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    parentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    parentAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f3e8ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 24,
    },
    parentInfo: {
        flex: 1,
    },
    parentName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    parentEmail: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    parentStatus: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    onlineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10b981',
    },
    offlineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
    },
    features: {
        flexDirection: 'column',
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    featureIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    featureText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    buttonContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#f8f9fa',
    },
    button: {
        backgroundColor: '#9b1fe8',
        paddingVertical: 14,
        borderRadius: 30,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
})

export default ConnectedScreen