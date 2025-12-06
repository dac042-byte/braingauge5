import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme, getStatusColor, getStatusLabel } from '../utils/theme';
import { Card, ProgressRing } from '../components/common';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AssessmentCardProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  completed: boolean;
  score?: number;
  onPress: () => void;
  duration: string;
}

function AssessmentCard({
  title,
  description,
  icon,
  completed,
  score,
  onPress,
  duration,
}: AssessmentCardProps) {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Card style={[styles.assessmentCard, completed && styles.completedCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, completed && styles.completedIcon]}>
            <Ionicons
              name={completed ? 'checkmark' : icon}
              size={24}
              color={completed ? theme.colors.success : theme.colors.primary}
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDescription}>{description}</Text>
          </View>
          {completed && score !== undefined ? (
            <View style={styles.scoreContainer}>
              <Text style={[styles.scoreText, { color: theme.colors.primary }]}>
                {Math.round(score)}
              </Text>
            </View>
          ) : (
            <View style={styles.durationContainer}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          )}
        </View>
        {!completed && (
          <View style={styles.startButton}>
            <Text style={styles.startText}>Start Assessment</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const {
    assessmentStatus,
    weeklyScore,
    isLoading,
    refreshAll,
    finalizeWeek,
  } = useApp();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    refreshAll();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const completed = assessmentStatus?.completed || {
    speech: false,
    cognitive: false,
    visual: false,
  };

  const scores = assessmentStatus?.scores || {};
  const allComplete = completed.speech && completed.cognitive && completed.visual;
  const weekNumber = assessmentStatus?.week_number || 1;
  const isBaseline = !assessmentStatus?.has_baseline;

  const handleFinalize = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await finalizeWeek();
    await refreshAll();
  };

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
          <Text style={styles.greeting}>Weekly Check-In</Text>
          <Text style={styles.weekLabel}>
            {isBaseline ? 'Baseline Week' : `Week ${weekNumber}`}
          </Text>
        </View>

        {/* Current Score (if any assessments complete) */}
        {weeklyScore && (
          <Card style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <View>
                <Text style={styles.scoreLabel}>NEURO LOAD SCORE</Text>
                <View style={styles.statusBadge}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(weeklyScore.status) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(weeklyScore.status) },
                    ]}
                  >
                    {getStatusLabel(weeklyScore.status)}
                  </Text>
                </View>
              </View>
              <ProgressRing
                score={weeklyScore.neuro_load_score}
                size={80}
                strokeWidth={8}
              />
            </View>
          </Card>
        )}

        {/* Assessments */}
        <Text style={styles.sectionTitle}>Assessments</Text>

        <AssessmentCard
          title="Speech Analysis"
          description="Read a passage aloud for 30-60 seconds"
          icon="mic-outline"
          completed={completed.speech}
          score={scores.speech}
          duration="~1 min"
          onPress={() => navigation.navigate('SpeechAssessment')}
        />

        <AssessmentCard
          title="Cognitive Tests"
          description="Reaction time and memory tests"
          icon="fitness-outline"
          completed={completed.cognitive}
          score={scores.cognitive}
          duration="~2 min"
          onPress={() => navigation.navigate('CognitiveAssessment')}
        />

        <AssessmentCard
          title="Visual Tracking"
          description="Follow a moving dot with your eyes"
          icon="eye-outline"
          completed={completed.visual}
          score={scores.visual}
          duration="~1 min"
          onPress={() => navigation.navigate('VisualAssessment')}
        />

        {/* Finalize Week Button */}
        {allComplete && (
          <TouchableOpacity style={styles.finalizeButton} onPress={handleFinalize}>
            <Text style={styles.finalizeText}>Complete Week {weekNumber}</Text>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.infoText}>
            {isBaseline
              ? 'This is your baseline week. Complete all assessments to establish your personal reference.'
              : 'Complete all three assessments to get your weekly Neuro Load Score. Higher scores indicate greater drift from your baseline.'}
          </Text>
        </Card>
      </ScrollView>
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
  greeting: {
    ...theme.typography.h1,
    color: theme.colors.text,
  },
  weekLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  scoreCard: {
    marginBottom: theme.spacing.xl,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  assessmentCard: {
    marginBottom: theme.spacing.md,
  },
  completedCard: {
    borderWidth: 1,
    borderColor: theme.colors.success,
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedIcon: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  cardInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  cardTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  cardDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  durationContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 8,
  },
  durationText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  scoreContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  startText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: '600',
    marginRight: 8,
  },
  finalizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    marginTop: theme.spacing.md,
    gap: 8,
  },
  finalizeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.surfaceLight,
  },
  infoText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    flex: 1,
    lineHeight: 20,
  },
});
