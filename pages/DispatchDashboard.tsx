
import React, { useState, useEffect } from 'react';
import { User, UserRole, DeliveryOrder } from '../types.ts';
import { ClinicalAPI } from '../services/apiService.ts';

const DispatchDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    const fetchData = () => {
      const allD: DeliveryOrder[] = JSON.parse(localStorage.getItem('medi_deliveries') || '[]');
      setDeliveries(allD.filter(d => d.dispatchId === user.id && d.status !== 'delivered'));
    };

    fetchData();
    window.addEventListener('storage', fetchData);
    
    // Simulate Location Tracking
    const geoTimer = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setMyLocation(loc);
            // Update user profile with latest location
            ClinicalAPI.updateUserStatus(user.id, { location: loc });
          },
          (err) => console.error("Geo tracking failed", err),
          { enableHighAccuracy: true }
        );
      }
    }, 10000);

    return () => {
      window.removeEventListener('storage', fetchData);
      clearInterval(geoTimer);
    };
  }, [user.id]);

  const updateDeliveryStatus = (id: string, status: DeliveryOrder['status']) => {
    const allD: DeliveryOrder[] = JSON.parse(localStorage.getItem('medi_deliveries') || '[]');
    const idx = allD.findIndex(d => d.id === id);
    if (idx > -1) {
      allD[idx].status = status;
      ClinicalAPI.saveDeliveries(allD);
      
      // Update Prescription Status accordingly
      const allP = JSON.parse(localStorage.getItem('medi_prescriptions') || '[]');
      const pIdx = allP.findIndex((p: any) => p.id === allD[idx].prescriptionId);
      if (pIdx > -1) {
        if (status === 'delivered') {
          allP[pIdx].status = 'delivered';
        } else if (status === 'in_transit') {
          allP[pIdx].status = 'dispatched';
        }
        ClinicalAPI.savePrescriptions(allP);
      }

      ClinicalAPI.addNotification(allD[idx].patientId, "Medication Delivery Update", `Your order is now ${status.replace('_', ' ')}.`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{user.name}</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block mt-2">Clinical Logistics Partner</p>
        </div>
        <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl flex items-center space-x-4">
           <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
           <p className="text-[10px] font-black uppercase tracking-widest">Tracking: {myLocation ? `${myLocation.lat.toFixed(4)}, ${myLocation.lng.toFixed(4)}` : 'Searching GPS...'}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Map Placeholder */}
        <div className="lg:col-span-8 bg-slate-100 rounded-[3rem] border border-slate-200 overflow-hidden relative shadow-inner h-[500px] flex items-center justify-center">
            <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/0,0,0/800x600?access_token=pk.placeholder')] bg-cover opacity-20 grayscale"></div>
            <div className="relative z-10 text-center">
               <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-2xl mx-auto mb-4 animate-bounce">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
               </div>
               <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Active Route Visualization</p>
            </div>
        </div>

        {/* Deliveries */}
        <div className="lg:col-span-4 space-y-6">
           <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Current Assignments</h2>
           <div className="space-y-4">
             {deliveries.length > 0 ? deliveries.map(d => (
               <div key={d.id} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl animate-in slide-in-from-right-4">
                  <div className="mb-6">
                    <p className="text-[9px] font-black uppercase text-emerald-600 mb-1">Destination</p>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">Byinks Clinical Patient Hub</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">{d.patientAddress}</p>
                  </div>

                  <div className="space-y-3">
                    {d.status === 'assigned' && (
                      <button onClick={() => updateDeliveryStatus(d.id, 'in_transit')} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition">Start Route</button>
                    )}
                    {d.status === 'in_transit' && (
                      <button onClick={() => updateDeliveryStatus(d.id, 'delivered')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition">Complete Drop-off</button>
                    )}
                    <span className="block text-center px-4 py-2 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl text-[8px] font-black uppercase">Current: {d.status.replace('_', ' ')}</span>
                  </div>
               </div>
             )) : (
               <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-300 italic">No active deliveries.</div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default DispatchDashboard;
