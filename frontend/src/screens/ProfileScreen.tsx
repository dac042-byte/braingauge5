import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme } from '../utils/theme';
import { Card, Button } from '../components/common';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    userId,
    serverUrl,
    setServerUrl,
    resetBaseline,
    history,
    assessmentStatus,
    isOnline,
  } = useApp();

  const [editingServer, setEditingServer] = useState(false);
  const [tempServerUrl, setTempServerUrl] = useState(serverUrl);
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleSaveServer = async () => {
    await setServerUrl(tempServerUrl);
    setEditingServer(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleResetBaseline = () => {
    Alert.alert(
      'Reset Baseline',
      'This will clear your baseline data. Your next assessment will establish a new baseline. History will be preserved. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetBaseline();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Baseline has been reset.');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset baseline. Please try again.');
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await api.exportData(userId);
      const jsonString = JSON.stringify(data, null, 2);

      await Share.share({
        message: jsonString,
        title: 'BrainGauge Data Export',
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Settings and data management</Text>
        </View>

        {/* Connection Status */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Server Connection</Text>
              <Text style={styles.statusValue}>
                {isOnline ? 'Connected' : 'Offline'}
              </Text>
            </View>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isOnline ? theme.colors.success : theme.colors.error },
              ]}
            />
          </View>
        </Card>

        {/* Server URL */}
        <Text style={styles.sectionTitle}>Server Settings</Text>
        <Card style={styles.settingCard}>
          <Text style={styles.settingLabel}>Backend URL</Text>
          {editingServer ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.input}
                value={tempServerUrl}
                onChangeText={setTempServerUrl}
                placeholder="http://localhost:8000"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingServer(false);
                    setTempServerUrl(serverUrl);
                  }}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveServer} style={styles.saveButton}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setEditingServer(true)}
              style={styles.settingValue}
            >
              <Text style={styles.settingValueText} numberOfLines={1}>
                {serverUrl}
              </Text>
              <Ionicons name="pencil" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </Card>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{history.length}</Text>
            <Text style={styles.statLabel}>Weeks Tracked</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>
              {assessmentStatus?.week_number || 1}
            </Text>
            <Text style={styles.statLabel}>Current Week</Text>
          </Card>
        </View>

        {/* User ID */}
        <Card style={styles.settingCard}>
          <Text style={styles.settingLabel}>User ID</Text>
          <Text style={styles.userId}>{userId}</Text>
        </Card>

        {/* Actions */}
        <Text style={styles.sectionTitle}>Data Management</Text>

        <Button
          title="Export All Data"
          onPress={handleExportData}
          variant="secondary"
          loading={isExporting}
          icon={
            <Ionicons
              name="download-outline"
              size={20}
              color={theme.colors.text}
            />
          }
          style={styles.actionButton}
        />

        <Button
          title="Reset Baseline"
          onPress={handleResetBaseline}
          variant="outline"
          loading={isResetting}
          icon={
            <Ionicons
              name="refresh-outline"
              size={20}
              color={theme.colors.primary}
            />
          }
          style={styles.actionButton}
        />

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        <Card style={styles.aboutCard}>
          <Text style={styles.appName}>BrainGauge</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
          <Text style={styles.aboutText}>
            Cognitive Performance Tracker for Athletes.{'\n'}
            Track your cognitive metrics and monitor trends over time.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.disclaimer}>
            This app is for performance awareness only and is not a medical device.
            Always consult healthcare professionals for medical concerns.
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
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  statusCard: {
    marginBottom: theme.spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusInfo: {},
  statusLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  statusValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  sectionTitle: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  settingCard: {
    marginBottom: theme.spacing.sm,
  },
  settingLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingValueText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    marginRight: 8,
  },
  editContainer: {},
  input: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: theme.spacing.sm,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  saveText: {
    color: '#fff',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  userId: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontFamily: 'monospace',
  },
  actionButton: {
    marginBottom: theme.spacing.sm,
  },
  aboutCard: {
    alignItems: 'center',
  },
  appName: {
    ...theme.typography.h2,
    color: theme.colors.primary,
  },
  version: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  aboutText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    width: '100%',
    marginVertical: theme.spacing.md,
  },
  disclaimer: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
