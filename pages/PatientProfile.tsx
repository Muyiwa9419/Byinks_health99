
import React, { useState, useEffect } from 'react';
import { User, Appointment, UserRole } from '../types';
import { Link } from 'react-router-dom';

interface PatientProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
}

const PatientProfile: React.FC<PatientProfileProps> = ({ user, onUpdateUser }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultants, setConsultants] = useState<User[]>([]);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);
  
  // Edit Profile State
  const [editData, setEditData] = useState<Partial<User>>({});

  const [newApp, setNewApp] = useState({
    consultantId: '',
    consultantName: '',
    date: '',
    time: '',
    notes: '',
    type: 'Telehealth'
  });

  const timeSlots = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];

  useEffect(() => {
    const stored = localStorage.getItem('medi_appointments');
    if (stored) {
      setAppointments(JSON.parse(stored).filter((a: Appointment) => a.patientId === user.id));
    }

    const storedUsers = localStorage.getItem('medi_registered_users');
    if (storedUsers) {
      const all: User[] = JSON.parse(storedUsers);
      setConsultants(all.filter(u => u.role === UserRole.CONSULTANT && u.isApproved));
    }
  }, [user.id]);

  useEffect(() => {
    // Initialize edit form with current user data
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
      fee: 45
    };

    saveAppointments([appointment, ...appointments]);
    closeBookingModal();
    alert("Consultation request submitted successfully!");
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser = { ...user, ...editData };
    onUpdateUser(updatedUser);
    setIsEditProfileOpen(false);
    alert("Profile updated successfully!");
  };

  const handleCancel = (id: string) => {
    if (window.confirm("Are you sure you want to cancel this appointment?")) {
      const updated = appointments.map(a => a.id === id ? { ...a, status: 'cancelled' as const } : a);
      saveAppointments(updated);
    }
  };

  const closeBookingModal = () => {
    setIsBookingOpen(false);
    setNewApp({ consultantId: '', consultantName: '', date: '', time: '', notes: '', type: 'Telehealth' });
  };

  const upcoming = appointments.filter(a => a.status !== 'completed' && a.status !== 'cancelled');
  const past = appointments.filter(a => a.status === 'completed' || a.status === 'cancelled');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link to="/dashboard" className="text-sm font-medium text-blue-600 flex items-center mb-2">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Health Profile</h1>
        </div>
        <button 
          onClick={() => setIsEditProfileOpen(true)}
          className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm"
        >
          Edit Profile
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
            <div className="px-6 pb-8 relative text-center">
              <div className="flex justify-center -mt-12 mb-4">
                <div className="w-24 h-24 bg-white rounded-[1.5rem] p-1 shadow-lg">
                  <div className="w-full h-full bg-blue-50 rounded-[1.2rem] flex items-center justify-center text-blue-600 font-bold text-3xl">
                    {user.name.charAt(0)}
                  </div>
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
              <p className="text-slate-500 text-sm mb-6">{user.email}</p>
              
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 text-left">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Blood Type</p>
                  <p className="text-sm font-bold text-slate-700">{user.bloodType || 'N/A'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Genotype</p>
                  <p className="text-sm font-bold text-slate-700">{user.genotype || 'N/A'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Height</p>
                  <p className="text-sm font-bold text-slate-700">{user.height ? `${user.height} cm` : 'N/A'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Weight</p>
                  <p className="text-sm font-bold text-slate-700">{user.weight ? `${user.weight} kg` : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Contact Records</h3>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Phone Number</p>
                <p className="text-sm font-bold text-slate-700">{user.phone || 'No phone registered'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Residential Address</p>
                <p className="text-sm font-bold text-slate-700 leading-tight">{user.address || 'No address registered'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Patient Age</p>
                <p className="text-sm font-bold text-slate-700">{user.age || 'N/A'} years old</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Appointments Queue</h2>
                <p className="text-xs text-slate-500 font-medium">Verified clinical sessions</p>
              </div>
              <button 
                onClick={() => setIsBookingOpen(true)}
                className="bg-blue-600 text-white text-xs font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-100 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                Book Session
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {upcoming.length > 0 ? upcoming.map((app) => (
                <div key={app.id} className="p-8 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center space-x-6">
                    <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[80px]">
                      <span className="text-[10px] font-black uppercase tracking-widest">{new Date(app.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-2xl font-black">{new Date(app.date).getDate()}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{app.consultantName}</h4>
                      <p className="text-xs text-slate-500 font-bold">{app.time} • {app.status.toUpperCase()}</p>
                    </div>
                  </div>
                  <button onClick={() => handleCancel(app.id)} className="p-3 text-slate-300 hover:text-red-500 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )) : (
                <div className="p-20 text-center text-slate-400 font-medium italic">No scheduled appointments.</div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <button 
              onClick={() => setShowPast(!showPast)}
              className="w-full p-8 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 transition"
            >
              <h2 className="text-xl font-bold text-slate-900">Clinical History</h2>
              <svg className={`w-5 h-5 transition-transform ${showPast ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showPast && (
              <div className="divide-y divide-slate-100 animate-in slide-in-from-top-2">
                {past.length > 0 ? past.map(app => (
                  <div key={app.id} className="p-8 flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <div className="bg-slate-100 text-slate-400 p-3 rounded-xl min-w-[64px] text-center">
                        <span className="text-[10px] font-black block">{new Date(app.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-xl font-black">{new Date(app.date).getDate()}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700">{app.consultantName}</h4>
                        <p className="text-xs text-slate-400">{app.status.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="p-12 text-center text-slate-400 italic">No archived records.</div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditProfileOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl relative z-10 p-10 animate-in zoom-in-95 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Modify Health Records</h3>
              <button onClick={() => setIsEditProfileOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Full Name</label>
                  <input required value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Age</label>
                  <input type="number" required value={editData.age} onChange={e => setEditData({...editData, age: parseInt(e.target.value)})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Blood Group</label>
                  <select required value={editData.bloodType} onChange={e => setEditData({...editData, bloodType: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                    <option value="A+">A+</option><option value="A-">A-</option>
                    <option value="B+">B+</option><option value="B-">B-</option>
                    <option value="O+">O+</option><option value="O-">O-</option>
                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Genotype</label>
                  <input required value={editData.genotype} onChange={e => setEditData({...editData, genotype: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Height (cm)</label>
                  <input required value={editData.height} onChange={e => setEditData({...editData, height: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Weight (kg)</label>
                  <input required value={editData.weight} onChange={e => setEditData({...editData, weight: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Phone</label>
                <input required value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Address</label>
                <textarea required value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none h-24 resize-none" />
              </div>
              <div className="flex space-x-4">
                <button type="button" onClick={() => setIsEditProfileOpen(false)} className="flex-grow py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">Discard</button>
                <button type="submit" className="flex-grow py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {isBookingOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeBookingModal}></div>
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg relative z-10 p-10 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900">Request Consultation</h3>
              <button onClick={closeBookingModal} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleBookAppointment} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Specialist</label>
                <select 
                  required 
                  value={newApp.consultantId} 
                  onChange={(e) => {
                    const doc = consultants.find(c => c.id === e.target.value);
                    setNewApp({...newApp, consultantId: e.target.value, consultantName: doc?.name || ''});
                  }} 
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select onboarded provider...</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.name} ({c.specialty})</option>)}
                </select>
                {consultants.length === 0 && (
                  <p className="text-[10px] text-red-500 mt-2 font-bold uppercase">No specialists currently verified by Admin.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Date</label>
                  <input 
                    type="date" 
                    required 
                    min={new Date().toISOString().split('T')[0]}
                    value={newApp.date} 
                    onChange={(e) => setNewApp({...newApp, date: e.target.value})} 
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Time Slot</label>
                  <select 
                    required 
                    value={newApp.time} 
                    onChange={(e) => setNewApp({...newApp, time: e.target.value})} 
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select time...</option>
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Consultation Notes (Optional)</label>
                <textarea 
                  placeholder="Describe your symptoms or reason for visit..." 
                  value={newApp.notes} 
                  onChange={(e) => setNewApp({...newApp, notes: e.target.value})} 
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl h-24 resize-none outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <button 
                type="submit" 
                disabled={consultants.length === 0}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition disabled:opacity-50"
              >
                Submit Consultation Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfile;
