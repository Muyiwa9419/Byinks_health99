
import { createClient } from '@supabase/supabase-js';
import { User, Appointment, AppNotification, Transaction, UserRole, SyncRequest } from '../types.ts';

/**
 * Clinical Hybrid API Service
 * Primary: Supabase Cloud
 * Fallback: Local Persisted Simulation (Cloud Vault)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const getLocalCollection = <T>(key: string): T[] => JSON.parse(localStorage.getItem(`medi_${key}`) || '[]');
const saveLocalCollection = <T>(key: string, data: T[]) => {
  localStorage.setItem(`medi_${key}`, JSON.stringify(data));
  // Forces all active tabs and components to refresh their local state
  window.dispatchEvent(new Event('storage'));
};

export const ClinicalAPI = {
  isConfigured(): boolean {
    return !!supabase;
  },

  /**
   * Simulated Cloud Vault for Email-Only Sync
   */
  pushToCloud(email: string, payload: any) {
    const vault = JSON.parse(localStorage.getItem('medi_cloud_vault') || '{}');
    vault[email.toLowerCase()] = {
      ...payload,
      lastSync: new Date().toISOString()
    };
    localStorage.setItem('medi_cloud_vault', JSON.stringify(vault));
    window.dispatchEvent(new Event('storage'));
  },

  pullFromCloud(email: string) {
    const vault = JSON.parse(localStorage.getItem('medi_cloud_vault') || '{}');
    return vault[email.toLowerCase()] || null;
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

  // --- AUTH OPERATIONS ---
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
  },

  // --- PROFILE OPERATIONS ---
  async getProfile(userId: string): Promise<User | null> {
    return getLocalCollection<User>('registered_users').find(u => u.id === userId) || null;
  },

  async getAllUsers(): Promise<User[]> {
    return getLocalCollection<User>('registered_users');
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
    const requests = getLocalCollection<SyncRequest>('sync_requests');
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx > -1) {
      requests[idx].status = status;
      saveLocalCollection('sync_requests', requests);
    }
  }
};
