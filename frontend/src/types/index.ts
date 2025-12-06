// BrainGauge Type Definitions

export interface SpeechFeatures {
  words_per_minute: number;
  filler_word_count: number;
  filler_word_ratio: number;
  average_pause_length: number;
  total_pause_time: number;
  word_count: number;
  duration_seconds: number;
  speech_rate_variability: number;
}

export interface SpeechResult {
  features: SpeechFeatures;
  drift_score: number;
  is_baseline: boolean;
  timestamp: string;
  transcript: string;
}

export interface CognitiveResult {
  avg_reaction_time: number;
  reaction_time_variability: number;
  reaction_accuracy: number;
  n_back_accuracy: number;
  n_back_avg_response_time: number;
  cognitive_drift_score: number;
  is_baseline: boolean;
  timestamp: string;
}

export interface VisualResult {
  tracking_accuracy: number;
  tracking_smoothness: number;
  blink_rate: number;
  deviation_frequency: number;
  visual_motor_drift_score: number;
  is_baseline: boolean;
  timestamp: string;
}

export interface WeeklyScore {
  week_number: number;
  speech_drift_score: number | null;
  cognitive_drift_score: number | null;
  visual_motor_drift_score: number | null;
  neuro_load_score: number;
  status: 'optimal' | 'moderate' | 'elevated' | 'high';
  timestamp: string;
}

export interface HistoryEntry {
  week_number: number;
  date: string;
  neuro_load_score: number;
  speech_drift: number | null;
  cognitive_drift: number | null;
  visual_drift: number | null;
  status: 'optimal' | 'moderate' | 'elevated' | 'high';
}

export interface AssessmentStatus {
  user_id: string;
  has_baseline: boolean;
  week_number: number;
  completed: {
    speech: boolean;
    cognitive: boolean;
    visual: boolean;
  };
  all_complete: boolean;
  scores?: {
    speech?: number;
    cognitive?: number;
    visual?: number;
  };
}

export interface TrendData {
  user_id: string;
  has_trends: boolean;
  weeks_analyzed?: number;
  overall_trend?: 'increasing' | 'decreasing' | 'stable';
  speech_trend?: 'increasing' | 'decreasing' | 'stable' | null;
  cognitive_trend?: 'increasing' | 'decreasing' | 'stable' | null;
  visual_trend?: 'increasing' | 'decreasing' | 'stable' | null;
  most_changed_area?: 'speech' | 'cognitive' | 'visual' | null;
  current_status?: string;
  average_neuro_load?: number;
  message?: string;
}

// Navigation types
export type RootStackParamList = {
  Main: undefined;
  SpeechAssessment: undefined;
  CognitiveAssessment: undefined;
  VisualAssessment: undefined;
  AssessmentComplete: { type: 'speech' | 'cognitive' | 'visual'; score: number };
};

export type MainTabParamList = {
  CheckIn: undefined;
  Dashboard: undefined;
  Insights: undefined;
  Profile: undefined;
};

// Reading passages for speech assessment
export const READING_PASSAGES = [
  {
    id: 1,
    title: "The Morning Run",
    text: "The early morning air was crisp and fresh as I started my run. My feet hit the pavement in a steady rhythm, and I could feel my heart rate gradually increasing. The sun was just beginning to peek over the horizon, painting the sky in shades of orange and pink. I focused on my breathing, inhaling deeply and exhaling slowly. Each stride brought me closer to my goal, and I felt a sense of accomplishment wash over me.",
    wordCount: 85
  },
  {
    id: 2,
    title: "Team Practice",
    text: "The coach blew the whistle and we gathered around. Today's practice would focus on coordination and teamwork. We split into groups and started the first drill. Communication was key as we passed the ball between teammates. I kept my eyes on the play, anticipating the next move. The sweat dripped down my face, but I stayed focused. Every practice makes us stronger as a team.",
    wordCount: 72
  },
  {
    id: 3,
    title: "Recovery Day",
    text: "Rest is just as important as training. Today I focused on stretching and mobility exercises. I started with deep breathing to calm my mind. Then I moved through a series of gentle stretches, paying attention to any areas of tension. The foam roller helped release tight muscles. I visualized my goals and felt grateful for my body's ability to heal and grow stronger each day.",
    wordCount: 73
  }
];
