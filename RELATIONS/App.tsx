import React, {useEffect} from 'react';
import {SafeAreaView, StatusBar, StyleSheet, View, Text, ActivityIndicator} from 'react-native';
import {Navigation} from './src/navigation';
import {colors} from './src/theme';
import {useStore} from './src/store';

export default function App() {
  const {hydrate, isHydrated, isLoading} = useStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.surface}
      />
      <Navigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
});