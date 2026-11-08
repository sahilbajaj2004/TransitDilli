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
  Keyboard,
  BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Region } from 'react-native-maps';
import { BottomTabInset } from '@/constants/theme';
import { TransitMap } from '@/components/transit-map';
import { OnboardingModal } from '@/components/onboarding-modal';
import { logger } from '@/services/app-logger';
import {
  fetchLiveNearbyBuses,
  fetchNearbyStops,
  fetchTransitRouteById,
  fetchBusLiveTelemetry,
  fetchRouteDirections,
  fetchBusesOnRoutes,
  fetchRouteSuggestions,
  DynamicRouteSuggestion,
  searchAllDelhiBuses,
  RouteDirectionOption,
  LiveBus,
  TransitStopItem,
  TransitRouteItem,
} from '@/services/api';
import { getOfflineRouteDetails, getOfflineRouteDirections } from '@/services/offline-transit';
import { getUserProfile, UserProfile } from '@/services/user-profile';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DELHI_SMART_SUGGESTIONS = [
  { label: '33', subtitle: 'Bhajanpura ⇄ Noida', icon: 'bus', color: '#38BDF8' },
  { label: '971', subtitle: 'Anand Vihar ⇄ Rohini', icon: 'bus', color: '#34D399' },
  { label: '502', subtitle: 'Mehrauli ⇄ Old Delhi', icon: 'bus', color: '#10B981' },
  { label: 'TMS', subtitle: 'Ring Road Mudrika', icon: 'repeat', color: '#F59E0B' },
  { label: 'OMS', subtitle: 'Outer Mudrika', icon: 'repeat', color: '#EA580C' },
  { label: '227A', subtitle: 'Karawal Nagar ⇄ Mori Gate', icon: 'bus', color: '#818CF8' },
  { label: '913', subtitle: 'Karawal Nagar ⇄ Qamruddin', icon: 'bus', color: '#38BDF8' },
  { label: 'Anand Vihar', subtitle: 'ISBT Hub', icon: 'location', color: '#34D399' },
  { label: 'Kashmere Gate', subtitle: 'North Delhi Hub', icon: 'location', color: '#F43F5E' },
  { label: 'DEVI', subtitle: 'Mohalla EV Bus', icon: 'flash', color: '#8B5CF6' },
  { label: 'DL1PD', subtitle: 'DTC State Fleet', icon: 'card', color: '#60A5FA' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<any>(null);
  const [search, setSearch] = useState('');
  const [selectedAgency, setSelectedAgency] = useState<'ALL' | 'DTC' | 'DIMTS' | 'DEVI' | 'DMRC'>('ALL');
  const [routeDirections, setRouteDirections] = useState<RouteDirectionOption[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [corridorRoute, setCorridorRoute] = useState<TransitRouteItem | null>(null);
  const [searchedRouteBuses, setSearchedRouteBuses] = useState<LiveBus[]>([]);
  const [routeSuggestions, setRouteSuggestions] = useState<DynamicRouteSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingArea, setLoadingArea] = useState(false);
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [stops, setStops] = useState<TransitStopItem[]>([]);
  const [selectedBus, setSelectedBus] = useState<LiveBus | null>(null);
  const [inspectedBus, setInspectedBus] = useState<LiveBus | null>(null);
  const [inspectedRoute, setInspectedRoute] = useState<TransitRouteItem | null>(null);
  const [selectedStop, setSelectedStop] = useState<TransitStopItem | null>(null);

  // Search interaction & stability state
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isSearchActiveRef = useRef(false);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto-clears search, dismisses keyboard, and restores full radar when commuter moves out
  const handleExitSearch = useCallback(() => {
    isSearchActiveRef.current = false;
    Keyboard.dismiss();
    setSearch('');
    setRouteSuggestions([]);
    setRouteDirections([]);
    setSelectedDirection(null);
    setCorridorRoute(null);
    setSearchedRouteBuses([]);
    setDrawerExpanded(false);
    setIsSearchFocused(false);
    logger.info('SEARCH', 'Search auto-cleared: commuter moved out of search');
  }, []);

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

  const handleSearchFocus = useCallback(() => {
    if (viewportTimerRef.current) {
      clearTimeout(viewportTimerRef.current);
      viewportTimerRef.current = null;
    }
    isSearchActiveRef.current = true;
    setIsSearchFocused(true);
    // Keep 50 live buses drawer closed when commuter clicks on search box
    setDrawerExpanded(false);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    const next = !drawerExpanded;
    setDrawerExpanded(next);
    if (next) {
      // Expanding the bus list: dismiss keyboard and unfocus search
      Keyboard.dismiss();
      setIsSearchFocused(false);
    }
  }, [drawerExpanded]);

  // Viewport change debounce ref & vehicle movement heading tracker
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViewportRef = useRef<{ lat: number; lon: number } | null>(null);
  const busHeadingRef = useRef<Map<string, { lat: number; lon: number; bearing: number }>>(new Map());

  // Check onboarding and log startup on mount
  useEffect(() => {
    logger.info('INIT', 'TransitDilli native engine initialized. Connected to Delhi OTD Telemetry.');
    (async () => {
      try {
        const profile = await getUserProfile();
        if (profile && profile.onboarded) {
          setUserProfile(profile);
          logger.info('AUTH', `Logged in commuter: ${profile.name}`);
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
          logger.info('GPS', `Last known location: ${lastKnown.coords.latitude.toFixed(4)}, ${lastKnown.coords.longitude.toFixed(4)}`);
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
          logger.success('GPS', `Active GPS fix acquired: ${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
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
          fetchLiveNearbyBuses(lat, lon, radiusKm, undefined, undefined, 50).catch(() => []),
          fetchNearbyStops(lat, lon, 3.5, 20).catch(() => []),
        ]);

        if (liveBuses.length > 0) {
          // Calculate & preserve active vehicle movement headings
          for (const b of liveBuses) {
            const prev = busHeadingRef.current.get(b.id);
            if (prev) {
              const dLat = (b.lat - prev.lat) * 111320;
              const dLon = (b.lon - prev.lon) * 111320 * Math.cos((b.lat * Math.PI) / 180);
              const dist = Math.hypot(dLat, dLon);

              if (dist >= 3.0) {
                // Bus is driving: compute exact travel heading
                const toRad = Math.PI / 180;
                const toDeg = 180 / Math.PI;
                const y = Math.sin((b.lon - prev.lon) * toRad) * Math.cos(b.lat * toRad);
                const x =
                  Math.cos(prev.lat * toRad) * Math.sin(b.lat * toRad) -
                  Math.sin(prev.lat * toRad) * Math.cos(b.lat * toRad) * Math.cos((b.lon - prev.lon) * toRad);
                b.bearing = (Math.round(Math.atan2(y, x) * toDeg) + 360) % 360;
              } else if (b.bearing === 0 && prev.bearing > 0) {
                // Bus is at stop or traffic light: retain last known forward heading!
                b.bearing = prev.bearing;
              }
            }
            busHeadingRef.current.set(b.id, { lat: b.lat, lon: b.lon, bearing: b.bearing });
          }

          setBuses(liveBuses);
          logger.info('RADAR', `Telemetry loaded: ${liveBuses.length} live buses at [${lat.toFixed(3)}, ${lon.toFixed(3)}]`);
          // If a bus is currently inspected, synchronize its position from the batch
          setInspectedBus((prev) => {
            if (!prev) return null;
            const match = liveBuses.find((b) => b.id === prev.id);
            return match ? { ...prev, ...match } : prev;
          });
        }
        if (nearbyStops.length > 0) setStops(nearbyStops);
      } finally {
        setLoading(false);
        setLoadingArea(false);
      }
    },
    []
  );

  // Initial and 7-second adaptive polling loop around active location
  useEffect(() => {
    loadTelemetryForCoords(userLocation.lat, userLocation.lon);

    const timer = setInterval(() => {
      // Do not interrupt active search / typing with background fleet replacements
      if (isSearchActiveRef.current || isSearchFocused || search.trim().length > 0) {
        return;
      }
      const target = lastViewportRef.current || userLocation;
      loadTelemetryForCoords(target.lat, target.lon);
    }, 7000);

    return () => clearInterval(timer);
  }, [userLocation, loadTelemetryForCoords, isSearchFocused, search]);

  // Dedicated High-Frequency Real-Time Tracking Loop for Selected Bus:
  // Polls live GPS telemetry every 2.5 seconds and advances the bus on the map!
  useEffect(() => {
    if (!inspectedBus) return;

    const busId = inspectedBus.id;
    let isCancelled = false;

    const trackCurrentBus = async () => {
      try {
        const live = await fetchBusLiveTelemetry(busId);
        if (live && !isCancelled) {
          setInspectedBus((prev) => {
            if (!prev || prev.id !== busId) return prev;
            return {
              ...prev,
              lat: live.lat,
              lon: live.lon,
              speed: live.speed,
              bearing: live.bearing,
              freshness: 'Live tracking',
              timestamp: live.timestamp,
            };
          });
        }
      } catch {
        // Fallback to internal route progression
      }
    };

    const timer = setInterval(trackCurrentBus, 2500);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [inspectedBus?.id]);

  // Dynamic Viewport Loading: when user moves map in screen, load buses in that new screen center!
  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      if (inspectedBus) return;
      // Never re-fetch telemetry while user is actively searching or keyboard is open
      if (isSearchActiveRef.current || isSearchFocused || search.trim().length > 0) {
        return;
      }

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
        if (isSearchActiveRef.current) return;
        lastViewportRef.current = { lat, lon };
        setLoadingArea(true);
        loadTelemetryForCoords(lat, lon, radiusKm);
      }, 700);
    },
    [inspectedBus, loadTelemetryForCoords, isSearchFocused, search]
  );

  // When a particular bus is clicked on map or card: enter Single-Bus Inspection Mode!
  const handleInspectBus = useCallback(async (bus: LiveBus) => {
    setSelectedBus(bus);
    setInspectedBus(bus);
    setDrawerExpanded(false);
    logger.info('INSPECT', `Inspecting ${bus.agency} Bus ${bus.registration} on Route ${bus.routeShortName} (${bus.speed > 0 ? bus.speed + ' km/h' : 'At Stop'}, Heading: ${bus.bearing}°)`);

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

  const handleDismissInspect = useCallback(() => {
    logger.info('INSPECT', 'Exited single-bus inspection. Returned to full radar.');
    setInspectedBus(null);
    setInspectedRoute(null);
  }, []);

  // Hardware Back Button handler on Android: registered once, reads latest state via ref (prevents ImeBackAnimationController cancellation)
  const backActionRef = useRef<() => boolean>(() => false);
  backActionRef.current = () => {
    if (inspectedBus) {
      handleDismissInspect();
      return true;
    }
    if (isSearchFocused || search.length > 0 || drawerExpanded) {
      handleExitSearch();
      return true;
    }
    return false;
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return backActionRef.current();
    });
    return () => backHandler.remove();
  }, []);

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

  // Route Direction Switcher: whenever commuter searches a route code (e.g. "33", "502", "227A")
  // Universal Search across ALL live buses operating in Delhi (routes, registrations, terminals, agencies)
  useEffect(() => {
    const q = search.trim();
    if (!q || q.length < 1) {
      setRouteDirections([]);
      setSelectedDirection(null);
      setCorridorRoute(null);
      setSearchedRouteBuses([]);
      return;
    }

    logger.info('SEARCH', `Searching every bus in Delhi: "${q}"...`);
    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const { buses: foundBuses, directions } = await searchAllDelhiBuses(q, selectedAgency);
        if (!isMounted) return;

        let finalDirs = directions;
        if (finalDirs.length === 0) {
          finalDirs = (await getOfflineRouteDirections(q)) || (await fetchRouteDirections(q)) || [];
        }

        if (isMounted) {
          setSearchedRouteBuses(foundBuses);
          setRouteDirections(finalDirs);
          setSelectedDirection(null);
          setCorridorRoute(null);

          if (foundBuses.length > 0) {
            logger.success(
              'SEARCH',
              `Found ${foundBuses.length} live buses across Delhi matching "${q}"${
                finalDirs.length > 0 ? ` (${finalDirs.length} directions available)` : ''
              }`
            );
          } else {
            logger.info('SEARCH', `0 live buses matching "${q}" across Delhi`);
          }
        }
      } catch {
        // Silently continue
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [search, selectedAgency]);

  const handleSelectDirection = useCallback(async (dir: RouteDirectionOption | null) => {
    if (!dir) {
      setSelectedDirection(null);
      setCorridorRoute(null);
      logger.info('CORRIDOR', `Switched to: All ${search.trim()} corridor buses`);
      return;
    }
    setSelectedDirection(dir.routeId);
    logger.info('CORRIDOR', `Selected Direction: ${dir.origin} ➔ ${dir.destination} (${dir.stopsCount} stops)`);
    try {
      const detail = (await getOfflineRouteDetails(dir.routeId)) || (await fetchTransitRouteById(dir.routeId));
      if (detail) {
        setCorridorRoute(detail);
      }
    } catch {
      // Keep selection active
    }
  }, [search]);

  // Dynamic Route Suggestions as commuter types (e.g. "971" -> 971, 971A; "33" -> 33, 33A, 334; "9" -> 901, 913, 971)
  useEffect(() => {
    const q = search.trim();
    if (!q || q.length < 1) {
      setRouteSuggestions([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const list = await fetchRouteSuggestions(q, 16);
        if (isMounted) {
          setRouteSuggestions(list);
          if (list.length > 0) {
            logger.info('SUGGEST', `Suggestions for "${q}": ${list.map((s) => s.shortName).join(', ')}`);
          }
        }
      } catch {
        if (isMounted) setRouteSuggestions([]);
      }
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [search]);

  // When commuter taps any suggested route card (e.g. 971, 971A, 33, 334)
  const handleSelectRouteSuggestion = useCallback(async (sugg: DynamicRouteSuggestion) => {
    isSelectingRef.current = true;
    Keyboard.dismiss();
    setSearch(sugg.shortName);
    setDrawerExpanded(true);
    logger.info('SELECT_ROUTE', `Selected: ${sugg.shortName} (${sugg.label})`);

    try {
      // 1. Fetch directions for the route (e.g. Bhajanpura -> Noida vs Noida -> Bhajanpura)
      let dirs = (await getOfflineRouteDirections(sugg.shortName)) || (await fetchRouteDirections(sugg.shortName)) || [];
      if (dirs.length === 0 && sugg.longName) {
        dirs = (await getOfflineRouteDirections(sugg.longName)) || (await fetchRouteDirections(sugg.longName)) || [];
      }
      setRouteDirections(dirs);
      setSelectedDirection(null);
      setCorridorRoute(null);

      // 2. Fetch live fleet operating on this route
      const queryCodes = [sugg.shortName, sugg.longName, `${sugg.shortName}UP`, `${sugg.shortName}DOWN`].filter(Boolean);
      const liveBuses = await fetchBusesOnRoutes(queryCodes);
      if (liveBuses.length > 0) {
        setSearchedRouteBuses(liveBuses);
        logger.success('ROUTE_FLEET', `Route ${sugg.shortName}: ${liveBuses.length} live buses operating across Delhi`);
      } else {
        const searchRes = await searchAllDelhiBuses(sugg.shortName);
        setSearchedRouteBuses(searchRes.buses);
      }
    } catch {
      // Retain state
    }
  }, []);

  // The active fleet pool: when commuter types a query, use all matching buses across Delhi
  const activeFleetPool = useMemo(() => {
    const raw =
      search.trim().length >= 1 && searchedRouteBuses.length > 0
        ? searchedRouteBuses
        : buses;
    const seen = new Set<string>();
    return raw.filter((bus) => {
      if (!bus || !bus.id || seen.has(bus.id)) return false;
      seen.add(bus.id);
      return true;
    });
  }, [search, searchedRouteBuses, buses]);

  // Filter buses by search, 4 agencies, and corridor direction
  const filteredBuses = useMemo(() => {
    const isDelhiSearch = search.trim().length >= 1 && searchedRouteBuses.length > 0;

    return activeFleetPool.filter((bus) => {
      // 4 Agency filter
      if (selectedAgency !== 'ALL') {
        if (bus.agency !== selectedAgency) {
          return false;
        }
      }

      // When commuter chooses a specific direction (e.g. Bhajanpura -> Noida vs Noida -> Bhajanpura)
      if (selectedDirection && routeDirections.length > 0) {
        const activeDir = routeDirections.find((d) => d.routeId === selectedDirection);
        if (activeDir) {
          const origKey = activeDir.origin.toLowerCase().slice(0, 6);
          const destKey = activeDir.destination.toLowerCase().slice(0, 6);
          const busDest = (bus.destination || '').toLowerCase();
          const busOrig = (bus.origin || '').toLowerCase();
          const busDesc = (bus.routeDesc || '').toUpperCase();
          const matchesDir =
            bus.routeId === selectedDirection ||
            busDest.includes(destKey) ||
            busOrig.includes(origKey) ||
            (activeDir.direction === 1 && busDesc.includes('UP')) ||
            (activeDir.direction === 0 && busDesc.includes('DOWN'));

          if (!matchesDir) return false;
        }
      }

      // If filtering local radar buses (before search results arrive or fallback)
      if (search.trim() && !isDelhiSearch) {
        const q = search.trim().toLowerCase();
        const matchesText =
          (bus.routeShortName || '').toLowerCase().includes(q) ||
          (bus.registration || '').toLowerCase().includes(q) ||
          (bus.destination || '').toLowerCase().includes(q) ||
          (bus.origin || '').toLowerCase().includes(q) ||
          (bus.routeDesc || '').toLowerCase().includes(q);

        if (!matchesText) return false;
      }

      return true;
    });
  }, [activeFleetPool, selectedAgency, search, selectedDirection, routeDirections, searchedRouteBuses.length]);

  // Counts for the 4 Delhi services (calculated from active fleet pool)
  const dtcCount = activeFleetPool.filter((b) => b.agency === 'DTC').length;
  const clusterCount = activeFleetPool.filter((b) => b.agency === 'DIMTS').length;
  const deviCount = activeFleetPool.filter((b) => b.agency === 'DEVI').length;
  const dmrcCount = activeFleetPool.filter((b) => b.agency === 'DMRC').length;

  // Active polyline points for inspected bus or searched direction corridor
  const routePolylinePoints = useMemo(() => {
    const activeRoute = inspectedRoute || corridorRoute;
    if (!activeRoute || !activeRoute.stops || activeRoute.stops.length === 0) return undefined;
    return activeRoute.stops.map((s) => ({ latitude: s.lat, longitude: s.lon }));
  }, [inspectedRoute, corridorRoute]);

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
          onDismissSearch={handleExitSearch}
        />
      </View>

      {/* Floating Top Header Bar & Agency Filters */}
      <View
        style={[styles.topOverlay, { paddingTop: insets.top + 6 }]}
        pointerEvents="box-none"
      >
        {/* Unified Top Search Capsule */}
        <View style={styles.topSearchCapsule} pointerEvents="auto">
          {/* If searching or text entered: Back Arrow to cancel search */}
          {isSearchFocused || search.length > 0 ? (
            <TouchableOpacity
              onPress={handleExitSearch}
              style={styles.searchBackBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color="#34D399" />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchLogoBadge}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.searchLogoImg}
                contentFit="contain"
              />
            </View>
          )}

          {/* Search Input */}
          <TextInput
            ref={inputRef}
            style={styles.topSearchInput}
            placeholder="Search every bus in Delhi (33, 971)..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            autoCorrect={false}
            autoCapitalize="characters"
          />

          {/* Quick Clear Button */}
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setRouteSuggestions([]);
                setRouteDirections([]);
                setSelectedDirection(null);
                setCorridorRoute(null);
                setSearchedRouteBuses([]);
                inputRef.current?.focus();
              }}
              style={styles.topClearBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {/* OTD LIVE indicator when idle */}
          {search.length === 0 && !isSearchFocused && (
            <View style={styles.topLiveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.topLiveText}>LIVE</Text>
            </View>
          )}

          {/* Profile Avatar Chip */}
          <TouchableOpacity
            style={styles.topProfileChip}
            onPress={() => setShowOnboarding(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-circle" size={26} color="#34D399" />
          </TouchableOpacity>
        </View>

        {/* Floating Search Results Dropdown (Top Overlay) */}
        {(isSearchFocused || search.length > 0) && (
          <View style={styles.topDropdownCard} pointerEvents="auto">
            {/* Dynamic Route Suggestions when commuter types */}
            {search.trim().length > 0 && routeSuggestions.length > 0 && (
              <View style={styles.topSuggestionsWrapper}>
                <View style={styles.suggestionsHeader}>
                  <View style={styles.dynHeaderLeft}>
                    <Ionicons name="git-network-outline" size={13} color="#34D399" />
                    <Text style={styles.suggestionsTitle}>
                      Suggested Delhi Routes ({routeSuggestions.length})
                    </Text>
                  </View>
                  <Text style={styles.suggestionsHint}>Tap to view corridor</Text>
                </View>
                <ScrollView
                  style={styles.topSuggestionsVerticalScroll}
                  keyboardShouldPersistTaps="always"
                  showsVerticalScrollIndicator={false}
                >
                  {routeSuggestions.map((item) => {
                    const agencyColor =
                      item.agency === 'DEVI'
                        ? '#8B5CF6'
                        : item.agency === 'DMRC'
                        ? '#06B6D4'
                        : item.agency === 'DIMTS'
                        ? '#EA580C'
                        : '#1D4ED8';

                    return (
                      <TouchableOpacity
                        key={`top-sugg-${item.shortName}-${item.longName}`}
                        style={styles.topSuggestionRow}
                        onPress={() => handleSelectRouteSuggestion(item)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.topSuggestionBadge, { backgroundColor: agencyColor }]}>
                          <Text style={styles.topSuggestionBadgeText}>{item.shortName}</Text>
                        </View>
                        <View style={styles.topSuggestionContent}>
                          <Text style={styles.topSuggestionTerminals} numberOfLines={1}>
                            {item.origin} ➔ {item.destination}
                          </Text>
                          <Text style={styles.topSuggestionMeta}>
                            {item.agency} • {item.directionCount || 2} directions
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#475569" />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Smart Quick Suggestions when Search query is empty */}
            {search.trim().length === 0 && (
              <View style={styles.topQuickSection}>
                <View style={styles.suggestionsHeader}>
                  <Text style={styles.suggestionsTitle}>Suggested for you</Text>
                  <Text style={styles.suggestionsHint}>Tap to search instantly</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={styles.suggestionsScroll}
                >
                  {DELHI_SMART_SUGGESTIONS.map((item) => (
                    <TouchableOpacity
                      key={`sugg-${item.label}`}
                      style={styles.suggestionChip}
                      onPress={() => {
                        isSelectingRef.current = true;
                        setSearch(item.label);
                        Keyboard.dismiss();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.suggestionDot, { backgroundColor: item.color }]} />
                      <Text style={styles.suggestionChipLabel}>{item.label}</Text>
                      <Text style={styles.suggestionChipSub}>{item.subtitle}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Direction Switcher (When searching a route e.g. 33) */}
            {routeDirections.length > 0 && (
              <View style={styles.directionSection}>
                <Text style={styles.directionHeaderTitle}>
                  Route {search.trim()} Direction:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={styles.directionPillsScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.directionPill,
                      selectedDirection === null && styles.directionPillActive,
                    ]}
                    onPress={() => handleSelectDirection(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={13}
                      color={selectedDirection === null ? '#34D399' : '#94A3B8'}
                    />
                    <Text
                      style={[
                        styles.directionPillText,
                        selectedDirection === null && styles.directionPillTextActive,
                      ]}
                    >
                      All {search.trim()} ({activeFleetPool.length})
                    </Text>
                  </TouchableOpacity>

                  {routeDirections.map((dir) => {
                    const isDirActive = selectedDirection === dir.routeId;
                    const origShort = dir.origin.split(/[\s(/,]/)[0];
                    const destShort = dir.destination.split(/[\s(/,]/)[0];
                    const shortLabel = `${origShort} ➔ ${destShort}`;

                    const count = activeFleetPool.filter(
                      (b) =>
                        b.routeId === dir.routeId ||
                        (b.destination && dir.destination && b.destination.toLowerCase().includes(dir.destination.toLowerCase().slice(0, 6))) ||
                        (b.origin && dir.origin && b.origin.toLowerCase().includes(dir.origin.toLowerCase().slice(0, 6))) ||
                        (dir.direction === 1 && b.routeDesc.toUpperCase().includes('UP')) ||
                        (dir.direction === 0 && b.routeDesc.toUpperCase().includes('DOWN'))
                    ).length;

                    return (
                      <TouchableOpacity
                        key={dir.routeId}
                        style={[
                          styles.directionPill,
                          isDirActive && styles.directionPillActive,
                        ]}
                        onPress={() => {
                          isSelectingRef.current = true;
                          handleSelectDirection(dir);
                          Keyboard.dismiss();
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="arrow-forward-circle"
                          size={13}
                          color={isDirActive ? '#34D399' : '#94A3B8'}
                        />
                        <Text
                          style={[
                            styles.directionPillText,
                            isDirActive && styles.directionPillTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {shortLabel} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Floating 4 Agency Filter Pills: DTC, DIMTS, DEVI, DMRC (Dark Theme) */}
        {!inspectedBus && !isSearchFocused && search.length === 0 && (
          <View style={styles.agencyFilterContainer} pointerEvents="auto">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.agencyFilterScroll}
            >
              <TouchableOpacity
                style={[styles.filterPill, selectedAgency === 'ALL' && styles.filterPillActiveAll]}
                onPress={() => setSelectedAgency('ALL')}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, selectedAgency === 'ALL' && styles.filterTextActive]}>
                  All ({activeFleetPool.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, selectedAgency === 'DTC' && styles.filterPillActiveDtc]}
                onPress={() => setSelectedAgency('DTC')}
                activeOpacity={0.8}
              >
                <View style={[styles.agencyDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={[styles.filterText, selectedAgency === 'DTC' && styles.filterTextActive]}>
                  DTC ({dtcCount})
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
                  Cluster ({clusterCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, selectedAgency === 'DEVI' && styles.filterPillActiveDevi]}
                onPress={() => setSelectedAgency('DEVI')}
                activeOpacity={0.8}
              >
                <View style={[styles.agencyDot, { backgroundColor: '#A855F7' }]} />
                <Text style={[styles.filterText, selectedAgency === 'DEVI' && styles.filterTextActive]}>
                  DEVI ({deviCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, selectedAgency === 'DMRC' && styles.filterPillActiveDmrc]}
                onPress={() => setSelectedAgency('DMRC')}
                activeOpacity={0.8}
              >
                <View style={[styles.agencyDot, { backgroundColor: '#06B6D4' }]} />
                <Text style={[styles.filterText, selectedAgency === 'DMRC' && styles.filterTextActive]}>
                  DMRC ({dmrcCount})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Bottom Sheet & Bus List Search */}
      <View
        style={[
          styles.bottomOverlay,
          {
            bottom: isKeyboardVisible ? 8 : Math.max(insets.bottom + 6, 14) + 52,
          },
        ]}
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
                          inspectedBus.agency === 'DEVI'
                            ? '#8B5CF6' // DEVI Mohalla: Purple
                            : inspectedBus.agency === 'DMRC'
                            ? '#06B6D4' // DMRC Feeder: Teal
                            : inspectedBus.agency === 'DIMTS'
                            ? '#EA580C' // Cluster: Orange
                            : '#1D4ED8', // DTC: Blue
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
                          color:
                            inspectedBus.agency === 'DEVI'
                              ? '#C084FC'
                              : inspectedBus.agency === 'DMRC'
                              ? '#22D3EE'
                              : inspectedBus.agency === 'DIMTS'
                              ? '#FB923C'
                              : '#60A5FA',
                        },
                      ]}
                    >
                      {inspectedBus.agency === 'DEVI'
                        ? 'DEVI Mohalla Bus Service'
                        : inspectedBus.agency === 'DMRC'
                        ? 'DMRC Metro Feeder Service'
                        : inspectedBus.agency === 'DIMTS'
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
                onPress={toggleDrawer}
                activeOpacity={0.85}
              >
                <View style={styles.handlePill} />
                <View style={styles.drawerSummaryRow}>
                  <Text style={styles.drawerTitle}>
                    {search.trim().length > 0
                      ? `${filteredBuses.length} Buses on Route ${search.trim()}`
                      : 'Live Buses on Radar'}
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
                      const badgeColor =
                        bus.agency === 'DEVI'
                          ? '#8B5CF6' // Purple
                          : bus.agency === 'DMRC'
                          ? '#06B6D4' // Teal
                          : bus.agency === 'DIMTS'
                          ? '#EA580C' // Orange
                          : '#1D4ED8'; // DTC Blue

                      return (
                        <TouchableOpacity
                          key={bus.id}
                          style={styles.busCard}
                          onPress={() => {
                            isSelectingRef.current = true;
                            handleInspectBus(bus);
                            Keyboard.dismiss();
                          }}
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
        </View>

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
  topSearchCapsule: {
    marginHorizontal: 14,
    marginTop: 4,
    zIndex: 10,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  searchLogoBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#059669',
  },
  searchLogoImg: {
    width: 20,
    height: 20,
  },
  searchBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSearchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 0,
  },
  topClearBtn: {
    padding: 3,
  },
  topLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#064E3B',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: '#059669',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  topLiveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  topProfileChip: {
    padding: 2,
  },
  topDropdownCard: {
    marginHorizontal: 14,
    marginTop: 6,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#334155',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    maxHeight: SCREEN_HEIGHT * 0.45,
    overflow: 'hidden',
  },
  topSuggestionsWrapper: {
    padding: 12,
  },
  topSuggestionsVerticalScroll: {
    maxHeight: SCREEN_HEIGHT * 0.35,
  },
  topSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 10,
  },
  topSuggestionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSuggestionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  topSuggestionContent: {
    flex: 1,
  },
  topSuggestionTerminals: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  topSuggestionMeta: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  topQuickSection: {
    padding: 12,
  },
  agencyFilterContainer: {
    marginHorizontal: 14,
    marginTop: 8,
    zIndex: 10,
  },
  agencyFilterScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 10,
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
  filterPillActiveDevi: {
    backgroundColor: '#8B5CF6',
    borderColor: '#C084FC',
  },
  filterPillActiveDmrc: {
    backgroundColor: '#06B6D4',
    borderColor: '#67E8F9',
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
    zIndex: 1000,
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
    height: 56,
  },
  bottomDrawerExpanded: {
    height: SCREEN_HEIGHT * 0.48,
  },
  bottomDrawerKeyboard: {
    height: Math.min(280, SCREEN_HEIGHT * 0.38),
  },
  bottomDrawerKeyboardEmpty: {
    height: 155,
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
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1.2,
    borderColor: '#334155',
  },
  searchDoneBtn: {
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchDoneBtnText: {
    color: '#34D399',
    fontSize: 12.5,
    fontWeight: '800',
  },
  dynamicSuggestionsSection: {
    marginHorizontal: 14,
    marginBottom: 8,
  },
  dynHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dynamicSuggestionsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 10,
    paddingVertical: 2,
  },
  dynamicRouteCard: {
    width: 175,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 9,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dynamicCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  dynamicBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  dynamicBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  agencyPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  agencyPillText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  dynamicRouteTerminals: {
    color: '#F1F5F9',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
    marginBottom: 6,
  },
  dynamicCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dynamicCardMeta: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },
  searchBoxFocused: {
    borderColor: '#10B981',
    backgroundColor: '#0F172A',
    shadowColor: '#10B981',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  searchClearBtn: {
    padding: 3,
    marginLeft: 4,
  },
  suggestionsSection: {
    marginHorizontal: 14,
    marginBottom: 8,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  suggestionsTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  suggestionsHint: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  suggestionsScroll: {
    flexDirection: 'row',
    gap: 7,
    paddingRight: 10,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  suggestionChipLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  suggestionChipSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
  },
  searchIconBtn: {
    paddingRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 0,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 12.5,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  directionSection: {
    marginHorizontal: 14,
    marginBottom: 8,
  },
  directionHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  directionPillsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 10,
  },
  directionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  directionPillActive: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  directionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  directionPillTextActive: {
    color: '#34D399',
    fontWeight: '800',
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
