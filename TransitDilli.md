# TransitDilli: Production Mobile Application Architecture & System Design (0 to 100)

Complete architectural specification, screen designs, component hierarchy, design tokens, agency theming, and implementation guide for the **TransitDilli Mobile App** built with **React Native and Expo SDK 58**.

---

## 1. Executive Summary & Mobile Architecture

### 1.1 Technical Stack
* **Framework:** React Native `0.88.1` / Expo SDK `58.0.23`
* **Language & Runtime:** TypeScript `6.0` / React `19.3.0` (with React Compiler enabled)
* **Routing:** Expo Router `v58` (Typed file-based routing in `src/app/`)
* **Animations:** `react-native-reanimated` `4.7.1` & `react-native-worklets`
* **Gestures:** `react-native-gesture-handler` `~3.3.0`
* **Data Fetching & Cache:** TanStack Query (`@tanstack/react-query` v5) with stale-while-revalidate
* **Map Engine:** `react-native-maps` / `@maplibre/maplibre-react-native`
* **Local Persistence:** `react-native-mmkv` / `@react-native-async-storage/async-storage`

---

## 2. Brand Identity, Logo & Theme Tokens

### 2.1 Logo Asset Integration (`logo.png`)
The primary branding asset is located at `/home/sahilbajaj/WtfCoding/TransitDilli/logo.png`.
It is configured across all app touchpoints:
* **App Icon:** `./assets/images/icon.png` (Generated from `logo.png` at 1024x1024)
* **Adaptive Android Icon:** `./assets/images/android-icon-foreground.png`
* **Splash Screen:** Displayed with smooth fade-in on background `#0F172A`
* **In-App Top Navigation Bar:** Integrated as a crisp 32x32 SVG/PNG brand header

### 2.2 Dual-Agency Design System
The visual language reflects Delhi's public transport operating model with immediate, unmistakable agency visual distinction:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TRANSITDILLI COLOR TOKENS                       │
├───────────────────────────────┬────────────────────────────────────────┤
│ DTC FLEET (Government)        │ DIMTS FLEET (Cluster)                  │
│ • Primary: #10B981 (Emerald)  │ • Primary: #2563EB (Royal Blue)        │
│ • Surface: #ECFDF5 (Mint)     │ • Surface: #EFF6FF (Ice Blue)          │
│ • Border:  #059669            │ • Border:  #1D4ED8                     │
│ • Badge:   "🚌 DTC"           │ • Badge:   "🚍 DIMTS"                  │
├───────────────────────────────┴────────────────────────────────────────┤
│ SPECIAL FLEET ACCENTS                                                  │
│ • Electric Vehicles (EV):     #06B6D4 (Electric Cyan)   Tag: "⚡ EV"    │
│ • Air Conditioned (AC):       #38BDF8 (Sky Blue)        Tag: "❄️ AC"    │
│ • Non-AC Standard:            #64748B (Slate Gray)      Tag: "Standard"│
├────────────────────────────────────────────────────────────────────────┤
│ BASE SURFACE TOKENS (DARK MODE FIRST)                                  │
│ • Background Canvas:          #0F172A (Deep Slate)                     │
│ • Card Surface:               #1E293B (Card Slate)                     │
│ • Text Primary:               #F8FAFC (Pure White)                     │
│ • Text Muted:                 #94A3B8 (Cool Gray)                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Layout & Navigation Hierarchy

The application follows the strict **Expo Router** convention where route screens reside exclusively in `src/app/`, while components, hooks, services, and constants live outside.

```
TransitDilli/
├── logo.png                          # Master high-resolution brand asset
├── app.json                          # Expo SDK 58 application config
├── package.json                      # Project dependencies & scripts
├── assets/                           # Bundled native icons and splash
│   └── images/
│       ├── icon.png
│       └── splash-icon.png
└── src/
    ├── app/                          # EXPO ROUTER ROUTE SCREENS
    │   ├── _layout.tsx               # Root Stack, QueryProvider, ThemeProvider
    │   ├── (tabs)/                   # Bottom Tab Navigator
    │   │   ├── _layout.tsx           # Tab bar with animated indicators
    │   │   ├── index.tsx             # SCREEN 1: Live Interactive Map
    │   │   ├── stops.tsx             # SCREEN 2: Nearby Bus Stops & ETAs
    │   │   ├── routes.tsx            # SCREEN 3: Route Explorer & Lines
    │   │   └── settings.tsx          # SCREEN 4: Agency Filters & Settings
    │   ├── bus/
    │   │   └── [id].tsx              # SCREEN 5: Live Bus Journey Tracker
    │   ├── stop/
    │   │   └── [stopId].tsx          # SCREEN 6: Stop Arrival Board
    │   └── route/
    │       └── [routeId].tsx         # SCREEN 7: Route Polyline & Sequence
    ├── components/                   # REUSABLE UI COMPONENTS
    │   ├── HeaderBrand.tsx           # Logo + Title App Header
    │   ├── BusMarker.tsx             # Animated Map Pin (Green/Blue)
    │   ├── BusCallout.tsx            # Floating marker popup
    │   ├── BusCard.tsx               # Bus card with EV/AC badges
    │   ├── StopEtaCard.tsx           # Arrival countdown card (e.g., "4 min")
    │   ├── AgencyFilterPills.tsx     # Toggle [All | DTC | DIMTS | EV]
    │   ├── RouteSearchBar.tsx        # Search input with debounce
    │   └── LiveBadge.tsx             # Pulsing green/blue real-time indicator
    ├── hooks/                        # CUSTOM REACT HOOKS
    │   ├── useUserLocation.ts        # Expo Location wrapper
    │   ├── useNearbyBuses.ts         # React Query 8s auto-refresh hook
    │   ├── useBusTracking.ts         # Single bus SSE / polling hook
    │   └── useStopArrivals.ts        # Stop ETA 20s polling hook
    ├── services/                     # NETWORKING & STORAGE
    │   ├── api.client.ts             # Axios / Fetch client configuration
    │   ├── transit.service.ts        # REST endpoints integration
    │   └── storage.service.ts        # MMKV local favorites storage
    └── constants/
        ├── theme.ts                  # Color palettes & typography
        └── config.ts                 # Backend URLs & defaults
```

---

## 4. Screen Specifications & User Experience (0 to 100)

---

### Screen 1: Live Interactive Map (`src/app/(tabs)/index.tsx`)
The centerpiece of the application. An interactive map centered on the user's location displaying live buses within a 2 km radius.

```
┌────────────────────────────────────────────────────────┐
│ [Logo] TransitDilli                    [🔍 Search] [⚙️] │
├────────────────────────────────────────────────────────┤
│  [  All (42)  ]   [ 🟢 DTC (26) ]   [ 🔵 DIMTS (16) ]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│                    ▲ [740C] 🟢                         │
│                    DL1PD8532                           │
│                                                        │
│         🔵 ▲ [502]                                     │
│         DL1PB4586                                      │
│                           📍 You                       │
│                                                        │
│                                  ▲ [620] 🟢 ⚡         │
│                                                        │
├────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐ │
│ │ 🟢 740CUP • DTC Electric ⚡                        │ │
│ │ Towards Anand Vihar ISBT                           │ │
│ │ 📍 180m away • 24 km/h • Next Stop: Mandi House    │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

#### Key Functional Behaviors:
1. **Camera Tracking:** Centers on user's current GPS location with high precision (`expo-location`).
2. **Dynamic Agency Pins:**
   - **Green Pin (`#10B981`):** DTC Government buses.
   - **Blue Pin (`#2563EB`):** DIMTS Cluster buses.
   - **Cyan Ring (`#06B6D4`):** Electric buses.
3. **Smooth Rotation:** Pin arrow rotates to match the `bearing` (heading angle) with Reanimated transitions.
4. **Bottom Sheet Preview:** Tapping any bus opens a preview drawer showing license plate, route, destination, speed, and a `"Track Live"` button.
5. **Auto-Refresh Loop:** Re-queries `GET /api/v1/buses/nearby` every 8 seconds silently. Pauses when the screen is blurred to save battery.

---

### Screen 2: Nearby Bus Stops & Live ETAs (`src/app/(tabs)/stops.tsx`)
Locates the nearest bus stops around the passenger and lists live arrival countdowns.

```
┌────────────────────────────────────────────────────────┐
│ Nearest Bus Stops                       [📍 200m away] │
├────────────────────────────────────────────────────────┤
│ 🚏 Shivaji Stadium Terminal                            │
│    Towards Connaught Place / Regal                     │
├────────────────────────────────────────────────────────┤
│  LIVE ARRIVALS                                         │
│                                                        │
│  🟢 740CUP    Anand Vihar ISBT         [ 2 min ]  LIVE │
│     DL1PD8532 • AC Electric ⚡                         │
│                                                        │
│  🔵 502DOWN   Kashmere Gate            [ 5 min ]  LIVE │
│     DL1PB4586 • Non-AC CNG                             │
│                                                        │
│  🟢 620UP     Hauz Khas Terminal       [ 9 min ]  LIVE │
│     DL51EV9706 • AC Electric ⚡                        │
├────────────────────────────────────────────────────────┤
│ 🚏 Scindia House (KG Marg)                     [350m]  │
│    3 upcoming buses scheduled                          │
└────────────────────────────────────────────────────────┘
```

#### Key Functional Behaviors:
1. **Sorted by Proximity:** Displays stops within walking distance (100m – 800m).
2. **Pulsing Live Countdown:** Arrival cards show remaining minutes with dynamic status colors:
   - `< 3 min:` Bold Green (Arriving shortly)
   - `3 – 10 min:` Neutral / Accent Blue
   - `> 10 min:` Slate gray
3. **Agency Badge Tag:** Every arrival row clearly states whether it is a DTC or DIMTS service.

---

### Screen 3: Route Explorer & Schedule (`src/app/(tabs)/routes.tsx`)
Instant search for any Delhi route number (e.g. `502`, `740C`, `OMS (+)`, `RL-77`).

```
┌────────────────────────────────────────────────────────┐
│ [🔍 Search Route Number e.g. 502, 740C...]            │
├────────────────────────────────────────────────────────┤
│ Popular Routes in Delhi:                               │
│                                                        │
│ 🟢 740C   Anand Vihar ISBT ⇄ Dichau Kalan Depot        │
│           Operated by DTC • 42 buses active            │
│                                                        │
│ 🔵 502    Mehrauli Terminal ⇄ Kashmere Gate City (T)   │
│           Operated by DIMTS • 28 buses active          │
│                                                        │
│ 🟢 OMS(+) Outer Mudrika Express                        │
│           Operated by DTC • 64 buses active            │
└────────────────────────────────────────────────────────┘
```

#### Key Functional Behaviors:
1. **Instant Search Filter:** Real-time fuzzy filtering of route names and endpoints.
2. **Direction Selector:** Switch between **UP (Origin → Destination)** and **DOWN (Destination → Origin)**.
3. **Active Fleet Indicator:** Shows how many buses are currently moving on that route right now.

---

### Screen 4: Live Bus Journey Tracker (`src/app/bus/[id].tsx`)
Opened when a user taps `"Track Live"` on any bus. Provides an Uber-like live journey tracking experience.

```
┌────────────────────────────────────────────────────────┐
│ [← Back]  Bus DL1PD8532 • Route 740CUP   [🔔 Remind Me]│
├────────────────────────────────────────────────────────┤
│ [MAP VIEW: Bus moving along polyline with live bearing]│
├────────────────────────────────────────────────────────┤
│ Speed: 24 km/h  •  Agency: DTC 🟢  •  Fleet: EV ⚡ ❄️  │
├────────────────────────────────────────────────────────┤
│ TRIP PROGRESSION                                       │
│                                                        │
│  ✓  Mandi House                               Passed   │
│                                                        │
│  ●  Supreme Court Metro Station          [ NOW • 0m ]  │
│     Current Bus Location                               │
│                                                        │
│  ○  ITO Ring Road Crossing               [ in 2 min ]  │
│                                                        │
│  ○  Shakarpur Crossing                   [ in 6 min ]  │
│                                                        │
│  ○  Anand Vihar ISBT (Terminal)          [ in 18 min ] │
└────────────────────────────────────────────────────────┘
```

#### Key Functional Behaviors:
1. **Stop Timeline:** Visual vertical rail showing passed stops (dimmed), current stop (pulsing), and upcoming stops with progressive ETAs.
2. **Map Camera Following:** The map camera automatically pans and smoothly interpolates coordinates between server updates using Reanimated.
3. **Arrival Alarm:** Optional push notification when the bus is 1 stop away.

---

## 5. UI Component Implementations

### 5.1 Dynamic Agency Bus Marker (`src/components/BusMarker.tsx`)
```tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface BusMarkerProps {
  id: string;
  agency: 'DTC' | 'DIMTS';
  route: string;
  bearing: number;
  isAc: boolean;
  isElectric: boolean;
  isSelected?: boolean;
}

export const BusMarker = memo(({
  agency,
  route,
  bearing,
  isAc,
  isElectric,
  isSelected = false
}: BusMarkerProps) => {
  // Agency Color Assignment
  const primaryColor = agency === 'DTC' ? '#10B981' : '#2563EB';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(`${bearing}deg`, { duration: 600 }) }]
  }));

  return (
    <View style={styles.wrapper}>
      {/* Directional Heading Cone */}
      <Animated.View style={[styles.arrowContainer, animatedStyle]}>
        <View style={[styles.headingArrow, { borderBottomColor: primaryColor }]} />
      </Animated.View>

      {/* Main Bus Pin Circle */}
      <View style={[
        styles.circlePin,
        { backgroundColor: primaryColor },
        isSelected && styles.selectedCircle,
        isElectric && styles.electricGlow
      ]}>
        <Text style={styles.busIcon}>🚌</Text>
      </View>

      {/* Route Badge Tag */}
      <View style={[styles.badge, { borderColor: primaryColor }]}>
        <Text style={styles.routeText}>{route}</Text>
        {isElectric && <Text style={styles.featureBadge}>⚡</Text>}
        {isAc && <Text style={styles.featureBadge}>❄️</Text>}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowContainer: {
    width: 20,
    height: 12,
    alignItems: 'center',
    marginBottom: -2,
  },
  headingArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  circlePin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  selectedCircle: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  electricGlow: {
    shadowColor: '#06B6D4',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  busIcon: {
    fontSize: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    marginTop: 3,
  },
  routeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  featureBadge: {
    fontSize: 9,
    marginLeft: 2,
  },
});
```

---

### 5.2 Brand Navigation Header with `logo.png` (`src/components/HeaderBrand.tsx`)
```tsx
import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const HeaderBrand = ({ onFilterPress }: { onFilterPress?: () => void }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 6 }]}>
      <View style={styles.brandRow}>
        <Image
          source={require('../../logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <View style={styles.titleColumn}>
          <Text style={styles.brandTitle}>TransitDilli</Text>
          <Text style={styles.brandSubtitle}>Delhi Live Transit</Text>
        </View>
      </View>

      <View style={styles.statusPill}>
        <View style={styles.pulseDot} />
        <Text style={styles.liveText}>OTD LIVE</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 34,
    height: 34,
    borderRadius: 8,
    marginRight: 10,
  },
  titleColumn: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
});
```

---

## 6. Networking & React Query Hooks

### 6.1 Nearby Buses Hook (`src/hooks/useNearbyBuses.ts`)
```typescript
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { BACKEND_URL } from '../constants/config';

export interface BusItem {
  id: string;
  tripId: string;
  routeId: string;
  lat: number;
  lon: number;
  bearing: number;
  speedKmph: number;
  agency: 'DTC' | 'DIMTS';
  themeColor: string;
  isAc: boolean;
  isElectric: boolean;
  timestamp: number;
}

export function useNearbyBuses(lat: number, lon: number, agencyFilter?: string) {
  return useQuery({
    queryKey: ['nearbyBuses', lat, lon, agencyFilter],
    queryFn: async (): Promise<BusItem[]> => {
      const params: Record<string, any> = { lat, lon, radius: 2.0 };
      if (agencyFilter && agencyFilter !== 'ALL') {
        params.agency = agencyFilter;
      }
      const res = await axios.get(`${BACKEND_URL}/api/v1/buses/nearby`, { params });
      return res.data.data || [];
    },
    refetchInterval: 8000,           // Auto poll every 8 seconds
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}
```

---

## 7. Configuration & Permissions (`app.json`)

```json
{
  "expo": {
    "name": "TransitDilli",
    "slug": "TransitDilli",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./logo.png",
    "scheme": "transitdilli",
    "userInterfaceStyle": "dark",
    "android": {
      "package": "com.transitdilli.app",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      "adaptiveIcon": {
        "foregroundImage": "./logo.png",
        "backgroundColor": "#0F172A"
      }
    },
    "plugins": [
      "expo-router",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "TransitDilli requires your location to display approaching DTC & DIMTS buses near you."
        }
      ]
    ]
  }
}
```

---

## 8. Verification & Execution Steps

```bash
# 1. Install necessary client packages
npx expo install @tanstack/react-query axios expo-location react-native-maps react-native-reanimated react-native-gesture-handler

# 2. Start Expo development server
npx expo start

# 3. Typecheck & Lint
npx tsc --noEmit
npx expo lint
```
