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
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface RouteLine {
  id: string;
  shortName: string;
  name: string;
  origin: string;
  destination: string;
  agency: 'DTC' | 'DIMTS' | 'EV';
  agencyColor: string;
  frequency: string;
  activeBuses: number;
  stops: string[];
}

const DELHI_ROUTES: RouteLine[] = [
  {
    id: '534UP',
    shortName: '534',
    name: 'Anand Vihar ISBT to Mehrauli Terminal',
    origin: 'Anand Vihar ISBT',
    destination: 'Mehrauli Terminal',
    agency: 'DIMTS',
    agencyColor: '#2563EB',
    frequency: '6 min',
    activeBuses: 28,
    stops: [
      'Anand Vihar ISBT',
      'Sarai Kale Khan ISBT',
      'Ashram Chowk Flyover',
      'Lajpat Nagar Ring Road',
      'South Extension II',
      'AIIMS Ring Road Hub',
      'Saket Crossing',
      'Mehrauli Terminal',
    ],
  },
  {
    id: 'TMS_UP',
    shortName: 'TMS+',
    name: 'Ring Road Mudrika Express (Circular Clockwise)',
    origin: 'Wazirpur Depot',
    destination: 'Wazirpur Depot (Circular)',
    agency: 'EV',
    agencyColor: '#0891B2',
    frequency: '4 min',
    activeBuses: 42,
    stops: [
      'Kashmere Gate ISBT',
      'ITO Express Bus Way',
      'Sarai Kale Khan ISBT',
      'AIIMS Ring Road Hub',
      'Dhaula Kuan Interchange',
      'Naraina Vihar',
      'Punjabi Bagh Club',
      'Wazirpur Depot',
    ],
  },
  {
    id: '729UP',
    shortName: '729',
    name: 'Mori Gate Terminal to Kapashera Border',
    origin: 'Mori Gate Terminal',
    destination: 'Kapashera Border',
    agency: 'DTC',
    agencyColor: '#059669',
    frequency: '10 min',
    activeBuses: 19,
    stops: [
      'Mori Gate Terminal',
      'Rajiv Chowk / CP',
      'Central Secretariat',
      'Dhaula Kuan Interchange',
      'Mahipalpur Crossing',
      'Kapashera Border',
    ],
  },
];

export default function ExploreScreen() {
  const [selectedRoute, setSelectedRoute] = useState<RouteLine>(DELHI_ROUTES[0]);

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
              Corridor<Text style={styles.brandTitleAccent}>Explorer</Text>
            </Text>
            <Text style={styles.brandSubtitle}>Delhi NCT Arterial Transit Network</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>Select Bus Route</Text>

        {/* Route Selector Tabs */}
        <View style={styles.routeSelectorRow}>
          {DELHI_ROUTES.map((route) => {
            const isSelected = selectedRoute.id === route.id;
            return (
              <Pressable
                key={route.id}
                onPress={() => setSelectedRoute(route)}
                style={[
                  styles.routeTab,
                  isSelected && { borderColor: route.agencyColor, backgroundColor: '#FFFFFF' },
                ]}
              >
                <View style={[styles.tabBadge, { backgroundColor: route.agencyColor }]}>
                  <Text style={styles.tabBadgeText}>{route.shortName}</Text>
                </View>
                <Text style={styles.tabBusesText}>{route.activeBuses} active</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Route Overview Card */}
        <View style={styles.routeOverviewCard}>
          <View style={styles.overviewTop}>
            <View style={[styles.bigBadge, { backgroundColor: selectedRoute.agencyColor }]}>
              <Text style={styles.bigBadgeText}>{selectedRoute.shortName}</Text>
            </View>
            <View style={styles.overviewInfo}>
              <Text style={styles.routeName}>{selectedRoute.name}</Text>
              <Text style={styles.routeAgency}>
                Operated by {selectedRoute.agency} • Frequency: {selectedRoute.frequency}
              </Text>
            </View>
          </View>

          <View style={styles.terminalsRow}>
            <View style={styles.terminalBox}>
              <Text style={styles.terminalLabel}>ORIGIN</Text>
              <Text style={styles.terminalName}>{selectedRoute.origin}</Text>
            </View>
            <Text style={styles.arrowText}>→</Text>
            <View style={styles.terminalBox}>
              <Text style={styles.terminalLabel}>DESTINATION</Text>
              <Text style={styles.terminalName}>{selectedRoute.destination}</Text>
            </View>
          </View>
        </View>

        {/* Stop Progression Timeline */}
        <Text style={[styles.sectionHeader, { marginTop: Spacing.four }]}>
          Corridor Stop Sequence ({selectedRoute.stops.length} Stops)
        </Text>

        <View style={styles.timelineContainer}>
          {selectedRoute.stops.map((stop, index) => {
            const isFirst = index === 0;
            const isLast = index === selectedRoute.stops.length - 1;

            return (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineIndicatorCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      (isFirst || isLast) && { backgroundColor: selectedRoute.agencyColor },
                    ]}
                  />
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.stopName, (isFirst || isLast) && styles.terminalStopName]}>
                    {stop}
                  </Text>
                  <Text style={styles.stopSequenceText}>Stop #{index + 1}</Text>
                </View>
              </View>
            );
          })}
        </View>
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
    paddingBottom: BottomTabInset + Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  routeSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  routeTab: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: Spacing.two,
    alignItems: 'center',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  tabBusesText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  routeOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: Spacing.three,
  },
  bigBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  overviewInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  routeAgency: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  terminalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: Spacing.two + 2,
    marginTop: Spacing.three,
  },
  terminalBox: {
    flex: 1,
  },
  terminalLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  terminalName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  arrowText: {
    fontSize: 16,
    color: '#94A3B8',
    paddingHorizontal: 8,
  },
  timelineContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineIndicatorCol: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CBD5E1',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  timelineLine: {
    width: 2,
    height: 36,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: Spacing.two,
    paddingBottom: Spacing.three,
  },
  stopName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  terminalStopName: {
    fontWeight: '800',
    color: '#0F172A',
  },
  stopSequenceText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
});
