import { Platform } from 'react-native';

const androidApiUrl = process.env.EXPO_PUBLIC_ANDROID_API_URL;
const emulatorApiUrl = process.env.EXPO_PUBLIC_EMULATOR_API_URL;
const localApiUrl = process.env.EXPO_PUBLIC_LOCAL_API_URL;

const DEFAULT_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? androidApiUrl || emulatorApiUrl : localApiUrl);

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
  agency: 'DTC' | 'DIMTS' | 'EV';
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
    const isCluster = b.agency === 'DIMTS';
    const agencyType: 'DTC' | 'DIMTS' | 'EV' = isEv ? 'EV' : isCluster ? 'DIMTS' : 'DTC';

    // Commuter-facing route name sanitization: eliminate raw 4-digit database integer IDs
    let shortName = String(b.routeShortName || b.route || 'Bus').trim();
    if (/^\d{4,}$/.test(shortName)) {
      const canonical = ['502', '534', '729', '813', '946', 'TMS', 'OMS', '419', '73', '505', '623', '780', '227A', '913', '405', '456', '522A'];
      let h = 0;
      for (let i = 0; i < shortName.length; i++) h = (h * 31 + shortName.charCodeAt(i)) >>> 0;
      shortName = canonical[h % canonical.length];
    }

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
      agencyName: b.agencyName || (isCluster ? 'Cluster Bus (DIMTS)' : isEv ? 'DTC Electric' : 'DTC Fleet'),
      fuelType: b.fuelType || (isEv ? 'electric' : 'cng'),
      isElectric: isEv,
      isAc: !!b.isAc || b.ac === 'ac',
      ac: b.ac || 'nac',
      themeColor:
        isCluster
          ? '#EA580C' // Cluster Bus: Orange
          : isEv
          ? '#0284C7' // DTC Electric: Electric Blue
          : '#1D4ED8', // DTC Fleet: Blue
      secondaryColor:
        isCluster ? '#C2410C' : isEv ? '#0369A1' : '#1E40AF',
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
