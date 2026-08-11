import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { restoreLocale, t, useLocale } from './src/i18n';
import { getDatabase } from './src/db/database';
import { loadModel } from './src/inference/classifier';
import { startSyncLoop } from './src/sync/sync';
import { colors, spacing, typography } from './src/theme';

import CaptureScreen from './src/screens/CaptureScreen';
import ResultScreen from './src/screens/ResultScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RegistryScreen from './src/screens/RegistryScreen';
import BreedGuideScreen from './src/screens/BreedGuideScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const IdentifyStack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTitleStyle: typography.title,
  headerTintColor: colors.primary,
  contentStyle: { backgroundColor: colors.background },
};

/**
 * Capture, result, and registration are one task, so they share a stack and the
 * back button walks the worker back through it. The other three are destinations
 * rather than steps, which is what the tab bar is for.
 */
function IdentifyFlow() {
  return (
    <IdentifyStack.Navigator screenOptions={screenOptions}>
      <IdentifyStack.Screen name="Capture" component={CaptureScreen}
                            options={{ title: t('app.name') }} />
      <IdentifyStack.Screen name="Result" component={ResultScreen}
                            options={{ title: t('result.title') }} />
      <IdentifyStack.Screen name="Register" component={RegisterScreen}
                            options={{ title: t('register.title') }} />
    </IdentifyStack.Navigator>
  );
}

const TABS = [
  { name: 'IdentifyTab', icon: 'camera', label: 'nav.capture', component: IdentifyFlow },
  { name: 'RegistryTab', icon: 'albums', label: 'nav.registry', component: RegistryScreen,
    headerTitle: 'registry.title' },
  { name: 'GuideTab', icon: 'book', label: 'nav.guide', component: BreedGuideScreen,
    headerTitle: 'guide.title' },
  { name: 'SettingsTab', icon: 'settings', label: 'nav.settings', component: SettingsScreen,
    headerTitle: 'settings.title' },
];

/**
 * The tab bar draws its own icon-and-label stack.
 *
 * The navigator's built-in label sits in a slot it sizes itself, and that slot
 * clips a 12sp line — worse in Devanagari, which is taller than Latin at the
 * same size. Rendering both inside the icon slot puts the height under our
 * control. The home-indicator inset is added to the bar rather than taken out of
 * it, so the labels do not move on a device that has one.
 */
function Tabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        ...screenOptions,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIconStyle: { flex: 1, width: '100%' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64 + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm + insets.bottom,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            headerShown: !!tab.headerTitle,
            headerTitle: tab.headerTitle ? t(tab.headerTitle) : undefined,
            tabBarAccessibilityLabel: t(tab.label),
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.tab}>
                <Ionicons name={focused ? tab.icon : `${tab.icon}-outline`}
                          size={24} color={color} />
                <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                  {t(tab.label)}
                </Text>
              </View>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    let stopSync;
    (async () => {
      // Locale and database must be ready before first render. The model is
      // warmed in parallel but never blocks startup — a failed load should
      // surface when the user tries to identify something, and must not stop
      // them reaching records they have already saved.
      await Promise.all([restoreLocale(), getDatabase()]);
      loadModel().catch(() => {});
      stopSync = startSyncLoop();
      setReady(true);
    })();
    return () => stopSync?.();
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Ionicons name="paw" size={44} color={colors.primary} />
        <Text style={typography.title}>{t('app.name')}</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Remounting on a language change is what refreshes the tab and screen
          titles, which are read once when the navigator renders. */}
      <NavigationContainer key={locale}>
        <Tabs />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  // without flexShrink:0 the label is squeezed below its line height and the
  // descenders are clipped, since it sits in a fixed-height row
  tabLabel: {
    fontSize: 12, lineHeight: 16, fontWeight: '600', textAlign: 'center', flexShrink: 0,
  },
  splash: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, backgroundColor: colors.background,
  },
});
