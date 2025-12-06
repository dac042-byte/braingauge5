import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AssessmentStatus, HistoryEntry, WeeklyScore, TrendData } from '../types';
import { api } from '../services/api';

interface AppState {
  userId: string;
  isLoading: boolean;
  assessmentStatus: AssessmentStatus | null;
  weeklyScore: WeeklyScore | null;
  history: HistoryEntry[];
  trends: TrendData | null;
  serverUrl: string;
  isOnline: boolean;
}

interface AppContextType extends AppState {
  refreshStatus: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshWeeklyScore: () => Promise<void>;
  refreshTrends: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  resetBaseline: () => Promise<void>;
  finalizeWeek: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER_ID: '@braingauge_user_id',
  SERVER_URL: '@braingauge_server_url',
};

const DEFAULT_SERVER_URL = 'http://localhost:8000';

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    userId: '',
    isLoading: true,
    assessmentStatus: null,
    weeklyScore: null,
    history: [],
    trends: null,
    serverUrl: DEFAULT_SERVER_URL,
    isOnline: true,
  });

  // Initialize user ID and server URL
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Get or create user ID
      let userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
      if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userId);
      }

      // Get server URL
      let serverUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
      if (!serverUrl) {
        serverUrl = DEFAULT_SERVER_URL;
      }

      api.setBaseUrl(serverUrl);

      setState(prev => ({
        ...prev,
        userId,
        serverUrl,
        isLoading: false,
      }));

      // Initial data fetch
      await refreshAllData(userId);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const refreshAllData = async (userId: string) => {
    try {
      const [status, history, trends] = await Promise.all([
        api.getAssessmentStatus(userId).catch(() => null),
        api.getHistory(userId).catch(() => []),
        api.getTrends(userId).catch(() => null),
      ]);

      let weeklyScore = null;
      if (status?.completed?.speech || status?.completed?.cognitive || status?.completed?.visual) {
        weeklyScore = await api.getWeeklyScore(userId).catch(() => null);
      }

      setState(prev => ({
        ...prev,
        assessmentStatus: status,
        history: history || [],
        weeklyScore,
        trends,
        isOnline: true,
      }));
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setState(prev => ({ ...prev, isOnline: false }));
    }
  };

  const refreshStatus = async () => {
    try {
      const status = await api.getAssessmentStatus(state.userId);
      setState(prev => ({ ...prev, assessmentStatus: status, isOnline: true }));
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  };

  const refreshHistory = async () => {
    try {
      const history = await api.getHistory(state.userId);
      setState(prev => ({ ...prev, history, isOnline: true }));
    } catch (error) {
      console.error('Failed to refresh history:', error);
    }
  };

  const refreshWeeklyScore = async () => {
    try {
      const weeklyScore = await api.getWeeklyScore(state.userId);
      setState(prev => ({ ...prev, weeklyScore, isOnline: true }));
    } catch (error) {
      console.error('Failed to refresh weekly score:', error);
    }
  };

  const refreshTrends = async () => {
    try {
      const trends = await api.getTrends(state.userId);
      setState(prev => ({ ...prev, trends, isOnline: true }));
    } catch (error) {
      console.error('Failed to refresh trends:', error);
    }
  };

  const refreshAll = async () => {
    await refreshAllData(state.userId);
  };

  const setServerUrl = async (url: string) => {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, url);
    api.setBaseUrl(url);
    setState(prev => ({ ...prev, serverUrl: url }));
    await refreshAll();
  };

  const resetBaseline = async () => {
    try {
      await api.resetBaseline(state.userId);
      await refreshAll();
    } catch (error) {
      console.error('Failed to reset baseline:', error);
      throw error;
    }
  };

  const finalizeWeek = async () => {
    try {
      await api.finalizeWeek(state.userId);
      await refreshAll();
    } catch (error) {
      console.error('Failed to finalize week:', error);
      throw error;
    }
  };

  return (
    <AppContext.Provider
      value={{
        ...state,
        refreshStatus,
        refreshHistory,
        refreshWeeklyScore,
        refreshTrends,
        refreshAll,
        setServerUrl,
        resetBaseline,
        finalizeWeek,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
