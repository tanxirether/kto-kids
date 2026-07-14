import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Full-screen prominent disclosure (Google Play User Data / Accessibility API policy).
 * Not a bottom sheet — occupies the entire screen before sensitive permissions.
 */
export default function ProminentDisclosureContent({
  title,
  bannerText,
  sections,
  checkboxLabel,
  acceptLabel = 'I agree — continue',
  declineLabel = 'Decline',
  requireScrollToEnd = false,
  dataTypesLabel,
  dataTypes,
  onAccept,
  onDecline,
}) {
  const [checked, setChecked] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(!requireScrollToEnd);
  const contentH = React.useRef(0);
  const layoutH = React.useRef(0);

  const canAccept = checked && scrolledToEnd;

  const recomputeScrollEnd = (offsetY = 0) => {
    if (!requireScrollToEnd) return;
    const c = contentH.current;
    const l = layoutH.current;
    if (!c || !l) return;
    if (c <= l + 8) {
      setScrolledToEnd(true);
      return;
    }
    if (l + offsetY >= c - 48) setScrolledToEnd(true);
  };

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDecline?.();
      return true;
    });
    return () => sub.remove();
  }, [onDecline]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>{bannerText}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {Array.isArray(dataTypes) && dataTypes.length > 0 ? (
        <View style={styles.dataTypesBox}>
          <Text style={styles.dataTypesLabel}>
            {dataTypesLabel || 'Data types in this disclosure'}
          </Text>
          <Text style={styles.dataTypesList}>{dataTypes.join(' · ')}</Text>
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        onScroll={({ nativeEvent }) => {
          recomputeScrollEnd(nativeEvent.contentOffset.y);
        }}
        onContentSizeChange={(_w, h) => {
          contentH.current = h;
          recomputeScrollEnd(0);
        }}
        onLayout={(e) => {
          layoutH.current = e.nativeEvent.layout.height;
          recomputeScrollEnd(0);
        }}
        scrollEventThrottle={16}
      >
        {(sections || []).map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
      {requireScrollToEnd && !scrolledToEnd ? (
        <Text style={styles.scrollHint}>
          Scroll down to read every AccessibilityService API data type before continuing.
        </Text>
      ) : null}
      <Pressable
        style={styles.checkboxRow}
        onPress={() => setChecked((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.checkboxLabel}>{checkboxLabel}</Text>
      </Pressable>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
          <Text style={styles.declineText}>{declineLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptBtn, !canAccept && styles.acceptBtnDisabled]}
          onPress={() => {
            if (!canAccept) return;
            onAccept?.();
          }}
          disabled={!canAccept}
        >
          <Text style={styles.acceptText}>{acceptLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  banner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  bannerText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  dataTypesBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 10,
    marginBottom: 8,
  },
  dataTypesLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  dataTypesList: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#9B1FE8',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#9B1FE8',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#111827',
    fontWeight: '600',
  },
  scrollHint: {
    fontSize: 13,
    color: '#B45309',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  declineText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  acceptBtn: {
    flex: 1.5,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#9B1FE8',
    alignItems: 'center',
  },
  acceptBtnDisabled: {
    opacity: 0.4,
  },
  acceptText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
