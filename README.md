<div align="center">

<img src="./logo.png" alt="TransitDilli App Icon" width="120" height="120" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" />

# 📱 TransitDilli (Mobile App)
### Real-Time Delhi NCR Transit Tracker for Android & iOS

[![Expo](https://img.shields.io/badge/Expo-SDK_58.0.23-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.88.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![React](https://img.shields.io/badge/React-19.3.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Reanimated](https://img.shields.io/badge/Animations-Reanimated_4.7-FF4154?style=for-the-badge&logo=framer&logoColor=white)](https://docs.swmansion.com/react-native-reanimated/)
[![TanStack Query](https://img.shields.io/badge/Data_Fetching-TanStack_Query_v5-FF4154?style=for-the-badge&logo=react-query&logoColor=white)](https://tanstack.com/query/latest)

<p align="center">
  The official <b>TransitDilli</b> mobile client.<br/>
  Features hardware-accelerated map navigation, live animated bus markers, stop arrival countdowns, and dual-agency color differentiation across Delhi NCR.
</p>

---

[📖 Complete Architecture Blueprint (TransitDilli.md)](./TransitDilli.md) • [🎨 Agency Visuals](#-agency-color-system) • [📱 App Screens](#-screens--features) • [🚀 Quick Start](#-getting-started)

</div>

---

## 🎨 Dual-Agency Color System

TransitDilli provides immediate, high-contrast visual differentiation between Delhi's public bus carriers:

| Operator | Accent Hex | Visual Pin | Badge Meaning |
| :--- | :--- | :--- | :--- |
| **DTC (Delhi Transport Corp)** | `#10B981` | 🟢 Emerald Green Pin | Government State Transport Fleet |
| **DIMTS (Cluster Scheme)** | `#2563EB` | 🔵 Royal Blue Pin | Concessionaire Cluster Fleet |
| **Electric Fleet (EV)** | `#06B6D4` | ⚡ Cyan Outer Glow | Zero-Emission Low-Floor Bus |
| **Air Conditioned (AC)** | `#38BDF8` | ❄️ Ice Blue Badge | Climate-Controlled AC Fleet |

---

## 📱 Screens & Features

```
┌────────────────────────────────────────────────────────┐
│                   TRANSITDILLI SCREENS                 │
├────────────────────────────────────────────────────────┤
│ 1. 🗺️ LIVE INTERACTIVE MAP (src/app/(tabs)/index.tsx)   │
│    • Real-time map with nearby buses within 2 km       │
│    • Smooth Reanimated bearing heading arrow           │
│    • Agency filter chips (All | DTC | DIMTS | EV)      │
│    • Quick inspection drawer on bus tap                │
│                                                        │
│ 2. 🚏 NEARBY BUS STOPS (src/app/(tabs)/stops.tsx)       │
│    • GPS walking-distance sorted stops (100m – 800m)   │
│    • Real-time countdown timer ("Arriving in 2 min")   │
│    • DTC Green & DIMTS Blue arrival badges             │
│                                                        │
│ 3. 🔍 ROUTE EXPLORER (src/app/(tabs)/routes.tsx)        │
│    • Instant search for routes (e.g. 502, 740C, OMS)   │
│    • UP / DOWN direction route sequence                │
│    • Active fleet count currently on the line          │
│                                                        │
│ 4. 🛰️ LIVE JOURNEY TRACKER (src/app/bus/[id].tsx)       │
│    • Uber-like real-time vehicle movement on map       │
│    • Vertical stop progression timeline                │
│    • Speed, agency tag, and remaining stop ETAs        │
│                                                        │
│ 5. ⚙️ SETTINGS & PREFERENCES (src/app/(tabs)/settings) │
│    • Dark/Light theme toggle                           │
│    • Custom radius slider (500m to 5 km)               │
│    • Default agency preference                         │
└────────────────────────────────────────────────────────┘
```

---

## 📂 Source Code Structure

Following strict **Expo Router** conventions, route pages live exclusively in `src/app/`:

```
TransitDilli/
├── logo.png                     # Master high-resolution brand asset
├── app.json                     # Expo SDK 58 application manifest
├── package.json                 # Project dependencies & scripts
├── TransitDilli.md              # 0-to-100 Architecture Blueprint
└── src/
    ├── app/                     # EXPO ROUTER ROUTE SCREENS
    │   ├── _layout.tsx          # Root Stack with TanStack Query Provider
    │   ├── (tabs)/              # Bottom Tab Navigator
    │   │   ├── _layout.tsx      # Native Bottom Tabs
    │   │   ├── index.tsx        # Screen 1: Live Interactive Map
    │   │   ├── stops.tsx        # Screen 2: Nearby Bus Stops & ETAs
    │   │   ├── routes.tsx       # Screen 3: Route Explorer & Lines
    │   │   └── settings.tsx     # Screen 4: Settings & Preferences
    │   └── bus/
    │       └── [id].tsx         # Screen 5: Single Vehicle Live Journey Tracker
    ├── components/              # REUSABLE UI COMPONENTS
    │   ├── HeaderBrand.tsx      # Header containing logo.png & live status
    │   ├── BusMarker.tsx        # Animated Map Pin (Green/Blue + Bearing)
    │   ├── BusCard.tsx          # Card with AC/EV badges & route tag
    │   ├── StopEtaCard.tsx      # Arrival countdown card (e.g., "4 min")
    │   └── AgencyFilterPills.tsx# Toggle [All | DTC | DIMTS | EV]
    ├── hooks/                   # REACT HOOKS & CACHING
    │   ├── useNearbyBuses.ts    # React Query 8s auto-refresh hook
    │   ├── useBusStream.ts      # Live bus tracking hook
    │   └── useUserLocation.ts   # High-precision Expo Location wrapper
    └── constants/
        ├── theme.ts             # DTC Green & DIMTS Blue Design Tokens
        └── config.ts            # Backend API base URL
```

---

## 🚀 Getting Started

### 1. Prerequisites
* **Node.js:** v20.x or later
* **Expo Go App:** Installed on your physical Android or iOS device, or an active Android Studio Emulator.

### 2. Installation
```bash
# Enter mobile app directory
cd TransitDilli

# Install project dependencies
npm install
```

### 3. Configure Backend Connection
Open `src/constants/config.ts` and set your local machine's IP:
```typescript
export const BACKEND_URL = __DEV__ 
  ? 'http://192.168.1.XX:3000'   // Your machine LAN IP
  : 'https://api.transitdilli.in';
```

### 4. Start the Application
```bash
# Start Expo development server
npx expo start
```
* **Physical Device:** Open **Expo Go** and scan the generated terminal QR code.
* **Android Emulator:** Press `a` in the terminal to launch on the emulator.

---

## 🛠️ Code Quality & Verification

```bash
# Typecheck TypeScript codebase
npx tsc --noEmit

# Run Expo Linter
npx expo lint
```

---

<div align="center">
  <b>TransitDilli Mobile</b> • Built with Expo SDK 58 & React Native
</div>
# TransitDilli
