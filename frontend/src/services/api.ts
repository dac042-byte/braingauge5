/**
 * BrainGauge API Service
 * Handles all communication with the backend server
 */

import * as FileSystem from 'expo-file-system';
import {
  SpeechResult,
  CognitiveResult,
  VisualResult,
  WeeklyScore,
  HistoryEntry,
  AssessmentStatus,
  TrendData,
} from '../types';

class ApiService {
  private baseUrl: string = 'http://localhost:8000';
  private timeout: number = 30000;

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // Audio/Speech endpoints
  async uploadAudio(
    audioUri: string,
    userId: string,
    isBaseline: boolean = false
  ): Promise<SpeechResult> {
    const formData = new FormData();

    // Read the file and create blob
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file not found');
    }

    // Get file extension
    const extension = audioUri.split('.').pop() || 'm4a';
    const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/m4a';

    formData.append('file', {
      uri: audioUri,
      type: mimeType,
      name: `recording.${extension}`,
    } as any);
    formData.append('user_id', userId);
    formData.append('is_baseline', String(isBaseline));

    const response = await fetch(`${this.baseUrl}/audio/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to upload audio');
    }

    return response.json();
  }

  // Cognitive endpoints
  async submitCognitiveResults(data: {
    user_id: string;
    reaction_times: number[];
    reaction_accuracy: number;
    n_back_correct: number;
    n_back_total: number;
    n_back_avg_response_time: number;
    is_baseline?: boolean;
  }): Promise<CognitiveResult> {
    return this.request<CognitiveResult>('/cognitive/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Visual endpoints
  async submitVisualResults(data: {
    user_id: string;
    tracking_accuracy: number;
    tracking_smoothness: number;
    blink_count: number;
    test_duration_seconds: number;
    deviation_events: number;
    avg_deviation_distance: number;
    is_baseline?: boolean;
  }): Promise<VisualResult> {
    return this.request<VisualResult>('/visual/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Score endpoints
  async getWeeklyScore(userId: string): Promise<WeeklyScore> {
    return this.request<WeeklyScore>(`/score/weekly/${userId}`);
  }

  async getAssessmentStatus(userId: string): Promise<AssessmentStatus> {
    return this.request<AssessmentStatus>(`/score/status/${userId}`);
  }

  async finalizeWeek(userId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/score/finalize/${userId}`, {
      method: 'POST',
    });
  }

  // History endpoints
  async getHistory(userId: string): Promise<HistoryEntry[]> {
    return this.request<HistoryEntry[]>(`/history/${userId}`);
  }

  async getTrends(userId: string): Promise<TrendData> {
    return this.request<TrendData>(`/history/${userId}/trends`);
  }

  async exportData(userId: string): Promise<any> {
    return this.request<any>(`/history/${userId}/export`);
  }

  async resetBaseline(userId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/history/${userId}/reset`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<{ status: string }>('/health');
      return true;
    } catch {
      return false;
    }
  }
}

export const api = new ApiService();
