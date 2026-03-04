import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { ActionButton } from "./src/components/ActionButton";
import { HistoryItem } from "./src/components/HistoryItem";
import { RiskBadge } from "./src/components/RiskBadge";
import { Section } from "./src/components/Section";
import { Tag } from "./src/components/Tag";
import { colors, radius, spacing, typography } from "./src/theme";
import { mockDashboard, mockHistory } from "./src/mock";

type RiskLevel = "SAFE" | "SUSPICIOUS" | "HIGH RISK";

type ScanResult = {
  fraud_probability: number;
  risk_level: RiskLevel;
  fraud_type: string;
  suspicious_keywords: string[];
  explanation: string;
  safety_tips: string[];
};

type DashboardStats = {
  total: number;
  spam: number;
  normal: number;
  top_spam_types: { label: string; value: number }[];
  latest_normal: string[];
  latest_spam: string[];
};

const API_BASE = Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";

const tipsLibrary = [
  "Never share OTP or UPI PIN.",
  "Verify sender details before clicking links.",
  "Avoid paying advance fees for jobs or loans.",
  "Report suspicious messages to 1930.",
  "Use official apps for payments.",
];

function analyzeLocal(message: string): ScanResult {
  const text = message.toLowerCase();
  const hit = (word: string) => text.includes(word);
  const suspicious = [
    "upi",
    "otp",
    "kyc",
    "urgent",
    "click",
    "loan",
    "lottery",
    "prize",
    "refund",
    "bank",
    "verify",
    "pin",
    "link",
  ].filter(hit);

  let risk_level: RiskLevel = "SAFE";
  let fraud_probability = 15;
  let fraud_type = "Other Scam";

  if (hit("otp") || hit("pin") || hit("upi")) {
    risk_level = "HIGH RISK";
    fraud_probability = 92;
    fraud_type = "UPI Fraud";
  } else if (hit("lottery") || hit("prize")) {
    risk_level = "SUSPICIOUS";
    fraud_probability = 68;
    fraud_type = "Lottery Scam";
  } else if (hit("loan") || hit("refund")) {
    risk_level = "SUSPICIOUS";
    fraud_probability = 62;
    fraud_type = "Loan Scam";
  }

  return {
    risk_level,
    fraud_probability,
    fraud_type,
    suspicious_keywords: suspicious.slice(0, 6),
    explanation:
      suspicious.length > 0
        ? "Multiple risk indicators detected. This message contains patterns common in fraud attempts."
        : "No obvious fraud patterns detected. Stay alert and verify the sender if unsure.",
    safety_tips: tipsLibrary,
  };
}

export default function App() {
  const [message, setMessage] = useState("");
  const [autoMode, setAutoMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<DashboardStats>(mockDashboard);
  const [result, setResult] = useState<ScanResult>(() =>
    analyzeLocal("Your SBI account credited with salary Rs 24,500.")
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/stats`);
        if (!response.ok) {
          throw new Error("Stats unavailable");
        }
        const data = (await response.json()) as DashboardStats;
        setDashboard(data);
      } catch {
        setDashboard(mockDashboard);
      }
    };
    loadStats();
  }, []);

  const requestAnalyze = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!response.ok) {
        throw new Error(`Backend error ${response.status}`);
      }
      const data = (await response.json()) as ScanResult;
      setResult(data);
      const stats = await fetch(`${API_BASE}/stats`);
      if (stats.ok) {
        const statsData = (await stats.json()) as DashboardStats;
        setDashboard(statsData);
      }
    } catch (err) {
      setError("Backend not reachable. Showing offline estimate.");
      setResult(analyzeLocal(text));
    } finally {
      setLoading(false);
    }
  };

  const onScan = () => {
    requestAnalyze(message);
  };

  const onPasteAndScan = async () => {
    const text = await Clipboard.getStringAsync();
    setMessage(text);
    requestAnalyze(text);
  };

  const riskTone = useMemo(() => {
    if (result.risk_level === "SAFE") return colors.safe;
    if (result.risk_level === "SUSPICIOUS") return colors.warning;
    return colors.danger;
  }, [result.risk_level]);

  const spamRate = dashboard.total
    ? Math.round((dashboard.spam / dashboard.total) * 100)
    : 0;
  const normalRate = 100 - spamRate;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[colors.bgDeep, colors.bgMid]} style={styles.container}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={styles.hero}>
                <View>
                  <Text style={styles.kicker}>AI Fraud Risk Detection</Text>
                  <Text style={styles.title}>Fraud Shield</Text>
                  <Text style={styles.subtitle}>
                    Protect every message with instant offline risk scoring and clear guidance.
                  </Text>
                </View>
                <View style={styles.pulse} />
              </View>

              <View style={styles.card}>
                <Section title="Message Scan">
                  <TextInput
                    placeholder="Paste or type the SMS/message"
                    placeholderTextColor={colors.textDim}
                    style={styles.input}
                    multiline
                    value={message}
                    onChangeText={setMessage}
                  />
                  {loading && <Text style={styles.status}>Scanning with backend...</Text>}
                  {!!error && <Text style={styles.error}>{error}</Text>}
                  <View style={styles.row}>
                    <ActionButton label="Scan Message" onPress={onScan} style={styles.flex} />
                    <ActionButton
                      label="Paste + Scan"
                      onPress={onPasteAndScan}
                      variant="secondary"
                      style={styles.flex}
                    />
                  </View>
                  <View style={styles.row}>
                    <ActionButton label="Scan Stored SMS" onPress={() => {}} style={styles.flex} />
                    <ActionButton
                      label={`Auto SMS: ${autoMode ? "ON" : "OFF"}`}
                      onPress={() => setAutoMode((prev) => !prev)}
                      variant="ghost"
                      style={styles.flex}
                    />
                  </View>
                </Section>
              </View>

              <View style={styles.cardAccent}>
                <Section title="Risk Summary">
                  <View style={styles.row}>
                    <RiskBadge level={result.risk_level} />
                    <Text style={[styles.score, { color: riskTone }]}>
                      {result.fraud_probability}% risk
                    </Text>
                  </View>
                  <Text style={styles.typeLabel}>Fraud Type</Text>
                  <Text style={styles.typeValue}>{result.fraud_type}</Text>
                  <View style={styles.tags}>
                    {result.suspicious_keywords.length === 0 ? (
                      <Tag label="No suspicious words" />
                    ) : (
                      result.suspicious_keywords.map((word) => (
                        <Tag
                          key={word}
                          label={word.toUpperCase()}
                          tone={result.risk_level === "HIGH RISK" ? "danger" : "warn"}
                        />
                      ))
                    )}
                  </View>
                  <Text style={styles.explanation}>{result.explanation}</Text>
                </Section>
              </View>

              <View style={styles.card}>
                <Section title="Safety Tips">
                  {result.safety_tips.map((tip) => (
                    <Text key={tip} style={styles.tipItem}>
                      {`? ${tip}`}
                    </Text>
                  ))}
                  <View style={styles.row}>
                    <ActionButton label="Report: 1930" onPress={() => {}} style={styles.flex} />
                    <ActionButton
                      label="View History"
                      onPress={() => {}}
                      variant="secondary"
                      style={styles.flex}
                    />
                  </View>
                </Section>
              </View>

              <View style={styles.card}>
                <Section title="Dashboard">
                  <View style={styles.dashboardRow}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Total Messages</Text>
                      <Text style={styles.metricValue}>{dashboard.total}</Text>
                      <Text style={styles.metricSub}>Last 30 days</Text>
                    </View>
                    <View style={styles.metricCardAlt}>
                      <Text style={styles.metricLabel}>Spam Detected</Text>
                      <Text style={[styles.metricValue, { color: colors.accentCoral }]}>
                        {dashboard.spam}
                      </Text>
                      <Text style={styles.metricSub}>{spamRate}% of traffic</Text>
                    </View>
                  </View>

                  <View style={styles.metricCardWide}>
                    <View style={styles.rowSpread}>
                      <Text style={styles.metricLabel}>Spam vs Normal</Text>
                      <Text style={styles.metricSub}>Weekly trend</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barSpam, { flex: spamRate }]} />
                      <View style={[styles.barNormal, { flex: normalRate }]} />
                    </View>
                    <View style={styles.rowSpread}>
                      <Text style={styles.legendSpam}>{spamRate}% Spam</Text>
                      <Text style={styles.legendNormal}>{normalRate}% Normal</Text>
                    </View>
                  </View>

                  <View style={styles.dashboardRow}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricLabel}>Top Spam Types</Text>
                    {dashboard.top_spam_types.map((item) => (
                      <View key={item.label} style={styles.listRow}>
                        <Text style={styles.listLabel}>{item.label}</Text>
                        <Text style={styles.listValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.metricCardAlt}>
                    <Text style={styles.metricLabel}>Latest Normal</Text>
                    {dashboard.latest_normal.map((item) => (
                      <Text key={item} style={styles.listItem}>
                        {item}
                      </Text>
                    ))}
                    <View style={styles.divider} />
                    <Text style={styles.metricLabel}>Latest Spam</Text>
                    {dashboard.latest_spam.map((item) => (
                      <Text key={item} style={styles.listItemAccent}>
                        {item}
                      </Text>
                    ))}
                  </View>
                </View>
                </Section>
              </View>

              <View style={styles.card}>
                <Section title="Recent Scans">
                  {mockHistory.map((item) => (
                    <HistoryItem
                      key={`${item.title}-${item.time}`}
                      title={item.title}
                      time={item.time}
                      risk={item.risk}
                      score={item.score}
                    />
                  ))}
                </Section>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.lg,
  },
  kicker: {
    color: colors.accentBlue,
    textTransform: "uppercase",
    fontSize: typography.small,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    marginTop: spacing.sm,
    maxWidth: 260,
  },
  pulse: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0, 210, 168, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(0, 210, 168, 0.4)",
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  cardAccent: {
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(90, 169, 255, 0.4)",
    gap: spacing.md,
  },
  input: {
    minHeight: 120,
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.body,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowSpread: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flex: {
    flex: 1,
  },
  score: {
    fontSize: typography.h2,
    fontWeight: "800",
  },
  typeLabel: {
    color: colors.textDim,
    fontSize: typography.small,
    marginTop: spacing.sm,
  },
  typeValue: {
    color: colors.textPrimary,
    fontSize: typography.h3,
    fontWeight: "700",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  explanation: {
    color: colors.textMuted,
    fontSize: typography.body,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  tipItem: {
    color: colors.textPrimary,
    fontSize: typography.body,
    marginBottom: spacing.xs,
  },
  status: {
    color: colors.accentBlue,
    fontSize: typography.small,
  },
  error: {
    color: colors.accentCoral,
    fontSize: typography.small,
  },
  dashboardRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  metricCardAlt: {
    flex: 1,
    backgroundColor: "rgba(90, 169, 255, 0.08)",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(90, 169, 255, 0.3)",
    gap: spacing.xs,
  },
  metricCardWide: {
    backgroundColor: "rgba(0, 210, 168, 0.08)",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0, 210, 168, 0.35)",
    gap: spacing.sm,
  },
  metricLabel: {
    color: colors.textDim,
    fontSize: typography.small,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    fontWeight: "800",
  },
  metricSub: {
    color: colors.textMuted,
    fontSize: typography.small,
  },
  barTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.bgCardAlt,
  },
  barSpam: {
    backgroundColor: colors.accentCoral,
  },
  barNormal: {
    backgroundColor: colors.accentTeal,
  },
  legendSpam: {
    color: colors.accentCoral,
    fontSize: typography.small,
    fontWeight: "600",
  },
  legendNormal: {
    color: colors.accentTeal,
    fontSize: typography.small,
    fontWeight: "600",
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listLabel: {
    color: colors.textPrimary,
    fontSize: typography.small,
  },
  listValue: {
    color: colors.accentAmber,
    fontSize: typography.small,
    fontWeight: "700",
  },
  listItem: {
    color: colors.textPrimary,
    fontSize: typography.small,
  },
  listItemAccent: {
    color: colors.accentCoral,
    fontSize: typography.small,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  orbTop: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(90, 169, 255, 0.15)",
  },
  orbBottom: {
    position: "absolute",
    bottom: -140,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255, 122, 89, 0.18)",
  },
});
