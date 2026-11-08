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
  RefreshControl,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  fetchNearbyStops,
  fetchPISArrivals,
  TransitStopItem,
  PISStopBoard,
  PISIncomingBus,
} from '@/services/api';
import { getOfflineNearbyStops, searchOfflineStops } from '@/services/offline-transit';

export default function StopsScreen() {
  const [stops, setStops] = useState<TransitStopItem[]>([]);
  const [selectedStop, setSelectedStop] = useState<TransitStopItem | null>(null);
  const [pisBoard, setPisBoard] = useState<PISStopBoard | null>(null);
  const [search, setSearch] = useState('');
  const [loadingStops, setLoadingStops] = useState(true);
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number }>({
    lat: 28.5694,
    lon: 77.2085,
  });

  // Get GPS coords on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
          });
        }
      } catch {
        // Fallback to South Delhi
      }
    })();
  }, []);

  // Fetch nearby stops (0ms local SQLite + network sync)
  const loadStops = useCallback(async () => {
    try {
      setLoadingStops(true);
      // Fast path: 0ms offline query
      const localStops = await getOfflineNearbyStops(userLocation.lat, userLocation.lon, 6.0, 40);
      if (localStops.length > 0) {
        setStops(localStops);
        if (!selectedStop) {
          setSelectedStop(localStops[0]);
        }
      }

      // Network path
      const data = await fetchNearbyStops(userLocation.lat, userLocation.lon, 6.0, 40).catch(() => []);
      if (data.length > 0) {
        setStops(data);
        if (!selectedStop) {
          setSelectedStop(data[0]);
        }
      }
    } finally {
      setLoadingStops(false);
      setRefreshing(false);
    }
  }, [userLocation, selectedStop]);

  useEffect(() => {
    loadStops();
  }, [loadStops]);

  // Fetch real PIS arrival countdowns for selected stop
  const loadArrivals = useCallback(async (stopId: string) => {
    try {
      setLoadingArrivals(true);
      const board = await fetchPISArrivals(stopId);
      setPisBoard(board);
      setCountdown(15);
    } finally {
      setLoadingArrivals(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStop) {
      loadArrivals(selectedStop.id);
    }
  }, [selectedStop, loadArrivals]);

  // 15-second countdown timer loop
  useEffect(() => {
    if (!selectedStop) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadArrivals(selectedStop.id);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedStop, loadArrivals]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStops();
    if (selectedStop) loadArrivals(selectedStop.id);
  };

  // Flatten incoming buses from all routes serving this stop
  const allIncomingBuses: PISIncomingBus[] = useMemo(() => {
    if (!pisBoard || !Array.isArray(pisBoard.routes)) return [];
    const list: PISIncomingBus[] = [];
    for (const r of pisBoard.routes) {
      if (Array.isArray(r.buses)) {
        for (const b of (r.buses as any[])) {
          list.push({
            ...b,
            routeShortName: b.routeShortName || r.shortName || r.routeId,
            destination: b.destination || r.longName || 'Delhi NCT Corridor',
            agency: b.agency || (r.agency as any) || 'DTC',
          });
        }
      }
    }
    list.sort((a, b) => a.etaMinutes - b.etaMinutes);
    return list;
  }, [pisBoard]);

  // Search across all 6,664 Delhi stops in local SQLite when user types
  useEffect(() => {
    if (!search.trim()) {
      loadStops();
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      const results = await searchOfflineStops(search, 30);
      if (isMounted && results.length > 0) {
        setStops(results);
        setSelectedStop(results[0]);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [search, loadStops]);

  // Filter stops by user search query
  const filteredStops = useMemo(() => {
    return stops;
  }, [stops]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Brand Header */}
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
            <View style={styles.titleRow}>
              <Text style={styles.brandTitle}>
                Stop<Text style={styles.brandTitleAccent}>Arrivals</Text>
              </Text>
              <View style={styles.livePill}>
                <View style={styles.livePulseDot} />
                <Text style={styles.livePillText}>PIS Board</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>Delhi NCT Live Arrival Countdown Engine</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Bus Stops Omni-Box */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search 6,600+ Delhi bus & metro stops..."
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

        {/* Horizontal Stop Selector Chips */}
        <Text style={styles.sectionHeader}>Nearby Transit Stops ({filteredStops.length})</Text>
        {loadingStops ? (
          <ActivityIndicator size="small" color="#059669" style={{ marginVertical: 12 }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.hubsScroll}
          >
            {filteredStops.slice(0, 15).map((stop) => {
              const isSelected = selectedStop?.id === stop.id;
              return (
                <TouchableOpacity
                  key={stop.id}
                  onPress={() => setSelectedStop(stop)}
                  activeOpacity={0.7}
                  style={[styles.hubChip, isSelected && styles.hubChipActive]}
                >
                  <Ionicons
                    name={isSelected ? 'location' : 'location-outline'}
                    size={14}
                    color={isSelected ? '#FFFFFF' : '#475569'}
                  />
                  <Text style={[styles.hubChipText, isSelected && styles.hubChipTextActive]}>
                    {stop.name.split('/')[0].trim()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Selected Stop Header Card */}
        {selectedStop && (
          <View style={styles.hubHeaderCard}>
            <View style={styles.hubHeaderRow}>
              <View style={styles.hubIconBox}>
                <Ionicons name="bus" size={22} color="#059669" />
              </View>
              <View style={styles.hubInfo}>
                <Text style={styles.hubNameText}>{selectedStop.name}</Text>
                <View style={styles.hubSubRow}>
                  <Text style={styles.hubSubText}>Stop #{selectedStop.code}</Text>
                  {selectedStop.distanceMeters && (
                    <Text style={styles.hubDistanceText}>
                      • {selectedStop.distanceMeters > 1000
                        ? `${(selectedStop.distanceMeters / 1000).toFixed(1)} km away`
                        : `${selectedStop.distanceMeters} m away`}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.refreshStatusRow}>
              <Text style={styles.refreshStatusText}>
                Live OTD Telemetry • Refreshing in {countdown}s
              </Text>
              {loadingArrivals && <ActivityIndicator size="small" color="#059669" />}
            </View>
          </View>
        )}

        {/* Arrival Countdowns Board */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Live Arrival Countdowns</Text>
          <Text style={styles.busesEnRouteCount}>{allIncomingBuses.length} approaching</Text>
        </View>

        {loadingArrivals && allIncomingBuses.length === 0 ? (
          <View style={styles.loadingArrivalsBox}>
            <ActivityIndicator size="small" color="#059669" />
            <Text style={styles.loadingArrivalsText}>Calculating arrival countdowns...</Text>
          </View>
        ) : allIncomingBuses.length === 0 ? (
          <View style={styles.emptyArrivalsCard}>
            <Ionicons name="time-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyArrivalsTitle}>No buses arriving within 20 mins</Text>
            <Text style={styles.emptyArrivalsSub}>
              Scheduled frequencies are operating. New GPS positions update every 7s.
            </Text>
          </View>
        ) : (
          <View style={styles.arrivalsList}>
            {allIncomingBuses.map((arr, index) => {
              const isDue = arr.etaMinutes <= 2;
              const isCluster = arr.agency === 'DIMTS';
              const badgeColor = isCluster
                ? '#EA580C' // Cluster Orange
                : arr.isElectric
                ? '#0284C7' // DTC Electric Blue
                : '#1D4ED8'; // DTC Royal Blue

              return (
                <View
                  key={`${arr.vehicleId}-${arr.routeId}-${index}`}
                  style={[styles.arrivalCard, isDue && styles.arrivalCardDue]}
                >
                  <View style={styles.arrivalLeft}>
                    <View style={[styles.routeBadge, { backgroundColor: badgeColor }]}>
                      <Text style={styles.routeBadgeText}>{arr.routeShortName}</Text>
                    </View>
                    <View style={styles.arrivalInfo}>
                      <View style={styles.destRow}>
                        <Text style={styles.destText} numberOfLines={1}>
                          Towards {arr.destination}
                        </Text>
                        {arr.isAc && (
                          <View style={styles.featurePill}>
                            <Text style={styles.featurePillText}>AC</Text>
                          </View>
                        )}
                        {arr.isElectric && (
                          <View style={[styles.featurePill, styles.featurePillEv]}>
                            <Text style={[styles.featurePillText, { color: '#0E7490' }]}>⚡ EV</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaPlate}>{arr.vehicleId}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaAgency}>{arr.agency}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaSpeed}>{arr.speedKmph} km/h</Text>
                        {arr.distanceKm !== undefined && (
                          <>
                            <Text style={styles.metaDot}>•</Text>
                            <Text style={styles.metaDist}>{arr.distanceKm} km</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Countdown ETA */}
                  <View style={[styles.etaCol, isDue && styles.etaColDue]}>
                    <Text style={[styles.etaNum, isDue && styles.etaNumDue]}>
                      {arr.etaMinutes === 0 ? 'DUE' : `${arr.etaMinutes}m`}
                    </Text>
                    <Text style={styles.etaLabel}>{arr.etaMinutes === 0 ? 'Arriving' : 'ETA'}</Text>
                  </View>
                </View>
              );
            })}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34D399',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    color: '#F8FAFC',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: Spacing.two,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  busesEnRouteCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34D399',
  },
  hubsScroll: {
    marginBottom: Spacing.three,
  },
  hubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  hubChipActive: {
    backgroundColor: '#059669',
    borderColor: '#10B981',
  },
  hubChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  hubChipTextActive: {
    color: '#FFFFFF',
  },
  hubHeaderCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#334155',
    marginBottom: Spacing.two,
  },
  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hubIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#059669',
  },
  hubInfo: {
    flex: 1,
  },
  hubNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  hubSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  hubSubText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hubDistanceText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
  },
  refreshStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  refreshStatusText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  loadingArrivalsBox: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingArrivalsText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyArrivalsCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyArrivalsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 8,
  },
  emptyArrivalsSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 240,
  },
  arrivalsList: {
    gap: Spacing.two,
  },
  arrivalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  arrivalCardDue: {
    borderColor: '#059669',
    backgroundColor: '#064E3B',
  },
  arrivalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  routeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  arrivalInfo: {
    flex: 1,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  destText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  featurePill: {
    backgroundColor: '#1E293B',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  featurePillEv: {
    backgroundColor: '#083344',
  },
  featurePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaPlate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metaDot: {
    fontSize: 10,
    color: '#475569',
    marginHorizontal: 4,
  },
  metaAgency: {
    fontSize: 10,
    color: '#94A3B8',
  },
  metaSpeed: {
    fontSize: 10,
    color: '#34D399',
    fontWeight: '600',
  },
  metaDist: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  etaCol: {
    alignItems: 'flex-end',
    minWidth: 48,
    marginLeft: 8,
  },
  etaColDue: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  etaNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  etaNumDue: {
    color: '#34D399',
  },
  etaLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
});
