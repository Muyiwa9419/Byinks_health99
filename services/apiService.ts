
import { createClient } from '@supabase/supabase-js';
import { User, Appointment, AppNotification, Transaction, UserRole } from '../types.ts';

/**
 * Clinical Cloud API Service
 * Powered by Supabase
 * 
 * Note: Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your environment.
 */

// Fallback to placeholder values to prevent the 'required' error during initialization
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE1OTgwNzEwMDAsImV4cCI6MTkwMzY0NzAwMH0.placeholder';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn("BYINKS HEALTH: Supabase credentials (URL/Key) are missing. Cloud features will be unavailable.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const ClinicalAPI = {
  isConfigured(): boolean {
    return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
  },

  // --- PROFILE OPERATIONS ---
  async getProfile(userId: string): Promise<User | null> {
    if (!this.isConfigured()) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) return null;
      return {
        ...data,
        isApproved: data.is_approved,
        bloodType: data.blood_type
      } as User;
    } catch (e) {
      return null;
    }
  },

  async saveProfile(user: User): Promise<void> {
    if (!this.isConfigured()) throw new Error("Cloud storage not configured.");
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        specialty: user.specialty,
        is_approved: user.isApproved ?? true,
        age: user.age,
        blood_type: user.bloodType,
        genotype: user.genotype,
        address: user.address,
        phone: user.phone
      });
    
    if (error) throw error;
  },

  async getConsultants(): Promise<User[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', UserRole.CONSULTANT)
        .eq('is_approved', true);
      
      if (error) return [];
      return data.map(d => ({ ...d, isApproved: d.is_approved, bloodType: d.blood_type })) as User[];
    } catch (e) {
      return [];
    }
  },

  // --- APPOINTMENT OPERATIONS ---
  async getAppointments(userId: string): Promise<Appointment[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .or(`patient_id.eq.${userId},consultant_id.eq.${userId}`)
        .order('date', { ascending: false });
      
      if (error) return [];
      return data.map(d => ({
        ...d,
        patientId: d.patient_id,
        consultantId: d.consultant_id,
        patientName: d.patient_name,
        consultantName: d.consultant_name,
        paymentStatus: d.payment_status
      })) as Appointment[];
    } catch (e) {
      return [];
    }
  },

  async createAppointment(app: Appointment): Promise<void> {
    if (!this.isConfigured()) throw new Error("Cloud storage not configured.");
    const { error } = await supabase
      .from('appointments')
      .insert({
        id: app.id,
        patient_id: app.patientId,
        patient_name: app.patientName,
        consultant_id: app.consultantId,
        consultant_name: app.consultantName,
        date: app.date,
        time: app.time,
        status: app.status,
        notes: app.notes,
        fee: app.fee,
        payment_status: 'pending'
      });
    
    if (error) throw error;
  },

  async updateAppointmentStatus(appId: string, status: Appointment['status']): Promise<void> {
    if (!this.isConfigured()) throw new Error("Cloud storage not configured.");
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', appId);
    
    if (error) throw error;
  },

  // --- NOTIFICATION OPERATIONS ---
  async getNotifications(userId: string): Promise<AppNotification[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });
      
      if (error) return [];
      return data.map(d => ({
        ...d,
        userId: d.user_id,
        isRead: d.is_read
      })) as AppNotification[];
    } catch (e) {
      return [];
    }
  },

  async pushNotification(notif: AppNotification): Promise<void> {
    if (!this.isConfigured()) return;
    const { error } = await supabase
      .from('notifications')
      .insert({
        id: notif.id,
        user_id: notif.userId,
        title: notif.title,
        message: notif.message,
        timestamp: notif.timestamp,
        is_read: notif.isRead,
        type: notif.type
      });
    
    if (error) throw error;
  },

  // --- CHAT OPERATIONS ---
  async getChatHistory(chatId: string): Promise<any[]> {
    if (!this.isConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });
      
      if (error) return [];
      return data;
    } catch (e) {
      return [];
    }
  },

  async sendChatMessage(msg: any): Promise<void> {
    if (!this.isConfigured()) throw new Error("Cloud storage not configured.");
    const { error } = await supabase
      .from('chat_messages')
      .insert(msg);
    if (error) throw error;
  }
};
