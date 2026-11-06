import React from 'react';
import { Tabs } from 'expo-router';
import { ModernBottomTab } from '@/components/modern-bottom-tab';

export default function AppTabs() {
  return (
    <Tabs
      tabBar={(props) => <ModernBottomTab {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Radar',
        }}
      />
      <Tabs.Screen
        name="stops"
        options={{
          title: 'Stops',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Corridors',
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
        }}
      />
    </Tabs>
  );
}
