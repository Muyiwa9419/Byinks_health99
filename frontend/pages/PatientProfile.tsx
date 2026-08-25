
import React, { useState, useEffect } from 'react';
import { User, Appointment, UserRole, AppNotification } from '../types.ts';
import { useNavigate, useParams } from 'react-router-dom';
import { ClinicalAPI } from '../services/apiService.ts';

interface PatientProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
}

const PatientProfile: React.FC<PatientProfileProps> = ({ user: currentUser, onUpdateUser }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultants, setConsultants] = useState<User[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isReschedulingOpen, setIsReschedulingOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  const [editData, setEditData] = useState<Partial<User>>({});
  const [newApp, setNewApp] = useState({
    consultantId: '',
    date: '',
    time: '',
    notes: ''
  });

  const [rescheduleApp, setRescheduleApp] = useState<Appointment | null>(null);

  const timeSlots = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];

  useEffect(() => {
    const fetchPortalData = async () => {
      let profile: User | null = null;
      if (id && id !== currentUser.id) {
        profile = await ClinicalAPI.getProfile(id);
      } else {
        profile = currentUser;
      }
      
      setTargetUser(profile);
      if (profile) setEditData(profile);

      if (profile) {
  try {
    const backendAppointments =
      await ClinicalAPI.getAppointments({
        patientId: profile.id,
      });

    setAppointments(backendAppointments);
  } catch (error) {
    console.error(
      'Failed to load appointments from backend:',
      error
    );

    setAppointments([]);
  }
}

      const storedUsers = localStorage.getItem('medi_registered_users');
      if (storedUsers) {
        const all: User[] = JSON.parse(storedUsers);
        setConsultants(all.filter(u => u.role === UserRole.CONSULTANT && u.isApproved));
      }
    };

    fetchPortalData();
    window.addEventListener('storage', fetchPortalData);
    return () => window.removeEventListener('storage', fetchPortalData);
  }, [id, currentUser]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetUser) {
      const updated = { ...targetUser, ...editData };
      onUpdateUser(updated);
      setTargetUser(updated);
      setIsEditProfileOpen(false);
    }
  };

  const syncLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser infrastructure.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        if (targetUser) {
          const updated = { ...targetUser, location };
          await ClinicalAPI.updateUserStatus(targetUser.id, { location });
          onUpdateUser(updated);
          setTargetUser(updated);
          setIsLocating(false);
          alert("Clinical coordinates synchronized. Dispatchers can now locate you for delivery.");
        }
      },
      (error) => {
        console.error("Location sync failed:", error);
        setIsLocating(false);
        alert("Failed to establish GPS uplink. Please ensure location permissions are granted.");
      },
      { enableHighAccuracy: true }
    );
  };

  const addNotification = async (userId: string, title: string, message: string) => {
    const notifications: AppNotification[] = JSON.parse(localStorage.getItem('medi_notifications') || '[]');
    notifications.push({
      id: Math.random().toString(36).substr(2, 9),
      userId,
      title,
      message,
      timestamp: new Date().toISOString(),
      isRead: false,
      type: 'system'
    });
    await ClinicalAPI.saveNotifications(notifications);
  };

  const handleCancelAppointment = async (appId: string) => {
    if (!confirm("Clinical Protocol: Are you sure you want to cancel this engagement? The specialist will be notified.")) return;

    const allApps: Appointment[] = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const idx = allApps.findIndex((a: Appointment) => a.id === appId);
    if (idx > -1) {
      const app = allApps[idx];
      app.status = 'cancelled';
      await ClinicalAPI.saveAppointments(allApps);
      
      addNotification(
        app.consultantId,
        'Appointment Cancelled by Patient',
        `${targetUser?.name} has cancelled their session scheduled for ${app.date} at ${app.time}.`
      );
    }
  };

  const handleDeleteAppointment = async (appId: string) => {
    if (!confirm("Clinical Record Purge: Are you sure you want to permanently remove this appointment from your history? This action cannot be undone.")) return;

    const allApps: Appointment[] = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const filteredApps = allApps.filter((a: Appointment) => a.id !== appId);
    await ClinicalAPI.saveAppointments(filteredApps);
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleApp || !targetUser) return;

    const allApps: Appointment[] = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const idx = allApps.findIndex((a: Appointment) => a.id === rescheduleApp.id);
    if (idx > -1) {
      const oldDate = allApps[idx].date;
      const oldTime = allApps[idx].time;
      
      allApps[idx] = { ...rescheduleApp, status: 'pending' };
      await ClinicalAPI.saveAppointments(allApps);

      addNotification(
        rescheduleApp.consultantId,
        'Appointment Rescheduled',
        `${targetUser.name} moved their session from ${oldDate} at ${oldTime} to ${rescheduleApp.date} at ${rescheduleApp.time}.`
      );

      setIsReschedulingOpen(false);
      setRescheduleApp(null);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
  e.preventDefault();

  if (
    !newApp.consultantId ||
    !newApp.date ||
    !newApp.time ||
    !targetUser
  ) {
    return;
  }

  const consultant = consultants.find(
    c => c.id === newApp.consultantId
  );

  if (!consultant) {
    alert('Consultant not found.');
    return;
  }

  try {
    // Create the appointment in the backend/PostgreSQL
    const appointment = await ClinicalAPI.createAppointment({
      consultantId: consultant.id,
      date: newApp.date,
      time: newApp.time,
      notes: newApp.notes || '',
      fee: 45,
    } as Omit<Appointment, 'id'>);

    console.log(
      '[appointment] Created successfully:',
      appointment
    );

    // Refresh appointments from the backend
    const refreshedAppointments =
      await ClinicalAPI.getAppointments({
        patientId: targetUser.id,
      });

    setAppointments(refreshedAppointments);

    // Notify consultant
    await addNotification(
      consultant.id,
      'New Appointment Request',
      `${targetUser.name} requested an appointment for ${newApp.date} at ${newApp.time}.`
    );

    setIsBookingOpen(false);

    setNewApp({
      consultantId: '',
      date: '',
      time: '',
      notes: '',
    });

    alert('Appointment booked successfully.');

  } catch (error) {
    console.error(
      '[appointment] Booking failed:',
      error
    );

    alert(
      error instanceof Error
        ? error.message
        : 'Failed to book appointment. Please try again.'
    );
  }
};

    

  if (!targetUser) return <div className="p-20 text-center font-black text-slate-300">Identity Not Found</div>;

  const isOwnProfile = currentUser.id === targetUser.id;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-8">
        <div className="flex items-center space-x-8">
          <div className="w-24 h-24 bg-emerald-600 rounded-[2.5rem] flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-emerald-200">
            {targetUser.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">{targetUser.name}</h1>
            <p className="text-slate-500 font-bold mt-1">{targetUser.email}</p>
            <div className="flex space-x-3 mt-4">
               <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100">Patient Profile</span>
               <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200">Verified Identity</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          {isOwnProfile && (
            <button 
              onClick={syncLocation}
              disabled={isLocating}
              className={`px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100 flex items-center space-x-3 ${isLocating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg className={`w-4 h-4 ${isLocating ? 'animate-spin' : 'animate-pulse'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span>{isLocating ? 'Synchronizing...' : 'Sync Live Location'}</span>
            </button>
          )}
          {isOwnProfile && (
            <button 
              onClick={() => setIsEditProfileOpen(true)}
              className="px-8 py-4 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-emerald-600 hover:text-emerald-600 transition shadow-sm"
            >
              Edit Records
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-8">
          <section className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/40">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-8">Clinical Vitals</h2>
            <div className="space-y-6">
              {[
                { label: 'Age', value: targetUser.age + ' Years' },
                { label: 'Blood Group', value: targetUser.bloodType },
                { label: 'Genotype', value: targetUser.genotype },
                { label: 'GPS Coordinates', value: targetUser.location ? `${targetUser.location.lat.toFixed(4)}, ${targetUser.location.lng.toFixed(4)}` : 'No Uplink', highlight: !!targetUser.location },
                { label: 'Phone', value: targetUser.phone },
                { label: 'Address', value: targetUser.address },
                { label: 'Emergency Name', value: targetUser.emergencyContactName, highlight: true },
                { label: 'Emergency Phone', value: targetUser.emergencyContactPhone, highlight: true }
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${item.highlight ? 'text-emerald-600' : 'text-slate-400'}`}>{item.label}</span>
                  <span className={`text-sm font-bold ${item.highlight ? 'text-emerald-700' : 'text-slate-900'}`}>{item.value || 'Not Set'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 mb-6">Patient Documents</h2>
            <div className="space-y-3">
              <button className="w-full flex items-center p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition group">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="text-xs font-black uppercase tracking-widest">Lab Report Sync</span>
              </button>
            </div>
          </section>
        </div>

        <div className="lg:col-span-2">
          <section className="bg-white rounded-[3.5rem] border border-slate-100 p-10 shadow-xl shadow-slate-200/40">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Clinical Engagements</h2>
              {isOwnProfile && (
                <button 
                  onClick={() => setIsBookingOpen(true)}
                  className="bg-emerald-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100"
                >
                  New Appointment
                </button>
              )}
            </div>

            <div className="space-y-6">
              {appointments.length > 0 ? [...appointments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((app) => (
                <div key={app.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:bg-white hover:border-emerald-200 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center space-x-6">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-emerald-50 transition">
                      <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900">Dr. {app.consultantName}</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{app.date} • {app.time}</p>
                      <div className="flex items-center space-x-3 mt-2">
                        <span className="text-[9px] font-black text-slate-900 bg-slate-200/50 px-2 py-0.5 rounded-md">${app.fee || 45}</span>
                        <span className={`text-[8px] font-black uppercase tracking-widest flex items-center ${app.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${app.paymentStatus === 'paid' ? 'bg-emerald-600' : 'bg-amber-500 animate-pulse'}`}></span>
                          {app.paymentStatus || 'pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                      app.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      app.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      app.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      {app.status}
                    </span>
                    
                    {isOwnProfile && (
                      <div className="flex items-center gap-2">
                        {app.status !== 'cancelled' && app.status !== 'completed' && (
                          <>
                            <button 
                              onClick={() => { setRescheduleApp(app); setIsReschedulingOpen(true); }}
                              className="px-5 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-emerald-600 hover:text-emerald-600 transition"
                            >
                              Reschedule
                            </button>
                            <button 
                              onClick={() => handleCancelAppointment(app.id)}
                              className="px-5 py-2 bg-white border border-slate-200 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:border-red-500 hover:bg-red-50 transition"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        
                        <button 
                          onClick={() => handleDeleteAppointment(app.id)}
                          className="p-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-red-500 hover:border-red-200 transition"
                          title="Delete from History"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}

                    {app.status === 'confirmed' && isOwnProfile && (
                      <button 
                        onClick={() => navigate('/dashboard')}
                        className="flex-grow md:flex-none px-6 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition"
                      >
                        Enter Session
                      </button>
                    )}
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200 shadow-sm">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No clinical records found in the portal</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsEditProfileOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-[3.5rem] shadow-2xl p-10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Clinical Record Update</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Age</label>
                  <input type="number" value={editData.age || ''} onChange={(e) => setEditData({...editData, age: parseInt(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Blood Group</label>
                  <input value={editData.bloodType || ''} onChange={(e) => setEditData({...editData, bloodType: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Personal Phone</label>
                <input value={editData.phone || ''} onChange={(e) => setEditData({...editData, phone: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition" />
              </div>
              
              <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 space-y-4">
                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Emergency Protocols</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Contact Name</label>
                    <input required value={editData.emergencyContactName || ''} onChange={(e) => setEditData({...editData, emergencyContactName: e.target.value})} className="w-full px-5 py-4 bg-white border-2 border-emerald-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition shadow-sm" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Contact Phone</label>
                    <input required value={editData.emergencyContactPhone || ''} onChange={(e) => setEditData({...editData, emergencyContactPhone: e.target.value})} className="w-full px-5 py-4 bg-white border-2 border-emerald-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition shadow-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Residential Address</label>
                <textarea value={editData.address || ''} onChange={(e) => setEditData({...editData, address: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none h-24 resize-none focus:border-emerald-600 transition" />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition shadow-xl">
                Update Clinical Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsBookingOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[3.5rem] shadow-2xl p-10">
            <h3 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Clinical Engagement</h3>
            <form onSubmit={handleBookAppointment} className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Select Specialist</label>
                <select 
                  required 
                  value={newApp.consultantId} 
                  onChange={(e) => setNewApp({...newApp, consultantId: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition"
                >
                  <option value="">Select Consultant</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>Dr. {c.name} ({c.specialty})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Preferred Date</label>
                  <input type="date" required value={newApp.date} onChange={(e) => setNewApp({...newApp, date: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Preferred Time</label>
                  <select required value={newApp.time} onChange={(e) => setNewApp({...newApp, time: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition">
                    <option value="">Select Time</option>
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition shadow-xl">
                Authorize Appointment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rescheduling Modal */}
      {isReschedulingOpen && rescheduleApp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsReschedulingOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[3.5rem] shadow-2xl p-10">
            <h3 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Modify Engagement</h3>
            <form onSubmit={handleRescheduleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">New Date</label>
                  <input type="date" required value={rescheduleApp.date} onChange={(e) => setRescheduleApp({...rescheduleApp, date: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">New Time</label>
                  <select required value={rescheduleApp.time} onChange={(e) => setRescheduleApp({...rescheduleApp, time: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition">
                    <option value="">Select Time</option>
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition shadow-xl">
                Update Schedule
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfile;
