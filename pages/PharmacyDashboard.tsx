
import React, { useState, useEffect } from 'react';
import { User, UserRole, Prescription, DeliveryOrder } from '../types.ts';
import { ClinicalAPI } from '../services/apiService.ts';

const PharmacyDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [dispatchers, setDispatchers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = () => {
      const allP: Prescription[] = JSON.parse(localStorage.getItem('medi_prescriptions') || '[]');
      setPrescriptions(allP.filter(p => ['sent_to_pharmacy', 'preparing', 'ready_for_dispatch'].includes(p.status)));

      const allUsers: User[] = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
      setDispatchers(allUsers.filter(u => u.role === UserRole.DISPATCH && u.isApproved));
    };

    fetchData();
    window.addEventListener('storage', fetchData);
    return () => window.removeEventListener('storage', fetchData);
  }, []);

  const handleUpdateStatus = (id: string, status: Prescription['status']) => {
    const allP: Prescription[] = JSON.parse(localStorage.getItem('medi_prescriptions') || '[]');
    const idx = allP.findIndex(p => p.id === id);
    if (idx > -1) {
      allP[idx].status = status;
      allP[idx].pharmacyId = user.id;
      ClinicalAPI.savePrescriptions(allP);
      
      const msg = status === 'preparing' ? "Pharmacy has started preparing your medication." :
                  status === 'ready_for_dispatch' ? "Your medication is ready and awaiting logistics pickup." : 
                  `Prescription status updated to ${status.replace('_', ' ')}.`;
                  
      ClinicalAPI.addNotification(allP[idx].patientId, "Pharmacy Update", msg);
    }
  };

  const assignDispatch = (prescription: Prescription, dispatcherId: string) => {
    if (!dispatcherId) return;
    const dispatcher = dispatchers.find(d => d.id === dispatcherId);
    if (!dispatcher) return;

    // 1. Update Prescription Status
    handleUpdateStatus(prescription.id, 'dispatched');

    // 2. Create Delivery Order
    const newDelivery: DeliveryOrder = {
      id: Math.random().toString(36).substr(2, 9),
      prescriptionId: prescription.id,
      patientId: prescription.patientId,
      pharmacyId: user.id,
      dispatchId: dispatcherId,
      status: 'assigned',
      patientAddress: "Clinical Destination Sync Active",
      timestamp: new Date().toISOString()
    };

    const allD = JSON.parse(localStorage.getItem('medi_deliveries') || '[]');
    ClinicalAPI.saveDeliveries([...allD, newDelivery]);

    // 3. Notify Dispatcher & Patient
    ClinicalAPI.addNotification(dispatcherId, "Pickup Required", `New medication delivery assigned for ${prescription.patientName}`);
    ClinicalAPI.addNotification(prescription.patientId, "Dispatched for Delivery", `Your medications have been handed to ${dispatcher.name} and are on the way.`);
    
    alert(`Success: Logistics protocol initialized with ${dispatcher.name}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{user.name}</h1>
          <div className="flex items-center space-x-3 mt-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">Fulfillment Hub Active</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-4 py-1.5 rounded-full">Node: L-75</span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
           <div className="text-right">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Dispatchers</p>
             <p className="text-lg font-black text-slate-900">{dispatchers.length} Online</p>
           </div>
           <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
           </div>
        </div>
      </div>

      <section className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-2xl">
         <div className="flex items-center justify-between mb-10 border-b border-slate-50 pb-8">
           <h2 className="text-2xl font-black text-slate-900 tracking-tight">Incoming Prescriptions</h2>
           <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{prescriptions.length} Pending Actions</span>
         </div>
         <div className="space-y-6">
           {prescriptions.length > 0 ? prescriptions.map(p => (
             <div key={p.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 group hover:bg-white hover:border-emerald-500 hover:shadow-xl transition-all duration-300">
                <div className="flex-grow space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 shadow-sm border border-slate-100 font-black">
                      {p.patientName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient Identity</p>
                      <h3 className="text-xl font-black text-slate-900">{p.patientName}</h3>
                    </div>
                  </div>
                  <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-sm text-slate-700 italic font-medium">
                    <span className="block font-black text-emerald-700 uppercase text-[9px] tracking-widest mb-1">Medication Protocol:</span>
                    {p.medications} — {p.dosage}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto shrink-0">
                   {p.status === 'sent_to_pharmacy' && (
                     <button onClick={() => handleUpdateStatus(p.id, 'preparing')} className="px-10 py-5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100">Establish Prep Node</button>
                   )}
                   {p.status === 'preparing' && (
                     <button onClick={() => handleUpdateStatus(p.id, 'ready_for_dispatch')} className="px-10 py-5 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition shadow-xl shadow-amber-100">Authorize Dispatch</button>
                   )}
                   {p.status === 'ready_for_dispatch' && (
                     <div className="flex items-center space-x-3 w-full sm:w-64">
                       <select 
                        onChange={(e) => assignDispatch(p, e.target.value)} 
                        className="w-full px-8 py-5 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-emerald-600 shadow-sm appearance-none"
                       >
                         <option value="">Assign Logistics Partner</option>
                         {dispatchers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                       </select>
                     </div>
                   )}
                   <div className="px-6 py-5 bg-slate-200/50 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center min-w-[120px]">
                     {p.status.replace('_', ' ')}
                   </div>
                </div>
             </div>
           )) : (
             <div className="text-center py-24 bg-slate-50/50 rounded-[4rem] border-4 border-dashed border-slate-100">
               <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 shadow-sm">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
               </div>
               <h3 className="text-xl font-black text-slate-900 tracking-tight">Fulfillment Queue Clear</h3>
               <p className="text-slate-400 font-medium text-sm mt-1 uppercase tracking-widest text-[10px]">Monitoring incoming clinical broadcasts...</p>
             </div>
           )}
         </div>
      </section>
    </div>
  );
};

export default PharmacyDashboard;
