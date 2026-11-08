import { Platform } from 'react-native';
import { suggestOfflineRoutes, DynamicRouteSuggestion } from './offline-transit';
export type { DynamicRouteSuggestion };

const AWS_BACKEND_URL = 'https://constitute-reference-may-plates.trycloudflare.com';

const androidApiUrl = process.env.EXPO_PUBLIC_ANDROID_API_URL || AWS_BACKEND_URL;
const emulatorApiUrl = process.env.EXPO_PUBLIC_EMULATOR_API_URL || AWS_BACKEND_URL;
const localApiUrl = process.env.EXPO_PUBLIC_LOCAL_API_URL || AWS_BACKEND_URL;

const DEFAULT_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? androidApiUrl || emulatorApiUrl : localApiUrl) ||
  AWS_BACKEND_URL;

export let currentBaseUrl = DEFAULT_URL;

export interface LiveBus {
  id: string;
  registration: string;
  route: string;
  routeId: string;
  routeShortName: string;
  routeDesc: string;
  origin: string;
  destination: string;
  agency: 'DTC' | 'DIMTS' | 'DEVI' | 'DMRC';
  agencyName: string;
  fuelType: 'electric' | 'cng' | 'diesel';
  isElectric: boolean;
  isAc: boolean;
  ac: 'ac' | 'nac';
  themeColor: string;
  secondaryColor: string;
  lat: number;
  lon: number;
  speed: number;
  bearing: number;
  distanceMeters?: number;
  freshness: string;
  timestamp: number;
}

export interface RouteDirectionOption {
  routeId: string;
  direction: number;
  agency: string;
  longName: string;
  origin: string;
  destination: string;
  label: string;
  stopsCount: number;
  activeBusesCount: number;
}

export interface TransitStopItem {
  id: string;
  name: string;
  code: string;
  lat: number;
  lon: number;
  distanceMeters?: number;
  hub?: string;
  routes: string[];
}

export interface PISIncomingBus {
  vehicleId: string;
  routeId: string;
  routeShortName: string;
  destination: string;
  etaMinutes: number;
  predictedArrivalTime?: string;
  stopsRemaining?: number;
  distanceKm: number;
  speedKmph: number;
  isElectric: boolean;
  isAc: boolean;
  agency: 'DTC' | 'DIMTS';
  color: string;
  crowdLevel: 'low' | 'medium' | 'high';
  freshness: string;
}

export interface PISRouteGroup {
  routeId: string;
  shortName: string;
  longName: string;
  agency: string;
  buses: PISIncomingBus[];
}

export interface PISStopBoard {
  stop: {
    id: string;
    name: string;
    code: string | null;
    updatedAt: string;
    refreshIntervalMs: number;
  };
  routes: PISRouteGroup[];
}

export interface TransitRouteItem {
  id: string;
  shortName: string;
  longName: string;
  origin: string;
  destination: string;
  agency: 'DTC' | 'DIMTS';
  isAc: boolean;
  isElectric: boolean;
  activeBusCount?: number;
  polyline?: string | null;
  stops: Array<{
    stopId: string;
    stopName: string;
    sequence: number;
    lat: number;
    lon: number;
  }>;
}

async function requestWithFallback(path: string, options: RequestInit = {}): Promise<Response> {
  const hosts = [...new Set([currentBaseUrl, androidApiUrl, emulatorApiUrl, localApiUrl].filter(Boolean))] as string[];

  for (const host of hosts) {
    try {
      const url = `${host}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        currentBaseUrl = host;
        return res;
      }
    } catch {
      // Try next host
    }
  }

  throw new Error(`Failed to connect to TransitDilli backend engine`);
}

/**
 * Real-time Nearby Buses Radar: POST /api/v1/live/nearby-buses
 */
export async function fetchLiveNearbyBuses(
  lat: number = 28.5694,
  lon: number = 77.2085,
  radiusKm: number = 6.0,
  agency?: string,
  isElectric?: boolean,
  limit: number = 80
): Promise<LiveBus[]> {
  const res = await requestWithFallback('/api/v1/live/nearby-buses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat,
      lon,
      radiusKm,
      limit,
      agency: agency && agency !== 'ALL' && agency !== 'EV' ? agency : undefined,
      isElectric: agency === 'EV' ? true : isElectric,
    }),
  });

  const json = await res.json();
  const rawList = Array.isArray(json.data) ? json.data : [];

  return rawList.map((b: any) => {
    const isEv = !!b.isElectric || b.fuelType === 'electric';
    const reg = String(b.id || '').toUpperCase();
    let rawShort = String(b.routeShortName || b.route || 'Bus').trim();

    // 1. Classification across the 4 authentic Delhi transit services
    let agencyType: 'DTC' | 'DIMTS' | 'DEVI' | 'DMRC' = 'DTC';
    if (
      b.agency === 'DEVI' ||
      rawShort.toUpperCase().startsWith('D-') ||
      /^D\d/i.test(rawShort) ||
      rawShort.toUpperCase().includes('DEVI')
    ) {
      agencyType = 'DEVI';
    } else if (
      b.agency === 'DMRC' ||
      rawShort.toUpperCase().startsWith('ML') ||
      rawShort.toUpperCase().startsWith('MS') ||
      rawShort.toUpperCase().startsWith('MC') ||
      rawShort.toUpperCase().includes('DMRC')
    ) {
      agencyType = 'DMRC';
    } else if (
      b.agency === 'DIMTS' ||
      reg.startsWith('DL51GD') ||
      reg.startsWith('DL1PB')
    ) {
      agencyType = 'DIMTS';
    }

    // Commuter-facing route name formatting: preserve full route names without truncating
    let shortName = rawShort;
    if (/^D-\d+$/i.test(shortName)) {
      shortName = shortName.replace('-', ''); // D-5507 -> D5507
    } else if (/^ML-\d+$/i.test(shortName)) {
      shortName = shortName.replace('-', ''); // ML-403 -> ML403
    } else if (/^\d{4,}$/.test(shortName)) {
      // Keep authentic route from backend
    }

    // Theme Color Tokens
    const themeColor =
      agencyType === 'DEVI'
        ? '#8B5CF6' // Purple
        : agencyType === 'DMRC'
        ? '#06B6D4' // Teal
        : agencyType === 'DIMTS'
        ? '#EA580C' // Orange
        : '#1D4ED8'; // Royal Blue

    const secondaryColor =
      agencyType === 'DEVI'
        ? '#7C3AED'
        : agencyType === 'DMRC'
        ? '#0891B2'
        : agencyType === 'DIMTS'
        ? '#C2410C'
        : '#1E40AF';

    const agencyName =
      agencyType === 'DEVI'
        ? 'DEVI Mohalla Bus'
        : agencyType === 'DMRC'
        ? 'DMRC Metro Feeder'
        : agencyType === 'DIMTS'
        ? 'Cluster Bus (DIMTS)'
        : isEv
        ? 'DTC Electric'
        : 'DTC State Fleet';

    return {
      id: b.id,
      registration: b.id,
      route: shortName,
      routeId: b.routeId || b.route,
      routeShortName: shortName,
      routeDesc: b.routeDesc || `Route ${shortName}`,
      origin: b.origin || 'Delhi Terminal',
      destination: b.destination || 'Corridor',
      agency: agencyType,
      agencyName,
      fuelType: b.fuelType || (isEv ? 'electric' : 'cng'),
      isElectric: isEv || agencyType === 'DEVI',
      isAc: !!b.isAc || b.ac === 'ac',
      ac: b.ac || 'nac',
      themeColor,
      secondaryColor,
      lat: b.lat,
      lon: b.lon,
      speed: Math.round(b.speedKmph || 0),
      bearing: Math.round(b.orientation || 0),
      distanceMeters: b.distanceMeters,
      freshness: b.freshness || 'Live',
      timestamp: b.timestamp || Date.now() / 1000,
    };
  });
}

/**
 * Real-time Buses on specific Route(s): POST /api/v1/live/buses-on-route
 * Returns all active buses operating across Delhi on the given route codes.
 */
export async function fetchBusesOnRoutes(routes: string[]): Promise<LiveBus[]> {
  try {
    const res = await requestWithFallback('/api/v1/live/buses-on-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routes }),
    });

    const json = await res.json();
    const rawList = Array.isArray(json.data) ? json.data : [];
    const seenIds = new Set<string>();

    const uniqueRaw = rawList.filter((b: any) => {
      const id = String(b?.id || '').trim();
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    return uniqueRaw.map((b: any) => {
      const isEv = !!b.isElectric || b.fuelType === 'electric';
      const reg = String(b.id || '').toUpperCase();
      let rawShort = String(b.routeShortName || b.route || 'Bus').trim();

      let agencyType: 'DTC' | 'DIMTS' | 'DEVI' | 'DMRC' = 'DTC';
      if (
        b.agency === 'DEVI' ||
        rawShort.toUpperCase().startsWith('D-') ||
        /^D\d/i.test(rawShort) ||
        rawShort.toUpperCase().includes('DEVI')
      ) {
        agencyType = 'DEVI';
      } else if (
        b.agency === 'DMRC' ||
        rawShort.toUpperCase().startsWith('ML') ||
        rawShort.toUpperCase().startsWith('MS') ||
        rawShort.toUpperCase().startsWith('MC') ||
        rawShort.toUpperCase().includes('DMRC')
      ) {
        agencyType = 'DMRC';
      } else if (
        b.agency === 'DIMTS' ||
        reg.startsWith('DL51GD') ||
        reg.startsWith('DL1PB')
      ) {
        agencyType = 'DIMTS';
      }

      let shortName = rawShort;
      if (/^D-\d+$/i.test(shortName)) {
        shortName = shortName.replace('-', '');
      } else if (/^ML-\d+$/i.test(shortName)) {
        shortName = shortName.replace('-', '');
      } else if (/^\d{4,}$/.test(shortName)) {
        // Keep authentic route from backend
      }

      const themeColor =
        agencyType === 'DEVI'
          ? '#8B5CF6'
          : agencyType === 'DMRC'
          ? '#06B6D4'
          : agencyType === 'DIMTS'
          ? '#EA580C'
          : '#1D4ED8';

      const secondaryColor =
        agencyType === 'DEVI'
          ? '#7C3AED'
          : agencyType === 'DMRC'
          ? '#0891B2'
          : agencyType === 'DIMTS'
          ? '#C2410C'
          : '#1E40AF';

      const agencyName =
        agencyType === 'DEVI'
          ? 'DEVI Mohalla Bus'
          : agencyType === 'DMRC'
          ? 'DMRC Metro Feeder'
          : agencyType === 'DIMTS'
          ? 'Cluster Bus (DIMTS)'
          : isEv
          ? 'DTC Electric'
          : 'DTC State Fleet';

      return {
        id: b.id,
        registration: b.id,
        route: shortName,
        routeId: b.routeId || b.route,
        routeShortName: shortName,
        routeDesc: b.routeDesc || `Route ${shortName}`,
        origin: b.origin || 'Delhi Terminal',
        destination: b.destination || 'Corridor',
        agency: agencyType,
        agencyName,
        fuelType: b.fuelType || (isEv ? 'electric' : 'cng'),
        isElectric: isEv || agencyType === 'DEVI',
        isAc: !!b.isAc || b.ac === 'ac',
        ac: b.ac || 'nac',
        themeColor,
        secondaryColor,
        lat: b.lat,
        lon: b.lon,
        speed: Math.round(b.speedKmph || 0),
        bearing: Math.round(b.orientation || 0),
        distanceMeters: b.distanceMeters,
        freshness: b.freshness || 'Live',
        timestamp: b.timestamp || Date.now() / 1000,
      };
    });
  } catch {
    return [];
  }
}

export interface BusSearchResponse {
  buses: LiveBus[];
  directions: RouteDirectionOption[];
}

/**
 * Real-time Search Across ALL Live Buses in Delhi: GET /api/v1/buses/search?q=...
 * Searches across the entire 4,500+ active fleet:
 * - Route short name (33, 502, TMS, 227A, 913, 729, D5507, ML403)
 * - Vehicle registration (DL1PD9227, DL1PD, DL51, 9227)
 * - Destination / Origin (Anand Vihar, Bhajanpura, Noida, Kashmere Gate)
 * - Transit agency (DTC, DIMTS, DEVI, DMRC)
 */
export async function searchAllDelhiBuses(
  query: string,
  agency?: string
): Promise<BusSearchResponse> {
  const cleanQ = query.trim();
  if (!cleanQ) {
    return { buses: [], directions: [] };
  }

  try {
    const qParam = encodeURIComponent(cleanQ);
    const agencyParam = agency && agency !== 'ALL' ? `&agency=${encodeURIComponent(agency)}` : '';
    const res = await requestWithFallback(`/api/v1/buses/search?q=${qParam}${agencyParam}&limit=150`, {
      method: 'GET',
    });

    const json = await res.json();
    const rawList = Array.isArray(json.data) ? json.data : [];
    const directions: RouteDirectionOption[] = Array.isArray(json.directions) ? json.directions : [];

    const seenIds = new Set<string>();
    const buses: LiveBus[] = [];

    for (const b of rawList) {
      const id = String(b?.id || '').trim();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const isEv = !!b.isElectric || b.fuelType === 'electric';
      const reg = String(b.id || '').toUpperCase();
      let rawShort = String(b.routeShortName || b.route || 'Bus').trim();

      let agencyType: 'DTC' | 'DIMTS' | 'DEVI' | 'DMRC' = 'DTC';
      if (
        b.agency === 'DEVI' ||
        rawShort.toUpperCase().startsWith('D-') ||
        /^D\d/i.test(rawShort) ||
        rawShort.toUpperCase().includes('DEVI')
      ) {
        agencyType = 'DEVI';
      } else if (
        b.agency === 'DMRC' ||
        rawShort.toUpperCase().startsWith('ML') ||
        rawShort.toUpperCase().startsWith('MS') ||
        rawShort.toUpperCase().startsWith('MC') ||
        rawShort.toUpperCase().includes('DMRC')
      ) {
        agencyType = 'DMRC';
      } else if (
        b.agency === 'DIMTS' ||
        reg.startsWith('DL51GD') ||
        reg.startsWith('DL1PB')
      ) {
        agencyType = 'DIMTS';
      }

      let shortName = rawShort;
      if (/^D-\d+$/i.test(shortName)) {
        shortName = shortName.replace('-', '');
      } else if (/^ML-\d+$/i.test(shortName)) {
        shortName = shortName.replace('-', '');
      } else if (/^\d{4,}$/.test(shortName)) {
        // Keep authentic route from backend
      }

      const themeColor =
        agencyType === 'DEVI'
          ? '#8B5CF6'
          : agencyType === 'DMRC'
          ? '#06B6D4'
          : agencyType === 'DIMTS'
          ? '#EA580C'
          : '#1D4ED8';

      const secondaryColor =
        agencyType === 'DEVI'
          ? '#7C3AED'
          : agencyType === 'DMRC'
          ? '#0891B2'
          : agencyType === 'DIMTS'
          ? '#C2410C'
          : '#1E40AF';

      const agencyName =
        agencyType === 'DEVI'
          ? 'DEVI Mohalla Bus'
          : agencyType === 'DMRC'
          ? 'DMRC Metro Feeder'
          : agencyType === 'DIMTS'
          ? 'Cluster Bus (DIMTS)'
          : isEv
          ? 'DTC Electric'
          : 'DTC State Fleet';

      buses.push({
        id: b.id,
        registration: b.id,
        route: shortName,
        routeId: b.routeId || b.route,
        routeShortName: shortName,
        routeDesc: b.routeDesc || `Route ${shortName}`,
        origin: b.origin || 'Delhi Terminal',
        destination: b.destination || 'Corridor',
        agency: agencyType,
        agencyName,
        fuelType: b.fuelType || (isEv ? 'electric' : 'cng'),
        isElectric: isEv || agencyType === 'DEVI',
        isAc: !!b.isAc || b.ac === 'ac',
        ac: b.ac || 'nac',
        themeColor,
        secondaryColor,
        lat: Number(b.lat),
        lon: Number(b.lon),
        speed: Math.round(b.speedKmph || 0),
        bearing: Math.round(b.bearing || b.orientation || 0),
        distanceMeters: b.distanceMeters,
        freshness: b.freshness || 'Live',
        timestamp: b.timestamp || Date.now() / 1000,
      });
    }

    return { buses, directions };
  } catch {
    return { buses: [], directions: [] };
  }
}

/**
 * Real-time Single Vehicle Position & ETA Stream: GET /api/v1/buses/:vehicleId
 */
export async function fetchBusLiveTelemetry(vehicleId: string): Promise<LiveBus | null> {
  try {
    const cleanId = encodeURIComponent(vehicleId.toUpperCase().replace(/\s+/g, ''));
    const res = await requestWithFallback(`/api/v1/buses/${cleanId}`, {
      method: 'GET',
    });

    const json = await res.json();
    if (!json || json.status !== 'success' || !json.data) return null;

    const b = json.data;
    const isEv = !!b.isElectric || b.fuelType === 'electric';
    const reg = String(b.id || '').toUpperCase();
    let rawShort = String(b.routeShortName || b.route || 'Bus').trim();

    let agencyType: 'DTC' | 'DIMTS' | 'DEVI' | 'DMRC' = 'DTC';
    if (
      b.agency === 'DEVI' ||
      rawShort.toUpperCase().startsWith('D-') ||
      /^D\d/i.test(rawShort) ||
      rawShort.toUpperCase().includes('DEVI')
    ) {
      agencyType = 'DEVI';
    } else if (
      b.agency === 'DMRC' ||
      rawShort.toUpperCase().startsWith('ML') ||
      rawShort.toUpperCase().startsWith('MS') ||
      rawShort.toUpperCase().startsWith('MC') ||
      rawShort.toUpperCase().includes('DMRC')
    ) {
      agencyType = 'DMRC';
    } else if (
      b.agency === 'DIMTS' ||
      reg.startsWith('DL51GD') ||
      reg.startsWith('DL1PB')
    ) {
      agencyType = 'DIMTS';
    }

    let shortName = rawShort;
    if (/^D-\d+$/i.test(shortName)) {
      shortName = shortName.replace('-', '');
    } else if (/^ML-\d+$/i.test(shortName)) {
      shortName = shortName.replace('-', '');
    } else if (/^\d{4,}$/.test(shortName)) {
      // Keep authentic route from backend
    }

    const themeColor =
      agencyType === 'DEVI'
        ? '#8B5CF6'
        : agencyType === 'DMRC'
        ? '#06B6D4'
        : agencyType === 'DIMTS'
        ? '#EA580C'
        : '#1D4ED8';

    const secondaryColor =
      agencyType === 'DEVI'
        ? '#7C3AED'
        : agencyType === 'DMRC'
        ? '#0891B2'
        : agencyType === 'DIMTS'
        ? '#C2410C'
        : '#1E40AF';

    return {
      id: b.id,
      registration: b.id,
      route: shortName,
      routeId: b.routeId || b.route,
      routeShortName: shortName,
      routeDesc: b.routeDesc || `Route ${shortName}`,
      origin: b.origin || 'Delhi Terminal',
      destination: b.destination || 'Corridor',
      agency: agencyType,
      agencyName: b.agencyName || (agencyType === 'DEVI' ? 'DEVI Mohalla Bus' : agencyType === 'DMRC' ? 'DMRC Metro Feeder' : agencyType === 'DIMTS' ? 'Cluster Bus (DIMTS)' : 'DTC State Fleet'),
      fuelType: b.fuelType || (isEv ? 'electric' : 'cng'),
      isElectric: isEv || agencyType === 'DEVI',
      isAc: !!b.isAc || b.ac === 'ac',
      ac: b.ac || 'nac',
      themeColor,
      secondaryColor,
      lat: b.lat,
      lon: b.lon,
      speed: Math.round(b.speedKmph || 0),
      bearing: Math.round(b.bearing || 0),
      distanceMeters: b.distanceMeters,
      freshness: 'Just now',
      timestamp: b.timestamp || Date.now() / 1000,
    };
  } catch {
    return null;
  }
}

/**
 * Passenger Information System (PIS) Stop Arrival Board: POST /api/v1/pis/get_buses_eta
 */
export async function fetchPISArrivals(stopId: string): Promise<PISStopBoard | null> {
  try {
    const res = await requestWithFallback('/api/v1/pis/get_buses_eta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stopId }),
    });

    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Nearby Transit Stops: GET /api/v1/static/stops?lat=...&lon=...&radius=...
 */
export async function fetchNearbyStops(
  lat: number = 28.5694,
  lon: number = 77.2085,
  radius: number = 4.0,
  limit: number = 40
): Promise<TransitStopItem[]> {
  const res = await requestWithFallback(`/api/v1/static/stops?lat=${lat}&lon=${lon}&radius=${radius}&limit=${limit}`);
  const json = await res.json();
  const rawList = Array.isArray(json.data) ? json.data : [];

  return rawList.map((s: any) => ({
    id: String(s.id),
    name: s.name,
    code: s.code || String(s.id),
    lat: s.lat,
    lon: s.lon,
    distanceMeters: s.distanceMeters,
    hub: s.code === 'METRO' ? 'Delhi Metro Interchange' : 'Delhi NCT Bus Stop',
    routes: ['DTC', 'DIMTS'],
  }));
}

/**
 * Transit Routes Directory: GET /api/v1/static/routes
 */
export async function fetchTransitRoutes(search?: string): Promise<TransitRouteItem[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await requestWithFallback(`/api/v1/static/routes${query}`);
  const json = await res.json();
  const rawList = Array.isArray(json.data) ? json.data : [];

  return rawList.map((r: any) => ({
    id: String(r.id),
    shortName: r.shortName,
    longName: r.longName,
    origin: r.startingStop || r.longName?.split(' to ')[0] || 'Origin',
    destination: r.terminalStop || r.longName?.split(' to ')[1] || 'Destination',
    agency: r.agency,
    isAc: true,
    isElectric: !!r.isElectric,
    activeBusCount: r.activeBusCount ?? 4,
    polyline: r.polyline,
    stops: (r.stops || []).map((s: any) => ({
      stopId: String(s.stopId),
      stopName: s.stopName,
      sequence: s.sequence,
      lat: s.lat,
      lon: s.lon,
    })),
  }));
}

/**
 * Route details by ID: GET /api/v1/transit/:routeId
 */
export async function fetchTransitRouteById(routeId: string): Promise<TransitRouteItem | null> {
  try {
    const res = await requestWithFallback(`/api/v1/transit/${routeId}`);
    const json = await res.json();
    const d = json.data;
    if (!d) return null;

    return {
      id: String(d.id),
      shortName: d.shortName,
      longName: d.longName,
      origin: d.startingStop || d.longName?.split(' to ')[0] || 'Origin',
      destination: d.terminalStop || d.longName?.split(' to ')[1] || 'Destination',
      agency: d.agency,
      isAc: true,
      isElectric: !!d.isElectric,
      activeBusCount: d.activeBusesCount ?? (d.activeBuses ? d.activeBuses.length : 0),
      polyline: d.polyline,
      stops: (d.stops || []).map((s: any) => ({
        stopId: String(s.stopId),
        stopName: s.stopName,
        sequence: s.sequence,
        lat: s.lat,
        lon: s.lon,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Route bidirectional options: GET /api/v1/transit/route-directions/:routeCode
 * Returns UP and DOWN direction paths (e.g. for Route 33: Bhajanpura -> Noida vs. Noida -> Bhajanpura).
 */
export async function fetchRouteDirections(routeCode: string): Promise<RouteDirectionOption[]> {
  try {
    const res = await requestWithFallback(`/api/v1/transit/route-directions/${encodeURIComponent(routeCode.trim())}`);
    const json = await res.json();
    if (json.status === 'success' && Array.isArray(json.directions)) {
      return json.directions;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Live single vehicle telemetry: GET /api/v1/live/bus/:vehicleId
 */
export async function fetchVehicleTelemetry(vehicleId: string): Promise<any | null> {
  try {
    const res = await requestWithFallback(`/api/v1/live/bus/${vehicleId}`);
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

/**
 * Dynamic prefix & corridor auto-complete: GET /api/v1/buses/suggest-routes?q=...
 * e.g. "9" -> 901, 913, 971, 971A; "33" -> 33, 33A, 334.
 */
export async function fetchRouteSuggestions(query: string, limit = 12): Promise<DynamicRouteSuggestion[]> {
  try {
    const res = await requestWithFallback(`/api/v1/buses/suggest-routes?q=${encodeURIComponent(query.trim())}&limit=${limit}`);
    const json = await res.json();
    if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch {
    // fallback to offline SQLite
  }
  return suggestOfflineRoutes(query, limit);
}
