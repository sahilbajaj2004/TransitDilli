import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Region } from 'react-native-maps';
import { BottomTabInset } from '@/constants/theme';
import { TransitMap } from '@/components/transit-map';
import { OnboardingModal } from '@/components/onboarding-modal';
import {
  fetchLiveNearbyBuses,
  fetchNearbyStops,
  fetchTransitRouteById,
  LiveBus,
  TransitStopItem,
  TransitRouteItem,
} from '@/services/api';
import { getOfflineRouteDetails } from '@/services/offline-transit';
import { getUserProfile, UserProfile } from '@/services/user-profile';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedAgency, setSelectedAgency] = useState<'ALL' | 'DTC' | 'DIMTS' | 'EV'>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadingArea, setLoadingArea] = useState(false);
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [stops, setStops] = useState<TransitStopItem[]>([]);
  const [selectedBus, setSelectedBus] = useState<LiveBus | null>(null);
  const [inspectedBus, setInspectedBus] = useState<LiveBus | null>(null);
  const [inspectedRoute, setInspectedRoute] = useState<TransitRouteItem | null>(null);
  const [selectedStop, setSelectedStop] = useState<TransitStopItem | null>(null);

  // User location defaults (starts from Karawal Nagar / Delhi center until GPS resolves)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number }>({
    lat: 28.718,
    lon: 77.268,
  });

  // User Profile & Onboarding Modal
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Drawer expansion state (peek vs expanded)
  const [drawerExpanded, setDrawerExpanded] = useState(false);

  // Viewport change debounce ref
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViewportRef = useRef<{ lat: number; lon: number } | null>(null);

  // Check onboarding on mount
  useEffect(() => {
    (async () => {
      try {
        const profile = await getUserProfile();
        if (profile && profile.onboarded) {
          setUserProfile(profile);
        } else {
          setShowOnboarding(true);
        }
      } catch {
        setShowOnboarding(true);
      }
    })();
  }, []);

  // Request & acquire user current location immediately
  useEffect(() => {
    (async () => {
      try {
        // Fast path: cached last known location (0ms)
        const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
        if (lastKnown) {
          setUserLocation({
            lat: lastKnown.coords.latitude,
            lon: lastKnown.coords.longitude,
          });
        }

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
        // Fallback location already set
      }
    })();
  }, []);

  // Fetch telemetry at coordinates
  const loadTelemetryForCoords = useCallback(
    async (lat: number, lon: number, radiusKm: number = 7.0) => {
      try {
        const [liveBuses, nearbyStops] = await Promise.all([
          fetchLiveNearbyBuses(lat, lon, radiusKm, undefined, undefined, 80).catch(() => []),
          fetchNearbyStops(lat, lon, 3.5, 30).catch(() => []),
        ]);

        if (liveBuses.length > 0) setBuses(liveBuses);
        if (nearbyStops.length > 0) setStops(nearbyStops);
      } finally {
        setLoading(false);
        setLoadingArea(false);
      }
    },
    []
  );

  // Initial and 7-second adaptive polling loop around user location
  useEffect(() => {
    loadTelemetryForCoords(userLocation.lat, userLocation.lon);

    const timer = setInterval(() => {
      const target = lastViewportRef.current || userLocation;
      loadTelemetryForCoords(target.lat, target.lon);
    }, 7000);

    return () => clearInterval(timer);
  }, [userLocation, loadTelemetryForCoords]);

  // Dynamic Viewport Loading: when user moves map in screen, load buses in that new screen center!
  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      if (inspectedBus) return;

      const lat = region.latitude;
      const lon = region.longitude;

      // Ignore micro-movements under ~800 meters to keep 60 FPS panning fluid
      if (lastViewportRef.current) {
        const dLat = Math.abs(lat - lastViewportRef.current.lat);
        const dLon = Math.abs(lon - lastViewportRef.current.lon);
        if (dLat < 0.007 && dLon < 0.007) {
          return;
        }
      }

      const radiusKm = Math.min(10.0, Math.max(2.5, region.latitudeDelta * 111 * 0.6));

      if (viewportTimerRef.current) {
        clearTimeout(viewportTimerRef.current);
      }

      // Debounce network load by 700ms and only show loading indicator once the fetch begins
      viewportTimerRef.current = setTimeout(() => {
        lastViewportRef.current = { lat, lon };
        setLoadingArea(true);
        loadTelemetryForCoords(lat, lon, radiusKm);
      }, 700);
    },
    [inspectedBus, loadTelemetryForCoords]
  );

  // When a particular bus is clicked on map or card: enter Single-Bus Inspection Mode!
  const handleInspectBus = useCallback(async (bus: LiveBus) => {
    setSelectedBus(bus);
    setInspectedBus(bus);
    setDrawerExpanded(false);

    try {
      const offline = await getOfflineRouteDetails(bus.routeId);
      if (offline && offline.stops.length > 0) {
        setInspectedRoute(offline);
      } else {
        const online = await fetchTransitRouteById(bus.routeId);
        if (online) setInspectedRoute(online);
      }
    } catch {
      // Keep inspecting bus
    }
  }, []);

  const handleDismissInspect = () => {
    setInspectedBus(null);
    setInspectedRoute(null);
  };

  const handleOnboardingComplete = (
    profile: UserProfile,
    coords: { lat: number; lon: number } | null
  ) => {
    setUserProfile(profile);
    setShowOnboarding(false);
    if (coords) {
      setUserLocation(coords);
      loadTelemetryForCoords(coords.lat, coords.lon);
    }
  };

  // Filter buses by search and agency
  const filteredBuses = useMemo(() => {
    return buses.filter((bus) => {
      if (selectedAgency !== 'ALL') {
        if (selectedAgency === 'EV') {
          if (!bus.isElectric) return false;
        } else if (bus.agency !== selectedAgency) {
          return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          bus.routeShortName.toLowerCase().includes(q) ||
          bus.registration.toLowerCase().includes(q) ||
          bus.destination.toLowerCase().includes(q) ||
          bus.origin.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [buses, selectedAgency, search]);

  const dtcCount = buses.filter((b) => b.agency === 'DTC' && !b.isElectric).length;
  const clusterCount = buses.filter((b) => b.agency === 'DIMTS').length;
  const evCount = buses.filter((b) => b.isElectric).length;

  const routePolylinePoints = useMemo(() => {
    if (!inspectedRoute || !inspectedRoute.stops || inspectedRoute.stops.length === 0) return undefined;
    return inspectedRoute.stops.map((s) => ({ latitude: s.lat, longitude: s.lon }));
  }, [inspectedRoute]);

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Google Map Canvas in Background */}
      <View style={styles.mapContainer}>
        <TransitMap
          buses={filteredBuses}
          stops={stops}
          selectedBus={selectedBus}
          inspectedBus={inspectedBus}
          onSelectBus={handleInspectBus}
          selectedStop={selectedStop}
          onSelectStop={setSelectedStop}
          userLocation={userLocation}
          onRegionChangeComplete={handleRegionChangeComplete}
          routePolyline={routePolylinePoints}
          isLoadingArea={loadingArea}
        />
      </View>

      {/* Floating Top Header Bar & Agency Filters */}
      <View
        style={[styles.topOverlay, { paddingTop: insets.top + 6 }]}
        pointerEvents="box-none"
      >
        <View style={styles.floatingHeader} pointerEvents="auto">
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
                <Text style={styles.brandTitle}>TransitDilli</Text>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>OTD LIVE</Text>
                </View>
              </View>
              <Text style={styles.brandSubtitle}>Delhi Real-Time Transit Radar</Text>
            </View>
          </View>

          {/* Profile Avatar Chip */}
          <TouchableOpacity
            style={styles.profileChip}
            onPress={() => setShowOnboarding(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-circle" size={24} color="#34D399" />
            <Text style={styles.profileName} numberOfLines={1}>
              {userProfile?.name ? userProfile.name.split(' ')[0] : 'Profile'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Floating Agency Filter Pills: DTC Blue & Cluster Orange (Dark Theme) */}
        {!inspectedBus && (
          <View style={styles.agencyFilterRow} pointerEvents="auto">
            <TouchableOpacity
              style={[styles.filterPill, selectedAgency === 'ALL' && styles.filterPillActiveAll]}
              onPress={() => setSelectedAgency('ALL')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, selectedAgency === 'ALL' && styles.filterTextActive]}>
                All ({buses.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, selectedAgency === 'DTC' && styles.filterPillActiveDtc]}
              onPress={() => setSelectedAgency('DTC')}
              activeOpacity={0.8}
            >
              <View style={[styles.agencyDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={[styles.filterText, selectedAgency === 'DTC' && styles.filterTextActive]}>
                DTC Blue ({dtcCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, selectedAgency === 'DIMTS' && styles.filterPillActiveCluster]}
              onPress={() => setSelectedAgency('DIMTS')}
              activeOpacity={0.8}
            >
              <View style={[styles.agencyDot, { backgroundColor: '#F97316' }]} />
              <Text
                style={[styles.filterText, selectedAgency === 'DIMTS' && styles.filterTextActive]}
              >
                Cluster Orange ({clusterCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, selectedAgency === 'EV' && styles.filterPillActiveEv]}
              onPress={() => setSelectedAgency('EV')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, selectedAgency === 'EV' && styles.filterTextActive]}>
                ⚡ EV ({evCount})
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Keyboard Avoiding Bottom Sheet & Bus List Search */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? BottomTabInset + 20 : 0}
        style={[styles.bottomOverlay, { bottom: insets.bottom + BottomTabInset + 10 }]}
        pointerEvents="box-none"
      >
          {/* Single-Bus Inspection Sheet (Dark Theme) */}
          {inspectedBus ? (
            <View style={styles.inspectorCard} pointerEvents="auto">
              {/* Top Row with Route Badge, Registration & Close Button */}
              <View style={styles.inspectorTopRow}>
                <View style={styles.inspectorTitleGroup}>
                  <View
                    style={[
                      styles.inspectorBadge,
                      {
                        backgroundColor:
                          inspectedBus.agency === 'DIMTS'
                            ? '#EA580C' // Cluster Orange
                            : inspectedBus.isElectric
                            ? '#0284C7' // DTC Electric
                            : '#1D4ED8', // DTC Blue
                      },
                    ]}
                  >
                    <Text style={styles.inspectorBadgeText}>{inspectedBus.routeShortName}</Text>
                  </View>

                  <View>
                    <View style={styles.inspectorRegRow}>
                      <Text style={styles.inspectorRegText}>{inspectedBus.registration}</Text>
                      {inspectedBus.isAc && <Text style={styles.acBadge}>AC</Text>}
                      {inspectedBus.isElectric && <Text style={styles.evBadge}>⚡ EV</Text>}
                    </View>
                    <Text
                      style={[
                        styles.inspectorAgencyText,
                        {
                          color: inspectedBus.agency === 'DIMTS' ? '#FB923C' : '#60A5FA',
                        },
                      ]}
                    >
                      {inspectedBus.agency === 'DIMTS'
                        ? 'DIMTS Cluster Bus Service'
                        : 'Delhi Transport Corporation (DTC)'}
                    </Text>
                  </View>
                </View>

                {/* Close Inspection Action */}
                <TouchableOpacity
                  style={styles.closeInspectorBtn}
                  onPress={handleDismissInspect}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={20} color="#F8FAFC" />
                </TouchableOpacity>
              </View>

              {/* Destination & Corridor Info */}
              <View style={styles.inspectorCorridorBox}>
                <View style={styles.terminalDotRow}>
                  <View style={[styles.terminalDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.terminalText} numberOfLines={1}>
                    From: {inspectedBus.origin}
                  </Text>
                </View>
                <View style={styles.terminalDotRow}>
                  <View style={[styles.terminalDot, { backgroundColor: '#F87171' }]} />
                  <Text style={styles.terminalText} numberOfLines={1}>
                    Towards: {inspectedBus.destination}
                  </Text>
                </View>
              </View>

              {/* Telemetry Stats: Speed, Bearing & Freshness */}
              <View style={styles.inspectorStatsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>
                    {inspectedBus.speed > 0 ? `${inspectedBus.speed} km/h` : 'At Stop'}
                  </Text>
                  <Text style={styles.statLbl}>Live Speed</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{inspectedBus.bearing}°</Text>
                  <Text style={styles.statLbl}>Travel Heading</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{inspectedBus.freshness}</Text>
                  <Text style={styles.statLbl}>GPS Ping</Text>
                </View>
              </View>

              {/* Restore Radar Button */}
              <TouchableOpacity
                style={styles.restoreRadarBtn}
                onPress={handleDismissInspect}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                <Text style={styles.restoreRadarBtnText}>
                  Back to Full Radar ({buses.length} Buses)
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Collapsible Bottom Bus Drawer (Dark Theme) */
            <View
              style={[
                styles.bottomDrawer,
                drawerExpanded ? styles.bottomDrawerExpanded : styles.bottomDrawerPeek,
              ]}
              pointerEvents="auto"
            >
              {/* Drawer Handle & Quick Summary */}
              <TouchableOpacity
                style={styles.drawerHandleBar}
                onPress={() => setDrawerExpanded(!drawerExpanded)}
                activeOpacity={0.85}
              >
                <View style={styles.handlePill} />
                <View style={styles.drawerSummaryRow}>
                  <Text style={styles.drawerTitle}>
                    {filteredBuses.length} Live Buses on Radar
                  </Text>
                  <View style={styles.drawerToggleRow}>
                    <Text style={styles.drawerToggleText}>
                      {drawerExpanded ? 'Hide List' : 'View List'}
                    </Text>
                    <Ionicons
                      name={drawerExpanded ? 'chevron-down' : 'chevron-up'}
                      size={16}
                      color="#94A3B8"
                    />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Search Box in Drawer with Keyboard Avoiding Support */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color="#94A3B8" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Filter line (e.g. 505), reg (DL1PD...)"
                  placeholderTextColor="#64748B"
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => setDrawerExpanded(true)}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Scrollable Bus Cards List */}
              {drawerExpanded && (
                <ScrollView
                  style={styles.busListScroll}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {loading && buses.length === 0 ? (
                    <ActivityIndicator size="small" color="#10B981" style={{ marginVertical: 20 }} />
                  ) : filteredBuses.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>No live buses found matching filter.</Text>
                    </View>
                  ) : (
                    filteredBuses.map((bus) => {
                      const isCluster = bus.agency === 'DIMTS';
                      const badgeColor = isCluster
                        ? '#EA580C' // Orange
                        : bus.isElectric
                        ? '#0284C7' // Electric Blue
                        : '#1D4ED8'; // DTC Blue

                      return (
                        <TouchableOpacity
                          key={bus.id}
                          style={styles.busCard}
                          onPress={() => handleInspectBus(bus)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.busCardBadge, { backgroundColor: badgeColor }]}>
                            <Text style={styles.busCardBadgeText}>{bus.routeShortName}</Text>
                          </View>

                          <View style={styles.busCardDetails}>
                            <View style={styles.busCardHeader}>
                              <Text style={styles.busCardReg}>{bus.registration}</Text>
                              {bus.isAc && <Text style={styles.acPill}>AC</Text>}
                              {bus.isElectric && <Text style={styles.evPill}>⚡ EV</Text>}
                            </View>
                            <Text style={styles.busCardDest} numberOfLines={1}>
                              Towards {bus.destination}
                            </Text>
                            <Text style={styles.busCardAgency} numberOfLines={1}>
                              {bus.agencyName} • {bus.freshness}
                            </Text>
                          </View>

                          <View style={styles.busCardRight}>
                            <Text style={styles.busCardSpeed}>
                              {bus.speed > 0 ? `${bus.speed} km/h` : 'At Stop'}
                            </Text>
                            <Ionicons name="chevron-forward" size={18} color="#64748B" />
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              )}
            </View>
          )}
        </KeyboardAvoidingView>

      {/* Onboarding Dialog (First launch) */}
      <OnboardingModal visible={showOnboarding} onComplete={handleOnboardingComplete} />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
    overflow: 'hidden',
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -70,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingHeader: {
    marginHorizontal: 14,
    marginTop: 6,
    zIndex: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#059669',
  },
  logoImage: {
    width: 26,
    height: 26,
  },
  brandTextContainer: {
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#064E3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.4,
  },
  brandSubtitle: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    maxWidth: 65,
  },
  agencyFilterRow: {
    marginHorizontal: 14,
    marginTop: 8,
    zIndex: 10,
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  filterPillActiveAll: {
    backgroundColor: '#334155',
    borderColor: '#64748B',
  },
  filterPillActiveDtc: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA',
  },
  filterPillActiveCluster: {
    backgroundColor: '#EA580C',
    borderColor: '#FDBA74',
  },
  filterPillActiveEv: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  agencyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 20,
  },
  inspectorCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  inspectorTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  inspectorTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  inspectorBadge: {
    width: 52,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectorBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inspectorRegRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inspectorRegText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  inspectorAgencyText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  acBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#CBD5E1',
    backgroundColor: '#334155',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  evBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  closeInspectorBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectorCorridorBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  terminalDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  terminalDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  terminalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  inspectorStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  statLbl: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  restoreRadarBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  restoreRadarBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  bottomDrawer: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  bottomDrawerPeek: {
    height: 120,
  },
  bottomDrawerExpanded: {
    height: SCREEN_HEIGHT * 0.48,
  },
  drawerHandleBar: {
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  handlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
    marginBottom: 6,
  },
  drawerSummaryRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  drawerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  drawerToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  busListScroll: {
    flex: 1,
    paddingHorizontal: 14,
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  busCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  busCardBadge: {
    width: 44,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  busCardBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  busCardDetails: {
    flex: 1,
  },
  busCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  busCardReg: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  acPill: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#CBD5E1',
    backgroundColor: '#334155',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  evPill: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#38BDF8',
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  busCardDest: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E8F0',
    marginTop: 2,
  },
  busCardAgency: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  busCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  busCardSpeed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#34D399',
  },
});
