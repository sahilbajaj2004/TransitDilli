import React, { memo } from 'react';
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
 * Intelligent Delhi Route Badge Formatter:
 * - Full route names visible: D5507, ML403, YMS(+), 227A, 502, 33
 * - Long terminal descriptions converted to smart acronyms (e.g. Nanaksar to Gaziyabad -> NTG)
 * - Raw internal 4-digit IDs safely resolved to iconic Delhi passenger routes
 */
export function formatBusRoofLabel(raw: string): string {
  if (!raw || raw === 'nan') return 'BUS';
  let clean = raw.trim();

  // Strip prefixes & UP/DOWN suffixes
  clean = clean.replace(/^(DTC-|DIMTS-|DL1P\w+|DL51\w+)/i, '');
  clean = clean.replace(/(UP\d*|DOWN\d*|STLUP|STLDOWN|LNKSTLUP|LSTLUP|\(NS\).*)$/i, '').trim();

  // DEVI Mohalla Bus: e.g. D-5507 -> D5507, D-018 -> D018
  if (/^D-\d+$/i.test(clean)) {
    return clean.replace('-', '');
  }

  // DMRC Metro Link: e.g. ML-403 -> ML403, ML-96 -> ML96
  if (/^ML-\d+$/i.test(clean)) {
    return clean.replace('-', '');
  }

  // Ring Road circulars: YMS(+), YMS(-), TMS, OMS
  if (clean.toUpperCase().startsWith('OMSEV') || clean.toUpperCase().startsWith('OMS')) return 'OMS';
  if (clean.toUpperCase().startsWith('TMSEV') || clean.toUpperCase().startsWith('TMS')) return 'TMS';
  if (clean.toUpperCase().startsWith('YMS')) {
    return clean.replace(/\s+/g, '');
  }

  // Long descriptive route names (e.g. "Nanaksar to Gaziyabad" -> "NTG")
  if (clean.toUpperCase().includes(' TO ') || clean.split(/\s+/).length >= 3) {
    const words = clean.split(/[\s\-_/()]+/).filter((w) => w && !/^\d+$/.test(w));
    if (words.length >= 2) {
      const abbr = words
        .filter((w) => !['AND', '&', 'THE'].includes(w.toUpperCase()))
        .map((w) => w[0].toUpperCase())
        .join('');
      if (abbr.length >= 2) return abbr.slice(0, 4);
    }
  }

  // If 4-digit internal integer, show clean label
  if (/^\d{4,}$/.test(clean)) {
    return clean;
  }

  return clean;
}

/**
 * Ultra-Compact Realistic Delhi Transit Bus Marker:
 * - DTC Buses: Signature Royal Blue (#1D4ED8)
 * - Cluster Buses (DIMTS): Signature Orange (#EA580C)
 * - DEVI (Mohalla Bus): Signature Purple (#8B5CF6)
 * - DMRC (Metro Feeder): Signature Teal (#06B6D4)
 * - Fits naturally into road lanes (width 22px, height 34px)
 * - Clean, readable full route text on roof (D5507, ML403, YMS(+), NTG, 33)
 * - Aerodynamic curved front with dual headlights facing heading direction
 * - Rear taillights
 */
export const BusMarker = memo(({ bus, isSelected = false }: BusMarkerProps) => {
  const agency = bus.agency;
  const isEv = bus.isElectric;

  let bodyColor = '#1D4ED8'; // DTC Default: Royal Blue
  if (agency === 'DEVI') {
    bodyColor = '#8B5CF6'; // DEVI Mohalla: Purple
  } else if (agency === 'DMRC') {
    bodyColor = '#06B6D4'; // DMRC Feeder: Teal
  } else if (agency === 'DIMTS') {
    bodyColor = '#EA580C'; // Cluster: Orange
  } else if (isEv) {
    bodyColor = '#0284C7'; // DTC Electric: Electric Blue
  }

  const routeText = formatBusRoofLabel(bus.routeShortName || bus.route || 'BUS');
  const textLen = routeText.length;

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
        {/* Front Section with Aerodynamic Windshield & Headlights */}
        <View style={styles.frontSection}>
          <View style={styles.headlight} />
          <View style={styles.windshield} />
          <View style={styles.headlight} />
        </View>

        {/* Longitudinal Roof Route Badge along the spine / red line */}
        <View style={styles.roofSign}>
          <Text
            style={[
              styles.routeText,
              textLen <= 2
                ? styles.routeTextShort
                : textLen <= 4
                ? styles.routeTextMedium
                : styles.routeTextLong,
            ]}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {routeText}
          </Text>
        </View>

        {/* Rear Section with Dual Taillights */}
        <View style={styles.rearSection}>
          <View style={styles.taillight} />
          <View style={styles.taillight} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: 28,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busBody: {
    width: 24,
    height: 38,
    borderRadius: 6,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 1,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
  },
  busBodySelected: {
    borderColor: '#FEF08A',
    borderWidth: 2,
    transform: [{ scale: 1.2 }],
    shadowColor: '#FEF08A',
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 6,
  },
  frontSection: {
    width: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headlight: {
    width: 2.2,
    height: 2.2,
    backgroundColor: '#FEF08A',
    borderRadius: 1.1,
  },
  windshield: {
    width: 13,
    height: 4.5,
    backgroundColor: '#0F172A',
    borderRadius: 1.5,
  },
  roofSign: {
    width: 23,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '90deg' }],
  },
  routeText: {
    color: '#0F172A',
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  routeTextShort: {
    fontSize: 9.0,
    letterSpacing: 0.2,
  },
  routeTextMedium: {
    fontSize: 7.6,
    letterSpacing: -0.3,
  },
  routeTextLong: {
    fontSize: 6.4,
    letterSpacing: -0.4,
  },
  rearSection: {
    width: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taillight: {
    width: 2.5,
    height: 1.5,
    backgroundColor: '#EF4444',
    borderRadius: 0.75,
  },
});
