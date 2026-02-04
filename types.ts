
export enum UserRole {
  PATIENT = 'PATIENT',
  CONSULTANT = 'CONSULTANT',
  PHARMACY = 'PHARMACY',
  DISPATCH = 'DISPATCH',
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
  location?: {
    lat: number;
    lng: number;
  };
}

export interface MedicalReport {
  id: string;
  patientId: string;
  patientName: string;
  fileName: string;
  uploadDate: string;
  status: 'pending_review' | 'vetted' | 'rejected';
  consultantNote?: string;
  vettedBy?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  consultantId: string;
  consultantName: string;
  pharmacyId?: string;
  medications: string;
  dosage: string;
  date: string;
  status: 'draft' | 'sent_to_pharmacy' | 'preparing' | 'ready_for_dispatch' | 'dispatched' | 'delivered';
}

export interface DeliveryOrder {
  id: string;
  prescriptionId: string;
  patientId: string;
  pharmacyId: string;
  dispatchId?: string;
  status: 'pending' | 'assigned' | 'in_transit' | 'delivered';
  patientAddress: string;
  patientLocation?: { lat: number; lng: number };
  currentLocation?: { lat: number; lng: number };
  timestamp: string;
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
  type: 'reminder' | 'system' | 'billing' | 'delivery';
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'consultation' | 'subscription' | 'pharmacy';
  timestamp: string;
  description: string;
}

export interface SyncRequest {
  id: string;
  requesterEmail: string;
  deviceInfo: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}
