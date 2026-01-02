
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { User, Appointment, AppNotification, Transaction, UserRole, SyncRequest } from '../types.ts';

/**
 * Clinical Hybrid API Service
 * Primary: Supabase Cloud (Global Sync)
 * Fallback: Local Persisted Simulation (Same-Device Sync)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Global Bridge for cross-tab (same device) sync
const clinicalBridge = new BroadcastChannel('medi_clinical_bridge');

const getLocalCollection = <T>(key: string): T[] => JSON.parse(localStorage.getItem(`medi_${key}`) || '[]');

/**
 * Enhanced Save: Updates local storage and broadcasts to Clinical Cloud for cross-device sync
 */
const saveLocalCollection = <T>(key: string, data: T[]) => {
  const fullKey = `medi_${key}`;
  localStorage.setItem(fullKey, JSON.stringify(data));
  
  // Cross-tab sync
  clinicalBridge.postMessage({ type: 'REFRESH_COLLECTION', key: fullKey });
  window.dispatchEvent(new Event('storage'));
  
  // Cross-device sync (Cloud Broadcast)
  ClinicalAPI.broadcastSystemEvent('COLLECTION_UPDATE', { key: fullKey, data });
};

export const ClinicalAPI = {
  isConfigured(): boolean {
    return !!supabase;
  },

  getBridge() {
    return clinicalBridge;
  },

  /**
   * Global System Event Bus for cross-device state sync
   */
  subscribeToGlobalSystem(onEvent: (payload: any) => void): RealtimeChannel | null {
    if (!supabase) return null;
    return supabase.channel('global_clinical_system')
      .on('broadcast', { event: 'system_update' }, ({ payload }) => {
        onEvent(payload);
      })
      .subscribe();
  },

  broadcastSystemEvent(type: string, data: any) {
    if (supabase) {
      supabase.channel('global_clinical_system').send({
        type: 'broadcast',
        event: 'system_update',
        payload: { type, data, timestamp: Date.now() },
      });
    }
  },

  /**
   * Subscribes to cross-device messages using Supabase Realtime
   */
  subscribeToClinicalCloud(chatId: string, onMessage: (msg: any) => void): RealtimeChannel | null {
    if (!supabase) return null;

    const channel = supabase.channel(`chat:${chatId}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        onMessage(payload);
      })
      .subscribe();
    
    return channel;
  },

  broadcastMessage(chatId: string, message: any) {
    if (supabase) {
      const channel = supabase.channel(`chat:${chatId}`);
      channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: message,
      });
    }
  },

  getClinicalSnapshot() {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('medi_') || key.startsWith('chat_'))) {
        snapshot[key] = localStorage.getItem(key) || '';
      }
    }
    return snapshot;
  },

  restoreClinicalSnapshot(snapshot: Record<string, string>) {
    Object.entries(snapshot).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    clinicalBridge.postMessage({ type: 'FULL_RESTORE' });
    window.dispatchEvent(new Event('storage'));
  },

  // Added pushToCloud method for clinical snapshot backup
  pushToCloud(email: string, data: Record<string, string>) {
    localStorage.setItem(`cloud_vault_${email.toLowerCase()}`, JSON.stringify(data));
  },

  // Added pullFromCloud method for clinical snapshot recovery
  pullFromCloud(email: string): Record<string, string> | null {
    const data = localStorage.getItem(`cloud_vault_${email.toLowerCase()}`);
    return data ? JSON.parse(data) : null;
  },

  seedDefaultData() {
    if (this.isConfigured()) return;
    const users = getLocalCollection<User>('registered_users');
    if (users.length === 0) {
      const defaultDoctors: User[] = [
        { id: 'doc-1', name: 'Dr. Sarah Jenkins', email: 'sarah.j@byinkshealth.com', role: UserRole.CONSULTANT, specialty: 'Cardiology', isApproved: true },
        { id: 'admin-1', name: 'System Admin', email: 'admin@byinkshealth.com', role: UserRole.ADMIN, isApproved: true }
      ];
      saveLocalCollection('registered_users', defaultDoctors);
    }
  },

  async signUp(email: string, pass: string, profile: User): Promise<User> {
    const users = getLocalCollection<User>('registered_users');
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error("Email registered.");
    const newUser = { ...profile, id: Math.random().toString(36).substr(2, 9) };
    users.push(newUser);
    saveLocalCollection('registered_users', users);
    localStorage.setItem('medi_local_session', JSON.stringify(newUser));
    return newUser;
  },

  async adminCreateUser(profile: User): Promise<User> {
    const users = getLocalCollection<User>('registered_users');
    const existing = users.find(u => u.id === profile.id || u.email.toLowerCase() === profile.email.toLowerCase());
    if (existing) return existing;
    const newUser = { ...profile, id: profile.id || Math.random().toString(36).substr(2, 9), isApproved: true };
    users.push(newUser);
    saveLocalCollection('registered_users', users);
    return newUser;
  },

  async signIn(email: string, pass: string): Promise<User> {
    const users = getLocalCollection<User>('registered_users');
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error("Identity not found.");
    localStorage.setItem('medi_local_session', JSON.stringify(user));
    return user;
  },

  async signOut() {
    localStorage.removeItem('medi_local_session');
    clinicalBridge.postMessage({ type: 'SIGN_OUT' });
  },

  async getProfile(userId: string): Promise<User | null> {
    return getLocalCollection<User>('registered_users').find(u => u.id === userId) || null;
  },

  async getAllUsers(): Promise<User[]> {
    const users = getLocalCollection<User>('registered_users');
    const uniqueMap = new Map();
    users.forEach(u => uniqueMap.set(u.id, u));
    return Array.from(uniqueMap.values());
  },

  async saveProfile(user: User): Promise<void> {
    const users = getLocalCollection<User>('registered_users');
    const idx = users.findIndex(u => u.id === user.id);
    if (idx > -1) users[idx] = user; else users.push(user);
    saveLocalCollection('registered_users', users);
  },

  async updateUserStatus(userId: string, updates: Partial<User>): Promise<void> {
    const users = getLocalCollection<User>('registered_users');
    const idx = users.findIndex(u => u.id === userId);
    if (idx > -1) {
      users[idx] = { ...users[idx], ...updates };
      saveLocalCollection('registered_users', users);
    }
  },

  async getSyncRequests(): Promise<SyncRequest[]> {
    return getLocalCollection<SyncRequest>('sync_requests');
  },

  async updateSyncRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    const syncs = getLocalCollection<SyncRequest>('sync_requests');
    const idx = syncs.findIndex(r => r.id === requestId);
    if (idx > -1) {
      syncs[idx].status = status;
      saveLocalCollection('sync_requests', syncs);
    }
  }
};
