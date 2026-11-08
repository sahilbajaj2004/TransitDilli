import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

export interface UserProfile {
  name: string;
  phone: string;
  onboarded: boolean;
  createdAt: number;
}

let profileDbInstance: SQLite.SQLiteDatabase | null = null;

async function getProfileDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (Platform.OS === 'web') return null;
  if (!profileDbInstance) {
    try {
      profileDbInstance = await SQLite.openDatabaseAsync('user_profile.db');
      await profileDbInstance.execAsync(`
        CREATE TABLE IF NOT EXISTS user_profile (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          onboarded INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL
        );
      `);
    } catch (e) {
      console.warn('Failed to initialize user_profile database:', e);
      return null;
    }
  }
  return profileDbInstance;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const db = await getProfileDb();
    if (!db) return null;

    const row = await db.getFirstAsync<{
      name: string;
      phone: string;
      onboarded: number;
      created_at: number;
    }>('SELECT name, phone, onboarded, created_at FROM user_profile WHERE id = 1 LIMIT 1');

    if (!row) return null;

    return {
      name: row.name,
      phone: row.phone,
      onboarded: row.onboarded === 1,
      createdAt: row.created_at,
    };
  } catch (err) {
    console.warn('Failed to load user profile:', err);
    return null;
  }
}

export async function saveUserProfile(name: string, phone: string): Promise<UserProfile> {
  const profile: UserProfile = {
    name: name.trim(),
    phone: phone.trim(),
    onboarded: true,
    createdAt: Date.now(),
  };

  try {
    const db = await getProfileDb();
    if (db) {
      await db.runAsync(
        `INSERT INTO user_profile (id, name, phone, onboarded, created_at)
         VALUES (1, ?, ?, 1, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           phone = excluded.phone,
           onboarded = 1,
           created_at = excluded.created_at`,
        [profile.name, profile.phone, profile.createdAt]
      );
    }
  } catch (err) {
    console.warn('Failed to persist user profile:', err);
  }

  return profile;
}

export async function clearUserProfile(): Promise<void> {
  try {
    const db = await getProfileDb();
    if (db) {
      await db.runAsync('DELETE FROM user_profile WHERE id = 1');
    }
  } catch (err) {
    console.warn('Failed to clear profile:', err);
  }
}
