
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

let localUser: User | null = JSON.parse(localStorage.getItem('medi_local_session') || 'null');

const getLocalCollection = <T>(key: string): T[] => JSON.parse(localStorage.getItem(`medi_${key}`) || '[]');
const saveLocalCollection = <T>(key: string, data: T[]) => {
  localStorage.setItem(`medi_${key}`, JSON.stringify(data));
  // CRITICAL: Dispatch event to trigger UI updates in all active tabs/components
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
        {
          id: 'doc-1',
          name: 'Dr. Sarah Jenkins',
          email: 'sarah.j@byinkshealth.com',
          role: UserRole.CONSULTANT,
          specialty: 'Cardiology',
          isApproved: true,
          avatar: 'https://i.pravatar.cc/150?u=sarah'
        },
        {
          id: 'doc-2',
          name: 'Dr. Michael Chen',
          email: 'm.chen@byinkshealth.com',
          role: UserRole.CONSULTANT,
          specialty: 'Pediatrics',
          isApproved: true,
          avatar: 'https://i.pravatar.cc/150?u=michael'
        },
        {
          id: 'doc-3',
          name: 'Dr. Elena Rodriguez',
          email: 'elena.r@byinkshealth.com',
          role: UserRole.CONSULTANT,
          specialty: 'Neurology',
          isApproved: true,
          avatar: 'https://i.pravatar.cc/150?u=elena'
        },
        {
          id: 'admin-1',
          name: 'System Admin',
          email: 'admin@byinkshealth.com',
          role: UserRole.ADMIN,
          isApproved: true
        }
      ];
      saveLocalCollection('registered_users', defaultDoctors);
      
      const notifications: AppNotification[] = [
        {
          id: 'welcome-notif',
          userId: 'all',
          title: 'Welcome to Byinks Health',
          message: 'Our clinical specialists are now online and ready to assist you.',
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'system'
        }
      ];
      saveLocalCollection('notifications', notifications);
    }
  },

  // --- AUTH OPERATIONS ---
  async signUp(email: string, pass: string, profile: User): Promise<User> {
    if (this.isConfigured()) {
      const { data, error } = await supabase!.auth.signUp({ email, password: pass });
      if (error) throw error;
      const userWithId = { ...profile, id: data.user!.id };
      await this.saveProfile(userWithId);
      return userWithId;
    } else {
      const users = getLocalCollection<User>('registered_users');
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error("Email already registered locally.");
      const newUser = { ...profile, id: Math.random().toString(36).substr(2, 9) };
      users.push(newUser);
      saveLocalCollection('registered_users', users);
      localUser = newUser;
      localStorage.setItem('medi_local_session', JSON.stringify(localUser));
      return newUser;
    }
  },

  async adminCreateUser(profile: User): Promise<User> {
    if (this.isConfigured()) {
      const { error } = await supabase!.from('profiles').upsert({
        id: profile.id || Math.random().toString(36).substr(2, 9),
        name: profile.name,
        email: profile.email,
        role: profile.role,
        specialty: profile.specialty,
        is_approved: true,
      });
      if (error) throw error;
      return profile;
    } else {
      const users = getLocalCollection<User>('registered_users');
      const newUser = { ...profile, id: profile.id || Math.random().toString(36).substr(2, 9), isApproved: true };
      users.push(newUser);
      saveLocalCollection('registered_users', users);
      return newUser;
    }
  },

  async signIn(email: string, pass: string): Promise<User> {
    if (this.isConfigured()) {
      const { data, error } = await supabase!.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      const profile = await this.getProfile(data.user!.id);
      if (!profile) throw new Error("Cloud profile not found.");
      return profile;
    } else {
      const users = getLocalCollection<User>('registered_users');
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) throw new Error("Local identity not found.");
      localUser = user;
      localStorage.setItem('medi_local_session', JSON.stringify(localUser));
      return user;
    }
  },

  async signOut() {
    if (this.isConfigured()) await supabase!.auth.signOut();
    localUser = null;
    localStorage.removeItem('medi_local_session');
  },

  // --- PROFILE OPERATIONS ---
  async getProfile(userId: string): Promise<User | null> {
    if (this.isConfigured()) {
      const { data, error } = await supabase!.from('profiles').select('*').eq('id', userId).single();
      return error ? null : { ...data, isApproved: data.is_approved, bloodType: data.blood_type } as User;
    } else {
      return getLocalCollection<User>('registered_users').find(u => u.id === userId) || null;
    }
  },

  async getAllUsers(): Promise<User[]> {
    if (this.isConfigured()) {
      const { data, error } = await supabase!.from('profiles').select('*');
      return error ? [] : data.map(d => ({ ...d, isApproved: d.is_approved, bloodType: d.blood_type })) as User[];
    } else {
      return getLocalCollection<User>('registered_users');
    }
  },

  async saveProfile(user: User): Promise<void> {
    if (this.isConfigured()) {
      await supabase!.from('profiles').upsert({
        id: user.id, name: user.name, email: user.email, role: user.role,
        specialty: user.specialty, is_approved: user.isApproved ?? true,
        age: user.age, blood_type: user.bloodType, genotype: user.genotype,
        address: user.address, phone: user.phone
      });
    } else {
      const users = getLocalCollection<User>('registered_users');
      const idx = users.findIndex(u => u.id === user.id);
      if (idx > -1) users[idx] = user; else users.push(user);
      saveLocalCollection('registered_users', users);
    }
  },

  async updateUserStatus(userId: string, updates: Partial<User>): Promise<void> {
    if (this.isConfigured()) {
      await supabase!.from('profiles').update({
        role: updates.role,
        specialty: updates.specialty,
        is_approved: updates.isApproved
      }).eq('id', userId);
    } else {
      const users = getLocalCollection<User>('registered_users');
      const idx = users.findIndex(u => u.id === userId);
      if (idx > -1) {
        users[idx] = { ...users[idx], ...updates };
        saveLocalCollection('registered_users', users);
      }
    }
  },

  // --- SYNC REQUEST OPERATIONS ---
  async getSyncRequests(): Promise<SyncRequest[]> {
    if (this.isConfigured()) {
      const { data, error } = await supabase!.from('sync_requests').select('*');
      return error ? [] : data as SyncRequest[];
    } else {
      return getLocalCollection<SyncRequest>('sync_requests');
    }
  },

  async updateSyncRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    if (this.isConfigured()) {
      await supabase!.from('sync_requests').update({ status }).eq('id', requestId);
    } else {
      const requests = getLocalCollection<SyncRequest>('sync_requests');
      const idx = requests.findIndex(r => r.id === requestId);
      if (idx > -1) {
        requests[idx].status = status;
        saveLocalCollection('sync_requests', requests);
      }
    }
  }
};
