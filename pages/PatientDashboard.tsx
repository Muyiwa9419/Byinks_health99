
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, UserRole, MedicalReport, Prescription, DeliveryOrder, ChatThread } from '../types.ts';
import { analyzeSymptoms, getHealthTips } from '../services/geminiService.ts';
import CommunicationOverlay from '../components/CommunicationOverlay.tsx';
import { ClinicalAPI } from '../services/apiService.ts';

interface PatientDashboardProps {
  user: User;
}

const TreatmentTimeline: React.FC<{ prescriptions: Prescription[]; deliveries: DeliveryOrder[] }> = ({ prescriptions, deliveries }) => {
  if (prescriptions.length === 0) return null;

  // Track the most recent active treatment
  const latestPrescription = [...prescriptions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const activeDelivery = deliveries.find(d => d.prescriptionId === latestPrescription.id);

  const stages = [
    { label: 'Consultation', status: 'completed' },
    { label: 'Prescription', status: latestPrescription ? 'completed' : 'pending' },
    { 
      label: 'Pharmacy', 
      status: ['preparing', 'ready_for_dispatch', 'dispatched', 'delivered'].includes(latestPrescription.status) ? 'completed' : 'active' 
    },
    { 
      label: 'Dispatch', 
      status: activeDelivery && ['in_transit', 'delivered'].includes(activeDelivery.status) ? 'completed' : (activeDelivery ? 'active' : 'pending') 
    },
    { label: 'Completion', status: latestPrescription.status === 'delivered' ? 'completed' : 'pending' }
  ];

  return (
    <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl mb-8 border border-white/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
      </div>
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">Treatment Level Monitor</h2>
            <p className="text-2xl font-black mt-2">Active Clinical Journey</p>
          </div>
          <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">Live Tracking</span>
        </div>

        <div className="flex justify-between relative">
          <div className="absolute top-5 left-0 w-full h-1 bg-white/10 -z-0 rounded-full overflow-hidden">
             <div 
              className="h-full bg-emerald-500 transition-all duration-1000" 
              style={{ width: `${(stages.filter(s => s.status === 'completed').length / (stages.length - 1)) * 100}%` }}
             ></div>
          </div>
          {stages.map((stage, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center group">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
                stage.status === 'completed' ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]' :
                stage.status === 'active' ? 'bg-amber-500 border-amber-400 animate-pulse' : 'bg-slate-800 border-slate-700'
              }`}>
                {stage.status === 'completed' ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                ) : (
                  <span className="text-[10px] font-black">{i + 1}</span>
                )}
              </div>
              <span className={`mt-4 text-[9px] font-black uppercase tracking-widest ${stage.status !== 'pending' ? 'text-white' : 'text-slate-500'}`}>{stage.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
           <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Action</p>
                <p className="text-sm font-bold text-white">
                  {latestPrescription.status === 'sent_to_pharmacy' ? 'Awaiting Pharmacy Confirmation' :
                   latestPrescription.status === 'preparing' ? 'Medication being prepared by pharmacist' :
                   latestPrescription.status === 'ready_for_dispatch' ? 'Ready for Logistics Pickup' :
                   latestPrescription.status === 'dispatched' ? 'Meds in transit with Swift Delivery' :
                   latestPrescription.status === 'delivered' ? 'Treatment Lifecycle Completed' : 'Under Review'}
                </p>
              </div>
           </div>
           {activeDelivery && activeDelivery.status === 'in_transit' && (
             <button className="px-6 py-3 bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-900">Map View</button>
           )}
        </div>
      </div>
    </div>
  );
};

const PatientDashboard: React.FC<PatientDashboardProps> = ({ user }) => {
  const [symptoms, setSymptoms] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [tips, setTips] = useState<any[]>([]);
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [consultants, setConsultants] = useState<User[]>([]);
  const [activeThreads, setActiveThreads] = useState<ChatThread[]>([]);
  
  const [showInput, setShowInput] = useState(true);
  const [isCommOpen, setIsCommOpen] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState<{name: string, role: string, id: string} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const allUsers: User[] = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
      setConsultants(allUsers.filter(u => u.role === UserRole.CONSULTANT && u.isApproved));
      
      const allReports: MedicalReport[] = JSON.parse(localStorage.getItem('medi_reports') || '[]');
      setReports(allReports.filter(r => r.patientId === user.id));

      const allPrescriptions: Prescription[] = JSON.parse(localStorage.getItem('medi_prescriptions') || '[]');
      setPrescriptions(allPrescriptions.filter(p => p.patientId === user.id));

      const allDeliveries: DeliveryOrder[] = JSON.parse(localStorage.getItem('medi_deliveries') || '[]');
      setDeliveries(allDeliveries.filter(d => d.patientId === user.id));

      const threads = await ClinicalAPI.getActiveThreads(user.id);
      setActiveThreads(threads);
    };

    fetchData();
    window.addEventListener('storage', fetchData);
    return () => window.removeEventListener('storage', fetchData);
  }, [user.id]);

  useEffect(() => {
    const fetchTips = async () => {
      const result = await getHealthTips();
      setTips(result);
    };
    fetchTips();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const newReport: MedicalReport = {
      id: Math.random().toString(36).substr(2, 9),
      patientId: user.id,
      patientName: user.name,
      fileName: file.name,
      uploadDate: new Date().toLocaleDateString(),
      status: 'pending_review'
    };
    const allReports: MedicalReport[] = JSON.parse(localStorage.getItem('medi_reports') || '[]');
    ClinicalAPI.saveReports([...allReports, newReport]);
    ClinicalAPI.addNotification(user.id, "Report Uploaded", "Your report is now in the vetting queue.");
  };

  const handleSymptomCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await analyzeSymptoms(symptoms);
      setAiResult(result || '');
      setShowInput(false);
    } catch (err) {
      setAiResult("Error analyzing symptoms.");
    } finally {
      setLoading(false);
    }
  };

  const openChat = (thread: ChatThread) => {
    const otherId = thread.participants.find(id => id !== user.id);
    const consultant = consultants.find(c => c.id === otherId);
    if (consultant) {
      setSelectedConsultant({ id: consultant.id, name: consultant.name, role: 'Consultant' });
      setIsCommOpen(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <TreatmentTimeline prescriptions={prescriptions} deliveries={deliveries} />

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Welcome Card */}
          <div className="bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <h1 className="text-4xl font-extrabold mb-2">Welcome Back, {user.name}</h1>
              <p className="text-emerald-100 font-medium max-w-md">Your health status is being monitored in real-time by the MediSphere core.</p>
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-20">
               <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
          </div>

          {/* Clinical Dialogues (New Chatting Section) */}
          <section className="bg-white rounded-[2rem] border border-slate-200 p-10 shadow-sm">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">Clinical Dialogues</h2>
               <Link to="/find-doctor" className="text-[10px] font-black uppercase text-emerald-600 hover:underline">Start New Consultation</Link>
             </div>
             <div className="space-y-4">
               {activeThreads.length > 0 ? activeThreads.map(thread => {
                 const otherId = thread.participants.find(id => id !== user.id);
                 const consultant = consultants.find(c => c.id === otherId);
                 if (!consultant) return null;

                 return (
                   <button 
                    key={thread.chatId} 
                    onClick={() => openChat(thread)}
                    className="w-full flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:border-emerald-500 hover:shadow-xl transition-all duration-300 group text-left"
                   >
                     <div className="flex items-center space-x-6">
                       <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-50 transition font-black">
                         {consultant.name.charAt(0)}
                       </div>
                       <div>
                         <p className="font-black text-slate-900">Dr. {consultant.name}</p>
                         <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">
                           {thread.lastMessage?.text || "Started a new secure session"}
                         </p>
                       </div>
                     </div>
                     <div className="text-right">
                        <span className="text-[8px] font-black uppercase text-slate-300 block mb-1">{thread.lastMessage?.time || "Active"}</span>
                        <div className="flex items-center justify-end">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-[8px] font-black uppercase ml-1.5 text-emerald-600">Encrypted Relay</span>
                        </div>
                     </div>
                   </button>
                 );
               }) : (
                 <div className="text-center py-10 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Active Sessions</p>
                 </div>
               )}
             </div>
          </section>

          {/* AI Symptom Checker */}
          <section className="bg-white rounded-[2rem] border border-slate-200 p-10 shadow-sm">
            {showInput ? (
              <form onSubmit={handleSymptomCheck} className="space-y-6">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">AI Virtual Triage</h2>
                </div>
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe your symptoms in detail for a clinical pre-assessment..."
                  className="w-full p-8 bg-slate-50 border border-slate-200 rounded-3xl text-slate-800 focus:border-emerald-500 outline-none h-40 transition-all resize-none font-medium text-lg"
                />
                <button disabled={loading || !symptoms.trim()} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50">
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-4 w-4 mr-3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" fill="none"></circle><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" fill="none"></path></svg>
                      Consulting Core Intelligence...
                    </span>
                  ) : "Analyze Health Patterns"}
                </button>
              </form>
            ) : (
              <div className="space-y-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black text-slate-900">Clinical AI Assessment</h2>
                  <button onClick={() => setShowInput(true)} className="text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline">New Triage</button>
                </div>
                <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 text-slate-700 leading-relaxed font-medium">
                  {aiResult}
                </div>
              </div>
            )}
          </section>

          {/* Report Vault */}
          <section className="bg-white rounded-[2rem] border border-slate-200 p-10 shadow-sm">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">Medical Artifacts</h2>
               <label className="cursor-pointer bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-100">
                 Upload Report
                 <input type="file" className="hidden" onChange={handleFileUpload} />
               </label>
             </div>
             <div className="grid gap-4">
               {reports.length > 0 ? reports.map(r => (
                 <div key={r.id} className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-[2rem] group hover:border-emerald-500 hover:bg-white transition-all duration-300">
                    <div className="flex items-center space-x-6">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-50 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{r.fileName}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{r.uploadDate} • Review Queue</p>
                      </div>
                    </div>
                    <span className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border ${
                      r.status === 'vetted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                      r.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                      'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                    }`}>
                      {r.status.replace('_', ' ')}
                    </span>
                 </div>
               )) : (
                 <div className="text-center py-20 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Vault Empty</p>
                 </div>
               )}
             </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-8 tracking-tight">Active Wellness Plan</h2>
            <div className="space-y-4">
              {tips.map((tip, i) => (
                <div key={i} className="p-6 bg-slate-50 rounded-[1.75rem] border-2 border-transparent hover:border-emerald-100 transition-all duration-300">
                  <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg mb-3 inline-block border border-emerald-100">{tip.category}</span>
                  <h3 className="font-black text-slate-900 text-sm mb-2">{tip.title}</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{tip.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-emerald-600 rounded-[3rem] p-10 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-xl font-black mb-8 tracking-tight">Identity Hub</h2>
              
              {/* Location Sync Status Indicator */}
              <div className="mb-6 p-4 bg-white/10 rounded-2xl border border-white/20">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-2 opacity-70">Logistics Precision</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest">GPS Uplink</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${user.location ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-white/30'}`}></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{user.location ? 'Synchronized' : 'No Uplink'}</span>
                  </div>
                </div>
                {!user.location && (
                  <Link to="/profile" className="mt-3 block text-[8px] font-black uppercase tracking-widest text-center py-2 bg-white/20 rounded-lg hover:bg-white/30 transition">Establish Sync in Profile</Link>
                )}
              </div>

              <div className="space-y-4">
                <Link to="/find-doctor" className="flex items-center justify-between w-full p-5 bg-white/10 hover:bg-white/20 rounded-2xl transition border border-white/10 group">
                  <span className="text-[10px] font-black uppercase tracking-widest">Specialist Network</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </Link>
                <Link to="/profile" className="flex items-center justify-between w-full p-5 bg-white/10 hover:bg-white/20 rounded-2xl transition border border-white/10 group">
                  <span className="text-[10px] font-black uppercase tracking-widest">Medical Profile</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </Link>
              </div>
            </div>
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </section>
        </div>
      </div>

      {selectedConsultant && (
        <CommunicationOverlay 
          isOpen={isCommOpen}
          onClose={() => setIsCommOpen(false)}
          currentUser={user}
          targetUser={selectedConsultant}
        />
      )}
    </div>
  );
};

export default PatientDashboard;
