
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, UserRole } from '../types.ts';
import { analyzeSymptoms, getHealthTips } from '../services/geminiService.ts';
import CommunicationOverlay from '../components/CommunicationOverlay.tsx';

interface PatientDashboardProps {
  user: User;
}

const PatientDashboard: React.FC<PatientDashboardProps> = ({ user }) => {
  const [symptoms, setSymptoms] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [tips, setTips] = useState<any[]>([]);
  const [showInput, setShowInput] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [consultants, setConsultants] = useState<User[]>([]);

  // Communication state
  const [isCommOpen, setIsCommOpen] = useState(false);
  const [commMode, setCommMode] = useState<'chat' | 'video'>('chat');
  const [selectedConsultant, setSelectedConsultant] = useState<{name: string, role: string, id: string} | null>(null);

  // Sync consultants from the system database
  useEffect(() => {
    const fetchConsultants = () => {
      const storedUsersStr = localStorage.getItem('medi_registered_users');
      if (storedUsersStr) {
        const allUsers: User[] = JSON.parse(storedUsersStr);
        // Only show approved medical consultants
        const doctors = allUsers.filter(u => u.role === UserRole.CONSULTANT && u.isApproved);
        setConsultants(doctors);
      }
    };

    fetchConsultants();
    // Listen for storage changes in case an admin adds a doctor in another tab
    window.addEventListener('storage', fetchConsultants);
    return () => window.removeEventListener('storage', fetchConsultants);
  }, []);

  const filteredConsultants = consultants.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.specialty && c.specialty.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    const fetchTips = async () => {
      try {
        const result = await getHealthTips();
        setTips(result);
      } catch (err) {
        console.error("Failed to fetch tips", err);
      }
    };
    fetchTips();
  }, []);

  const handleSymptomCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAiResult('');
    try {
      const result = await analyzeSymptoms(symptoms);
      setAiResult(result || '');
      setShowInput(false);
    } catch (err) {
      setAiResult("Error analyzing symptoms. Please try again or consult a doctor immediately.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSymptoms('');
    setAiResult('');
    setShowInput(true);
  };

  const openComm = (mode: 'chat' | 'video', consultant: {name: string, role: string, id: string}) => {
    setCommMode(mode);
    setSelectedConsultant(consultant);
    setIsCommOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Enhanced Welcome Card */}
          <div className="bg-gradient-to-br from-indigo-700 via-blue-600 to-indigo-800 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-4">
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                  Connected to Clinical Network
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">Hello, {user.name.split(' ')[0]}!</h1>
                <p className="text-blue-100 text-lg max-w-md leading-relaxed font-medium">Your healthcare team is ready. Select an onboarded specialist below to start your consultation.</p>
              </div>
            </div>
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-white/10 rounded-full blur-[100px] transition-all group-hover:scale-110 duration-700"></div>
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px]"></div>
          </div>

          {/* AI Diagnostic Lab */}
          <div className="grid gap-6">
            {showInput ? (
              <section className="bg-white rounded-[2rem] border border-slate-200 p-10 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="flex items-center space-x-5">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">AI Symptom Scan</h2>
                      <p className="text-slate-500 font-medium text-sm">Powered by Gemini for preliminary medical insights.</p>
                    </div>
                  </div>
                </div>
                
                <form onSubmit={handleSymptomCheck} className="space-y-6 relative z-10">
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Describe your symptoms in detail (e.g., persistent cough, sharp lower back pain)..."
                    className="w-full p-8 bg-slate-50 border border-slate-200 rounded-3xl text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none h-48 transition-all resize-none font-medium leading-relaxed shadow-inner"
                  />
                  <button
                    disabled={loading || !symptoms.trim()}
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all transform active:scale-[0.98] shadow-2xl flex items-center justify-center space-x-3"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-3">
                        <svg className="animate-spin h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="tracking-wide">AI Analysis in Progress...</span>
                      </div>
                    ) : (
                      <>
                        <span className="tracking-wide">Start Symptom Analysis</span>
                        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </section>
            ) : (
              <section className="bg-indigo-50/40 rounded-[2rem] border-2 border-indigo-100 p-10 shadow-sm animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center space-x-5">
                    <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">Analysis Result</h2>
                      <p className="text-indigo-500 font-bold text-xs uppercase tracking-widest">Preliminary Screening</p>
                    </div>
                  </div>
                  <button onClick={handleReset} className="p-3 bg-white border border-indigo-100 text-indigo-400 hover:text-indigo-600 rounded-xl transition shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
                <div className="bg-white rounded-[2rem] p-10 border border-indigo-100 shadow-xl">
                  <div className="text-slate-700 whitespace-pre-wrap leading-relaxed font-medium text-lg italic">
                    {aiResult}
                  </div>
                </div>
                <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-700 text-center font-bold uppercase tracking-widest">
                  Disclaimer: This is not a diagnosis. Please contact an official specialist below.
                </div>
              </section>
            )}

            {/* Clinical Directory - Real Data From Admin */}
            <section className="bg-white rounded-[2rem] border border-slate-200 p-10 shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Onboarded Specialists</h2>
                  <p className="text-slate-500 font-medium text-sm">Consultants verified by hospital administration.</p>
                </div>
                <div className="relative flex-grow max-w-xs">
                  <input 
                    type="text" 
                    placeholder="Search specialists..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                {filteredConsultants.length > 0 ? filteredConsultants.map((c) => (
                  <div key={c.id} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:border-indigo-200 hover:bg-white hover:shadow-xl transition-all duration-300 group">
                    <div className="flex items-center space-x-4 mb-5">
                      <div className="w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center text-white font-bold text-xl ring-4 ring-white">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition truncate max-w-[140px]">{c.name}</h4>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em]">{c.specialty || 'General Practitioner'}</span>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => openComm('chat', { name: c.name, role: UserRole.CONSULTANT, id: c.id })}
                        className="flex-grow bg-white border border-slate-200 text-slate-700 py-3 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        Secure Chat
                      </button>
                      <button 
                        onClick={() => openComm('video', { name: c.name, role: UserRole.CONSULTANT, id: c.id })}
                        className="p-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <h3 className="text-slate-900 font-bold mb-1">No Active Specialists</h3>
                    <p className="text-slate-400 text-sm font-medium">Please wait for hospital administrators to onboard clinical staff.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Dynamic Sidebar */}
        <div className="space-y-8">
          <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-8 flex items-center">
              <svg className="w-6 h-6 mr-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Health Intelligence
            </h2>
            <div className="space-y-5">
              {tips.length > 0 ? tips.map((tip, i) => (
                <div key={i} className="group p-6 bg-slate-50 rounded-[1.5rem] border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">{tip.category}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-2">{tip.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">{tip.description}</p>
                </div>
              )) : (
                <div className="space-y-4">
                  {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-50 rounded-[1.5rem] animate-pulse"></div>)}
                </div>
              )}
            </div>
          </section>

          <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <h2 className="text-lg font-bold mb-6 relative z-10">Care Resources</h2>
            <div className="grid gap-3 relative z-10">
              <Link to="/profile" className="flex items-center w-full px-5 py-4 text-sm font-bold bg-white/5 hover:bg-white/10 rounded-2xl transition border border-white/5 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center mr-4 group-hover:scale-110 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                My Clinical Records
              </Link>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-2xl"></div>
          </section>
        </div>
      </div>

      {/* Real-time Interaction Interface */}
      {selectedConsultant && (
        <CommunicationOverlay 
          isOpen={isCommOpen}
          onClose={() => { setIsCommOpen(false); setSelectedConsultant(null); }}
          currentUser={user}
          targetUser={selectedConsultant}
          mode={commMode}
        />
      )}
    </div>
  );
};

export default PatientDashboard;
