import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface SavedRoute {
  id: string;
  shortName: string;
  name: string;
  agency: string;
  agencyColor: string;
  activeBuses: number;
}

interface SavedStop {
  id: string;
  name: string;
  code: string;
  upcomingEta: string;
  route: string;
}

const INITIAL_SAVED_ROUTES: SavedRoute[] = [
  {
    id: '534UP',
    shortName: '534',
    name: 'Anand Vihar ISBT to Mehrauli Terminal',
    agency: 'DIMTS',
    agencyColor: '#EA580C',
    activeBuses: 28,
  },
  {
    id: 'TMS_UP',
    shortName: 'TMS+',
    name: 'Ring Road Mudrika Express (Circular)',
    agency: 'DTC',
    agencyColor: '#1D4ED8',
    activeBuses: 42,
  },
];

const INITIAL_SAVED_STOPS: SavedStop[] = [
  {
    id: 'ST_AIIMS',
    name: 'AIIMS Hospital Ring Road',
    code: 'ND-534-04',
    upcomingEta: '1 min',
    route: 'TMS+',
  },
  {
    id: 'ST_SOUTH_EXT',
    name: 'South Extension II',
    code: 'ND-534-05',
    upcomingEta: '4 min',
    route: '534',
  },
];

export default function SavedScreen() {
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(INITIAL_SAVED_ROUTES);
  const [savedStops, setSavedStops] = useState<SavedStop[]>(INITIAL_SAVED_STOPS);

  const removeRoute = (id: string) => {
    setSavedRoutes((prev) => prev.filter((r) => r.id !== id));
  };

  const removeStop = (id: string) => {
    setSavedStops((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header with Logo */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
          </View>
          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>
              Saved<Text style={styles.brandTitleAccent}>Bookmarks</Text>
            </Text>
            <Text style={styles.brandSubtitle}>Favorite Lines & Stops • Fast Access</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Saved Routes Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Saved Transit Lines</Text>
          <Text style={styles.sectionCount}>{savedRoutes.length} saved</Text>
        </View>

        {savedRoutes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="git-network-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyText}>No transit lines bookmarked yet</Text>
          </View>
        ) : (
          savedRoutes.map((route) => (
            <View key={route.id} style={styles.savedCard}>
              <View style={styles.savedLeft}>
                <View style={[styles.routeBadge, { backgroundColor: route.agencyColor }]}>
                  <Text style={styles.routeBadgeText}>{route.shortName}</Text>
                </View>
                <View style={styles.savedInfo}>
                  <Text style={styles.savedTitle} numberOfLines={1}>
                    {route.name}
                  </Text>
                  <Text style={styles.savedSub}>
                    {route.agency} • {route.activeBuses} buses active right now
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => removeRoute(route.id)} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={18} color="#94A3B8" />
              </Pressable>
            </View>
          ))
        )}

        {/* Saved Stops Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.four }]}>
          <Text style={styles.sectionHeader}>Saved Bus Stops</Text>
          <Text style={styles.sectionCount}>{savedStops.length} saved</Text>
        </View>

        {savedStops.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyText}>No bus stops bookmarked yet</Text>
          </View>
        ) : (
          savedStops.map((stop) => (
            <View key={stop.id} style={styles.savedCard}>
              <View style={styles.savedLeft}>
                <View style={styles.stopIconBox}>
                  <Ionicons name="location" size={20} color="#059669" />
                </View>
                <View style={styles.savedInfo}>
                  <Text style={styles.savedTitle}>{stop.name}</Text>
                  <Text style={styles.savedSub}>
                    {stop.code} • Next: {stop.route} in{' '}
                    <Text style={{ fontWeight: '700', color: '#047857' }}>
                      {stop.upcomingEta}
                    </Text>
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => removeStop(stop.id)} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={18} color="#94A3B8" />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  brandTextContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandTitleAccent: {
    color: '#059669',
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five + 40,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.three,
    marginBottom: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  savedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    flex: 1,
  },
  routeBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  stopIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedInfo: {
    flex: 1,
  },
  savedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  savedSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  removeBtn: {
    padding: 8,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
