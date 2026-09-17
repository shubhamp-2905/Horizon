import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090D16" />
      <RootNavigator />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
});
