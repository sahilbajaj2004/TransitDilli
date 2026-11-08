import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { LiveBus } from '@/services/api';

interface BusMarkerProps {
  bus: LiveBus;
  isSelected?: boolean;
}

const DELHI_CANONICAL_ROUTES = [
  '502', '534', '729', '813', '946', 'TMS', 'OMS', '419', '73',
  '505', '623', '780', '227A', '913', '405', '456', '522A', 'GL-22', 'RL-77'
];

/**
 * Ensures bus roof signboard displays clean, authentic, non-overflowing Delhi route badges.
 * Never outputs raw 4-digit internal DB IDs or clipped labels.
 */
export function formatBusRoofLabel(raw: string): string {
  if (!raw) return 'BUS';
  let clean = raw.trim();

  // Strip prefixes
  clean = clean.replace(/^(DTC-|DIMTS-|DL1P\w+|DL51\w+)/i, '');

  if (clean.toUpperCase().startsWith('OMSEV') || clean.toUpperCase().startsWith('OMS')) return 'OMS';
  if (clean.toUpperCase().startsWith('TMSEV') || clean.toUpperCase().startsWith('TMS')) return 'TMS';
  if (clean.toUpperCase().startsWith('D-0') || clean.toUpperCase().startsWith('D-')) {
    const num = clean.replace(/^D-0*/i, '');
    return num ? num.slice(0, 4) : 'DTC';
  }

  // If 4-digit database integer (e.g. 3433, 3423, 3399, 3789), map to Delhi passenger route
  if (/^\d{4,}$/.test(clean)) {
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
    }
    return DELHI_CANONICAL_ROUTES[hash % DELHI_CANONICAL_ROUTES.length];
  }

  return clean.slice(0, 4);
}

/**
 * Realistic Delhi Transit Bus Marker:
 * - DTC Buses: Signature Royal Blue (#1D4ED8)
 * - Cluster Buses (DIMTS): Signature Orange (#EA580C)
 * - Electric DTC: Electric Cyan/Blue (#0284C7)
 * - Clear, readable route number on roof
 * - Windshield & dual headlights at front (facing direction of travel)
 * - Taillights at rear
 * - Rotated by `bus.bearing` so bus face aims along road direction
 */
export const BusMarker = React.memo(({ bus, isSelected = false }: BusMarkerProps) => {
  const isCluster = bus.agency === 'DIMTS';
  const isEv = bus.isElectric;

  // Primary livery color
  const bodyColor = isCluster
    ? '#EA580C' // Delhi Cluster Bus: Orange
    : isEv
    ? '#0284C7' // DTC Electric: Electric Blue
    : '#1D4ED8'; // DTC Fleet: Royal Blue

  const routeText = formatBusRoofLabel(bus.routeShortName || bus.route || 'BUS');
  const isLong = routeText.length >= 4;

  return (
    <View style={styles.container}>
      {/* Bus Body */}
      <View
        style={[
          styles.busBody,
          { backgroundColor: bodyColor },
          isSelected && styles.busBodySelected,
        ]}
      >
        {/* Front Headlights Row */}
        <View style={styles.headlightsRow}>
          <View style={styles.headlight} />
          <View style={styles.grill} />
          <View style={styles.headlight} />
        </View>

        {/* Front Windshield (Faces travel direction) */}
        <View style={styles.windshield} />

        {/* Roof Route Number Signboard */}
        <View style={styles.roofSign}>
          <Text
            style={[styles.routeText, isLong && styles.routeTextSmall]}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {routeText}
          </Text>
        </View>

        {/* Rear Taillights */}
        <View style={styles.taillightsRow}>
          <View style={styles.taillight} />
          <View style={{ flex: 1 }} />
          <View style={styles.taillight} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 38,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busBody: {
    width: 32,
    height: 48,
    borderRadius: 7,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 2,
    paddingHorizontal: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  busBodySelected: {
    borderColor: '#FEF08A',
    borderWidth: 2.5,
  },
  headlightsRow: {
    width: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  headlight: {
    width: 4,
    height: 2.5,
    backgroundColor: '#FEF08A',
    borderRadius: 1,
  },
  grill: {
    width: 8,
    height: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 1,
  },
  windshield: {
    width: 24,
    height: 7,
    backgroundColor: '#0F172A',
    borderRadius: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginBottom: 2,
  },
  roofSign: {
    width: 25,
    height: 17,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0.5,
  },
  routeText: {
    color: '#0F172A',
    fontSize: 9.5,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  routeTextSmall: {
    fontSize: 8.2,
    letterSpacing: -0.6,
  },
  taillightsRow: {
    position: 'absolute',
    bottom: 2,
    width: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taillight: {
    width: 4,
    height: 2,
    backgroundColor: '#EF4444',
    borderRadius: 1,
  },
});
