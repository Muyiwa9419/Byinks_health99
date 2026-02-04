
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, UserRole, MedicalReport, Prescription, DeliveryOrder } from '../types.ts';
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
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [consultants, setConsultants] = useState<User[]>([]);
  
  // UI State
  const [showInput, setShowInput] = useState(true);
  const [isCommOpen, setIsCommOpen] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState<{name: string, role: string, id: string} | null>(null);

  useEffect(() => {
    const fetchData = () => {
      const allUsers: User[] = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
      setConsultants(allUsers.filter(u => u.role === UserRole.CONSULTANT && u.isApproved));
      
      const allReports: MedicalReport[] = JSON.parse(localStorage.getItem('medi_reports') || '[]');
      setReports(allReports.filter(r => r.patientId === user.id));

      const allPrescriptions: Prescription[] = JSON.parse(localStorage.getItem('medi_prescriptions') || '[]');
      setPrescriptions(allPrescriptions.filter(p => p.patientId === user.id));

      const allDeliveries: DeliveryOrder[] = JSON.parse(localStorage.getItem('medi_deliveries') || '[]');
      setDeliveries(allDeliveries.filter(d => d.patientId === user.id && d.status !== 'delivered'));
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
    alert("Clinical Report Uploaded. Our specialists have been notified for vetting.");
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Welcome Card */}
          <div className="bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <h1 className="text-4xl font-extrabold mb-2">Health Pulse: {user.name}</h1>
              <p className="text-emerald-100 font-medium max-w-md">Your remote healthcare hub. Consult, upload, and track medication from home.</p>
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-20">
               <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
          </div>

          {/* Active Deliveries */}
          {deliveries.length > 0 && (
            <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl animate-in slide-in-from-top-4">
               <div className="flex items-center justify-between mb-6">
                 <h2 className="text-lg font-black uppercase tracking-widest text-emerald-400">Medication Tracking</h2>
                 <span className="animate-pulse flex h-3 w-3 rounded-full bg-emerald-500"></span>
               </div>
               {deliveries.map(d => (
                 <div key={d.id} className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-400">Status</p>
                      <h3 className="text-xl font-black text-white">{d.status.replace('_', ' ')}</h3>
                    </div>
                    <div className="h-1 flex-grow bg-white/10 mx-4 rounded-full relative overflow-hidden">
                      <div className={`absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-1000 ${d.status === 'pending' ? 'w-1/4' : d.status === 'assigned' ? 'w-1/2' : 'w-3/4 animate-pulse'}`}></div>
                    </div>
                    <button className="px-6 py-3 bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition">Live Track</button>
                 </div>
               ))}
            </section>
          )}

          {/* AI Symptom Checker */}
          <section className="bg-white rounded-[2rem] border border-slate-200 p-10 shadow-sm">
            {showInput ? (
              <form onSubmit={handleSymptomCheck} className="space-y-6">
                <h2 className="text-2xl font-bold text-slate-900">Virtual Triage</h2>
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="How are you feeling today?"
                  className="w-full p-8 bg-slate-50 border border-slate-200 rounded-3xl text-slate-800 focus:border-emerald-500 outline-none h-32 transition-all resize-none font-medium"
                />
                <button disabled={loading || !symptoms.trim()} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-600 transition">
                  {loading ? "Analyzing..." : "Analyze Symptoms"}
                </button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900">AI Observations</h2>
                  <button onClick={() => setShowInput(true)} className="text-emerald-600 font-black text-[10px] uppercase">Reset</button>
                </div>
                <div className="p-8 bg-emerald-50 rounded-2xl border border-emerald-100 text-slate-700 italic leading-relaxed">
                  {aiResult}
                </div>
              </div>
            )}
          </section>

          {/* Report Vault */}
          <section className="bg-white rounded-[2rem] border border-slate-200 p-10 shadow-sm">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-bold text-slate-900">Clinical Reports</h2>
               <label className="cursor-pointer bg-emerald-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition">
                 Upload New
                 <input type="file" className="hidden" onChange={handleFileUpload} />
               </label>
             </div>
             <div className="grid gap-4">
               {reports.length > 0 ? reports.map(r => (
                 <div key={r.id} className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-emerald-500 transition-all">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{r.fileName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{r.uploadDate}</p>
                      </div>
                    </div>
                    <span className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase ${r.status === 'vetted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                 </div>
               )) : (
                 <div className="text-center py-10 text-slate-400 italic text-sm">No clinical reports uploaded yet.</div>
               )}
             </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Health Tips */}
          <section className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-8">Wellness Tips</h2>
            <div className="space-y-4">
              {tips.map((tip, i) => (
                <div key={i} className="p-5 bg-slate-50 rounded-[1.5rem] border border-transparent hover:border-emerald-100 transition-all">
                  <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded mb-2 inline-block">{tip.category}</span>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{tip.title}</h3>
                  <p className="text-xs text-slate-500">{tip.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="bg-emerald-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
            <h2 className="text-lg font-black mb-6">Remote Portal</h2>
            <div className="space-y-3 relative z-10">
              <Link to="/find-doctor" className="block w-full text-center py-4 bg-white/20 hover:bg-white/30 rounded-2xl text-[10px] font-black uppercase transition border border-white/20">Find Specialist</Link>
              <Link to="/profile" className="block w-full text-center py-4 bg-white/20 hover:bg-white/30 rounded-2xl text-[10px] font-black uppercase transition border border-white/20">Manage Profile</Link>
            </div>
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
