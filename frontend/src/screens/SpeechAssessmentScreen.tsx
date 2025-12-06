import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../utils/theme';
import { Header, Button, Card } from '../components/common';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { READING_PASSAGES, RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Phase = 'instructions' | 'recording' | 'processing' | 'complete';

export default function SpeechAssessmentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { userId, assessmentStatus, refreshAll } = useApp();

  const [phase, setPhase] = useState<Phase>('instructions');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [passage] = useState(
    READING_PASSAGES[Math.floor(Math.random() * READING_PASSAGES.length)]
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isBaseline = !assessmentStatus?.has_baseline;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (phase === 'recording') {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [phase]);

  const startRecording = async () => {
    try {
      setError(null);

      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone access is needed for speech assessment.');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setPhase('recording');
      setRecordingDuration(0);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPhase('processing');

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error('No recording URI');
      }

      // Check minimum duration
      if (recordingDuration < 15) {
        setError('Recording too short. Please read for at least 20 seconds.');
        setPhase('instructions');
        return;
      }

      // Upload to server
      const response = await api.uploadAudio(uri, userId, isBaseline);
      setResult(response);
      setPhase('complete');

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshAll();
    } catch (err: any) {
      console.error('Failed to process recording:', err);
      setError(err.message || 'Failed to process recording. Please try again.');
      setPhase('instructions');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleComplete = () => {
    navigation.navigate('AssessmentComplete', {
      type: 'speech',
      score: result.drift_score,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Speech Analysis" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'instructions' && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="mic" size={48} color={theme.colors.primary} />
            </View>

            <Text style={styles.title}>Read Aloud</Text>
            <Text style={styles.subtitle}>
              Read the following passage at your normal pace for 30-60 seconds
            </Text>

            {error && (
              <Card style={styles.errorCard}>
                <Ionicons name="warning" size={20} color={theme.colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            )}

            <Card style={styles.passageCard}>
              <Text style={styles.passageTitle}>{passage.title}</Text>
              <Text style={styles.passageText}>{passage.text}</Text>
            </Card>

            <Button
              title="Start Recording"
              onPress={startRecording}
              size="large"
              icon={<Ionicons name="mic" size={20} color="#fff" />}
              style={styles.button}
            />
          </>
        )}

        {phase === 'recording' && (
          <View style={styles.recordingContainer}>
            <Animated.View
              style={[
                styles.recordingIndicator,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View style={styles.recordingDot} />
            </Animated.View>

            <Text style={styles.recordingLabel}>Recording...</Text>
            <Text style={styles.timer}>{formatTime(recordingDuration)}</Text>

            <Card style={styles.passageCard}>
              <Text style={styles.passageTitle}>{passage.title}</Text>
              <Text style={styles.passageText}>{passage.text}</Text>
            </Card>

            <Text style={styles.hint}>
              {recordingDuration < 20
                ? `Keep reading for at least ${20 - recordingDuration} more seconds`
                : 'Tap Stop when finished'}
            </Text>

            <Button
              title="Stop Recording"
              onPress={stopRecording}
              variant="secondary"
              size="large"
              disabled={recordingDuration < 15}
              icon={<Ionicons name="stop" size={20} color={theme.colors.text} />}
              style={styles.button}
            />
          </View>
        )}

        {phase === 'processing' && (
          <View style={styles.processingContainer}>
            <View style={styles.loadingSpinner}>
              <Ionicons name="sync" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.processingText}>Analyzing speech...</Text>
            <Text style={styles.processingSubtext}>
              This may take a few seconds
            </Text>
          </View>
        )}

        {phase === 'complete' && result && (
          <View style={styles.completeContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
            </View>

            <Text style={styles.completeTitle}>Analysis Complete</Text>

            <Card style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Speech Drift Score</Text>
                <Text style={styles.resultValue}>
                  {Math.round(result.drift_score)}
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
                    {result.features.words_per_minute.toFixed(0)}
                  </Text>
                  <Text style={styles.metricLabel}>Words/min</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {result.features.filler_word_count}
                  </Text>
                  <Text style={styles.metricLabel}>Filler words</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {result.features.average_pause_length.toFixed(2)}s
                  </Text>
                  <Text style={styles.metricLabel}>Avg pause</Text>
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
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
  },
  errorText: {
    ...theme.typography.bodySmall,
    color: theme.colors.error,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  passageCard: {
    marginBottom: theme.spacing.xl,
  },
  passageTitle: {
    ...theme.typography.h3,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  passageText: {
    ...theme.typography.body,
    color: theme.colors.text,
    lineHeight: 26,
  },
  button: {
    marginTop: theme.spacing.md,
  },
  recordingContainer: {
    alignItems: 'center',
  },
  recordingIndicator: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  recordingDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.error,
  },
  recordingLabel: {
    ...theme.typography.h3,
    color: theme.colors.error,
  },
  timer: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.text,
    marginVertical: theme.spacing.md,
  },
  hint: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  loadingSpinner: {
    marginBottom: theme.spacing.lg,
  },
  processingText: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  processingSubtext: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  completeContainer: {
    alignItems: 'center',
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
