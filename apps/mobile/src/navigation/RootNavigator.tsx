import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';

export const RootNavigator: React.FC = () => {
  // Navigation foundation placeholder: renders HomeScreen shell
  return (
    <View style={styles.container}>
      <HomeScreen />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
