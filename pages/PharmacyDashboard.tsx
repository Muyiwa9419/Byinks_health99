
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
      setPrescriptions(allP.filter(p => p.status === 'sent_to_pharmacy' || p.status === 'preparing' || p.status === 'ready_for_dispatch'));

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
      ClinicalAPI.addNotification(allP[idx].patientId, "Medication Update", `Pharmacy is now ${status.replace('_', ' ')} your medications.`);
    }
  };

  const assignDispatch = (prescription: Prescription, dispatcherId: string) => {
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
      patientAddress: "Clinical Destination Registered", // Placeholder
      timestamp: new Date().toISOString()
    };

    const allD = JSON.parse(localStorage.getItem('medi_deliveries') || '[]');
    ClinicalAPI.saveDeliveries([...allD, newDelivery]);

    // 3. Notify Dispatcher & Patient
    ClinicalAPI.addNotification(dispatcherId, "New Delivery Assigned", `Deliver meds to ${prescription.patientName}`);
    ClinicalAPI.addNotification(prescription.patientId, "Out for Delivery", `Your medications have been assigned to ${dispatcher.name} and are out for delivery.`);
    
    alert(`Medication assigned to dispatcher ${dispatcher.name}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">{user.name}</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block mt-2">Certified Clinical Pharmacy</p>
      </div>

      <div className="grid lg:grid-cols-1 gap-8">
        <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl">
           <h2 className="text-xl font-bold text-slate-900 mb-8">Prescription Fulfillment Hub</h2>
           <div className="space-y-6">
             {prescriptions.length > 0 ? prescriptions.map(p => (
               <div key={p.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 group hover:bg-white hover:border-emerald-500 transition-all">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-slate-400">Patient</p>
                    <h3 className="text-2xl font-black text-slate-900">{p.patientName}</h3>
                    <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-slate-700 italic">
                      {p.medications} - {p.dosage}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 items-center">
                     {p.status === 'sent_to_pharmacy' && (
                       <button onClick={() => handleUpdateStatus(p.id, 'preparing')} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Start Preparing</button>
                     )}
                     {p.status === 'preparing' && (
                       <button onClick={() => handleUpdateStatus(p.id, 'ready_for_dispatch')} className="px-8 py-4 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Mark Ready</button>
                     )}
                     {p.status === 'ready_for_dispatch' && (
                       <div className="flex items-center space-x-3">
                         <select onChange={(e) => assignDispatch(p, e.target.value)} className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-emerald-600">
                           <option value="">Assign Dispatcher</option>
                           {dispatchers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                         </select>
                       </div>
                     )}
                     <span className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-[8px] font-black uppercase">{p.status.replace('_', ' ')}</span>
                  </div>
               </div>
             )) : (
               <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-400 font-medium">No pending prescriptions in the fulfillment stream.</div>
             )}
           </div>
        </section>
      </div>
    </div>
  );
};

export default PharmacyDashboard;
