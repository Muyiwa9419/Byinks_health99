
import React, { useState, useEffect } from 'react';
import { User, UserRole, Appointment, MedicalReport, Prescription } from '../types.ts';
import { summarizePatientHistory, analyzeMedicalReport } from '../services/geminiService.ts';
import CommunicationOverlay from '../components/CommunicationOverlay.tsx';
import { ClinicalAPI } from '../services/apiService.ts';

interface ConsultantDashboardProps {
  user: User;
}

const ConsultantDashboard: React.FC<ConsultantDashboardProps> = ({ user }) => {
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [aiReportInsight, setAiReportInsight] = useState('');
  const [prescribingFor, setPrescribingFor] = useState<MedicalReport | null>(null);
  const [prescriptionData, setPrescriptionData] = useState({ medications: '', dosage: '' });
  const [loadingAI, setLoadingAI] = useState(false);
  
  // Existing state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isCommOpen, setIsCommOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{id: string, name: string} | null>(null);

  useEffect(() => {
    const fetchData = () => {
      const allApps: Appointment[] = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
      setAppointments(allApps.filter(a => a.consultantId === user.id));

      const allReports: MedicalReport[] = JSON.parse(localStorage.getItem('medi_reports') || '[]');
      setReports(allReports.filter(r => r.status === 'pending_review'));
    };

    fetchData();
    window.addEventListener('storage', fetchData);
    return () => window.removeEventListener('storage', fetchData);
  }, [user.id]);

  const handleVetReport = async (report: MedicalReport) => {
    setSelectedReport(report);
    setLoadingAI(true);
    const insight = await analyzeMedicalReport(`Patient: ${report.patientName}, File: ${report.fileName}`);
    setAiReportInsight(insight);
    setLoadingAI(false);
  };

  const handleIssuePrescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescribingFor) return;

    const newPrescription: Prescription = {
      id: Math.random().toString(36).substr(2, 9),
      patientId: prescribingFor.patientId,
      patientName: prescribingFor.patientName,
      consultantId: user.id,
      consultantName: user.name,
      medications: prescriptionData.medications,
      dosage: prescriptionData.dosage,
      date: new Date().toLocaleDateString(),
      status: 'sent_to_pharmacy'
    };

    const allPrescriptions = JSON.parse(localStorage.getItem('medi_prescriptions') || '[]');
    ClinicalAPI.savePrescriptions([...allPrescriptions, newPrescription]);

    // Update report status
    const allReports: MedicalReport[] = JSON.parse(localStorage.getItem('medi_reports') || '[]');
    const reportIdx = allReports.findIndex(r => r.id === prescribingFor.id);
    if (reportIdx > -1) {
      allReports[reportIdx].status = 'vetted';
      ClinicalAPI.saveReports(allReports);
    }

    // Notify Pharmacy & Patient
    ClinicalAPI.addNotification(prescribingFor.patientId, "Prescription Issued", `Dr. ${user.name} has vetted your report and sent a prescription to the pharmacy.`);
    
    // Auto-Notify all Pharmacies (broadcast system)
    const pharmacies: User[] = JSON.parse(localStorage.getItem('medi_registered_users') || '[]').filter((u: any) => u.role === UserRole.PHARMACY);
    pharmacies.forEach(p => ClinicalAPI.addNotification(p.id, "New Prescription Received", `New prescription for ${prescribingFor.patientName}`));

    setPrescribingFor(null);
    setSelectedReport(null);
    setPrescriptionData({ medications: '', dosage: '' });
    alert("Prescription synchronized with Pharmacy Hub.");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Dr. {user.name}</h1>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{user.specialty} Specialist</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left: Pending Reports for Vetting */}
        <div className="lg:col-span-5 space-y-8">
          <section className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Vetting Queue</h2>
            <div className="space-y-4">
              {reports.length > 0 ? reports.map(r => (
                <div key={r.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-emerald-600 transition">
                  <div>
                    <p className="font-bold text-slate-900">{r.patientName}</p>
                    <p className="text-[10px] text-slate-500">{r.fileName}</p>
                  </div>
                  <button onClick={() => handleVetReport(r)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md">Vet Report</button>
                </div>
              )) : (
                <div className="text-center py-10 text-slate-400 text-sm italic">No reports pending vetting.</div>
              )}
            </div>
          </section>

          {/* Pending Appointments */}
          <section className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl">
             <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-6">Today's Schedule</h2>
             <div className="space-y-4">
               {appointments.filter(a => a.status === 'confirmed').map(a => (
                 <div key={a.id} className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold">{a.patientName}</p>
                      <p className="text-[9px] text-emerald-400">{a.time}</p>
                    </div>
                    <button onClick={() => { setSelectedPatient({id: a.patientId, name: a.patientName}); setIsCommOpen(true); }} className="text-[9px] font-black uppercase text-emerald-500 underline">Open Session</button>
                 </div>
               ))}
             </div>
          </section>
        </div>

        {/* Right: Vetting & Prescription Hub */}
        <div className="lg:col-span-7">
          {selectedReport ? (
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl space-y-8 animate-in zoom-in-95">
               <div className="flex justify-between items-center border-b border-slate-50 pb-6">
                 <div>
                   <h3 className="text-2xl font-black text-slate-900">{selectedReport.patientName}</h3>
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Medical Record Analysis</p>
                 </div>
                 <button onClick={() => setSelectedReport(null)} className="text-slate-300 hover:text-slate-900 transition">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                 </button>
               </div>

               <div className="p-8 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">AI Clinical Insights</h4>
                  {loadingAI ? (
                    <div className="flex items-center space-x-3 text-slate-400 italic">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Extracting medical patterns...</span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 italic leading-relaxed">{aiReportInsight}</p>
                  )}
               </div>

               <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultant Decision</h4>
                  <div className="flex space-x-4">
                    <button onClick={() => setPrescribingFor(selectedReport)} className="flex-grow bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-200">Issue Prescription</button>
                    <button className="flex-grow bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">Mark as Clear</button>
                  </div>
               </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-20 text-center border-4 border-dashed border-slate-50 rounded-[4rem] text-slate-300">
              <svg className="w-20 h-20 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <h3 className="text-2xl font-black text-slate-400">Clinical Dashboard Active</h3>
              <p className="font-medium max-w-sm">Select a report from the vetting queue or an active session to begin clinical review.</p>
            </div>
          )}
        </div>
      </div>

      {/* Prescription Modal */}
      {prescribingFor && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setPrescribingFor(null)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[3.5rem] p-10 shadow-2xl">
             <h3 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">Prescription Pad</h3>
             <form onSubmit={handleIssuePrescription} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Patient</label>
                  <p className="px-6 py-4 bg-slate-50 rounded-2xl font-bold text-slate-900">{prescribingFor.patientName}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Medications</label>
                  <textarea required value={prescriptionData.medications} onChange={e => setPrescriptionData({...prescriptionData, medications: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600 h-24" placeholder="Drug names & strengths..." />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Dosage Instructions</label>
                  <input required value={prescriptionData.dosage} onChange={e => setPrescriptionData({...prescriptionData, dosage: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600" placeholder="e.g. 1-0-1 for 7 days" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-200">Broadcast to Pharmacy Hub</button>
             </form>
          </div>
        </div>
      )}

      {selectedPatient && (
        <CommunicationOverlay 
          isOpen={isCommOpen}
          onClose={() => { setIsCommOpen(false); setSelectedPatient(null); }}
          currentUser={user}
          targetUser={{...selectedPatient, role: 'Patient'}}
        />
      )}
    </div>
  );
};

export default ConsultantDashboard;
