
import React, { useState, useEffect } from 'react';
import { User, UserRole, Appointment } from '../types';
import { summarizePatientHistory } from '../services/geminiService';
import CommunicationOverlay from '../components/CommunicationOverlay';

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

  // Communication state
  const [isCommOpen, setIsCommOpen] = useState(false);
  const [commMode, setCommMode] = useState<'chat' | 'video'>('chat');

  // Sync data from localStorage
  useEffect(() => {
    const fetchData = () => {
      // 1. Fetch Appointments
      const storedApps = localStorage.getItem('medi_appointments');
      if (storedApps) {
        const all = JSON.parse(storedApps);
        // Filter by current consultant's ID or Name
        setAppointments(all.filter((a: Appointment) => a.consultantId === user.id || a.consultantName.includes(user.name)));
      }

      // 2. Discover Real Patients from Chat History and Registered Users
      const registeredUsersStr = localStorage.getItem('medi_registered_users') || '[]';
      const registeredUsers: User[] = JSON.parse(registeredUsersStr);
      const patients = registeredUsers.filter(u => u.role === UserRole.PATIENT);

      const discoveredPatients: ChatPatient[] = [];
      
      // Scan localStorage keys for chat history involving this consultant
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
      
      // Also include patients who have appointments with this doctor even if no chat yet
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
    const interval = setInterval(fetchData, 3000); 
    return () => clearInterval(interval);
  }, [user.id, user.name, appointments.length]);

  const updateAppStatus = (id: string, status: Appointment['status']) => {
    const all = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const updated = all.map((a: Appointment) => a.id === id ? { ...a, status } : a);
    localStorage.setItem('medi_appointments', JSON.stringify(updated));
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

  const openComm = (mode: 'chat' | 'video') => {
    if (!selectedPatient) return;
    setCommMode(mode);
    setIsCommOpen(true);
  };

  const pending = appointments.filter(a => a.status === 'pending');
  const confirmed = appointments.filter(a => a.status === 'confirmed');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dr. {user.name}</h1>
          <div className="flex items-center mt-2 space-x-3">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-100">
              {user.specialty || 'Medical Consultant'}
            </span>
            <span className="flex items-center text-xs font-bold text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              On Duty
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-white px-6 py-4 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Queue</span>
            <span className="text-xl font-black text-amber-600">{pending.length}</span>
          </div>
          <div className="bg-white px-6 py-4 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confirmed</span>
            <span className="text-xl font-black text-blue-600">{confirmed.length}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Sidebar: Patient Roster */}
        <div className="lg:col-span-4 space-y-8">
          {/* Incoming Appointment Requests */}
          <section className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm overflow-hidden">
            <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center">
              <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Clinical Intake
            </h2>
            <div className="space-y-4">
              {pending.length > 0 ? pending.map((app) => (
                <div key={app.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-left-2">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{app.patientName}</h4>
                      <p className="text-[11px] text-slate-500 font-medium uppercase mt-0.5">{app.date} • {app.time}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => updateAppStatus(app.id, 'confirmed')}
                      className="flex-grow bg-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                    >
                      Accept
                    </button>
                    <button 
                      onClick={() => updateAppStatus(app.id, 'cancelled')}
                      className="px-4 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 py-2.5 rounded-xl transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-[1.5rem]">
                  <p className="text-xs text-slate-400 font-medium italic">Intake queue empty</p>
                </div>
              )}
            </div>
          </section>

          {/* Active Conversations (Real Patients) */}
          <section className="bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-white/5">
            <h2 className="text-[11px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-6">Active Consultations</h2>
            <div className="space-y-3">
              {activeChatPatients.length > 0 ? activeChatPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPatient(p); setSummary(''); }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center space-x-4 ${
                    selectedPatient?.id === p.id 
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/40 translate-x-2' 
                      : 'bg-white/5 border-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                    selectedPatient?.id === p.id ? 'bg-white/20' : 'bg-slate-800'
                  }`}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="font-bold text-sm truncate">{p.name}</div>
                    <div className={`text-[10px] font-medium truncate ${
                      selectedPatient?.id === p.id ? 'text-indigo-100' : 'text-slate-500'
                    }`}>
                      {p.lastMessage}
                    </div>
                  </div>
                </button>
              )) : (
                <div className="py-12 text-center opacity-30">
                  <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  <p className="text-xs font-bold uppercase tracking-widest">No Active Chats</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Workspace: Communication & AI Panel */}
        <div className="lg:col-span-8">
          {selectedPatient ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm h-full flex flex-col animate-in zoom-in-95 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-8 border-b border-slate-100 gap-6">
                <div className="flex items-center space-x-5">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400 text-2xl border border-slate-200">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">{selectedPatient.name}</h2>
                    <p className="text-slate-500 font-medium text-sm">{selectedPatient.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => openComm('video')} 
                    className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 shadow-sm"
                    title="Start Video Consultation"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                  <button 
                    onClick={() => openComm('chat')} 
                    className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 shadow-sm"
                    title="Open Secure Chat"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </button>
                  <button
                    onClick={() => handleSummarize(selectedPatient.lastMessage || 'No recent symptoms reported.')}
                    disabled={loading}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition shadow-xl disabled:opacity-50 flex items-center"
                  >
                    {loading ? (
                      <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : null}
                    Generate Clinical Context
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-10 flex-grow mb-12">
                <div>
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Patient Reported Events</h3>
                  <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 text-slate-700 leading-relaxed text-sm min-h-[250px] shadow-inner font-medium italic">
                    {selectedPatient.lastMessage || 'Consultation history pending...'}
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-4">Gemini Insight Engine</h3>
                  {summary ? (
                    <div className="p-8 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 text-slate-800 font-medium animate-in fade-in duration-500 min-h-[250px] text-sm leading-relaxed shadow-sm">
                       {summary}
                    </div>
                  ) : (
                    <div className="min-h-[250px] flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-400 italic text-xs p-10 text-center space-y-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <p>Use the AI Summary tool to analyze recent patient interactions and medical patterns.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Session Observations
                </h3>
                <textarea 
                  className="w-full p-6 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none h-32 transition text-slate-700 resize-none text-sm font-medium"
                  placeholder="Clinical notes for the current session..."
                />
                <div className="mt-6 flex space-x-3">
                  <button className="flex-grow bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition shadow-xl shadow-indigo-100">Sync with Medical Record</button>
                  <button className="px-8 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition">Discard</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-20 shadow-sm h-full flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-indigo-50 text-indigo-400 rounded-3xl flex items-center justify-center mb-10 shadow-xl shadow-indigo-100/50 transform -rotate-12">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Patient Care Center</h3>
              <p className="text-slate-500 max-w-sm leading-relaxed text-sm font-medium">
                Select an active patient consultation from the roster to start a secure video call, chat, or analyze their reported medical symptoms.
              </p>
            </div>
          )}
        </div>
      </div>

      {selectedPatient && (
        <CommunicationOverlay 
          isOpen={isCommOpen}
          onClose={() => setIsCommOpen(false)}
          currentUser={user}
          targetUser={{ name: selectedPatient.name, role: 'Patient', id: selectedPatient.id }}
          mode={commMode}
        />
      )}
    </div>
  );
};

export default ConsultantDashboard;
