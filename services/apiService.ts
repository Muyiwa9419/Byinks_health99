
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { User, Appointment, AppNotification, Transaction, UserRole, SyncRequest, MedicalReport, Prescription, DeliveryOrder } from '../types.ts';

/**
 * ==========================================
 * CLOUD RELAY CONFIGURATION
 * ==========================================
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const clinicalBridge = new BroadcastChannel('medi_clinical_bridge');
const activeChannels = new Map<string, RealtimeChannel>();
let globalSystemChannel: RealtimeChannel | null = null;

const getLocalCollection = <T>(key: string): T[] => JSON.parse(localStorage.getItem(`medi_${key}`) || '[]');

const saveLocalCollection = (key: string, data: any) => {
  const fullKey = key.startsWith('medi_') || key.startsWith('chat_') ? key : `medi_${key}`;
  localStorage.setItem(fullKey, JSON.stringify(data));
  
  clinicalBridge.postMessage({ type: 'COLLECTION_UPDATE', key: fullKey, data });
  window.dispatchEvent(new Event('storage'));
  
  if (supabase) {
    if (!globalSystemChannel) {
      globalSystemChannel = supabase.channel('system_relay').subscribe();
    }
    globalSystemChannel.send({
      type: 'broadcast',
      event: 'system_update',
      payload: { type: 'COLLECTION_UPDATE', data: { key: fullKey, data }, timestamp: Date.now() },
    });
  }
};

export const ClinicalAPI = {
  isConfigured(): boolean { return !!supabase; },
  getBridge() { return clinicalBridge; },

  subscribeToGlobalSystem(onEvent: (payload: any) => void): RealtimeChannel | null {
    if (!supabase) return null;
    if (globalSystemChannel) return globalSystemChannel;
    globalSystemChannel = supabase.channel('system_relay')
      .on('broadcast', { event: 'system_update' }, ({ payload }) => onEvent(payload))
      .subscribe();
    return globalSystemChannel;
  },

  subscribeToClinicalCloud(chatId: string, onMessage: (msg: any) => void, onStatusChange?: (status: string) => void): RealtimeChannel | null {
    if (!supabase) return null;
    const existing = activeChannels.get(chatId);
    if (existing) { existing.unsubscribe(); activeChannels.delete(chatId); }
    const channel = supabase.channel(`chat_relay_${chatId}`)
      .on('broadcast', { event: 'new_message' }, ({ payload }) => onMessage(payload))
      .on('broadcast', { event: 'session_ended' }, () => onMessage({ type: 'SESSION_ENDED' }))
      .subscribe((status) => { if (onStatusChange) onStatusChange(status); });
    activeChannels.set(chatId, channel);
    return channel;
  },

  async broadcastMessage(chatId: string, message: any) {
    if (supabase) {
      let channel = activeChannels.get(chatId);
      if (!channel) {
        channel = supabase.channel(`chat_relay_${chatId}`);
        await new Promise<void>((res) => channel!.subscribe(s => s === 'SUBSCRIBED' && res()));
        activeChannels.set(chatId, channel);
      }
      await channel.send({ type: 'broadcast', event: 'new_message', payload: message });
    }
    clinicalBridge.postMessage({ type: 'CHAT_MESSAGE', chatId, message });
  },

  async broadcastEndSession(chatId: string) {
    if (supabase) {
      const channel = activeChannels.get(chatId);
      if (channel) await channel.send({ type: 'broadcast', event: 'session_ended', payload: { timestamp: Date.now() } });
    }
    clinicalBridge.postMessage({ type: 'CHAT_CLOSED', chatId });
  },

  // Collections
  async saveAppointments(apps: Appointment[]) { saveLocalCollection('appointments', apps); },
  async saveNotifications(notifs: AppNotification[]) { saveLocalCollection('notifications', notifs); },
  async saveUsers(users: User[]) { saveLocalCollection('registered_users', users); },
  async saveReports(reports: MedicalReport[]) { saveLocalCollection('reports', reports); },
  async savePrescriptions(p: Prescription[]) { saveLocalCollection('prescriptions', p); },
  async saveDeliveries(d: DeliveryOrder[]) { saveLocalCollection('deliveries', d); },

  async addNotification(userId: string, title: string, message: string, type: AppNotification['type'] = 'system') {
    const notifs = getLocalCollection<AppNotification>('notifications');
    notifs.push({
      id: Math.random().toString(36).substr(2, 9),
      userId,
      title,
      message,
      timestamp: new Date().toISOString(),
      isRead: false,
      type
    });
    await this.saveNotifications(notifs);
  },

  async getProfile(userId: string): Promise<User | null> {
    const users = getLocalCollection<User>('registered_users');
    return users.find(u => u.id === userId) || null;
  },

  async saveProfile(user: User): Promise<void> {
    const users = getLocalCollection<User>('registered_users');
    const idx = users.findIndex(u => u.id === user.id);
    if (idx > -1) { users[idx] = user; await this.saveUsers(users); }
  },

  getClinicalSnapshot() {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('medi_') || key.startsWith('chat_'))) snapshot[key] = localStorage.getItem(key) || '';
    }
    return snapshot;
  },

  restoreClinicalSnapshot(snapshot: Record<string, string>) {
    Object.entries(snapshot).forEach(([key, value]) => localStorage.setItem(key, value));
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
      const defaults: User[] = [
        { id: 'doc-1', name: 'Dr. Sarah Jenkins', email: 'sarah.j@byinkshealth.com', role: UserRole.CONSULTANT, specialty: 'Cardiology', isApproved: true },
        { id: 'pharm-1', name: 'Global Pharma Hub', email: 'pharmacy@byinkshealth.com', role: UserRole.PHARMACY, isApproved: true },
        { id: 'dispatch-1', name: 'Swift Delivery Pro', email: 'dispatch@byinkshealth.com', role: UserRole.DISPATCH, isApproved: true },
        { id: 'admin-1', name: 'System Admin', email: 'admin@byinkshealth.com', role: UserRole.ADMIN, isApproved: true }
      ];
      this.saveUsers(defaults);
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

  async getAllUsers(): Promise<User[]> { return getLocalCollection<User>('registered_users'); },
  async getSyncRequests(): Promise<SyncRequest[]> { return getLocalCollection<SyncRequest>('sync_requests'); },
  async updateSyncRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    const requests = getLocalCollection<SyncRequest>('sync_requests');
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx > -1) { requests[idx] = { ...requests[idx], status }; saveLocalCollection('sync_requests', requests); }
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
  async updateUserStatus(userId: string, updates: Partial<User>): Promise<void> {
    const users = getLocalCollection<User>('registered_users');
    const idx = users.findIndex(u => u.id === userId);
    if (idx > -1) { users[idx] = { ...users[idx], ...updates }; await this.saveUsers(users); }
  }
};
