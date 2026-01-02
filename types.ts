
export enum UserRole {
  PATIENT = 'PATIENT',
  CONSULTANT = 'CONSULTANT',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  specialty?: string;
  avatar?: string;
  isApproved?: boolean;
  // Medical & Contact Info for Patients
  age?: number;
  bloodType?: string;
  genotype?: string;
  height?: string;
  weight?: string;
  phone?: string;
  address?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  consultantId: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  patientName: string;
  consultantName: string;
  paymentStatus?: 'pending' | 'paid';
  fee?: number;
}

export interface ConsultantAvailability {
  consultantId: string;
  blockedSlots: {
    [date: string]: string[]; // date string (YYYY-MM-DD) -> array of time strings
  };
}

export interface AppNotification {
  id: string;
  userId: string;
  appId?: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  type: 'reminder' | 'system' | 'billing';
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'consultation' | 'subscription';
  timestamp: string;
  description: string;
}

export interface HealthMetric {
  label: string;
  value: number;
  unit: string;
  change: number;
}
