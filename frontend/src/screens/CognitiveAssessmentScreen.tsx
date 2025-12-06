import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Phase = 'instructions' | 'reaction' | 'nback' | 'processing' | 'complete';

const REACTION_TRIALS = 10;
const NBACK_TRIALS = 20;
const NBACK_N = 2;

export default function CognitiveAssessmentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { userId, assessmentStatus, refreshAll } = useApp();

  const [phase, setPhase] = useState<Phase>('instructions');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Reaction test state
  const [reactionTrial, setReactionTrial] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [reactionCorrect, setReactionCorrect] = useState(0);
  const [showTarget, setShowTarget] = useState(false);
  const [waitingForTap, setWaitingForTap] = useState(false);
  const targetStartTime = useRef<number>(0);
  const reactionTimeout = useRef<NodeJS.Timeout | null>(null);

  // N-back test state
  const [nbackTrial, setNbackTrial] = useState(0);
  const [nbackSequence, setNbackSequence] = useState<number[]>([]);
  const [nbackCorrect, setNbackCorrect] = useState(0);
  const [nbackTotal, setNbackTotal] = useState(0);
  const [nbackResponseTimes, setNbackResponseTimes] = useState<number[]>([]);
  const [currentSymbol, setCurrentSymbol] = useState<number | null>(null);
  const [nbackPhase, setNbackPhase] = useState<'show' | 'wait'>('show');
  const nbackStartTime = useRef<number>(0);
  const nbackTimeout = useRef<NodeJS.Timeout | null>(null);

  const isBaseline = !assessmentStatus?.has_baseline;
  const targetOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
      if (nbackTimeout.current) clearTimeout(nbackTimeout.current);
    };
  }, []);

  // Generate N-back sequence
  const generateNbackSequence = useCallback(() => {
    const symbols = [1, 2, 3, 4]; // 4 different symbols
    const sequence: number[] = [];
    const matchProbability = 0.3; // 30% match rate

    for (let i = 0; i < NBACK_TRIALS; i++) {
      if (i >= NBACK_N && Math.random() < matchProbability) {
        // Create a match
        sequence.push(sequence[i - NBACK_N]);
      } else {
        // Random symbol (avoid accidental matches if possible)
        let newSymbol;
        do {
          newSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        } while (i >= NBACK_N && newSymbol === sequence[i - NBACK_N] && Math.random() > 0.5);
        sequence.push(newSymbol);
      }
    }
    return sequence;
  }, []);

  // Start reaction test
  const startReactionTest = () => {
    setPhase('reaction');
    setReactionTrial(0);
    setReactionTimes([]);
    setReactionCorrect(0);
    scheduleNextTarget();
  };

  const scheduleNextTarget = () => {
    // Random delay between 1-3 seconds
    const delay = 1000 + Math.random() * 2000;
    reactionTimeout.current = setTimeout(() => {
      setShowTarget(true);
      setWaitingForTap(true);
      targetStartTime.current = Date.now();

      Animated.timing(targetOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();

      // Auto-fail after 2 seconds
      reactionTimeout.current = setTimeout(() => {
        if (waitingForTap) {
          handleReactionMiss();
        }
      }, 2000);
    }, delay);
  };

  const handleReactionTap = async () => {
    if (!waitingForTap) return;

    const reactionTime = Date.now() - targetStartTime.current;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setWaitingForTap(false);
    setShowTarget(false);
    targetOpacity.setValue(0);

    if (reactionTimeout.current) {
      clearTimeout(reactionTimeout.current);
    }

    setReactionTimes(prev => [...prev, reactionTime]);
    setReactionCorrect(prev => prev + 1);

    const newTrial = reactionTrial + 1;
    setReactionTrial(newTrial);

    if (newTrial >= REACTION_TRIALS) {
      // Start N-back test
      startNbackTest();
    } else {
      scheduleNextTarget();
    }
  };

  const handleReactionMiss = () => {
    setWaitingForTap(false);
    setShowTarget(false);
    targetOpacity.setValue(0);

    // Record a penalty reaction time
    setReactionTimes(prev => [...prev, 2000]);

    const newTrial = reactionTrial + 1;
    setReactionTrial(newTrial);

    if (newTrial >= REACTION_TRIALS) {
      startNbackTest();
    } else {
      scheduleNextTarget();
    }
  };

  // Start N-back test
  const startNbackTest = () => {
    const sequence = generateNbackSequence();
    setNbackSequence(sequence);
    setNbackTrial(0);
    setNbackCorrect(0);
    setNbackTotal(0);
    setNbackResponseTimes([]);
    setPhase('nback');

    // Short delay before starting
    setTimeout(() => {
      showNbackSymbol(0, sequence);
    }, 1000);
  };

  const showNbackSymbol = (index: number, sequence: number[]) => {
    if (index >= NBACK_TRIALS) {
      submitResults();
      return;
    }

    setCurrentSymbol(sequence[index]);
    setNbackPhase('show');
    setNbackTrial(index);
    nbackStartTime.current = Date.now();

    // Show for 1.5 seconds, then wait 0.5 seconds
    nbackTimeout.current = setTimeout(() => {
      setNbackPhase('wait');

      // Check if this was a match trial
      const isMatch = index >= NBACK_N && sequence[index] === sequence[index - NBACK_N];

      // Wait 0.5 seconds then move to next
      nbackTimeout.current = setTimeout(() => {
        setCurrentSymbol(null);

        // If it was a match and user didn't respond, count as miss
        if (isMatch) {
          setNbackTotal(prev => prev + 1);
        }

        showNbackSymbol(index + 1, sequence);
      }, 500);
    }, 1500);
  };

  const handleNbackResponse = async () => {
    if (nbackPhase !== 'show' && nbackPhase !== 'wait') return;

    const responseTime = Date.now() - nbackStartTime.current;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentIndex = nbackTrial;
    const isMatch = currentIndex >= NBACK_N && nbackSequence[currentIndex] === nbackSequence[currentIndex - NBACK_N];

    setNbackTotal(prev => prev + 1);

    if (isMatch) {
      setNbackCorrect(prev => prev + 1);
      setNbackResponseTimes(prev => [...prev, responseTime]);
    }

    // Clear current timeout and move to next
    if (nbackTimeout.current) {
      clearTimeout(nbackTimeout.current);
    }

    setCurrentSymbol(null);
    setTimeout(() => {
      showNbackSymbol(currentIndex + 1, nbackSequence);
    }, 300);
  };

  // Submit results
  const submitResults = async () => {
    setPhase('processing');

    try {
      const accuracy = reactionTimes.length > 0
        ? (reactionCorrect / REACTION_TRIALS) * 100
        : 0;

      const avgNbackTime = nbackResponseTimes.length > 0
        ? nbackResponseTimes.reduce((a, b) => a + b, 0) / nbackResponseTimes.length
        : 1000;

      const response = await api.submitCognitiveResults({
        user_id: userId,
        reaction_times: reactionTimes,
        reaction_accuracy: accuracy,
        n_back_correct: nbackCorrect,
        n_back_total: Math.max(nbackTotal, 1),
        n_back_avg_response_time: avgNbackTime,
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
      type: 'cognitive',
      score: result.cognitive_drift_score,
    });
  };

  const getSymbolIcon = (num: number): keyof typeof Ionicons.glyphMap => {
    const icons: (keyof typeof Ionicons.glyphMap)[] = ['square', 'triangle', 'ellipse', 'star'];
    return icons[num - 1] || 'square';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Cognitive Tests" showBack />

      <View style={styles.content}>
        {phase === 'instructions' && (
          <View style={styles.centeredContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="fitness" size={48} color={theme.colors.primary} />
            </View>

            <Text style={styles.title}>Cognitive Assessment</Text>
            <Text style={styles.subtitle}>Two quick tests to measure your cognitive performance</Text>

            {error && (
              <Card style={styles.errorCard}>
                <Ionicons name="warning" size={20} color={theme.colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            )}

            <Card style={styles.infoCard}>
              <Text style={styles.infoTitle}>Test 1: Reaction Time</Text>
              <Text style={styles.infoText}>
                Tap the circle as quickly as possible when it appears. 10 trials.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.infoTitle}>Test 2: 2-Back Memory</Text>
              <Text style={styles.infoText}>
                Tap when the current shape matches the shape from 2 steps ago. 20 trials.
              </Text>
            </Card>

            <Button
              title="Start Tests"
              onPress={startReactionTest}
              size="large"
              style={styles.button}
            />
          </View>
        )}

        {phase === 'reaction' && (
          <TouchableOpacity
            style={styles.reactionArea}
            onPress={handleReactionTap}
            activeOpacity={1}
          >
            <Text style={styles.trialCounter}>
              {reactionTrial + 1} / {REACTION_TRIALS}
            </Text>
            <Text style={styles.reactionLabel}>Tap when the circle appears</Text>

            <View style={styles.targetContainer}>
              <Animated.View
                style={[
                  styles.target,
                  { opacity: targetOpacity },
                ]}
              />
            </View>

            {!showTarget && (
              <Text style={styles.waitText}>Wait for the circle...</Text>
            )}
          </TouchableOpacity>
        )}

        {phase === 'nback' && (
          <TouchableOpacity
            style={styles.nbackArea}
            onPress={handleNbackResponse}
            activeOpacity={0.9}
          >
            <Text style={styles.trialCounter}>
              {nbackTrial + 1} / {NBACK_TRIALS}
            </Text>
            <Text style={styles.nbackLabel}>
              Tap if this matches 2 shapes ago
            </Text>

            <View style={styles.symbolContainer}>
              {currentSymbol !== null ? (
                <Ionicons
                  name={getSymbolIcon(currentSymbol)}
                  size={120}
                  color={theme.colors.primary}
                />
              ) : (
                <View style={styles.emptySymbol} />
              )}
            </View>

            <Text style={styles.nbackHint}>
              Remember the pattern - tap only for matches!
            </Text>
          </TouchableOpacity>
        )}

        {phase === 'processing' && (
          <View style={styles.centeredContent}>
            <View style={styles.loadingSpinner}>
              <Ionicons name="sync" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.processingText}>Calculating results...</Text>
          </View>
        )}

        {phase === 'complete' && result && (
          <View style={styles.centeredContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
            </View>

            <Text style={styles.completeTitle}>Tests Complete</Text>

            <Card style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Cognitive Drift Score</Text>
                <Text style={styles.resultValue}>
                  {Math.round(result.cognitive_drift_score)}
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
                    {result.avg_reaction_time.toFixed(0)}ms
                  </Text>
                  <Text style={styles.metricLabel}>Avg Reaction</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {result.n_back_accuracy.toFixed(0)}%
                  </Text>
                  <Text style={styles.metricLabel}>N-Back Accuracy</Text>
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
    marginBottom: 4,
  },
  infoText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  button: {
    width: '100%',
    marginTop: theme.spacing.md,
  },
  reactionArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialCounter: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    position: 'absolute',
    top: 20,
  },
  reactionLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  targetContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  target: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary,
  },
  waitText: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xl,
  },
  nbackArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nbackLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  symbolContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySymbol: {
    width: 120,
    height: 120,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  nbackHint: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xl,
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
