# TransitDilli Mobile — Mobile App Architecture & Offline Engine
## React Native (Expo) Architecture Specification

---

## 1. Executive Summary

`TransitDilli` is an Expo React Native application built for Android and iOS that delivers high-performance transit tracking, offline-first search, and sub-10ms route navigation for the Delhi NCR transit ecosystem.

---

## 2. Map Service & Tile Architecture: Mirroring Chartr

### Map Service Reverse Engineering
Our decompilation of the Chartr APK (`in.chartr.transit`) revealed:
* **Map Provider:** Google Maps Android SDK (`com.google.android.gms.maps`) configured with `com.google.android.geo.API_KEY`.
* **Custom Map Styling:** Chartr uses `res/raw/map_style.json` to silence commercial labels, land parcels, and building outlines, allowing transit lines and bus markers to be the primary visual focal point.

### TransitDilli Mobile Map Architecture
In `TransitDilli`, we use `react-native-maps` with platform-native rendering:

* **Android:** Google Maps with custom transit styling (`customMapStyle={transitMapStyle}`) to achieve the exact clean, high-contrast aesthetics as Chartr.
* **iOS:** Apple Maps with subtle point-of-interest filtering.

```typescript
// Custom Transit Map Style (Muted clutter, high-contrast roads)
export const TRANSIT_MAP_STYLE = [
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.station.bus',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#F1F5F9' }],
  },
];
```

---

## 3. Offline-First Architecture via Embedded SQLite (`static_delhi.db`)

Following the gold-standard architecture discovered in Chartr (`static_dl.7z`), `TransitDilli` eliminates 80% of server requests by evaluating stop searches, route geometries, and timetable structures **100% locally on the device**.

```
[ App Launch ]
      │
      ▼
Check Local Storage (expo-file-system)
      │
      ├── Exists? ───────────────► Open Local SQLite Database (expo-sqlite)
      │                                       │
      └── Does Not Exist / Outdated?          ▼
                 │               Query Offline in 0ms:
                 ▼               • All 3,000+ Delhi Bus Stops
      Download static_delhi.7z   • All Route Lines & Directions
      (850 KB CDN Asset)         • Pre-compressed Polyline Shapes
```

### Local Database Tables (`expo-sqlite`)
1. **`Routes`**: Instant offline search by bus number (e.g., `"534"`, `"TMS+"`, `"433"`).
2. **`RouteDetails`**: Contains pre-computed stop order and compressed polyline coordinates.
3. **`Stops` & `BusStops`**: Geo-indexed with spatial bounding boxes for offline nearby stop detection.
4. **`MetroStops`**: Delhi Metro network interchange stations and line color badges.

---

## 4. Live GPS Radar & Low-Battery Adaptive Polling

To prevent battery drain and excessive mobile data usage while keeping live tracking ultra-responsive:

* **Active Radar Mode:** When user is actively viewing the live map screen, the app polls `POST /api/v1/live/nearby-buses` every **5 seconds** with the current GPS coordinates.
* **Stop Board Mode:** When viewing a specific bus stop, the app respects the backend's dynamic `refreshIntervalMs: 30000` (every 30 seconds), matching Chartr's verified PIS recommendation.
* **Background / Idle Mode:** Polling is completely halted when the app is minimized or the screen is turned off.

---

## 5. UI Architecture & Components

1. **Floating Island Bottom Tab Bar (`modern-bottom-tab.tsx`):**
   * Floating rounded pill design (`#FFFFFF` with `#059669` emerald active tint).
   * Smooth spring translation indicator powered by React Native Reanimated (`withSpring({ damping: 18, stiffness: 140 })`).
   * 4 Core Tabs:
     - **Radar (`index`):** Real-time bus radar and map viewport.
     - **Stops (`stops`):** Live PIS stop arrival boards.
     - **Explore (`explore`):** Corridor finder & route timetable viewer.
     - **Saved (`saved`):** Quick-access bookmarked routes and favorite stops.
2. **Native Status Bar:** `<StatusBar style="dark" />` paired with `androidStatusBar` in `app.json` for high-contrast dark status bar icons over the clean white header.
3. **Adaptive Icon Assets:** 50% safe-zone padded icons (`android-icon-foreground.png`, `android-icon-monochrome.png`) preventing launcher clipping and supporting Android Material You themed icons.

---

## 6. Mobile Implementation Roadmap

- [ ] **Phase 1: `expo-sqlite` Offline Engine**
  - Integrate `expo-sqlite` and `expo-file-system` for `static_delhi.db`.
  - Wire search bars on `stops` and `explore` to local SQLite queries.
- [ ] **Phase 2: Google Maps with Custom Transit Styling**
  - Integrate `react-native-maps` with `TRANSIT_MAP_STYLE`.
  - Add animated bus pin markers with heading rotation.
- [ ] **Phase 3: Live Radar Telemetry Integration**
  - Connect `index.tsx` to `POST /api/v1/live/nearby-buses`.
  - Render live buses within 2.5 km of user's current location.
- [ ] **Phase 4: PIS Stop Arrival Board Integration**
  - Connect `stops.tsx` to `POST /api/v1/pis/get_buses_eta`.
  - Display live countdowns and incoming bus cards with agency badges.
