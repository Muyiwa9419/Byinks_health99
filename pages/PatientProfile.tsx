
import React, { useState, useEffect } from 'react';
import { User, Appointment, UserRole, ConsultantAvailability, AppNotification } from '../types';
import { Link } from 'react-router-dom';

interface PatientProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
}

const PatientProfile: React.FC<PatientProfileProps> = ({ user, onUpdateUser }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [consultants, setConsultants] = useState<User[]>([]);
  const [availabilities, setAvailabilities] = useState<ConsultantAvailability[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  
  const [editData, setEditData] = useState<Partial<User>>({});

  const [newApp, setNewApp] = useState({
    consultantId: '',
    consultantName: '',
    date: '',
    time: '',
    notes: '',
    type: 'Telehealth'
  });

  const SESSION_FEE = 45;
  const timeSlots = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];

  useEffect(() => {
    const stored = localStorage.getItem('medi_appointments');
    if (stored) {
      const parsed = JSON.parse(stored);
      setAllAppointments(parsed);
      setAppointments(parsed.filter((a: Appointment) => a.patientId === user.id));
    }

    const storedUsers = localStorage.getItem('medi_registered_users');
    if (storedUsers) {
      const all: User[] = JSON.parse(storedUsers);
      setConsultants(all.filter(u => u.role === UserRole.CONSULTANT && u.isApproved));
    }

    const storedAvail = localStorage.getItem('medi_availability');
    if (storedAvail) {
      setAvailabilities(JSON.parse(storedAvail));
    }
  }, [user.id]);

  useEffect(() => {
    setEditData({
      name: user.name,
      age: user.age,
      bloodType: user.bloodType,
      genotype: user.genotype,
      height: user.height,
      weight: user.weight,
      phone: user.phone,
      address: user.address
    });
  }, [user]);

  const saveAppointments = (updated: Appointment[]) => {
    const allStored = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const otherUsersApps = allStored.filter((a: Appointment) => a.patientId !== user.id);
    const final = [...otherUsersApps, ...updated];
    localStorage.setItem('medi_appointments', JSON.stringify(final));
    setAppointments(updated);
    setAllAppointments(final);
  };

  const addNotification = (userId: string, title: string, message: string, appId?: string) => {
    const notifications: AppNotification[] = JSON.parse(localStorage.getItem('medi_notifications') || '[]');
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      appId,
      title,
      message,
      timestamp: new Date().toISOString(),
      isRead: false,
      type: 'system'
    };
    notifications.push(newNotif);
    localStorage.setItem('medi_notifications', JSON.stringify(notifications));
    window.dispatchEvent(new Event('storage'));
  };

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApp.consultantId || !newApp.date || !newApp.time) {
      alert("Please select a consultant, date, and time.");
      return;
    }

    const appointment: Appointment = {
      id: Math.random().toString(36).substr(2, 9),
      patientId: user.id,
      patientName: user.name,
      consultantId: newApp.consultantId,
      consultantName: newApp.consultantName,
      date: newApp.date,
      time: newApp.time,
      status: 'pending',
      notes: newApp.notes,
      fee: SESSION_FEE,
      paymentStatus: 'pending'
    };

    saveAppointments([appointment, ...appointments]);
    
    // Notify Consultant
    addNotification(
      newApp.consultantId,
      'New Appointment Request',
      `${user.name} has requested a consultation on ${newApp.date} at ${newApp.time}.`,
      appointment.id
    );

    closeBookingModal();
    alert(`Appointment requested. Please note a $${SESSION_FEE} fee is payable after your session.`);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser = { ...user, ...editData };
    onUpdateUser(updatedUser);
    setIsEditProfileOpen(false);
  };

  const handleCancel = (id: string) => {
    if (window.confirm("Are you sure you want to cancel this appointment?")) {
      const updated = appointments.map(a => a.id === id ? { ...a, status: 'cancelled' as const } : a);
      saveAppointments(updated);
      
      const app = appointments.find(a => a.id === id);
      if (app) {
        addNotification(
          app.consultantId,
          'Appointment Cancelled',
          `${user.name} has cancelled their appointment for ${app.date}.`
        );
      }
    }
  };

  const closeBookingModal = () => {
    setIsBookingOpen(false);
    setNewApp({ consultantId: '', consultantName: '', date: '', time: '', notes: '', type: 'Telehealth' });
  };

  const upcoming = appointments.filter(a => a.status !== 'completed' && a.status !== 'cancelled');

  // Filter available slots based on consultant's blocks and existing appointments
  const getFilteredSlots = () => {
    if (!newApp.consultantId || !newApp.date) return timeSlots;
    
    const consultantAvail = availabilities.find(a => a.consultantId === newApp.consultantId);
    const blocked = consultantAvail?.blockedSlots[newApp.date] || [];
    const booked = allAppointments
      .filter(a => a.consultantId === newApp.consultantId && a.date === newApp.date && (a.status === 'confirmed' || a.status === 'pending'))
      .map(a => a.time);
    
    return timeSlots.filter(t => !blocked.includes(t) && !booked.includes(t));
  };

  const filteredSlots = getFilteredSlots();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500 pt-24">
      <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Link to="/dashboard" className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center mb-4 hover:translate-x-[-4px] transition-transform">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Command Dashboard
          </Link>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Clinical Records</h1>
        </div>
        <button 
          onClick={() => setIsEditProfileOpen(true)}
          className="bg-white border-2 border-slate-100 px-10 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-emerald-600 hover:text-emerald-600 transition-all shadow-xl shadow-slate-200/40"
        >
          Update Profile Node
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="space-y-10">
          <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
            <div className="h-40 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800"></div>
            <div className="px-10 pb-12 relative text-center">
              <div className="flex justify-center -mt-20 mb-8">
                <div className="w-40 h-40 bg-white rounded-[3rem] p-3 shadow-2xl ring-8 ring-emerald-50">
                  <div className="w-full h-full bg-emerald-50 rounded-[2.5rem] flex items-center justify-center text-emerald-600 font-black text-5xl">
                    {user.name.charAt(0)}
                  </div>
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">{user.name}</h2>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mb-10">{user.email}</p>
              
              <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-10 text-left">
                <div className="p-6 bg-slate-50 rounded-[2rem]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Blood Type</p>
                  <p className="text-lg font-black text-slate-900">{user.bloodType || 'N/A'}</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-[2rem]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Genotype</p>
                  <p className="text-lg font-black text-slate-900">{user.genotype || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-12">
          <section className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
            <div className="p-12 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center bg-slate-50/30 gap-6">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Active Schedule</h2>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Verified & Pending Clinical Sessions</p>
              </div>
              <button 
                onClick={() => setIsBookingOpen(true)}
                className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-10 py-5 rounded-[1.5rem] hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-200 flex items-center"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                Book Session
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {upcoming.length > 0 ? upcoming.map((app) => (
                <div key={app.id} className="p-12 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
                  <div className="flex items-center space-x-10">
                    <div className="bg-emerald-50 text-emerald-600 p-8 rounded-[2.5rem] flex flex-col items-center justify-center min-w-[120px] border border-emerald-100 shadow-inner group-hover:scale-110 transition-transform">
                      <span className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">{new Date(app.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-4xl font-black">{new Date(app.date).getDate()}</span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-2xl mb-2">Dr. {app.consultantName}</h4>
                      <div className="flex items-center space-x-4">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg">{app.time}</span>
                        <span className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          app.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleCancel(app.id)} className="p-5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )) : (
                <div className="p-40 text-center text-slate-300 font-black uppercase tracking-[0.3em] text-xs italic">
                  No active clinical schedule found.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Profile Edit Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsEditProfileOpen(false)}></div>
          <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-2xl relative z-10 p-16 animate-in zoom-in-95 duration-500">
            <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-10">Update Clinical Identity</h3>
            <form onSubmit={handleSaveProfile} className="space-y-8">
               <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Name</label>
                   <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none focus:border-emerald-600 transition" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Protocol</label>
                   <input type="text" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none focus:border-emerald-600 transition" />
                 </div>
               </div>
               <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Blood</label>
                    <input type="text" value={editData.bloodType} onChange={e => setEditData({...editData, bloodType: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none focus:border-emerald-600 transition" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Genotype</label>
                    <input type="text" value={editData.genotype} onChange={e => setEditData({...editData, genotype: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none focus:border-emerald-600 transition" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                    <input type="number" value={editData.age} onChange={e => setEditData({...editData, age: parseInt(e.target.value)})} className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none focus:border-emerald-600 transition" />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Residence Address</label>
                  <textarea value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none h-32 resize-none focus:border-emerald-600 transition" />
               </div>
               <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition shadow-2xl">Confirm Updates</button>
            </form>
          </div>
        </div>
      )}

      {/* Booking Modal with Availability Checks */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={closeBookingModal}></div>
          <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-2xl relative z-10 p-16 animate-in zoom-in-95 duration-500">
            <div className="flex justify-between items-start mb-12">
              <div>
                <h3 className="text-4xl font-black text-slate-900 tracking-tight">Request Session</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Select specialist and clinical slot</p>
              </div>
              <button onClick={closeBookingModal} className="p-4 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-[1.5rem] transition">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleBookAppointment} className="space-y-10">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Preferred Specialist</label>
                <select 
                  required 
                  value={newApp.consultantId} 
                  onChange={(e) => {
                    const doc = consultants.find(c => c.id === e.target.value);
                    setNewApp({...newApp, consultantId: e.target.value, consultantName: doc?.name || '', time: ''});
                  }} 
                  className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-emerald-600 transition font-black text-slate-900 appearance-none"
                >
                  <option value="">Select Onboarded Provider...</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>Dr. {c.name} ({c.specialty})</option>)}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Session Date</label>
                  <input type="date" required min={new Date().toISOString().split('T')[0]} value={newApp.date} onChange={(e) => setNewApp({...newApp, date: e.target.value, time: ''})} className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-emerald-600 transition font-black" />
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Clinical Slot</label>
                  <select required disabled={!newApp.date || !newApp.consultantId} value={newApp.time} onChange={(e) => setNewApp({...newApp, time: e.target.value})} className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-emerald-600 transition font-black appearance-none disabled:opacity-30">
                    <option value="">Select Slot...</option>
                    {filteredSlots.map(t => <option key={t} value={t}>{t}</option>)}
                    {newApp.date && newApp.consultantId && filteredSlots.length === 0 && <option disabled>No availability for this date</option>}
                  </select>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-[2.5rem] p-10 border-2 border-emerald-100">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.3em]">Financial Summary</span>
                  <span className="text-4xl font-black text-emerald-600">${SESSION_FEE}.00</span>
                </div>
                <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-tight leading-relaxed max-w-sm">
                  Consultation fee is authorized <span className="underline decoration-emerald-300">post-session</span>. Booking confirms specialist resource allocation.
                </p>
              </div>

              <button type="submit" disabled={consultants.length === 0 || !newApp.time} className="w-full bg-emerald-600 text-white py-8 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-emerald-200 hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50">
                Finalize Session Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfile;
