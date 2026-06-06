import 'expo-task-manager'; // must be imported before task registration
import './src/services/geofence'; // registers LOCATION_TASK at module level

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SetupScreen from './src/screens/SetupScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const tabIcons = {
  Home: ['time', 'time-outline'],
  History: ['bar-chart', 'bar-chart-outline'],
  Setup: ['location', 'location-outline'],
  Settings: ['settings', 'settings-outline'],
};

function TabNav() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              const [active, inactive] = tabIcons[route.name];
              return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#6C63FF',
            tabBarInactiveTintColor: '#A0A0B0',
            tabBarStyle: {
              backgroundColor: '#FFFFFF',
              borderTopWidth: 0,
              elevation: 20,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: -4 },
              height: 64 + insets.bottom,
              paddingBottom: insets.bottom + 4,
              paddingTop: 6,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            headerStyle: { backgroundColor: '#6C63FF', elevation: 0, shadowOpacity: 0 },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'My Shift' }} />
          <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
          <Tab.Screen name="Setup" component={SetupScreen} options={{ title: 'Workplace' }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <TabNav />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
