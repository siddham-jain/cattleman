import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { restoreLocale, t } from './src/i18n';
import { getDatabase } from './src/db/database';
import { loadModel } from './src/inference/classifier';
import { startSyncLoop } from './src/sync/sync';
import { colors, typography } from './src/theme';

import CaptureScreen from './src/screens/CaptureScreen';
import ResultScreen from './src/screens/ResultScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RegistryScreen from './src/screens/RegistryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = useState(false);

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
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: typography.heading,
            headerTintColor: colors.primary,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="Capture" component={CaptureScreen}
                        options={{ title: t('app.name') }} />
          <Stack.Screen name="Result" component={ResultScreen}
                        options={{ title: t('result.title') }} />
          <Stack.Screen name="Register" component={RegisterScreen}
                        options={{ title: t('register.title') }} />
          <Stack.Screen name="Registry" component={RegistryScreen}
                        options={{ title: t('registry.title') }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
