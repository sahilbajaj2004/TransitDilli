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

interface StopItem {
  id: string;
  name: string;
  code: string;
  hub: string;
  routes: string[];
  arrivals: Array<{
    route: string;
    destination: string;
    etaMinutes: number;
    agency: string;
    agencyColor: string;
    speed: number;
    isAc: boolean;
  }>;
}

const DELHI_HUBS: StopItem[] = [
  {
    id: 'ST_AIIMS',
    name: 'AIIMS Hospital Ring Road',
    code: 'ND-534-04',
    hub: 'South Delhi Hub',
    routes: ['534', 'TMS+', '433', '543'],
    arrivals: [
      { route: 'TMS+', destination: 'Mudrika Express Clockwise', etaMinutes: 1, agency: 'EV', agencyColor: '#0891B2', speed: 42, isAc: true },
      { route: '534', destination: 'Mehrauli Terminal', etaMinutes: 3, agency: 'DIMTS', agencyColor: '#2563EB', speed: 28, isAc: true },
      { route: '534', destination: 'Mehrauli Terminal', etaMinutes: 7, agency: 'DTC', agencyColor: '#059669', speed: 34, isAc: false },
      { route: '433', destination: 'New Delhi Railway Station', etaMinutes: 11, agency: 'DTC', agencyColor: '#059669', speed: 22, isAc: true },
    ],
  },
  {
    id: 'ST_KASHMERE_GATE',
    name: 'Kashmere Gate ISBT',
    code: 'ND-HUB-01',
    hub: 'North Delhi Inter-State Terminal',
    routes: ['TMS-', '100', '205', 'EXP-2'],
    arrivals: [
      { route: 'TMS-', destination: 'Mudrika Express Anti-Clockwise', etaMinutes: 2, agency: 'EV', agencyColor: '#0891B2', speed: 38, isAc: true },
      { route: '100', destination: 'Kendriya Terminal', etaMinutes: 5, agency: 'DTC', agencyColor: '#059669', speed: 29, isAc: true },
      { route: '205', destination: 'Anand Vihar ISBT', etaMinutes: 9, agency: 'DIMTS', agencyColor: '#2563EB', speed: 31, isAc: false },
    ],
  },
  {
    id: 'ST_RAJIV_CHOWK',
    name: 'Connaught Place / Super Bazar',
    code: 'ND-HUB-02',
    hub: 'Central Delhi Core',
    routes: ['729', '433', 'AIRPORT-EX'],
    arrivals: [
      { route: '729', destination: 'Kapashera Border', etaMinutes: 4, agency: 'DIMTS', agencyColor: '#2563EB', speed: 24, isAc: true },
      { route: '433', destination: 'Badarpur Border', etaMinutes: 8, agency: 'DTC', agencyColor: '#059669', speed: 27, isAc: false },
    ],
  },
];

export default function StopsScreen() {
  const [selectedHub, setSelectedHub] = useState<StopItem>(DELHI_HUBS[0]);

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
              Stop<Text style={styles.brandTitleAccent}>Boards</Text>
            </Text>
            <Text style={styles.brandSubtitle}>Passenger Information System (PIS) • Delhi NCT</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hub Selector Chips */}
        <Text style={styles.sectionHeader}>Select Transit Hub</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubsScroll}>
          {DELHI_HUBS.map((hub) => {
            const isSelected = selectedHub.id === hub.id;
            return (
              <Pressable
                key={hub.id}
                onPress={() => setSelectedHub(hub)}
                style={[styles.hubChip, isSelected && styles.hubChipActive]}
              >
                <Ionicons
                  name={isSelected ? 'location' : 'location-outline'}
                  size={14}
                  color={isSelected ? '#FFFFFF' : '#475569'}
                />
                <Text style={[styles.hubChipText, isSelected && styles.hubChipTextActive]}>
                  {hub.name.split(' ')[0]} {hub.name.split(' ')[1] || ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Selected Hub Card */}
        <View style={styles.hubHeaderCard}>
          <View style={styles.hubHeaderRow}>
            <View style={styles.hubIconBox}>
              <Ionicons name="business" size={22} color="#059669" />
            </View>
            <View style={styles.hubInfo}>
              <Text style={styles.hubNameText}>{selectedHub.name}</Text>
              <Text style={styles.hubSubText}>{selectedHub.hub} • {selectedHub.code}</Text>
            </View>
          </View>

          <View style={styles.routesPillsRow}>
            <Text style={styles.servingLabel}>Lines Serving:</Text>
            {selectedHub.routes.map((r, i) => (
              <View key={i} style={styles.routeTag}>
                <Text style={styles.routeTagText}>{r}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Arrival Countdowns Board */}
        <Text style={[styles.sectionHeader, { marginTop: Spacing.four }]}>
          Live Arrival Countdowns
        </Text>

        <View style={styles.arrivalsList}>
          {selectedHub.arrivals.map((arr, index) => {
            const isDue = arr.etaMinutes <= 2;
            return (
              <View
                key={index}
                style={[
                  styles.arrivalCard,
                  isDue && styles.arrivalCardDue,
                ]}
              >
                <View style={styles.arrivalLeft}>
                  <View style={[styles.routeBadge, { backgroundColor: arr.agencyColor }]}>
                    <Text style={styles.routeBadgeText}>{arr.route}</Text>
                  </View>
                  <View style={styles.arrivalInfo}>
                    <View style={styles.destRow}>
                      <Text style={styles.destText} numberOfLines={1}>
                        Towards {arr.destination}
                      </Text>
                    </View>
                    <Text style={styles.metaText}>
                      {arr.agency} • {arr.speed} km/h {arr.isAc ? '• AC' : ''}
                    </Text>
                  </View>
                </View>

                {/* Countdown ETA */}
                <View style={[styles.etaCol, isDue && styles.etaColDue]}>
                  <Text style={[styles.etaNum, isDue && styles.etaNumDue]}>
                    {arr.etaMinutes === 0 ? 'DUE' : `${arr.etaMinutes}m`}
                  </Text>
                  <Text style={styles.etaLabel}>{arr.etaMinutes === 0 ? 'Now' : 'Arrival'}</Text>
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
    paddingBottom: BottomTabInset + Spacing.five + 40,
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
  hubsScroll: {
    marginHorizontal: -Spacing.three,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  hubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  hubChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  hubChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  hubChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hubHeaderCard: {
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
  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  hubIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubInfo: {
    flex: 1,
  },
  hubNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  hubSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  routesPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  servingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 4,
  },
  routeTag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  routeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  arrivalsList: {
    gap: Spacing.two,
  },
  arrivalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  arrivalCardDue: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  arrivalLeft: {
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
  arrivalInfo: {
    flex: 1,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  destText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  etaCol: {
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  etaColDue: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  etaNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  etaNumDue: {
    color: '#047857',
  },
  etaLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
