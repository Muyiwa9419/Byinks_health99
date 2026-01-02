
import { createClient } from '@supabase/supabase-js';
import { User, Appointment, AppNotification, Transaction, UserRole } from '../types.ts';

/**
 * Clinical Hybrid API Service
 * Primary: Supabase Cloud
 * Fallback: Local Persisted Simulation (if credentials missing)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Initialize Supabase only if configured
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Mock Auth State for Local Mode
let localUser: User | null = JSON.parse(localStorage.getItem('medi_local_session') || 'null');

const getLocalCollection = <T>(key: string): T[] => JSON.parse(localStorage.getItem(`medi_${key}`) || '[]');
const saveLocalCollection = <T>(key: string, data: T[]) => localStorage.setItem(`medi_${key}`, JSON.stringify(data));

export const ClinicalAPI = {
  isConfigured(): boolean {
    return !!supabase;
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
      if (users.find(u => u.email === email)) throw new Error("Email already registered locally.");
      const newUser = { ...profile, id: Math.random().toString(36).substr(2, 9) };
      users.push(newUser);
      saveLocalCollection('registered_users', users);
      localUser = newUser;
      localStorage.setItem('medi_local_session', JSON.stringify(localUser));
      return newUser;
    }
  },

  async adminCreateUser(profile: User): Promise<User> {
    // In a real cloud app, this would use a service role or invite flow. 
    // Here we simulate administrative account provisioning.
    if (this.isConfigured()) {
      // Create profile entry. Actual auth happens via invite in real Supabase apps.
      const { error } = await supabase!.from('profiles').upsert({
        id: profile.id || Math.random().toString(36).substr(2, 9),
        name: profile.name,
        email: profile.email,
        role: profile.role,
        specialty: profile.specialty,
        is_approved: true, // Admin-created accounts are auto-approved
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
      if (!user) throw new Error("Local identity not found. Please register.");
      localUser = user;
      localStorage.setItem('medi_local_session', JSON.stringify(localUser));
      return user;
    }
  },

  async signOut() {
    if (this.isConfigured()) {
      await supabase!.auth.signOut();
    }
    localUser = null;
    localStorage.removeItem('medi_local_session');
  },

  // --- PROFILE OPERATIONS ---
  async getProfile(userId: string): Promise<User | null> {
    if (this.isConfigured()) {
      const { data, error } = await supabase!.from('profiles').select('*').eq('id', userId).single();
      if (error) return null;
      return { ...data, isApproved: data.is_approved, bloodType: data.blood_type } as User;
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
      const { error } = await supabase!.from('profiles').upsert({
        id: user.id, name: user.name, email: user.email, role: user.role,
        specialty: user.specialty, is_approved: user.isApproved ?? true,
        age: user.age, blood_type: user.bloodType, genotype: user.genotype,
        address: user.address, phone: user.phone
      });
      if (error) throw error;
    } else {
      const users = getLocalCollection<User>('registered_users');
      const idx = users.findIndex(u => u.id === user.id);
      if (idx > -1) users[idx] = user; else users.push(user);
      saveLocalCollection('registered_users', users);
    }
  },

  async updateUserStatus(userId: string, updates: Partial<User>): Promise<void> {
    if (this.isConfigured()) {
      const { error } = await supabase!
        .from('profiles')
        .update({
          role: updates.role,
          specialty: updates.specialty,
          is_approved: updates.isApproved
        })
        .eq('id', userId);
      if (error) throw error;
    } else {
      const users = getLocalCollection<User>('registered_users');
      const idx = users.findIndex(u => u.id === userId);
      if (idx > -1) {
        users[idx] = { ...users[idx], ...updates };
        saveLocalCollection('registered_users', users);
      }
    }
  },

  async getConsultants(): Promise<User[]> {
    if (this.isConfigured()) {
      const { data, error } = await supabase!.from('profiles').select('*').eq('role', UserRole.CONSULTANT).eq('is_approved', true);
      return error ? [] : data.map(d => ({ ...d, isApproved: d.is_approved, bloodType: d.blood_type })) as User[];
    } else {
      return getLocalCollection<User>('registered_users').filter(u => u.role === UserRole.CONSULTANT && u.isApproved);
    }
  },

  // --- APPOINTMENT OPERATIONS ---
  async getAppointments(userId: string): Promise<Appointment[]> {
    if (this.isConfigured()) {
      const { data, error } = await supabase!.from('appointments').select('*').or(`patient_id.eq.${userId},consultant_id.eq.${userId}`).order('date', { ascending: false });
      return error ? [] : data.map(d => ({ ...d, patientId: d.patient_id, consultantId: d.consultant_id, patientName: d.patient_name, consultantName: d.consultant_name, paymentStatus: d.payment_status })) as Appointment[];
    } else {
      return getLocalCollection<Appointment>('appointments').filter(a => a.patientId === userId || a.consultantId === userId);
    }
  },

  async createAppointment(app: Appointment): Promise<void> {
    if (this.isConfigured()) {
      const { error } = await supabase!.from('appointments').insert({
        id: app.id, patient_id: app.patientId, patient_name: app.patientName,
        consultant_id: app.consultantId, consultant_name: app.consultantName,
        date: app.date, time: app.time, status: app.status, notes: app.notes,
        fee: app.fee, payment_status: 'pending'
      });
      if (error) throw error;
    } else {
      const apps = getLocalCollection<Appointment>('appointments');
      apps.push(app);
      saveLocalCollection('appointments', apps);
    }
  },

  async updateAppointmentStatus(appId: string, status: Appointment['status']): Promise<void> {
    if (this.isConfigured()) {
      await supabase!.from('appointments').update({ status }).eq('id', appId);
    } else {
      const apps = getLocalCollection<Appointment>('appointments');
      const idx = apps.findIndex(a => a.id === appId);
      if (idx > -1) apps[idx].status = status;
      saveLocalCollection('appointments', apps);
    }
  },

  // --- NOTIFICATION OPERATIONS ---
  async getNotifications(userId: string): Promise<AppNotification[]> {
    if (this.isConfigured()) {
      const { data, error } = await supabase!.from('notifications').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
      return error ? [] : data.map(d => ({ ...d, userId: d.user_id, isRead: d.is_read })) as AppNotification[];
    } else {
      return getLocalCollection<AppNotification>('notifications').filter(n => n.userId === userId);
    }
  },

  async pushNotification(notif: AppNotification): Promise<void> {
    if (this.isConfigured()) {
      await supabase!.from('notifications').insert({
        id: notif.id, user_id: notif.userId, title: notif.title,
        message: notif.message, timestamp: notif.timestamp, is_read: notif.isRead, type: notif.type
      });
    } else {
      const notifs = getLocalCollection<AppNotification>('notifications');
      notifs.push(notif);
      saveLocalCollection('notifications', notifs);
    }
  }
};
