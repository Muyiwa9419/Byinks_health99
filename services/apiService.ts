
import { User, Appointment, AppNotification, Transaction, UserRole } from '../types.ts';

/**
 * Clinical API Service Layer
 * 
 * To migrate to a real backend (Supabase/Firebase/Node.js):
 * 1. Replace the internal logic of these functions with fetch() or SDK calls.
 * 2. The rest of the application will continue to work without changes.
 */

const KEYS = {
  USERS: 'medi_registered_users',
  APPOINTMENTS: 'medi_appointments',
  NOTIFICATIONS: 'medi_notifications',
  TRANSACTIONS: 'medi_transactions',
  AVAILABILITY: 'medi_availability',
  AUDIT_LOGS: 'medi_audit_logs'
};

const getLocal = <T>(key: string, fallback: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : fallback;
};

const setLocal = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
  // Critical for cross-tab sync on the same device
  window.dispatchEvent(new Event('storage'));
};

export const ClinicalAPI = {
  // --- USER OPERATIONS ---
  async getUsers(): Promise<User[]> {
    return getLocal<User[]>(KEYS.USERS, []);
  },

  async saveUser(user: User): Promise<void> {
    const users = await this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index > -1) {
      users[index] = user;
    } else {
      users.push(user);
    }
    setLocal(KEYS.USERS, users);
  },

  async getConsultants(): Promise<User[]> {
    const users = await this.getUsers();
    return users.filter(u => u.role === UserRole.CONSULTANT && u.isApproved);
  },

  // --- APPOINTMENT OPERATIONS ---
  async getAppointments(userId?: string): Promise<Appointment[]> {
    const all = getLocal<Appointment[]>(KEYS.APPOINTMENTS, []);
    if (!userId) return all;
    return all.filter(a => a.patientId === userId || a.consultantId === userId);
  },

  async createAppointment(app: Appointment): Promise<void> {
    const all = await this.getAppointments();
    all.push(app);
    setLocal(KEYS.APPOINTMENTS, all);
  },

  async updateAppointmentStatus(appId: string, status: Appointment['status']): Promise<void> {
    const all = await this.getAppointments();
    const index = all.findIndex(a => a.id === appId);
    if (index > -1) {
      all[index].status = status;
      setLocal(KEYS.APPOINTMENTS, all);
    }
  },

  // --- NOTIFICATION OPERATIONS ---
  async getNotifications(userId: string): Promise<AppNotification[]> {
    const all = getLocal<AppNotification[]>(KEYS.NOTIFICATIONS, []);
    return all.filter(n => n.userId === userId);
  },

  async pushNotification(notif: AppNotification): Promise<void> {
    const all = getLocal<AppNotification[]>(KEYS.NOTIFICATIONS, []);
    all.push(notif);
    setLocal(KEYS.NOTIFICATIONS, all);
  },

  // --- SYSTEM OPERATIONS ---
  async pushAuditLog(log: any): Promise<void> {
    const all = getLocal<any[]>(KEYS.AUDIT_LOGS, []);
    all.unshift(log);
    setLocal(KEYS.AUDIT_LOGS, all.slice(0, 100));
  }
};
