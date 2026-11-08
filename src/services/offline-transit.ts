import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';
import { TransitStopItem, TransitRouteItem } from './api';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;

/**
 * Initializes and opens the offline Delhi transit database.
 * Copies the pre-bundled 5.8 MB SQLite file to the app's SQLite sandbox directory on first launch.
 */
export async function getOfflineDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  if (Platform.OS === 'web') return null;
  if (dbInstance) return dbInstance;
  if (isInitializing) {
    // Wait until initialization completes
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return dbInstance;
  }

  isInitializing = true;
  try {
    const dbDir = `${FileSystem.documentDirectory}SQLite`;
    const dbPath = `${dbDir}/static_delhi.db`;

    const dirInfo = await FileSystem.getInfoAsync(dbDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
    }

    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    if (!fileInfo.exists) {
      const asset = Asset.fromModule(require('@/assets/database/static_delhi.db'));
      await asset.downloadAsync();
      if (asset.localUri) {
        await FileSystem.copyAsync({
          from: asset.localUri,
          to: dbPath,
        });
      }
    }

    dbInstance = await SQLite.openDatabaseAsync('static_delhi.db');
    return dbInstance;
  } catch (err) {
    console.warn('[OfflineTransit] SQLite local database initialization error:', err);
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * 0ms local offline stop search across 6,664 stops
 */
export async function searchOfflineStops(query: string, limit: number = 30): Promise<TransitStopItem[]> {
  try {
    const db = await getOfflineDatabase();
    if (!db) return [];

    const q = `%${query.trim()}%`;
    const rows = await db.getAllAsync<{
      stop_id: number;
      name: string;
      lat: number;
      lon: number;
    }>(
      `SELECT stop_id, name, lat, lon FROM BusStops WHERE name LIKE ? OR stop_id LIKE ? LIMIT ?`,
      [q, q, limit]
    );

    return rows.map((r) => ({
      id: String(r.stop_id),
      name: r.name,
      code: String(r.stop_id),
      lat: r.lat,
      lon: r.lon,
      hub: 'Delhi NCT Bus Stop',
      routes: ['DTC', 'DIMTS'],
    }));
  } catch {
    return [];
  }
}

/**
 * 0ms local offline nearby stops calculation using spatial bounding box
 */
export async function getOfflineNearbyStops(
  userLat: number,
  userLon: number,
  radiusKm: number = 4.0,
  limit: number = 30
): Promise<TransitStopItem[]> {
  try {
    const db = await getOfflineDatabase();
    if (!db) return [];

    const latDelta = radiusKm / 111.0;
    const lonDelta = radiusKm / (111.0 * Math.cos((userLat * Math.PI) / 180));

    const minLat = userLat - latDelta;
    const maxLat = userLat + latDelta;
    const minLon = userLon - lonDelta;
    const maxLon = userLon + lonDelta;

    const rows = await db.getAllAsync<{
      stop_id: number;
      name: string;
      lat: number;
      lon: number;
    }>(
      `SELECT stop_id, name, lat, lon FROM BusStops WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 80`,
      [minLat, maxLat, minLon, maxLon]
    );

    const withDist = rows.map((r) => {
      const dLat = ((r.lat - userLat) * Math.PI) / 180;
      const dLon = ((r.lon - userLon) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((userLat * Math.PI) / 180) *
          Math.cos((r.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return {
        id: String(r.stop_id),
        name: r.name,
        code: String(r.stop_id),
        lat: r.lat,
        lon: r.lon,
        distanceMeters: Math.round(distKm * 1000),
        hub: 'Delhi NCT Bus Stop',
        routes: ['DTC', 'DIMTS'],
      };
    });

    withDist.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
    return withDist.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * 0ms local offline route search across 2,619 routes
 */
export async function searchOfflineRoutes(query?: string, limit: number = 30): Promise<TransitRouteItem[]> {
  try {
    const db = await getOfflineDatabase();
    if (!db) return [];

    let rows: Array<{
      route_id: number;
      agency: string;
      long_name: string;
      short_name: string;
      starting_stop: string;
      terminal_stop: string;
      display_name: string;
    }>;

    if (query && query.trim()) {
      const trimmed = query.trim();
      const q = `%${trimmed}%`;
      const exact = trimmed;
      const startsWith = `${trimmed}%`;
      rows = await db.getAllAsync(
        `SELECT route_id, agency, long_name, short_name, starting_stop, terminal_stop, display_name 
         FROM Routes 
         WHERE display_name LIKE ? OR long_name LIKE ? OR starting_stop LIKE ? OR terminal_stop LIKE ?
         ORDER BY 
           CASE 
             WHEN display_name = ? THEN 0 
             WHEN display_name LIKE ? THEN 1 
             ELSE 2 
           END,
           LENGTH(display_name) ASC
         LIMIT ?`,
        [q, q, q, q, exact, startsWith, limit]
      );
    } else {
      rows = await db.getAllAsync(
        `SELECT route_id, agency, long_name, short_name, starting_stop, terminal_stop, display_name 
         FROM Routes 
         WHERE display_name NOT LIKE '%nan%' 
         ORDER BY 
           CASE 
             WHEN display_name IN ('505', '502', '534', '729', 'TMS', 'OMS', '419', '429', '433', '100A') THEN 0 
             ELSE 1 
           END, 
           LENGTH(display_name) ASC, 
           display_name ASC 
         LIMIT ?`,
        [limit]
      );
    }

    return rows.map((r) => {
      const shortName =
        r.display_name && r.display_name !== 'nan'
          ? r.display_name
          : r.short_name && r.short_name !== 'nan'
          ? r.short_name
          : String(r.route_id);

      return {
        id: String(r.route_id),
        shortName,
        longName: r.long_name || shortName,
        origin: r.starting_stop || 'Terminal',
        destination: r.terminal_stop || 'Corridor',
        agency: r.agency === 'DIMTS' ? 'DIMTS' : 'DTC',
        isAc: true,
        isElectric: shortName.toUpperCase().includes('EV'),
        activeBusCount: 4,
        stops: [],
      };
    });
  } catch {
    return [];
  }
}

/**
 * 0ms local offline route details and stop sequence
 */
export async function getOfflineRouteDetails(routeId: number | string): Promise<TransitRouteItem | null> {
  try {
    const db = await getOfflineDatabase();
    if (!db) return null;

    const numId = typeof routeId === 'number' ? routeId : parseInt(routeId, 10);
    if (isNaN(numId)) return null;

    const routeRow = await db.getFirstAsync<{
      route_id: number;
      agency: string;
      long_name: string;
      short_name: string;
      starting_stop: string;
      terminal_stop: string;
      display_name: string;
    }>(
      `SELECT route_id, agency, long_name, short_name, starting_stop, terminal_stop, display_name 
       FROM Routes WHERE route_id = ? LIMIT 1`,
      [numId]
    );

    if (!routeRow) return null;

    const detailRow = await db.getFirstAsync<{
      geometry: string | null;
      stops: string | null;
    }>(`SELECT geometry, stops FROM RouteDetails WHERE route_id = ? LIMIT 1`, [numId]);

    let stopIds: number[] = [];
    if (detailRow?.stops) {
      try {
        stopIds = JSON.parse(detailRow.stops);
      } catch {
        stopIds = [];
      }
    }

    const stops: Array<{
      stopId: string;
      stopName: string;
      sequence: number;
      lat: number;
      lon: number;
    }> = [];

    if (stopIds.length > 0) {
      const placeholders = stopIds.map(() => '?').join(',');
      const stopRows = await db.getAllAsync<{
        stop_id: number;
        name: string;
        lat: number;
        lon: number;
      }>(
        `SELECT stop_id, name, lat, lon FROM BusStops WHERE stop_id IN (${placeholders})`,
        stopIds
      );

      const stopMap = new Map(stopRows.map((s) => [s.stop_id, s]));

      for (let i = 0; i < stopIds.length; i++) {
        const s = stopMap.get(stopIds[i]);
        if (s) {
          stops.push({
            stopId: String(s.stop_id),
            stopName: s.name,
            sequence: i + 1,
            lat: s.lat,
            lon: s.lon,
          });
        }
      }
    }

    const shortName =
      routeRow.display_name && routeRow.display_name !== 'nan'
        ? routeRow.display_name
        : routeRow.short_name && routeRow.short_name !== 'nan'
        ? routeRow.short_name
        : String(routeRow.route_id);

    return {
      id: String(routeRow.route_id),
      shortName,
      longName: routeRow.long_name || shortName,
      origin: routeRow.starting_stop || 'Origin Terminal',
      destination: routeRow.terminal_stop || 'Destination Terminal',
      agency: routeRow.agency === 'DIMTS' ? 'DIMTS' : 'DTC',
      isAc: true,
      isElectric: shortName.toUpperCase().includes('EV'),
      polyline: detailRow?.geometry || null,
      stops,
    };
  } catch {
    return null;
  }
}
