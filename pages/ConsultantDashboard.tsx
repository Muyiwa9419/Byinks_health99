
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Appointment, ConsultantAvailability, AppNotification } from '../types.ts';
import { summarizePatientHistory } from '../services/geminiService.ts';
import CommunicationOverlay from '../components/CommunicationOverlay.tsx';

interface ConsultantDashboardProps {
  user: User;
}

interface ChatPatient {
  id: string;
  name: string;
  email: string;
  lastMessage?: string;
}

const ConsultantDashboard: React.FC<ConsultantDashboardProps> = ({ user }) => {
  const [selectedPatient, setSelectedPatient] = useState<ChatPatient | null>(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeChatPatients, setActiveChatPatients] = useState<ChatPatient[]>([]);
  const [availability, setAvailability] = useState<ConsultantAvailability>({ consultantId: user.id, blockedSlots: {} });

  // Calendar state
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]);

  // Communication state
  const [isCommOpen, setIsCommOpen] = useState(false);

  const timeSlots = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];

  // Sync data from localStorage
  useEffect(() => {
    const fetchData = () => {
      // 1. Fetch Appointments
      const storedApps = localStorage.getItem('medi_appointments');
      if (storedApps) {
        const all = JSON.parse(storedApps);
        setAppointments(all.filter((a: Appointment) => a.consultantId === user.id));
      }

      // 2. Fetch Availability
      const storedAvail = localStorage.getItem('medi_availability');
      if (storedAvail) {
        const allAvail: ConsultantAvailability[] = JSON.parse(storedAvail);
        const myAvail = allAvail.find(a => a.consultantId === user.id);
        if (myAvail) setAvailability(myAvail);
      }

      // 3. Discover Real Patients from Chat History and Registered Users
      const registeredUsersStr = localStorage.getItem('medi_registered_users') || '[]';
      const registeredUsers: User[] = JSON.parse(registeredUsersStr);
      const patients = registeredUsers.filter(u => u.role === UserRole.PATIENT);

      const discoveredPatients: ChatPatient[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('chat_') && key.includes(user.id)) {
          const parts = key.replace('chat_', '').split('--');
          const patientId = parts.find(p => p !== user.id);
          const patientRecord = patients.find(p => p.id === patientId);
          
          if (patientRecord) {
            const history = JSON.parse(localStorage.getItem(key) || '[]');
            discoveredPatients.push({
              id: patientRecord.id,
              name: patientRecord.name,
              email: patientRecord.email,
              lastMessage: history.length > 0 ? history[history.length - 1].text : 'No messages yet'
            });
          }
        }
      }
      
      appointments.forEach(app => {
        if (!discoveredPatients.find(p => p.id === app.patientId)) {
          const patientRecord = patients.find(p => p.id === app.patientId);
          if (patientRecord) {
            discoveredPatients.push({
              id: patientRecord.id,
              name: patientRecord.name,
              email: patientRecord.email,
              lastMessage: 'Appointment Scheduled'
            });
          }
        }
      });

      setActiveChatPatients(discoveredPatients);
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, [user.id, appointments.length]);

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

  const toggleSlot = (time: string) => {
    const dateStr = selectedDay;
    const currentBlocked = availability.blockedSlots[dateStr] || [];
    let newBlocked: string[];

    if (currentBlocked.includes(time)) {
      newBlocked = currentBlocked.filter(t => t !== time);
    } else {
      newBlocked = [...currentBlocked, time];
    }

    const newAvailability = {
      ...availability,
      blockedSlots: {
        ...availability.blockedSlots,
        [dateStr]: newBlocked
      }
    };

    setAvailability(newAvailability);
    const storedAvail: ConsultantAvailability[] = JSON.parse(localStorage.getItem('medi_availability') || '[]');
    const index = storedAvail.findIndex(a => a.consultantId === user.id);
    if (index > -1) {
      storedAvail[index] = newAvailability;
    } else {
      storedAvail.push(newAvailability);
    }
    localStorage.setItem('medi_availability', JSON.stringify(storedAvail));
  };

  const updateAppStatus = (id: string, status: Appointment['status']) => {
    const all = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const appIndex = all.findIndex((a: Appointment) => a.id === id);
    if (appIndex > -1) {
      const app = all[appIndex];
      app.status = status;
      localStorage.setItem('medi_appointments', JSON.stringify(all));
      
      // Notify Patient
      const statusLabel = status === 'confirmed' ? 'Accepted' : 'Cancelled';
      addNotification(
        app.patientId,
        `Appointment ${statusLabel}`,
        `Dr. ${user.name} has ${statusLabel.toLowerCase()} your appointment for ${app.date} at ${app.time}.`,
        app.id
      );
    }
  };

  const handleSummarize = async (history: string) => {
    setLoading(true);
    setSummary('');
    try {
      const result = await summarizePatientHistory(history);
      setSummary(result || '');
    } catch (err) {
      setSummary("Error generating AI clinical summary.");
    } finally {
      setLoading(false);
    }
  };

  const openComm = () => {
    if (!selectedPatient) return;
    setIsCommOpen(true);
  };

  // Calendar Helpers
  const daysInMonth = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  }, [viewDate]);

  const calendarDays = useMemo(() => {
    const arr = [];
    for (let i = 0; i < daysInMonth.firstDay; i++) arr.push(null);
    for (let i = 1; i <= daysInMonth.days; i++) arr.push(i);
    return arr;
  }, [daysInMonth]);

  const changeMonth = (offset: number) => {
    const next = new Date(viewDate);
    next.setMonth(next.getMonth() + offset);
    setViewDate(next);
  };

  const getAppointmentsForDay = (day: number | null) => {
    if (!day) return [];
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toISOString().split('T')[0];
    return appointments.filter(a => a.date === d && a.status === 'confirmed');
  };

  const pending = appointments.filter(a => a.status === 'pending');
  const confirmedForSelected = appointments.filter(a => a.date === selectedDay && a.status === 'confirmed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Clinical Workspace</h1>
          <div className="flex items-center mt-2 space-x-3">
            <span className="px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
              {user.specialty || 'Medical Specialist'}
            </span>
            <span className="flex items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50/50 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
              Clinical Node Online
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-white px-8 py-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Queue</span>
            <span className="text-2xl font-black text-amber-500">{pending.length}</span>
          </div>
          <div className="bg-white px-8 py-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Confirmed</span>
            <span className="text-2xl font-black text-emerald-600">{appointments.filter(a => a.status === 'confirmed').length}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Calendar & Availability */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/40">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">Medical Schedule</h2>
              <div className="flex space-x-2">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>

            <div className="text-center mb-6">
              <h3 className="text-lg font-black text-slate-900">
                {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-4">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                <div key={d} className="text-[10px] font-black text-slate-300 text-center uppercase">{d}</div>
              ))}
              {calendarDays.map((day, idx) => {
                const isSelected = day && new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toISOString().split('T')[0] === selectedDay;
                const hasApps = day && getAppointmentsForDay(day).length > 0;
                
                return (
                  <button
                    key={idx}
                    disabled={!day}
                    onClick={() => day && setSelectedDay(new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toISOString().split('T')[0])}
                    className={`h-12 rounded-2xl flex flex-col items-center justify-center text-xs font-bold transition-all relative ${
                      !day ? 'bg-transparent' : 
                      isSelected ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-110 z-10' : 
                      'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                    }`}
                  >
                    {day}
                    {hasApps && !isSelected && <span className="absolute bottom-1.5 w-1 h-1 bg-emerald-400 rounded-full"></span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-10 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Slots for {new Date(selectedDay).toLocaleDateString()}</h4>
              <div className="grid grid-cols-2 gap-3">
                {timeSlots.map(time => {
                  const isBlocked = availability.blockedSlots[selectedDay]?.includes(time);
                  const isBooked = confirmedForSelected.find(a => a.time === time);
                  
                  return (
                    <button
                      key={time}
                      disabled={!!isBooked}
                      onClick={() => toggleSlot(time)}
                      className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                        isBooked ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50' :
                        isBlocked ? 'bg-red-50 border-red-100 text-red-500' :
                        'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                      }`}
                    >
                      {time}
                      <span className="block mt-1 opacity-50">
                        {isBooked ? 'Booked' : isBlocked ? 'Unavailable' : 'Available'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Pending Requests */}
          <section className="bg-slate-900 rounded-[3rem] p-8 shadow-2xl text-white overflow-hidden relative">
            <div className="relative z-10">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 mb-8 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Pending Intake
              </h2>
              <div className="space-y-4">
                {pending.length > 0 ? pending.map((app) => (
                  <div key={app.id} className="p-6 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-md animate-in slide-in-from-left-4">
                    <div className="mb-4">
                      <h4 className="font-black text-white text-base">{app.patientName}</h4>
                      <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mt-1">{app.date} • {app.time}</p>
                    </div>
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => updateAppStatus(app.id, 'confirmed')}
                        className="flex-grow bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest py-3.5 rounded-xl hover:bg-emerald-500 transition shadow-xl shadow-emerald-900/40"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => updateAppStatus(app.id, 'cancelled')}
                        className="px-4 bg-white/5 border border-white/10 text-white/40 hover:text-red-400 hover:border-red-400/30 py-3.5 rounded-xl transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest italic">Intake stream empty</p>
                  </div>
                )}
              </div>
            </div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl"></div>
          </section>
        </div>

        {/* Right Column: Interaction Hub */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[3.5rem] border border-slate-100 p-10 shadow-xl shadow-slate-200/40 min-h-[800px] flex flex-col">
            
            {/* Horizontal Patient Roster */}
            <div className="mb-12">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Patient Stream</h3>
              <div className="flex space-x-6 overflow-x-auto pb-4 custom-scrollbar">
                {activeChatPatients.length > 0 ? activeChatPatients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPatient(p); setSummary(''); }}
                    className={`flex-shrink-0 group p-6 rounded-[2.5rem] border transition-all duration-500 flex flex-col items-center text-center w-48 ${
                      selectedPatient?.id === p.id 
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-2xl shadow-emerald-200 scale-105' 
                        : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-white hover:border-emerald-200 hover:shadow-xl'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-black text-2xl mb-4 transition-transform group-hover:rotate-6 ${
                      selectedPatient?.id === p.id ? 'bg-white/20' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {p.name.charAt(0)}
                    </div>
                    <div className="font-black text-sm truncate w-full mb-1">{p.name}</div>
                    <div className={`text-[9px] font-bold uppercase tracking-widest truncate w-full ${
                      selectedPatient?.id === p.id ? 'text-emerald-100' : 'text-slate-400'
                    }`}>
                      {p.lastMessage || 'New Session'}
                    </div>
                  </button>
                )) : (
                  <div className="w-full py-12 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">No active patient sessions discovered</p>
                  </div>
                )}
              </div>
            </div>

            {selectedPatient ? (
              <div className="flex-grow flex flex-col animate-in zoom-in-95 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 pb-10 border-b border-slate-50 gap-8">
                  <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center font-black text-emerald-600 text-3xl border border-emerald-100 shadow-inner">
                      {selectedPatient.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tight">{selectedPatient.name}</h2>
                      <p className="text-slate-500 font-bold text-sm mt-1">{selectedPatient.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <button 
                      onClick={openComm} 
                      className="bg-slate-900 text-white px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition-all shadow-xl flex items-center"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                      Secure Communication Hub
                    </button>
                    <button
                      onClick={() => handleSummarize(selectedPatient.lastMessage || 'No recent clinical input available.')}
                      disabled={loading}
                      className="bg-white border border-slate-200 text-slate-900 px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:border-emerald-600 hover:text-emerald-600 transition-all shadow-sm flex items-center"
                    >
                      {loading && (
                        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      )}
                      Sync AI Context
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-12 flex-grow mb-12">
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Patient Dialogue History</h3>
                    <div className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100 text-slate-700 leading-relaxed text-sm min-h-[300px] shadow-inner font-medium italic relative">
                      <div className="absolute top-6 right-8 opacity-10">
                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.987z"/></svg>
                      </div>
                      {selectedPatient.lastMessage || 'Initial clinical encounter records...'}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Clinical Intelligence Summary</h3>
                    {summary ? (
                      <div className="p-10 bg-emerald-50/50 rounded-[3rem] border border-emerald-100 text-slate-800 font-medium animate-in fade-in duration-1000 min-h-[300px] text-sm leading-relaxed shadow-sm relative">
                         <div className="absolute top-6 right-8 opacity-20 text-emerald-600">
                           <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                         </div>
                         {summary}
                      </div>
                    ) : (
                      <div className="min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[3rem] text-slate-400 italic text-xs p-12 text-center space-y-6 bg-slate-50/30">
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm">
                          <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <p className="max-w-[200px] leading-relaxed">Activate AI Context Engine to synthesize clinical input and history patterns.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl overflow-hidden relative">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em] mb-6 flex items-center relative z-10">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Scribe Notes & Observations
                  </h3>
                  <textarea 
                    className="w-full p-8 bg-white/5 border border-white/10 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none h-40 transition text-white placeholder-slate-600 resize-none text-sm font-medium relative z-10 backdrop-blur-md"
                    placeholder="Document clinical session findings, diagnosis recommendations, and next steps..."
                  />
                  <div className="mt-8 flex space-x-4 relative z-10">
                    <button className="flex-grow bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-emerald-500 transition shadow-xl shadow-emerald-950/40">Authorize Medical Sync</button>
                    <button className="px-10 bg-white/5 border border-white/10 text-white/60 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition">Archive Draft</button>
                  </div>
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl"></div>
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-20 animate-in fade-in duration-1000">
                <div className="w-32 h-32 bg-emerald-50 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mb-12 shadow-xl shadow-emerald-100 transform -rotate-12 hover:rotate-0 transition-transform duration-700">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h3 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">Clinical Care Command</h3>
                <p className="text-slate-500 max-w-md leading-relaxed text-base font-medium">
                  The clinical stream is currently quiet. Select a patient from your stream above or check the intake queue to initiate a new session.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPatient && (
        <CommunicationOverlay 
          isOpen={isCommOpen}
          onClose={() => setIsCommOpen(false)}
          currentUser={user}
          targetUser={{ name: selectedPatient.name, role: 'Patient', id: selectedPatient.id }}
        />
      )}
    </div>
  );
};

export default ConsultantDashboard;
