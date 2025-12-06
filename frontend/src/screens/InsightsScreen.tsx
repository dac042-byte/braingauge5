import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme, getStatusColor } from '../utils/theme';
import { Card } from '../components/common';
import { useApp } from '../context/AppContext';

interface InsightItem {
  type: 'info' | 'warning' | 'success';
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { history, trends, weeklyScore, refreshAll } = useApp();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    refreshAll();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const generateInsights = (): InsightItem[] => {
    const insights: InsightItem[] = [];

    if (!trends?.has_trends && history.length < 2) {
      return [
        {
          type: 'info',
          title: 'Building Your Profile',
          description:
            'Complete at least 2 weeks of assessments to start seeing personalized insights about your cognitive performance trends.',
          icon: 'time-outline',
        },
      ];
    }

    // Most changed area
    if (trends?.most_changed_area) {
      const areaLabels: Record<string, string> = {
        speech: 'Speech patterns',
        cognitive: 'Cognitive performance',
        visual: 'Visual-motor tracking',
      };
      const areaDescriptions: Record<string, string> = {
        speech:
          'Your speech metrics showed the most change this week. This could indicate changes in processing speed or focus. Consider if stress or fatigue might be factors.',
        cognitive:
          'Your cognitive test results showed the most change. Reaction time and working memory can be affected by sleep, stress, or training load.',
        visual:
          'Your visual tracking showed the most change. Eye movement control can be sensitive to fatigue, dehydration, or intense training.',
      };

      insights.push({
        type: 'warning',
        title: `${areaLabels[trends.most_changed_area]} Changed Most`,
        description: areaDescriptions[trends.most_changed_area],
        icon: 'trending-up',
      });
    }

    // Overall trend
    if (trends?.overall_trend) {
      if (trends.overall_trend === 'decreasing') {
        insights.push({
          type: 'success',
          title: 'Positive Trend',
          description:
            'Your Neuro Load Score is decreasing, meaning you\'re getting closer to your baseline. Your recovery and performance strategies are working.',
          icon: 'trending-down',
        });
      } else if (trends.overall_trend === 'increasing') {
        insights.push({
          type: 'warning',
          title: 'Increasing Drift',
          description:
            'Your Neuro Load Score has been increasing. Consider reviewing your sleep, stress levels, and training intensity. Rest and recovery may help.',
          icon: 'trending-up',
        });
      } else {
        insights.push({
          type: 'info',
          title: 'Stable Performance',
          description:
            'Your cognitive metrics have remained relatively stable. Continue your current routines and monitor for any changes.',
          icon: 'remove-outline',
        });
      }
    }

    // Status-based insights
    if (weeklyScore?.status) {
      switch (weeklyScore.status) {
        case 'optimal':
          insights.push({
            type: 'success',
            title: 'Optimal Zone',
            description:
              'You\'re performing close to your baseline. This is a great time for skill work, tactical training, or competition.',
            icon: 'checkmark-circle-outline',
          });
          break;
        case 'moderate':
          insights.push({
            type: 'info',
            title: 'Moderate Drift',
            description:
              'Some deviation from baseline detected. Standard training can continue, but pay attention to recovery quality.',
            icon: 'alert-circle-outline',
          });
          break;
        case 'elevated':
          insights.push({
            type: 'warning',
            title: 'Elevated Load',
            description:
              'Notable drift from baseline. Consider reducing training intensity and prioritizing sleep and nutrition.',
            icon: 'warning-outline',
          });
          break;
        case 'high':
          insights.push({
            type: 'warning',
            title: 'High Load Detected',
            description:
              'Significant drift from your baseline. Prioritize rest and recovery. Consider light activity only until scores improve.',
            icon: 'alert-outline',
          });
          break;
      }
    }

    // Week count insight
    if (history.length > 0) {
      insights.push({
        type: 'info',
        title: `${history.length} Week${history.length > 1 ? 's' : ''} of Data`,
        description:
          history.length < 4
            ? 'Continue weekly assessments to build a more complete picture of your cognitive performance patterns.'
            : 'You have a solid baseline of data. Trends and patterns are becoming more reliable.',
        icon: 'calendar-outline',
      });
    }

    // Average load insight
    if (trends?.average_neuro_load !== undefined) {
      const avg = trends.average_neuro_load;
      insights.push({
        type: avg < 30 ? 'success' : avg < 50 ? 'info' : 'warning',
        title: `Average Score: ${avg.toFixed(1)}`,
        description:
          avg < 30
            ? 'Your average Neuro Load Score is low, indicating consistent performance near your baseline.'
            : avg < 50
            ? 'Your average shows moderate drift. Look for patterns in when scores are higher or lower.'
            : 'Your average indicates regular drift from baseline. Consider lifestyle or training adjustments.',
        icon: 'analytics-outline',
      });
    }

    return insights;
  };

  const insights = generateInsights();

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
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>Understanding your cognitive trends</Text>
        </View>

        {/* Insights List */}
        {insights.map((insight, index) => (
          <InsightCard key={index} {...insight} />
        ))}

        {/* Disclaimer */}
        <Card style={styles.disclaimer}>
          <Ionicons
            name="information-circle"
            size={20}
            color={theme.colors.textMuted}
          />
          <Text style={styles.disclaimerText}>
            These insights are for performance awareness only and are not medical
            advice. Always consult healthcare professionals for medical concerns.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

function InsightCard({ type, title, description, icon }: InsightItem) {
  const getColor = () => {
    switch (type) {
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.primary;
    }
  };

  const color = getColor();

  return (
    <Card style={styles.insightCard}>
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.insightContent}>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={styles.insightDescription}>{description}</Text>
      </View>
    </Card>
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
  insightCard: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  insightTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.surfaceLight,
  },
  disclaimerText: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});
