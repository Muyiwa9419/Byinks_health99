
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

const clinicalBridge = new BroadcastChannel('medi_clinical_bridge');

const getLocalCollection = <T>(key: string): T[] => JSON.parse(localStorage.getItem(`medi_${key}`) || '[]');

/**
 * Enhanced Save: Updates local storage and broadcasts to Clinical Cloud for cross-device sync
 */
const saveLocalCollection = (key: string, data: any) => {
  const fullKey = key.startsWith('medi_') || key.startsWith('chat_') ? key : `medi_${key}`;
  localStorage.setItem(fullKey, JSON.stringify(data));
  
  // Cross-tab sync (Same Device)
  clinicalBridge.postMessage({ type: 'REFRESH_COLLECTION', key: fullKey });
  window.dispatchEvent(new Event('storage'));
  
  // Cross-device sync (Global Cloud Broadcast)
  if (supabase) {
    const channel = supabase.channel('global_clinical_system');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'system_update',
          payload: { type: 'COLLECTION_UPDATE', data: { key: fullKey, data }, timestamp: Date.now() },
        });
      }
    });
  }
};

export const ClinicalAPI = {
  isConfigured(): boolean {
    return !!supabase;
  },

  getBridge() {
    return clinicalBridge;
  },

  subscribeToGlobalSystem(onEvent: (payload: any) => void): RealtimeChannel | null {
    if (!supabase) return null;
    return supabase.channel('global_clinical_system')
      .on('broadcast', { event: 'system_update' }, ({ payload }) => {
        onEvent(payload);
      })
      .subscribe();
  },

  subscribeToClinicalCloud(chatId: string, onMessage: (msg: any) => void): RealtimeChannel | null {
    if (!supabase) return null;
    // Use a unique channel for this specific conversation
    return supabase.channel(`clinical_chat_${chatId}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        onMessage(payload);
      })
      .subscribe();
  },

  async broadcastMessage(chatId: string, message: any) {
    if (supabase) {
      const channel = supabase.channel(`clinical_chat_${chatId}`);
      // Ensure we wait for subscription before sending to avoid "lost" messages
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: message,
          });
        }
      });
    }
  },

  /**
   * Data Specific Persistence Methods
   */
  async saveAppointments(apps: Appointment[]) {
    saveLocalCollection('appointments', apps);
  },

  async saveNotifications(notifs: AppNotification[]) {
    saveLocalCollection('notifications', notifs);
  },

  async saveUsers(users: User[]) {
    saveLocalCollection('registered_users', users);
  },

  async getProfile(userId: string): Promise<User | null> {
    const users = getLocalCollection<User>('registered_users');
    return users.find(u => u.id === userId) || null;
  },

  async saveProfile(user: User): Promise<void> {
    const users = getLocalCollection<User>('registered_users');
    const idx = users.findIndex(u => u.id === user.id);
    if (idx > -1) {
      users[idx] = user;
      await this.saveUsers(users);
    }
  },

  async getSyncRequests(): Promise<SyncRequest[]> {
    return getLocalCollection<SyncRequest>('sync_requests');
  },

  async updateSyncRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    const requests = getLocalCollection<SyncRequest>('sync_requests');
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx > -1) {
      requests[idx] = { ...requests[idx], status };
      saveLocalCollection('sync_requests', requests);
    }
  },

  async adminCreateUser(user: User): Promise<User> {
    const users = getLocalCollection<User>('registered_users');
    if (users.find(u => u.email.toLowerCase() === user.email.toLowerCase())) throw new Error("Email registered.");
    const newUser = { ...user, id: Math.random().toString(36).substr(2, 9) };
    users.push(newUser);
    await this.saveUsers(users);
    return newUser;
  },

  async removeUser(userId: string): Promise<void> {
    const users = getLocalCollection<User>('registered_users');
    const filteredUsers = users.filter(u => u.id !== userId);
    await this.saveUsers(filteredUsers);
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

  pushToCloud(email: string, data: Record<string, string>) {
    localStorage.setItem(`cloud_vault_${email.toLowerCase()}`, JSON.stringify(data));
  },

  pullFromCloud(email: string): Record<string, string> | null {
    const data = localStorage.getItem(`cloud_vault_${email.toLowerCase()}`);
    return data ? JSON.parse(data) : null;
  },

  seedDefaultData() {
    const users = getLocalCollection<User>('registered_users');
    if (users.length === 0) {
      const defaultDoctors: User[] = [
        { id: 'doc-1', name: 'Dr. Sarah Jenkins', email: 'sarah.j@byinkshealth.com', role: UserRole.CONSULTANT, specialty: 'Cardiology', isApproved: true },
        { id: 'admin-1', name: 'System Admin', email: 'admin@byinkshealth.com', role: UserRole.ADMIN, isApproved: true }
      ];
      this.saveUsers(defaultDoctors);
    }
  },

  async signUp(email: string, pass: string, profile: User): Promise<User> {
    const users = getLocalCollection<User>('registered_users');
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error("Email registered.");
    const newUser = { ...profile, id: Math.random().toString(36).substr(2, 9) };
    users.push(newUser);
    await this.saveUsers(users);
    localStorage.setItem('medi_local_session', JSON.stringify(newUser));
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

  async getAllUsers(): Promise<User[]> {
    return getLocalCollection<User>('registered_users');
  },

  async updateUserStatus(userId: string, updates: Partial<User>): Promise<void> {
    const users = getLocalCollection<User>('registered_users');
    const idx = users.findIndex(u => u.id === userId);
    if (idx > -1) {
      users[idx] = { ...users[idx], ...updates };
      await this.saveUsers(users);
    }
  }
};
