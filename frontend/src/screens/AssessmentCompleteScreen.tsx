import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme, getScoreColor } from '../utils/theme';
import { Button, Card, ProgressRing } from '../components/common';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, 'AssessmentComplete'>;

export default function AssessmentCompleteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();

  const { type, score } = route.params;

  const getAssessmentInfo = () => {
    switch (type) {
      case 'speech':
        return {
          title: 'Speech Analysis',
          icon: 'mic' as keyof typeof Ionicons.glyphMap,
          description: 'Your speech patterns have been analyzed and compared to your baseline.',
        };
      case 'cognitive':
        return {
          title: 'Cognitive Tests',
          icon: 'fitness' as keyof typeof Ionicons.glyphMap,
          description: 'Your reaction time and memory performance have been measured.',
        };
      case 'visual':
        return {
          title: 'Visual Tracking',
          icon: 'eye' as keyof typeof Ionicons.glyphMap,
          description: 'Your eye movement and tracking accuracy have been recorded.',
        };
      default:
        return {
          title: 'Assessment',
          icon: 'checkmark' as keyof typeof Ionicons.glyphMap,
          description: 'Assessment completed.',
        };
    }
  };

  const getScoreInterpretation = (score: number) => {
    if (score < 20) {
      return {
        status: 'Excellent',
        message: 'Your performance is very close to your baseline. Great job maintaining consistency!',
        color: theme.colors.optimal,
      };
    } else if (score < 40) {
      return {
        status: 'Good',
        message: 'Minor drift from baseline detected. This is within normal variation.',
        color: theme.colors.moderate,
      };
    } else if (score < 60) {
      return {
        status: 'Moderate',
        message: 'Notable change from your baseline. Consider factors like sleep, stress, or training load.',
        color: theme.colors.elevated,
      };
    } else {
      return {
        status: 'Elevated',
        message: 'Significant drift detected. Prioritize rest and recovery, and monitor your wellbeing.',
        color: theme.colors.high,
      };
    }
  };

  const info = getAssessmentInfo();
  const interpretation = getScoreInterpretation(score);

  const handleContinue = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Main');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${interpretation.color}20` }]}>
            <Ionicons name={info.icon} size={32} color={interpretation.color} />
          </View>
          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.subtitle}>Complete</Text>
        </View>

        <View style={styles.scoreSection}>
          <ProgressRing
            score={score}
            size={160}
            strokeWidth={14}
            label="Drift Score"
          />
        </View>

        <Card style={styles.interpretationCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: `${interpretation.color}20` }]}>
              <Text style={[styles.statusText, { color: interpretation.color }]}>
                {interpretation.status}
              </Text>
            </View>
          </View>
          <Text style={styles.message}>{interpretation.message}</Text>
        </Card>

        <Card style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.infoText}>{info.description}</Text>
        </Card>

        <View style={styles.footer}>
          <Button
            title="Back to Check-In"
            onPress={handleContinue}
            size="large"
            style={styles.button}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  scoreSection: {
    alignItems: 'center',
    marginVertical: theme.spacing.xxl,
  },
  interpretationCard: {
    marginBottom: theme.spacing.lg,
  },
  statusRow: {
    marginBottom: theme.spacing.md,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    ...theme.typography.body,
    fontWeight: '600',
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceLight,
  },
  infoText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: theme.spacing.xl,
  },
  button: {
    width: '100%',
  },
});
