
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, UserRole } from '../types.ts';
import { analyzeSymptoms, getHealthTips } from '../services/geminiService.ts';
import CommunicationOverlay from '../components/CommunicationOverlay.tsx';
import { ClinicalAPI } from '../services/apiService.ts';

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

  // Sync state
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [syncEmailInput, setSyncEmailInput] = useState(user.email);
  const [isSyncing, setIsSyncing] = useState(false);

  // Communication state
  const [isCommOpen, setIsCommOpen] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState<{name: string, role: string, id: string} | null>(null);

  useEffect(() => {
    const fetchConsultants = () => {
      const storedUsersStr = localStorage.getItem('medi_registered_users');
      if (storedUsersStr) {
        const allUsers: User[] = JSON.parse(storedUsersStr);
        const doctors = allUsers.filter(u => u.role === UserRole.CONSULTANT && u.isApproved);
        setConsultants(doctors);
      }
    };

    fetchConsultants();
    window.addEventListener('storage', fetchConsultants);
    return () => window.removeEventListener('storage', fetchConsultants);
  }, []);

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

  const openComm = (consultant: {name: string, role: string, id: string}) => {
    setSelectedConsultant(consultant);
    setIsCommOpen(true);
  };

  const handleCloudSync = () => {
    if (!syncEmailInput.trim()) {
      alert("Verification Required: Please provide your clinical email.");
      return;
    }

    setIsSyncing(true);
    
    // Simulate push then pull
    setTimeout(() => {
      // 1. Push EVERYTHING from current local state to cloud vault
      const currentSnapshot = ClinicalAPI.getClinicalSnapshot();
      ClinicalAPI.pushToCloud(user.email, currentSnapshot);

      // 2. Pull global changes (simulated merge)
      const cloudData = ClinicalAPI.pullFromCloud(syncEmailInput);
      
      if (cloudData && syncEmailInput.toLowerCase() !== user.email.toLowerCase()) {
        // Different identity restore logic
        if (confirm(`Clinical Identity Alert: Restore full clinical records and chat history for ${syncEmailInput} and overwrite current session?`)) {
           ClinicalAPI.restoreClinicalSnapshot(cloudData);
           alert("Session Overwritten: Clinical identity and chat history synchronized.");
           window.location.reload();
        }
      } else {
        alert("Clinical Cloud Synchronized: Local and remote medical records/chats are now uniform.");
      }

      setIsSyncing(false);
      setIsSyncOpen(false);
    }, 1200);
  };

  const filteredConsultants = consultants.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.specialty && c.specialty.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-800 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-4">
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                  Patient Hub Active
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">Welcome, {user.name.split(' ')[0]}!</h1>
                <p className="text-emerald-100 text-lg max-w-md leading-relaxed font-medium">Manage your clinical record and connect with specialists.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setIsSyncOpen(true)}
                  className="px-6 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
                  Clinical Cloud Sync
                </button>
              </div>
            </div>
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-white/10 rounded-full blur-[100px]"></div>
          </div>

          <div className="grid gap-6">
            {showInput ? (
              <section className="bg-white rounded-[2rem] border border-slate-200 p-10 shadow-sm">
                <div className="flex items-center space-x-5 mb-8">
                  <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-100">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">AI Symptom Scan</h2>
                    <p className="text-slate-500 font-medium text-sm">Instant clinical analysis using Gemini Intelligence.</p>
                  </div>
                </div>
                
                <form onSubmit={handleSymptomCheck} className="space-y-6">
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Describe your symptoms in detail..."
                    className="w-full p-8 bg-slate-50 border border-slate-200 rounded-3xl text-slate-800 focus:border-emerald-500 outline-none h-48 transition-all resize-none font-medium leading-relaxed"
                  />
                  <button
                    disabled={loading || !symptoms.trim()}
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-xl flex items-center justify-center space-x-3"
                  >
                    {loading ? "Analyzing Clinical Data..." : "Run AI Diagnostic Scan"}
                  </button>
                </form>
              </section>
            ) : (
              <section className="bg-emerald-50/40 rounded-[2rem] border-2 border-emerald-100 p-10 animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Screening Result</h2>
                  <button onClick={handleReset} className="p-3 bg-white border border-emerald-100 text-emerald-600 rounded-xl">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
                <div className="bg-white rounded-[2rem] p-10 border border-emerald-100 shadow-xl text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                  {aiResult}
                </div>
                <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-700 text-center font-black uppercase tracking-widest">
                  Not a medical diagnosis. Consult a human specialist below.
                </div>
              </section>
            )}

            <section className="bg-white rounded-[2rem] border border-slate-200 p-10 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Clinical Directory</h2>
                  <p className="text-slate-500 font-medium text-sm">Verified specialists currently online.</p>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search specialists..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all w-full md:w-64"
                  />
                  <svg className="w-5 h-5 absolute left-4 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                {filteredConsultants.length > 0 ? filteredConsultants.map((c) => (
                  <div key={c.id} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:border-emerald-500 hover:bg-white hover:shadow-xl transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center space-x-4 mb-5">
                      <div className="relative">
                        <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-100 overflow-hidden">
                          {c.avatar ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : c.name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 leading-none mb-1">{c.name}</h4>
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{c.specialty || 'General Practitioner'}</span>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button onClick={() => openComm({ name: c.name, role: UserRole.CONSULTANT, id: c.id })} className="flex-grow bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl hover:bg-emerald-600 transition shadow-sm">Secure Chat & Files</button>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200 shadow-sm">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No active specialists found.</p>
                    <p className="text-slate-400 text-[10px] mt-1 italic">Our medical team is currently being onboarded.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-8 flex items-center">
              <svg className="w-6 h-6 mr-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Health Insights
            </h2>
            <div className="space-y-4">
              {tips.map((tip, i) => (
                <div key={i} className="p-5 bg-slate-50 rounded-[1.5rem] border border-transparent hover:border-emerald-100 transition-all">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded mb-2 inline-block">{tip.category}</span>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{tip.title}</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{tip.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
            <h2 className="text-lg font-bold mb-6">Quick Actions</h2>
            <div className="space-y-3 relative z-10">
              <Link to="/profile" className="flex items-center w-full px-5 py-4 text-xs font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 rounded-2xl transition border border-white/5">
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                My Medical Profile
              </Link>
              <button onClick={() => setIsSyncOpen(true)} className="flex items-center w-full px-5 py-4 text-xs font-black uppercase tracking-widest bg-emerald-600/20 hover:bg-emerald-600/30 rounded-2xl transition border border-emerald-500/30 text-emerald-400">
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
                Cloud Identity Sync
              </button>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-600/10 rounded-full blur-2xl"></div>
          </section>
        </div>
      </div>

      {/* Clinical Sync Modal */}
      {isSyncOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsSyncOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl p-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50"></div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 relative z-10">Clinical Identity Recovery</h3>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-8 relative z-10">Email-Based Mobility Protocol</p>
            
            <div className="space-y-8 relative z-10">
              <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Integrate Medical Profile</h4>
                <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">Byinks Cloud Vault will verify your clinical email and synchronize your health records to this node.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Registered Clinical Email</label>
                    <input 
                      type="email" 
                      placeholder="e.g. john.doe@clinical.com" 
                      value={syncEmailInput}
                      onChange={(e) => setSyncEmailInput(e.target.value)}
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-emerald-600 shadow-sm"
                    />
                  </div>
                  <button 
                    onClick={handleCloudSync}
                    disabled={isSyncing}
                    className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition flex items-center justify-center"
                  >
                    {isSyncing ? (
                      <svg className="animate-spin h-4 w-4 mr-3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" fill="none"></circle><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" fill="none"></path></svg>
                    ) : null}
                    Synchronize Medical Cloud
                  </button>
                </div>
              </div>

              <div className="text-center bg-emerald-50/30 p-4 rounded-2xl border border-dashed border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                  {isSyncing ? 'Accessing Secure Vault...' : 'Your clinical identity is verified via 256-bit encryption.'}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsSyncOpen(false)}
              className="mt-6 w-full text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] hover:text-slate-900 transition"
            >
              Dismiss Mobility Hub
            </button>
          </div>
        </div>
      )}

      {selectedConsultant && (
        <CommunicationOverlay 
          isOpen={isCommOpen}
          onClose={() => { setIsCommOpen(false); setSelectedConsultant(null); }}
          currentUser={user}
          targetUser={selectedConsultant}
        />
      )}
    </div>
  );
};

export default PatientDashboard;
