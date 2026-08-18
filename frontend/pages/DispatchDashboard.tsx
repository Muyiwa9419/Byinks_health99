
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, DeliveryOrder } from '../types.ts';
import { ClinicalAPI } from '../services/apiService.ts';

// Explicitly handle Leaflet via global 'L' object provided by CDN script
declare const L: any;

const DispatchDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isOnline, setIsOnline] = useState(user.isOnline ?? true);
  const [focusedDeliveryId, setFocusedDeliveryId] = useState<string | null>(null);
  
  const mapRef = useRef<any>(null);
  const dispatcherMarkerRef = useRef<any>(null);
  const deliveryMarkersRef = useRef<Map<string, any>>(new Map());
  const routeLinesRef = useRef<Map<string, any>>(new Map());
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = () => {
      const allD: DeliveryOrder[] = JSON.parse(localStorage.getItem('medi_deliveries') || '[]');
      setDeliveries(allD.filter(d => d.dispatchId === user.id && d.status !== 'delivered'));
      
      const allUsers: User[] = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
      const me = allUsers.find(u => u.id === user.id);
      if (me) setIsOnline(me.isOnline ?? true);
    };

    fetchData();
    window.addEventListener('storage', fetchData);
    
    // Initial and periodic location tracking
    const trackLocation = () => {
      if (navigator.geolocation && isOnline) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setMyLocation(loc);
            ClinicalAPI.updateUserStatus(user.id, { location: loc });
          },
          (err) => console.error("Geo tracking failed", err),
          { enableHighAccuracy: true }
        );
      }
    };

    trackLocation();
    const geoTimer = setInterval(trackLocation, 5000); // More frequent for smooth tracking

    return () => {
      window.removeEventListener('storage', fetchData);
      clearInterval(geoTimer);
    };
  }, [user.id, isOnline]);

  // Map Initialization
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      // Initialize Leaflet map
      const initialView = myLocation ? [myLocation.lat, myLocation.lng] : [6.4674, 3.4070]; // Default to Lagos
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(initialView, 14);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(mapRef.current);

      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync Dispatcher Marker
  useEffect(() => {
    if (mapRef.current && myLocation) {
      if (!dispatcherMarkerRef.current) {
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div class="relative">
              <div class="absolute -inset-4 bg-emerald-500/20 rounded-full animate-ping"></div>
              <div class="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-2xl border-4 border-white relative z-10">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        dispatcherMarkerRef.current = L.marker([myLocation.lat, myLocation.lng], { icon }).addTo(mapRef.current);
      } else {
        dispatcherMarkerRef.current.setLatLng([myLocation.lat, myLocation.lng]);
      }
    }
    
    // Hide marker if offline
    if (dispatcherMarkerRef.current && !isOnline) {
      dispatcherMarkerRef.current.remove();
      dispatcherMarkerRef.current = null;
    }
  }, [myLocation, isOnline]);

  // Sync Delivery Markers & Route Lines
  useEffect(() => {
    if (!mapRef.current || !myLocation) return;

    // Clear removed deliveries and lines
    const activeDeliveryIds = new Set(deliveries.map(d => d.id));
    
    deliveryMarkersRef.current.forEach((marker, id) => {
      if (!activeDeliveryIds.has(id)) {
        marker.remove();
        deliveryMarkersRef.current.delete(id);
      }
    });

    routeLinesRef.current.forEach((line, id) => {
      if (!activeDeliveryIds.has(id)) {
        line.remove();
        routeLinesRef.current.delete(id);
      }
    });

    // Add/Update current deliveries
    deliveries.forEach(d => {
      const destLat = d.patientLocation?.lat || (myLocation ? myLocation.lat + 0.005 : 6.4724);
      const destLng = d.patientLocation?.lng || (myLocation ? myLocation.lng + 0.005 : 3.4120);
      const destination: [number, number] = [destLat, destLng];

      // Update Marker
      if (!deliveryMarkersRef.current.has(d.id)) {
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div class="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl border-2 border-white">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        const marker = L.marker(destination, { icon })
          .addTo(mapRef.current)
          .bindPopup(`<div class="p-2 font-black text-[10px] uppercase tracking-widest text-slate-900">Patient: ${d.patientName}<br/><span class="text-slate-400">#${d.id.substring(0, 5)}</span></div>`);
        
        deliveryMarkersRef.current.set(d.id, marker);
      } else {
        deliveryMarkersRef.current.get(d.id).setLatLng(destination);
      }

      // Update Route Line (only if in transit or assigned)
      const routePoints = [[myLocation.lat, myLocation.lng], destination];
      if (!routeLinesRef.current.has(d.id)) {
        const line = L.polyline(routePoints, {
          color: d.id === focusedDeliveryId ? '#10b981' : '#cbd5e1',
          weight: d.id === focusedDeliveryId ? 6 : 3,
          opacity: d.id === focusedDeliveryId ? 0.8 : 0.4,
          dashArray: d.status === 'assigned' ? '10, 10' : 'none'
        }).addTo(mapRef.current);
        routeLinesRef.current.set(d.id, line);
      } else {
        const line = routeLinesRef.current.get(d.id);
        line.setLatLngs(routePoints);
        line.setStyle({
          color: d.id === focusedDeliveryId ? '#10b981' : '#cbd5e1',
          weight: d.id === focusedDeliveryId ? 6 : 3,
          opacity: d.id === focusedDeliveryId ? 0.8 : 0.4
        });
      }
    });

    // Auto-focus logic
    if (focusedDeliveryId && routeLinesRef.current.has(focusedDeliveryId)) {
        mapRef.current.fitBounds(routeLinesRef.current.get(focusedDeliveryId).getBounds(), { padding: [100, 100], animate: true });
    } else if (deliveries.length > 0 && isOnline) {
      const bounds = L.latLngBounds([myLocation.lat, myLocation.lng]);
      deliveries.forEach(d => {
        const destLat = d.patientLocation?.lat || (myLocation ? myLocation.lat + 0.005 : 6.4724);
        const destLng = d.patientLocation?.lng || (myLocation ? myLocation.lng + 0.005 : 3.4120);
        bounds.extend([destLat, destLng]);
      });
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [deliveries, myLocation, isOnline, focusedDeliveryId]);

  const toggleOnlineStatus = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    await ClinicalAPI.updateUserStatus(user.id, { isOnline: newStatus });
  };

  const updateDeliveryStatus = (id: string, status: DeliveryOrder['status']) => {
    const allD: DeliveryOrder[] = JSON.parse(localStorage.getItem('medi_deliveries') || '[]');
    const idx = allD.findIndex(d => d.id === id);
    if (idx > -1) {
      allD[idx].status = status;
      ClinicalAPI.saveDeliveries(allD);
      
      const allP = JSON.parse(localStorage.getItem('medi_prescriptions') || '[]');
      const pIdx = allP.findIndex((p: any) => p.id === allD[idx].prescriptionId);
      if (pIdx > -1) {
        if (status === 'delivered') {
          allP[pIdx].status = 'delivered';
          setFocusedDeliveryId(null);
        } else if (status === 'in_transit') {
          allP[pIdx].status = 'dispatched';
          setFocusedDeliveryId(id);
        }
        ClinicalAPI.savePrescriptions(allP);
      }

      ClinicalAPI.addNotification(allD[idx].patientId, "Medication Delivery Update", `Your order is now ${status.replace('_', ' ')}.`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{user.name}</h1>
          <div className="flex items-center space-x-4 mt-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block">Clinical Logistics Partner</p>
            <button 
              onClick={toggleOnlineStatus}
              className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                isOnline ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </button>
          </div>
        </div>
        <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-xl flex items-center space-x-6 border border-white/10">
           <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
             <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`}></div>
           </div>
           <div>
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Live GPS Metadata</p>
             <p className="text-[11px] font-black tracking-widest">
               {isOnline ? (myLocation ? `${myLocation.lat.toFixed(6)} N, ${myLocation.lng.toFixed(6)} E` : 'Searching Signals...') : 'Sensors Disabled'}
             </p>
           </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-10">
        {/* Real-time Map Hub */}
        <div className="lg:col-span-8 bg-white rounded-[4rem] border border-slate-100 overflow-hidden relative shadow-2xl h-[650px] p-4">
            <div ref={mapContainerRef} className="w-full h-full z-10"></div>
            
            {/* Map Overlays */}
            <div className="absolute top-8 left-8 z-20 flex flex-col space-y-3 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-slate-100 pointer-events-auto">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Map Intelligence</p>
                    <p className="text-[10px] font-bold text-slate-900">
                        {deliveries.length} Patients in Vector
                    </p>
                </div>
                {focusedDeliveryId && (
                    <button 
                        onClick={() => setFocusedDeliveryId(null)}
                        className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg text-[8px] font-black uppercase tracking-widest pointer-events-auto hover:bg-emerald-600 transition"
                    >
                        Reset Vector View
                    </button>
                )}
            </div>

            {(!myLocation || !isOnline) && (
              <div className="absolute inset-0 z-30 bg-slate-900/10 backdrop-blur-sm flex items-center justify-center rounded-[3.5rem] m-4 pointer-events-none">
                 <div className="bg-white px-8 py-4 rounded-2xl shadow-xl flex items-center space-x-4">
                    {isOnline ? (
                      <>
                        <div className="w-5 h-5 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Establishing Secure Uplink...</span>
                      </>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Logistics Link Offline</span>
                    )}
                 </div>
              </div>
            )}
        </div>

        {/* Deliveries Context Area */}
        <div className="lg:col-span-4 space-y-8">
           <div className="flex justify-between items-center">
             <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Clinical Assignments</h2>
             <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest">{deliveries.length} Active</span>
           </div>
           
           <div className="space-y-6 max-h-[550px] overflow-y-auto custom-scrollbar pr-2">
             {deliveries.length > 0 ? deliveries.map(d => (
               <div 
                 key={d.id} 
                 onClick={() => setFocusedDeliveryId(d.id)}
                 className={`p-10 border rounded-[3.5rem] shadow-xl hover:shadow-2xl transition-all duration-300 animate-in slide-in-from-right-8 group cursor-pointer ${
                    focusedDeliveryId === d.id ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'
                 }`}
               >
                  <div className="mb-8 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest mb-1">Destination Hub</p>
                      <h3 className="text-2xl font-black text-slate-900 leading-tight">{d.patientName}</h3>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                        focusedDeliveryId === d.id ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-300 group-hover:text-emerald-600'
                    }`}>
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                  </div>

                  <div className={`p-6 rounded-2xl border mb-6 transition-all ${
                    focusedDeliveryId === d.id ? 'bg-white border-emerald-100' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Clinical Address</p>
                    <p className="text-xs text-slate-600 font-bold leading-relaxed">{d.patientAddress}</p>
                  </div>

                  <div className={`p-6 rounded-2xl border mb-8 transition-all ${
                    focusedDeliveryId === d.id ? 'bg-emerald-100/30 border-emerald-200' : 'bg-emerald-50/50 border-emerald-100'
                  }`}>
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Medication Package</p>
                    <div className="text-xs text-slate-700 font-bold">
                       <p className="mb-1">{d.medications}</p>
                       <p className="text-[9px] text-emerald-700 opacity-70 italic">{d.dosage}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {d.status === 'assigned' && (
                      <button 
                        disabled={!isOnline}
                        onClick={(e) => { e.stopPropagation(); updateDeliveryStatus(d.id, 'in_transit'); }} 
                        className="w-full bg-emerald-600 text-white py-5 rounded-[1.75rem] font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100 active:scale-95 disabled:opacity-50"
                      >
                        Initialize Route
                      </button>
                    )}
                    {d.status === 'in_transit' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateDeliveryStatus(d.id, 'delivered'); }} 
                        className="w-full bg-slate-900 text-white py-5 rounded-[1.75rem] font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition shadow-xl shadow-slate-200 active:scale-95"
                      >
                        Confirm Drop-off
                      </button>
                    )}
                    <div className="flex items-center justify-center space-x-3 px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl">
                      <div className={`w-1.5 h-1.5 rounded-full ${d.status === 'in_transit' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status: {d.status.replace('_', ' ')}</span>
                    </div>
                  </div>
               </div>
             )) : (
               <div className="text-center py-24 bg-slate-50 rounded-[4rem] border-4 border-dashed border-slate-100">
                 <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 shadow-sm">
                   <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                 </div>
                 <h3 className="text-lg font-black text-slate-900 tracking-tight">Logistics Deck Clear</h3>
                 <p className="text-slate-400 font-medium text-[10px] uppercase tracking-widest mt-1">Awaiting clinical dispatch signals...</p>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default DispatchDashboard;
