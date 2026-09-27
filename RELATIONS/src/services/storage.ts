import AsyncStorage from '@react-native-async-storage/async-storage';
import {Contact, RelationEdge} from '../types';

const STORAGE_KEYS = {
  CONTACTS: '@relations_contacts',
  EDGES: '@relations_edges',
  LAST_SYNC: '@relations_last_sync',
  USER_PREFERENCES: '@relations_user_preferences',
};

export interface StoredData {
  contacts: Contact[];
  edges: RelationEdge[];
  lastSyncTime: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  notificationEnabled?: boolean;
  reminderDays?: number[];
  language?: string;
}

export async function saveContacts(contacts: Contact[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  } catch (error) {
    console.error('保存联系人失败:', error);
    throw error;
  }
}

export async function loadContacts(): Promise<Contact[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CONTACTS);
    if (data) {
      return JSON.parse(data) as Contact[];
    }
    return [];
  } catch (error) {
    console.error('加载联系人失败:', error);
    return [];
  }
}

export async function saveEdges(edges: RelationEdge[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.EDGES, JSON.stringify(edges));
  } catch (error) {
    console.error('保存关系边失败:', error);
    throw error;
  }
}

export async function loadEdges(): Promise<RelationEdge[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EDGES);
    if (data) {
      return JSON.parse(data) as RelationEdge[];
    }
    return [];
  } catch (error) {
    console.error('加载关系边失败:', error);
    return [];
  }
}

export async function saveAllData(data: StoredData): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.CONTACTS, JSON.stringify(data.contacts)],
      [STORAGE_KEYS.EDGES, JSON.stringify(data.edges)],
      [STORAGE_KEYS.LAST_SYNC, data.lastSyncTime],
    ]);
  } catch (error) {
    console.error('保存所有数据失败:', error);
    throw error;
  }
}

export async function loadAllData(): Promise<StoredData | null> {
  try {
    const results = await AsyncStorage.multiGet([
      STORAGE_KEYS.CONTACTS,
      STORAGE_KEYS.EDGES,
      STORAGE_KEYS.LAST_SYNC,
    ]);

    const [contactsData, edgesData, lastSyncTime] = results;

    if (contactsData[1]) {
      return {
        contacts: JSON.parse(contactsData[1]),
        edges: edgesData[1] ? JSON.parse(edgesData[1]) : [],
        lastSyncTime: lastSyncTime[1] || new Date().toISOString(),
      };
    }
    return null;
  } catch (error) {
    console.error('加载所有数据失败:', error);
    return null;
  }
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
  } catch (error) {
    console.error('保存用户偏好设置失败:', error);
    throw error;
  }
}

export async function loadUserPreferences(): Promise<UserPreferences | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (data) {
      return JSON.parse(data) as UserPreferences;
    }
    return null;
  } catch (error) {
    console.error('加载用户偏好设置失败:', error);
    return null;
  }
}

export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  } catch (error) {
    console.error('清除所有数据失败:', error);
    throw error;
  }
}

export async function exportData(): Promise<string> {
  try {
    const data = await loadAllData();
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('导出数据失败:', error);
    throw error;
  }
}

export async function importData(jsonString: string): Promise<StoredData> {
  try {
    const data = JSON.parse(jsonString) as StoredData;
    await saveAllData(data);
    return data;
  } catch (error) {
    console.error('导入数据失败:', error);
    throw error;
  }
}

export {STORAGE_KEYS};