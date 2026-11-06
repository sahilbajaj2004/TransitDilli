import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface BusItem {
  id: string;
  registration: string;
  route: string;
  destination: string;
  agency: 'DTC' | 'DIMTS' | 'EV';
  agencyColor: string;
  speed: number;
  nextStop: string;
  etaMinutes: number;
  isAc: boolean;
  isElectric: boolean;
}

const MOCK_LIVE_BUSES: BusItem[] = [
  {
    id: '1',
    registration: 'DL1PC4821',
    route: '534',
    destination: 'Mehrauli Terminal',
    agency: 'DIMTS',
    agencyColor: '#2563EB',
    speed: 28,
    nextStop: 'AIIMS Ring Road',
    etaMinutes: 2,
    isAc: true,
    isElectric: false,
  },
  {
    id: '2',
    registration: 'DL51EV1044',
    route: 'TMS+',
    destination: 'Ring Road Mudrika Express',
    agency: 'EV',
    agencyColor: '#0891B2',
    speed: 42,
    nextStop: 'South Extension II',
    etaMinutes: 1,
    isAc: true,
    isElectric: true,
  },
  {
    id: '3',
    registration: 'DL1PD9012',
    route: '534',
    destination: 'Mehrauli Terminal',
    agency: 'DTC',
    agencyColor: '#059669',
    speed: 34,
    nextStop: 'Ashram Chowk Flyover',
    etaMinutes: 5,
    isAc: false,
    isElectric: false,
  },
  {
    id: '4',
    registration: 'DL1PB3390',
    route: '729',
    destination: 'Kapashera Border',
    agency: 'DIMTS',
    agencyColor: '#2563EB',
    speed: 24,
    nextStop: 'Central Secretariat',
    etaMinutes: 6,
    isAc: true,
    isElectric: false,
  },
  {
    id: '5',
    registration: 'DL51EV2091',
    route: '534',
    destination: 'Anand Vihar ISBT',
    agency: 'EV',
    agencyColor: '#0891B2',
    speed: 31,
    nextStop: 'Sarai Kale Khan ISBT',
    etaMinutes: 4,
    isAc: true,
    isElectric: true,
  },
];

export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const [selectedAgency, setSelectedAgency] = useState<'ALL' | 'DTC' | 'DIMTS' | 'EV'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [buses, setBuses] = useState<BusItem[]>(MOCK_LIVE_BUSES);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  const filteredBuses = buses.filter((bus) => {
    if (selectedAgency !== 'ALL' && bus.agency !== selectedAgency) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        bus.route.toLowerCase().includes(q) ||
        bus.registration.toLowerCase().includes(q) ||
        bus.destination.toLowerCase().includes(q) ||
        bus.nextStop.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Brand Header with TransitDilli Logo */}
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
                Transit<Text style={styles.brandTitleAccent}>Dilli</Text>
              </Text>
              <View style={styles.livePill}>
                <View style={styles.livePulseDot} />
                <Text style={styles.livePillText}>OTD Live</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>Delhi NCT Real-Time Transit Radar</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Omni-Box */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search bus line (e.g. 534), stop, plate..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Fleet Quick Stats Cards */}
        <View style={styles.statsRow}>
          <Pressable
            onPress={() => setSelectedAgency('ALL')}
            style={[styles.statCard, selectedAgency === 'ALL' && styles.statCardActive]}
          >
            <Text style={styles.statLabel}>Total Fleet</Text>
            <Text style={styles.statValue}>3,430</Text>
          </Pressable>

          <Pressable
            onPress={() => setSelectedAgency('DTC')}
            style={[styles.statCard, selectedAgency === 'DTC' && styles.statCardActiveDtc]}
          >
            <Text style={[styles.statLabel, { color: '#059669' }]}>DTC</Text>
            <Text style={[styles.statValue, { color: '#065F46' }]}>2,734</Text>
          </Pressable>

          <Pressable
            onPress={() => setSelectedAgency('DIMTS')}
            style={[styles.statCard, selectedAgency === 'DIMTS' && styles.statCardActiveDimts]}
          >
            <Text style={[styles.statLabel, { color: '#2563EB' }]}>DIMTS</Text>
            <Text style={[styles.statValue, { color: '#1E40AF' }]}>1,354</Text>
          </Pressable>

          <Pressable
            onPress={() => setSelectedAgency('EV')}
            style={[styles.statCard, selectedAgency === 'EV' && styles.statCardActiveEv]}
          >
            <Text style={[styles.statLabel, { color: '#0891B2' }]}>Electric</Text>
            <Text style={[styles.statValue, { color: '#155E75' }]}>696</Text>
          </Pressable>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Live Buses</Text>
          <Text style={styles.sectionCount}>{filteredBuses.length} active</Text>
        </View>

        {/* Bus Cards List */}
        {filteredBuses.map((bus) => (
          <View key={bus.id} style={styles.busCard}>
            <View style={styles.busCardTop}>
              <View style={styles.routeBadgeRow}>
                <View style={[styles.routeBadge, { backgroundColor: bus.agencyColor }]}>
                  <Text style={styles.routeBadgeText}>{bus.route}</Text>
                </View>
                <View style={styles.busInfo}>
                  <View style={styles.regRow}>
                    <Text style={styles.regText}>{bus.registration}</Text>
                    {bus.isAc && (
                      <View style={styles.featureBadge}>
                        <Text style={styles.featureBadgeText}>AC</Text>
                      </View>
                    )}
                    {bus.isElectric && (
                      <View style={[styles.featureBadge, styles.featureBadgeEv]}>
                        <Text style={[styles.featureBadgeText, { color: '#0E7490' }]}>⚡ EV</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.destText} numberOfLines={1}>
                    Towards {bus.destination}
                  </Text>
                </View>
              </View>

              {/* Speed Badge */}
              <View style={styles.speedCol}>
                <Text style={styles.speedVal}>{bus.speed}</Text>
                <Text style={styles.speedUnit}>km/h</Text>
              </View>
            </View>

            {/* Next Stop & ETA Row */}
            <View style={styles.busCardBottom}>
              <Text style={styles.nextStopText} numberOfLines={1}>
                Next: <Text style={styles.nextStopBold}>{bus.nextStop}</Text>
              </Text>
              <View style={styles.etaBadge}>
                <Text style={styles.etaText}>{bus.etaMinutes} min</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Delhi Transit Hubs Header */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.four }]}>
          <Text style={styles.sectionTitle}>Major Delhi Interchange Hubs</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hubsScroll}>
          {['AIIMS Ring Road', 'Kashmere Gate ISBT', 'Rajiv Chowk / CP', 'Anand Vihar ISBT', 'Sarai Kale Khan'].map(
            (hub, i) => (
              <View key={i} style={styles.hubCard}>
                <Text style={styles.hubTitle}>{hub}</Text>
                <Text style={styles.hubSubtitle}>PIS Arrival Board</Text>
              </View>
            )
          )}
        </ScrollView>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  searchContainer: {
    marginBottom: Spacing.three,
  },
  searchInput: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    fontSize: 13,
    color: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  statCardActive: {
    borderColor: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  statCardActiveDtc: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  statCardActiveDimts: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  statCardActiveEv: {
    borderColor: '#0891B2',
    backgroundColor: '#ECFEFF',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#475569',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    fontVariant: ['tabular-nums'],
  },
  busCard: {
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
  busCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  busInfo: {
    flex: 1,
  },
  regRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  regText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  featureBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  featureBadgeEv: {
    backgroundColor: '#ECFEFF',
    borderColor: '#CFFAFE',
  },
  featureBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  destText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  speedCol: {
    alignItems: 'flex-end',
    marginLeft: Spacing.two,
  },
  speedVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  speedUnit: {
    fontSize: 9,
    color: '#64748B',
  },
  busCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
  },
  nextStopText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  nextStopBold: {
    fontWeight: '700',
    color: '#1E293B',
  },
  etaBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  etaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    fontVariant: ['tabular-nums'],
  },
  hubsScroll: {
    marginHorizontal: -Spacing.three,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
  hubCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    marginRight: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  hubTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  hubSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
});
