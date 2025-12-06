import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme, getStatusColor, getStatusLabel, getScoreColor } from '../utils/theme';
import { Card, ProgressRing } from '../components/common';
import { LineChart } from '../components/charts';
import { useApp } from '../context/AppContext';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { history, weeklyScore, trends, refreshAll } = useApp();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    refreshAll();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const latestEntry = history.length > 0 ? history[history.length - 1] : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Track your cognitive performance</Text>
        </View>

        {/* Current Score Card */}
        {(weeklyScore || latestEntry) && (
          <Card style={styles.mainScoreCard}>
            <Text style={styles.cardLabel}>NEURO LOAD SCORE</Text>
            <View style={styles.mainScoreContent}>
              <ProgressRing
                score={weeklyScore?.neuro_load_score || latestEntry?.neuro_load_score || 0}
                size={140}
                strokeWidth={12}
                label="Drift"
              />
              <View style={styles.scoreDetails}>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: getStatusColor(
                          weeklyScore?.status || latestEntry?.status || 'optimal'
                        ),
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: getStatusColor(
                          weeklyScore?.status || latestEntry?.status || 'optimal'
                        ),
                      },
                    ]}
                  >
                    {getStatusLabel(weeklyScore?.status || latestEntry?.status || 'optimal')}
                  </Text>
                </View>
                <Text style={styles.scoreExplanation}>
                  {(weeklyScore?.neuro_load_score || latestEntry?.neuro_load_score || 0) < 30
                    ? 'Your cognitive metrics are close to baseline. Keep up the good work!'
                    : (weeklyScore?.neuro_load_score || latestEntry?.neuro_load_score || 0) < 50
                    ? 'Some metrics have drifted from baseline. Consider rest and recovery.'
                    : 'Notable drift from baseline. Prioritize rest and monitor closely.'}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* History Chart */}
        <Text style={styles.sectionTitle}>Weekly Trend</Text>
        <LineChart data={history} height={220} />

        {/* Individual Scores */}
        <Text style={styles.sectionTitle}>Score Breakdown</Text>
        <View style={styles.scoresGrid}>
          <ScoreCard
            title="Speech"
            score={weeklyScore?.speech_drift_score ?? latestEntry?.speech_drift ?? null}
            color={theme.colors.speechChart}
          />
          <ScoreCard
            title="Cognitive"
            score={weeklyScore?.cognitive_drift_score ?? latestEntry?.cognitive_drift ?? null}
            color={theme.colors.cognitiveChart}
          />
          <ScoreCard
            title="Visual"
            score={weeklyScore?.visual_motor_drift_score ?? latestEntry?.visual_drift ?? null}
            color={theme.colors.visualChart}
          />
        </View>

        {/* Trend Summary */}
        {trends?.has_trends && (
          <Card style={styles.trendCard}>
            <Text style={styles.trendTitle}>Trend Analysis</Text>
            <View style={styles.trendRow}>
              <TrendIndicator label="Overall" trend={trends.overall_trend} />
              <TrendIndicator label="Speech" trend={trends.speech_trend} />
              <TrendIndicator label="Cognitive" trend={trends.cognitive_trend} />
              <TrendIndicator label="Visual" trend={trends.visual_trend} />
            </View>
            {trends.average_neuro_load !== undefined && (
              <Text style={styles.averageText}>
                Average Neuro Load: {trends.average_neuro_load.toFixed(1)}
              </Text>
            )}
          </Card>
        )}

        {/* Empty State */}
        {history.length === 0 && !weeklyScore && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Data Yet</Text>
            <Text style={styles.emptyText}>
              Complete your first weekly assessment to start tracking your cognitive performance.
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

interface ScoreCardProps {
  title: string;
  score: number | null;
  color: string;
}

function ScoreCard({ title, score, color }: ScoreCardProps) {
  return (
    <Card style={styles.scoreCard}>
      <View style={[styles.scoreIndicator, { backgroundColor: color }]} />
      <Text style={styles.scoreCardTitle}>{title}</Text>
      <Text style={[styles.scoreCardValue, { color: score !== null ? getScoreColor(score) : theme.colors.textMuted }]}>
        {score !== null ? Math.round(score) : '--'}
      </Text>
    </Card>
  );
}

interface TrendIndicatorProps {
  label: string;
  trend?: 'increasing' | 'decreasing' | 'stable' | null;
}

function TrendIndicator({ label, trend }: TrendIndicatorProps) {
  const getIcon = () => {
    switch (trend) {
      case 'increasing':
        return '↗';
      case 'decreasing':
        return '↘';
      case 'stable':
        return '→';
      default:
        return '-';
    }
  };

  const getColor = () => {
    switch (trend) {
      case 'increasing':
        return theme.colors.warning;
      case 'decreasing':
        return theme.colors.success;
      case 'stable':
        return theme.colors.textSecondary;
      default:
        return theme.colors.textMuted;
    }
  };

  return (
    <View style={styles.trendItem}>
      <Text style={styles.trendLabel}>{label}</Text>
      <Text style={[styles.trendIcon, { color: getColor() }]}>{getIcon()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  mainScoreCard: {
    marginBottom: theme.spacing.xl,
  },
  cardLabel: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  mainScoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreDetails: {
    flex: 1,
    marginLeft: theme.spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    ...theme.typography.body,
    fontWeight: '600',
  },
  scoreExplanation: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  scoresGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  scoreCard: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  scoreIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: theme.spacing.sm,
  },
  scoreCardTitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  scoreCardValue: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },
  trendCard: {
    marginTop: theme.spacing.lg,
  },
  trendTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendItem: {
    alignItems: 'center',
  },
  trendLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  trendIcon: {
    fontSize: 20,
    fontWeight: '600',
  },
  averageText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  emptyCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
