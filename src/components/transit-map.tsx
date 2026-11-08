import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import { StyleSheet, View, Text, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LiveBus, TransitStopItem } from '@/services/api';
import { TRANSIT_MAP_STYLE } from '@/constants/map-style';
import { BusMarker } from './bus-marker';

interface TransitMapProps {
  buses: LiveBus[];
  stops?: TransitStopItem[];
  selectedBus: LiveBus | null;
  inspectedBus?: LiveBus | null;
  onSelectBus: (bus: LiveBus) => void;
  selectedStop?: TransitStopItem | null;
  onSelectStop?: (stop: TransitStopItem) => void;
  userLocation?: { lat: number; lon: number } | null;
  onRegionChangeComplete?: (region: Region) => void;
  routePolyline?: Array<{ latitude: number; longitude: number }>;
  isLoadingArea?: boolean;
}

/**
 * Ultra-performant Android Marker:
 * Temporarily enables view tracking for 150ms so native Android View can rasterize,
 * then freezes tracksViewChanges to FALSE.
 * This stores the native Bitmap in GPU texture cache, giving buttery 60-120 FPS panning.
 */
const FastBusMarker = memo(({
  bus,
  isSelected,
  onPress,
}: {
  bus: LiveBus;
  isSelected: boolean;
  onPress: (bus: LiveBus) => void;
}) => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [bus.id, bus.routeShortName, bus.lat, bus.lon, bus.bearing, isSelected]);

  return (
    <Marker
      coordinate={{ latitude: bus.lat, longitude: bus.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={true}
      rotation={bus.bearing}
      tracksViewChanges={tracksViewChanges}
      onPress={() => onPress(bus)}
    >
      <BusMarker bus={bus} isSelected={isSelected} />
    </Marker>
  );
});

export function TransitMap({
  buses,
  stops = [],
  selectedBus,
  inspectedBus,
  onSelectBus,
  selectedStop,
  onSelectStop,
  userLocation,
  onRegionChangeComplete,
  routePolyline,
  isLoadingArea = false,
}: TransitMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const hasCenteredInitialRef = useRef(false);

  // Smoothly center on user's real GPS position ONCE on startup
  useEffect(() => {
    if (userLocation && mapRef.current && !hasCenteredInitialRef.current) {
      hasCenteredInitialRef.current = true;
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.lat,
          longitude: userLocation.lon,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        },
        700
      );
    }
  }, [userLocation?.lat, userLocation?.lon]);

  // Smoothly zoom in on the inspected bus
  useEffect(() => {
    if (inspectedBus && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: inspectedBus.lat,
          longitude: inspectedBus.lon,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        500
      );
    }
  }, [inspectedBus]);

  // Initial focus: user GPS or Delhi AIIMS Ring Road Corridor
  const initialRegion = useMemo(() => ({
    latitude: userLocation?.lat || 28.5694,
    longitude: userLocation?.lon || 77.2085,
    latitudeDelta: 0.035,
    longitudeDelta: 0.035,
  }), []);

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation?.lat || 28.5694,
          longitude: userLocation?.lon || 77.2085,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        },
        400
      );
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webFallbackContainer}>
        <Text style={styles.webFallbackText}>Native Google Maps is active on Android/iOS.</Text>
        <Text style={styles.webFallbackSub}>{buses.length} live buses tracked</Text>
      </View>
    );
  }

  // When a particular bus is clicked / inspected:
  // ONLY render that single bus on the radar map until dismissed!
  const busesToRender = inspectedBus ? [inspectedBus] : buses;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        customMapStyle={TRANSIT_MAP_STYLE}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        toolbarEnabled={false}
        loadingEnabled={true}
        loadingIndicatorColor="#34D399"
        loadingBackgroundColor="#0F172A"
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {/* Render Route Polyline for inspected bus */}
        {routePolyline && routePolyline.length > 1 && (
          <Polyline
            coordinates={routePolyline}
            strokeColor={inspectedBus?.agency === 'DIMTS' ? '#EA580C' : '#1D4ED8'}
            strokeWidth={4.5}
            lineDashPattern={[0]}
          />
        )}

        {/* Render Bus Stops (filtered if single bus inspected) */}
        {!inspectedBus &&
          stops.slice(0, 25).map((stop) => {
            const isSelected = selectedStop?.id === stop.id;
            return (
              <Marker
                key={`stop-${stop.id}`}
                coordinate={{ latitude: stop.lat, longitude: stop.lon }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onPress={() => onSelectStop && onSelectStop(stop)}
              >
                <View style={[styles.stopPin, isSelected && styles.stopPinSelected]}>
                  <View style={[styles.stopPinInner, isSelected && styles.stopPinInnerSelected]} />
                </View>
              </Marker>
            );
          })}

        {/* Render Live Moving Buses with Zero-Lag Native GPU Bitmap Caching */}
        {busesToRender.map((bus) => {
          const isSelected = selectedBus?.id === bus.id || inspectedBus?.id === bus.id;

          return (
            <FastBusMarker
              key={`bus-${bus.id}`}
              bus={bus}
              isSelected={isSelected}
              onPress={onSelectBus}
            />
          );
        })}
      </MapView>

      {/* Dynamic Viewport Loading Indicator */}
      {isLoadingArea && (
        <View style={styles.loadingAreaChip}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingAreaText}>Updating buses in this area...</Text>
        </View>
      )}

      {/* Floating Recenter Button */}
      <TouchableOpacity
        style={styles.recenterButton}
        onPress={handleRecenter}
        activeOpacity={0.8}
      >
        <Ionicons name="locate" size={22} color="#0F172A" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -70,
  },
  map: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  webFallbackContainer: {
    flex: 1,
    minHeight: 250,
    backgroundColor: '#0B132B',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webFallbackText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  webFallbackSub: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  stopPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  stopPinSelected: {
    borderColor: '#059669',
    transform: [{ scale: 1.3 }],
  },
  stopPinInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#475569',
  },
  stopPinInnerSelected: {
    backgroundColor: '#059669',
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  loadingAreaChip: {
    position: 'absolute',
    top: 140,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  loadingAreaText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
});
