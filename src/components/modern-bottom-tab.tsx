import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

export interface ModernBottomTabProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string; params?: object }>;
  };
  descriptors: Record<string, any>;
  navigation?: {
    navigate: (name: string, params?: object) => void;
    emit?: (event: { type: string; target: string; canPreventDefault?: boolean }) => {
      defaultPrevented: boolean;
    };
  };
  navigateToTab?: (routeKey: string) => void;
  emitter?: {
    emit: (event: any) => any;
  };
}

interface TabConfig {
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
}

const TAB_CONFIGS: Record<string, TabConfig> = {
  index: {
    label: 'Radar',
    activeIcon: 'navigate',
    inactiveIcon: 'navigate-outline',
  },
  stops: {
    label: 'Stops',
    activeIcon: 'bus',
    inactiveIcon: 'bus-outline',
  },
  explore: {
    label: 'Corridors',
    activeIcon: 'git-network',
    inactiveIcon: 'git-network-outline',
  },
  saved: {
    label: 'Saved',
    activeIcon: 'bookmark',
    inactiveIcon: 'bookmark-outline',
  },
};

const PADDING_HORIZONTAL = 6;

export function ModernBottomTab(props: ModernBottomTabProps) {
  const { state, navigation, navigateToTab } = props;
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom + 6, 14);

  const [dockWidth, setDockWidth] = useState(0);
  const routeCount = state.routes.length;
  const tabWidth = dockWidth > 0 ? (dockWidth - PADDING_HORIZONTAL * 2) / routeCount : 0;

  // Sliding pill position shared value
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Measure dock layout
  const handleDockLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== dockWidth) {
      setDockWidth(width);
      const computedTabWidth = (width - PADDING_HORIZONTAL * 2) / routeCount;
      const initialX = PADDING_HORIZONTAL + state.index * computedTabWidth;
      indicatorX.value = initialX;
      indicatorWidth.value = computedTabWidth;
      setHasInitialized(true);
    }
  };

  // Animate pill when active tab index changes
  useEffect(() => {
    if (tabWidth > 0) {
      const targetX = PADDING_HORIZONTAL + state.index * tabWidth;
      if (!hasInitialized) {
        indicatorX.value = targetX;
        indicatorWidth.value = tabWidth;
        setHasInitialized(true);
      } else {
        // Fluid spring glide across tabs
        indicatorX.value = withSpring(targetX, {
          damping: 20,
          stiffness: 220,
          mass: 0.8,
        });
        indicatorWidth.value = withSpring(tabWidth, {
          damping: 20,
          stiffness: 220,
        });
      }
    }
  }, [state.index, tabWidth, hasInitialized]);

  // Sliding active pill animated style
  const slidingPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <View pointerEvents="box-none" style={[styles.dockContainer, { bottom: bottomOffset }]}>
      <View onLayout={handleDockLayout} style={styles.island}>
        {/* Continuous Gliding Green Active Pill */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.slidingPill,
              slidingPillStyle,
            ]}
          />
        )}

        {/* Tab Buttons */}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIGS[route.name] || {
            label: route.name,
            activeIcon: 'ellipse',
            inactiveIcon: 'ellipse-outline',
          };

          const onPress = () => {
            if (isFocused) return;
            if (navigateToTab) {
              navigateToTab(route.key);
            } else if (navigation?.navigate) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              isFocused={isFocused}
              config={config}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  isFocused,
  config,
  onPress,
}: {
  isFocused: boolean;
  config: TabConfig;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabPressable}
    >
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        <Ionicons
          name={isFocused ? config.activeIcon : config.inactiveIcon}
          size={isFocused ? 20 : 19}
          color={isFocused ? '#34D399' : '#94A3B8'}
        />
        <Text
          style={[
            styles.tabLabel,
            isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
          ]}
          numberOfLines={1}
        >
          {config.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dockContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  island: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingVertical: 5,
    paddingHorizontal: PADDING_HORIZONTAL,
    width: '100%',
    maxWidth: 420,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  slidingPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 0,
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 24,
    zIndex: 1,
  },
  tabPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: -0.2,
  },
  tabLabelActive: {
    color: '#34D399',
    fontWeight: '800',
  },
  tabLabelInactive: {
    color: '#94A3B8',
    fontWeight: '600',
  },
});
