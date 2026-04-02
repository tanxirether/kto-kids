import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getDailyLimitsMs,
  getKeywords,
  getLastForeground,
  getTodayUsageMs,
  getTodayUsageMsUsageStats,
  getUsageAccessDebug,
  getAccessibilityServiceHealth,
  hasUsageAccess,
  openUsageAccessSettings,
  isAccessibilityEnabled,
} from "../../services/AccessibilityServiceBridge";

function msToMinutes(ms) {
  if (!ms || ms <= 0) return 0;
  return Math.round((ms / 60000) * 10) / 10;
}

export default function UsageDebug({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [usageAccess, setUsageAccess] = useState(null);
  const [usageAccessDebug, setUsageAccessDebug] = useState({});
  const [lastFg, setLastFg] = useState({ packageName: "", timestampMs: 0 });
  const [usage, setUsage] = useState({});
  const [limits, setLimits] = useState({});
  const [keywords, setKeywordsState] = useState([]);
  const [svcHealth, setSvcHealth] = useState({ lastError: "", lastErrorTsMs: 0 });
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const entries = Object.entries(usage || {});
    entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    return entries.map(([pkg, ms]) => ({
      pkg,
      ms: Number(ms) || 0,
      minutes: msToMinutes(Number(ms) || 0),
      limitMs: Number(limits?.[pkg] || 0),
      limitMinutes: msToMinutes(Number(limits?.[pkg] || 0)),
    }));
  }, [usage, limits]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [e, ua, uAcc, l, k, h] = await Promise.all([
        isAccessibilityEnabled(),
        hasUsageAccess(),
        getTodayUsageMsUsageStats(),
        getDailyLimitsMs(),
        getKeywords(),
        getAccessibilityServiceHealth(),
      ]);
      const fg = await getLastForeground();
      const dbg = await getUsageAccessDebug();
      setEnabled(Boolean(e));
      setUsageAccess(Boolean(ua));
      setUsageAccessDebug(dbg || {});
      setLastFg(fg || { packageName: "", timestampMs: 0 });
      setUsage(uAcc || {});
      setLimits(l || {});
      setKeywordsState(k || []);
      setSvcHealth(h || { lastError: "", lastErrorTsMs: 0 });
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Usage Debug</Text>
        <TouchableOpacity onPress={refresh} disabled={loading}>
          <Text style={[styles.refresh, loading && { opacity: 0.5 }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>
          <Text style={styles.rowText}>
            Accessibility enabled: <Text style={styles.mono}>{String(enabled)}</Text>
          </Text>
          <Text style={styles.rowText}>
            Usage access: <Text style={styles.mono}>{String(usageAccess)}</Text>
          </Text>
          {usageAccess === false ? (
            <Text style={styles.dim}>
              Debug:{" "}
              <Text style={styles.mono}>
                mode={String(usageAccessDebug?.appOpsMode)} hasAnyEvents={String(usageAccessDebug?.hasAnyEvents)} fg=
                {String(usageAccessDebug?.currentForegroundPackage)}
              </Text>
            </Text>
          ) : null}
          {usageAccess === false ? (
            <TouchableOpacity onPress={openUsageAccessSettings} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Enable Usage Access</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.rowText}>
            Last foreground: <Text style={styles.mono}>{lastFg?.packageName || "(none)"}</Text>
          </Text>
          {svcHealth?.lastError ? (
            <Text style={styles.dim}>
              Service error: <Text style={styles.mono}>{String(svcHealth?.lastError)}</Text>
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Keywords</Text>
          <Text style={styles.mono}>{(keywords || []).join(", ") || "(none)"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today usage</Text>
          {rows.length === 0 ? (
            <Text style={styles.dim}>
              No usage yet. Open an app (e.g. YouTube) then switch to another app so the service
              records time.
            </Text>
          ) : (
            rows.map((r) => (
              <View key={r.pkg} style={styles.usageRow}>
                <Text style={styles.pkg}>{r.pkg}</Text>
                <Text style={styles.usageVal}>
                  {r.minutes} min ({r.ms} ms)
                  {r.limitMs > 0 ? ` • limit ${r.limitMinutes} min` : ""}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  back: { color: "#2563EB", fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "700", color: "#111827" },
  refresh: { color: "#2563EB", fontWeight: "700" },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 8 },
  rowText: { color: "#111827" },
  mono: { fontFamily: "monospace", color: "#111827" },
  dim: { color: "#6B7280" },
  error: { marginTop: 8, color: "#DC2626" },
  actionBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnText: { color: "#FFF", fontWeight: "800" },
  usageRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  pkg: { fontSize: 13, fontWeight: "700", color: "#111827" },
  usageVal: { marginTop: 2, color: "#374151" },
});

