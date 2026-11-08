import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  fetchTransitRoutes,
  fetchTransitRouteById,
  TransitRouteItem,
} from '@/services/api';
import { searchOfflineRoutes, getOfflineRouteDetails } from '@/services/offline-transit';

export default function ExploreScreen() {
  const [routes, setRoutes] = useState<TransitRouteItem[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<TransitRouteItem | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadRoutes = useCallback(async (query?: string) => {
    try {
      setLoading(true);
      // Fast path: 0ms local offline SQLite search
      const offline = await searchOfflineRoutes(query, 50);
      if (offline.length > 0) {
        setRoutes(offline);
        if (!selectedRoute) {
          fetchDetails(offline[0].id);
        }
      }

      // Network sync
      const data = await fetchTransitRoutes(query).catch(() => []);
      if (data.length > 0) {
        setRoutes(data);
        if (!selectedRoute) {
          fetchDetails(data[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedRoute]);

  const fetchDetails = async (routeId: string) => {
    try {
      setLoadingDetails(true);
      // Fast path: 0ms offline route stops and geometry
      const offlineDetail = await getOfflineRouteDetails(routeId);
      if (offlineDetail && offlineDetail.stops.length > 0) {
        setSelectedRoute(offlineDetail);
      }

      // Network sync
      const detailed = await fetchTransitRouteById(routeId).catch(() => null);
      if (detailed) {
        setSelectedRoute(detailed);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadRoutes(search);
  }, [search, loadRoutes]);

  const filteredRoutes = useMemo(() => {
    if (!search.trim()) return routes;
    const q = search.toLowerCase();
    return routes.filter(
      (r) =>
        r.shortName.toLowerCase().includes(q) ||
        r.longName.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q) ||
        r.origin.toLowerCase().includes(q)
    );
  }, [routes, search]);

  const agencyColor =
    selectedRoute?.agency === 'DIMTS'
      ? '#EA580C' // Cluster Orange
      : selectedRoute?.isElectric
      ? '#0284C7' // DTC Electric Blue
      : '#1D4ED8'; // DTC Royal Blue

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
            <Text style={styles.brandSubtitle}>2,600+ Delhi Bus Routes & Timetables</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Route Lines */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search route (e.g. 505, TMS, 729), terminal..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionHeader}>Delhi Bus Trunk Lines ({filteredRoutes.length})</Text>

        {/* Route Selector Chips */}
        {loading && routes.length === 0 ? (
          <ActivityIndicator size="small" color="#059669" style={{ marginVertical: 12 }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.routeSelectorRow}
          >
            {filteredRoutes.slice(0, 20).map((route) => {
              const isSelected = selectedRoute?.id === route.id;
              const color =
                route.agency === 'DIMTS' ? '#EA580C' : route.isElectric ? '#0284C7' : '#1D4ED8';

              return (
                <TouchableOpacity
                  key={route.id}
                  onPress={() => {
                    setSelectedRoute(route);
                    fetchDetails(route.id);
                  }}
                  activeOpacity={0.7}
                  style={[
                    styles.routeTab,
                    isSelected && { borderColor: color, backgroundColor: '#0F172A', borderWidth: 2 },
                  ]}
                >
                  <View style={[styles.tabBadge, { backgroundColor: color }]}>
                    <Text style={styles.tabBadgeText} numberOfLines={1}>{route.shortName}</Text>
                  </View>
                  <Text style={styles.tabBusesText}>{route.activeBusCount ?? 4} active</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Route Overview Card */}
        {selectedRoute && (
          <View style={styles.routeOverviewCard}>
            <View style={styles.overviewTop}>
              <View style={[styles.bigBadge, { backgroundColor: agencyColor }]}>
                <Text style={styles.bigBadgeText}>{selectedRoute.shortName}</Text>
              </View>
              <View style={styles.overviewInfo}>
                <Text style={styles.routeName}>{selectedRoute.longName}</Text>
                <View style={styles.overviewMeta}>
                  <Text style={styles.metaBadge}>{selectedRoute.agency}</Text>
                  {selectedRoute.isElectric && (
                    <Text style={[styles.metaBadge, styles.metaBadgeEv]}>⚡ EV Fleet</Text>
                  )}
                  <Text style={styles.activeBusesCount}>
                    {selectedRoute.activeBusCount ?? 4} buses tracked live
                  </Text>
                </View>
              </View>
            </View>

            {/* Terminals Banner */}
            <View style={styles.terminalsBox}>
              <View style={styles.terminalItem}>
                <View style={[styles.terminalDot, { backgroundColor: '#059669' }]} />
                <View>
                  <Text style={styles.terminalLabel}>Origin Terminal</Text>
                  <Text style={styles.terminalName}>{selectedRoute.origin}</Text>
                </View>
              </View>
              <View style={styles.terminalDivider} />
              <View style={styles.terminalItem}>
                <View style={[styles.terminalDot, { backgroundColor: '#DC2626' }]} />
                <View>
                  <Text style={styles.terminalLabel}>Destination Terminal</Text>
                  <Text style={styles.terminalName}>{selectedRoute.destination}</Text>
                </View>
              </View>
            </View>

            {/* Stop Sequence List */}
            <Text style={[styles.sectionHeader, { marginTop: Spacing.three, marginBottom: 8 }]}>
              Stop Sequence ({selectedRoute.stops.length} Stops)
            </Text>

            {loadingDetails ? (
              <ActivityIndicator size="small" color="#059669" style={{ marginVertical: 16 }} />
            ) : selectedRoute.stops.length === 0 ? (
              <Text style={styles.noStopsText}>Regular Delhi NCT arterial line.</Text>
            ) : (
              <View style={styles.stopsTimeline}>
                {selectedRoute.stops.map((stop, index) => {
                  const isFirst = index === 0;
                  const isLast = index === selectedRoute.stops.length - 1;

                  return (
                    <View key={`${stop.stopId}-${index}`} style={styles.timelineRow}>
                      <View style={styles.timelineGutter}>
                        <View
                          style={[
                            styles.timelineDot,
                            isFirst && styles.timelineDotStart,
                            isLast && styles.timelineDotEnd,
                          ]}
                        />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={[styles.stopNameText, (isFirst || isLast) && styles.stopNameBold]}>
                          {stop.stopName}
                        </Text>
                        <Text style={styles.stopSeqText}>Stop #{stop.sequence}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
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
    backgroundColor: '#064E3B',
    borderWidth: 1.5,
    borderColor: '#059669',
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
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  brandTitleAccent: {
    color: '#34D399',
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five + 40,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: Spacing.three,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#F8FAFC',
    paddingVertical: 0,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: Spacing.two,
  },
  routeSelectorRow: {
    marginBottom: Spacing.three,
  },
  routeTab: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    minWidth: 70,
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 120,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tabBusesText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 4,
  },
  routeOverviewCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#334155',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bigBadge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  overviewInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    lineHeight: 18,
  },
  overviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
    backgroundColor: '#064E3B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  metaBadgeEv: {
    color: '#38BDF8',
    backgroundColor: '#083344',
  },
  activeBusesCount: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  terminalsBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginTop: Spacing.three,
    borderWidth: 1,
    borderColor: '#334155',
  },
  terminalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  terminalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  terminalLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  terminalName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  terminalDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
    marginLeft: 20,
  },
  noStopsText: {
    fontSize: 12,
    color: '#94A3B8',
    paddingVertical: 8,
  },
  stopsTimeline: {
    marginTop: 6,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineGutter: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#475569',
    marginTop: 4,
  },
  timelineDotStart: {
    backgroundColor: '#10B981',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineDotEnd: {
    backgroundColor: '#EF4444',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: '#334155',
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
    paddingLeft: 8,
  },
  stopNameText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  stopNameBold: {
    fontWeight: '800',
    color: '#F8FAFC',
  },
  stopSeqText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
});
