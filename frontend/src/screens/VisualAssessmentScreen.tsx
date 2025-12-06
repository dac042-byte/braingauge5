import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../utils/theme';
import { Header, Button, Card } from '../components/common';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Phase = 'instructions' | 'tracking' | 'processing' | 'complete';

const TEST_DURATION = 30; // seconds
const DOT_SIZE = 30;
const TRACKING_AREA_HEIGHT = SCREEN_HEIGHT * 0.5;

export default function VisualAssessmentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { userId, assessmentStatus, refreshAll } = useApp();

  const [phase, setPhase] = useState<Phase>('instructions');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState(TEST_DURATION);
  const [blinkCount, setBlinkCount] = useState(0);

  // Tracking metrics
  const [trackingPoints, setTrackingPoints] = useState<{ x: number; y: number }[]>([]);
  const [deviations, setDeviations] = useState(0);
  const [totalDeviation, setTotalDeviation] = useState(0);
  const deviationSamples = useRef(0);

  // Animation
  const dotPosition = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH / 2, y: TRACKING_AREA_HEIGHT / 2 })).current;
  const userPosition = useRef({ x: SCREEN_WIDTH / 2, y: TRACKING_AREA_HEIGHT / 2 });
  const targetPosition = useRef({ x: SCREEN_WIDTH / 2, y: TRACKING_AREA_HEIGHT / 2 });
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const trackingInterval = useRef<NodeJS.Timeout | null>(null);

  const isBaseline = !assessmentStatus?.has_baseline;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (trackingInterval.current) clearInterval(trackingInterval.current);
      if (animationRef.current) animationRef.current.stop();
    };
  }, []);

  // Pan responder for user finger tracking
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        userPosition.current = {
          x: evt.nativeEvent.locationX,
          y: evt.nativeEvent.locationY,
        };
      },
      onPanResponderMove: (evt) => {
        userPosition.current = {
          x: evt.nativeEvent.locationX,
          y: evt.nativeEvent.locationY,
        };
      },
    })
  ).current;

  const startTracking = async () => {
    setPhase('tracking');
    setTimeRemaining(TEST_DURATION);
    setBlinkCount(0);
    setDeviations(0);
    setTotalDeviation(0);
    deviationSamples.current = 0;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Start the dot animation
    animateDot();

    // Start timer
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          endTracking();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Start tracking deviation
    trackingInterval.current = setInterval(() => {
      const dx = userPosition.current.x - targetPosition.current.x;
      const dy = userPosition.current.y - targetPosition.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      setTotalDeviation(prev => prev + distance);
      deviationSamples.current += 1;

      // Count as deviation if more than 50px away
      if (distance > 50) {
        setDeviations(prev => prev + 1);
      }
    }, 100);
  };

  const animateDot = () => {
    const generateNextPoint = () => {
      const padding = 40;
      return {
        x: padding + Math.random() * (SCREEN_WIDTH - 2 * padding - DOT_SIZE),
        y: padding + Math.random() * (TRACKING_AREA_HEIGHT - 2 * padding - DOT_SIZE),
      };
    };

    const moveToNext = () => {
      if (phase !== 'tracking' && phase !== 'instructions') return;

      const next = generateNextPoint();
      targetPosition.current = next;

      // Calculate duration based on distance (smooth pursuit)
      const dx = next.x - (dotPosition.x as any)._value;
      const dy = next.y - (dotPosition.y as any)._value;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const duration = Math.max(1000, Math.min(3000, distance * 3));

      animationRef.current = Animated.timing(dotPosition, {
        toValue: next,
        duration,
        useNativeDriver: false,
      });

      animationRef.current.start(() => {
        // Small pause at each point
        setTimeout(moveToNext, 200);
      });
    };

    moveToNext();
  };

  const handleBlink = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBlinkCount(prev => prev + 1);
  };

  const endTracking = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (trackingInterval.current) clearInterval(trackingInterval.current);
    if (animationRef.current) animationRef.current.stop();

    setPhase('processing');

    try {
      // Calculate metrics
      const avgDeviation = deviationSamples.current > 0
        ? totalDeviation / deviationSamples.current
        : 0;

      // Tracking accuracy: inverse of average deviation (max 100)
      const trackingAccuracy = Math.max(0, Math.min(100, 100 - avgDeviation / 2));

      // Smoothness: based on how few deviations occurred
      const expectedSamples = TEST_DURATION * 10;
      const deviationRate = deviations / expectedSamples;
      const trackingSmoothnessValue = Math.max(0, Math.min(100, 100 - deviationRate * 100));

      const response = await api.submitVisualResults({
        user_id: userId,
        tracking_accuracy: trackingAccuracy,
        tracking_smoothness: trackingSmoothnessValue,
        blink_count: blinkCount,
        test_duration_seconds: TEST_DURATION,
        deviation_events: Math.floor(deviations / 10), // Aggregate deviations
        avg_deviation_distance: avgDeviation,
        is_baseline: isBaseline,
      });

      setResult(response);
      setPhase('complete');

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshAll();
    } catch (err: any) {
      console.error('Failed to submit results:', err);
      setError(err.message || 'Failed to submit results');
      setPhase('instructions');
    }
  };

  const handleComplete = () => {
    navigation.navigate('AssessmentComplete', {
      type: 'visual',
      score: result.visual_motor_drift_score,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Visual Tracking" showBack />

      <View style={styles.content}>
        {phase === 'instructions' && (
          <View style={styles.centeredContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="eye" size={48} color={theme.colors.primary} />
            </View>

            <Text style={styles.title}>Eye Tracking</Text>
            <Text style={styles.subtitle}>
              Follow the moving dot with your finger. Tap the blink button when you blink.
            </Text>

            {error && (
              <Card style={styles.errorCard}>
                <Ionicons name="warning" size={20} color={theme.colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            )}

            <Card style={styles.infoCard}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoText}>
                1. Keep your finger on the moving dot{'\n'}
                2. Follow it as smoothly as possible{'\n'}
                3. Tap the "Blink" button whenever you blink{'\n'}
                4. Test lasts {TEST_DURATION} seconds
              </Text>
            </Card>

            <Button
              title="Start Tracking"
              onPress={startTracking}
              size="large"
              style={styles.button}
            />
          </View>
        )}

        {phase === 'tracking' && (
          <View style={styles.trackingContainer}>
            <View style={styles.trackingHeader}>
              <Text style={styles.timerText}>{timeRemaining}s</Text>
              <TouchableOpacity style={styles.blinkButton} onPress={handleBlink}>
                <Ionicons name="eye-off" size={20} color={theme.colors.text} />
                <Text style={styles.blinkText}>Blink ({blinkCount})</Text>
              </TouchableOpacity>
            </View>

            <View
              style={styles.trackingArea}
              {...panResponder.panHandlers}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    left: Animated.subtract(dotPosition.x, DOT_SIZE / 2),
                    top: Animated.subtract(dotPosition.y, DOT_SIZE / 2),
                  },
                ]}
              />
              <Text style={styles.trackingHint}>
                Keep your finger on the dot
              </Text>
            </View>
          </View>
        )}

        {phase === 'processing' && (
          <View style={styles.centeredContent}>
            <View style={styles.loadingSpinner}>
              <Ionicons name="sync" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.processingText}>Analyzing tracking data...</Text>
          </View>
        )}

        {phase === 'complete' && result && (
          <View style={styles.centeredContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
            </View>

            <Text style={styles.completeTitle}>Tracking Complete</Text>

            <Card style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Visual-Motor Drift Score</Text>
                <Text style={styles.resultValue}>
                  {Math.round(result.visual_motor_drift_score)}
                </Text>
              </View>

              {result.is_baseline && (
                <View style={styles.baselineTag}>
                  <Text style={styles.baselineText}>Baseline Established</Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.metricsGrid}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {result.tracking_accuracy.toFixed(0)}%
                  </Text>
                  <Text style={styles.metricLabel}>Accuracy</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {result.blink_rate.toFixed(1)}
                  </Text>
                  <Text style={styles.metricLabel}>Blinks/min</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {result.tracking_smoothness.toFixed(0)}%
                  </Text>
                  <Text style={styles.metricLabel}>Smoothness</Text>
                </View>
              </View>
            </Card>

            <Button
              title="Continue"
              onPress={handleComplete}
              size="large"
              style={styles.button}
            />
          </View>
        )}
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
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    marginBottom: theme.spacing.lg,
    width: '100%',
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.error,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  infoCard: {
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  infoTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    marginTop: theme.spacing.md,
  },
  trackingContainer: {
    flex: 1,
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  blinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    gap: 8,
  },
  blinkText: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  trackingArea: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: theme.colors.primary,
  },
  trackingHint: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    alignSelf: 'center',
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  loadingSpinner: {
    marginBottom: theme.spacing.lg,
  },
  processingText: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  successIcon: {
    marginBottom: theme.spacing.lg,
  },
  completeTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
  },
  resultCard: {
    width: '100%',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  resultValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  baselineTag: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
  },
  baselineText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  metricLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
});
