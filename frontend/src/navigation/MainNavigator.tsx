import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

import { RootStackParamList, MainTabParamList } from '../types';
import { theme } from '../utils/theme';

// Screens
import CheckInScreen from '../screens/CheckInScreen';
import DashboardScreen from '../screens/DashboardScreen';
import InsightsScreen from '../screens/InsightsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SpeechAssessmentScreen from '../screens/SpeechAssessmentScreen';
import CognitiveAssessmentScreen from '../screens/CognitiveAssessmentScreen';
import VisualAssessmentScreen from '../screens/VisualAssessmentScreen';
import AssessmentCompleteScreen from '../screens/AssessmentCompleteScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          switch (route.name) {
            case 'CheckIn':
              iconName = focused ? 'play-circle' : 'play-circle-outline';
              break;
            case 'Dashboard':
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              break;
            case 'Insights':
              iconName = focused ? 'bulb' : 'bulb-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
          }

          return (
            <View style={focused ? styles.activeTab : undefined}>
              <Ionicons name={iconName} size={24} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="CheckIn"
        component={CheckInScreen}
        options={{ tabBarLabel: 'Check-In' }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ tabBarLabel: 'Insights' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="SpeechAssessment"
        component={SpeechAssessmentScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="CognitiveAssessment"
        component={CognitiveAssessmentScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="VisualAssessment"
        component={VisualAssessmentScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="AssessmentComplete"
        component={AssessmentCompleteScreen}
        options={{ animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: 85,
    paddingTop: 8,
    paddingBottom: 25,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  activeTab: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    padding: 4,
  },
});
