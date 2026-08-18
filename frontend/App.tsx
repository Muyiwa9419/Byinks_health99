
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole, Appointment, AppNotification } from './types.ts';
import HospitalHome from './pages/HospitalHome.tsx';
import Login from './pages/Login.tsx';
import PatientDashboard from './pages/PatientDashboard.tsx';
import PatientProfile from './pages/PatientProfile.tsx';
import ConsultantDashboard from './pages/ConsultantDashboard.tsx';
import AdminDashboard from './pages/AdminDashboard.tsx';
import PharmacyDashboard from './pages/PharmacyDashboard.tsx';
import DispatchDashboard from './pages/DispatchDashboard.tsx';
import FindDoctor from './pages/FindDoctor.tsx';
import Services from './pages/Services.tsx';
import Contact from './pages/Contact.tsx';
import Navbar from './components/Navbar.tsx';
import { ClinicalAPI, supabase } from './services/apiService.ts';
import ConsultantProfile from './pages/ConsultantProfile';

const CloudPulse = () => (
  <div className="fixed bottom-6 right-6 z-[500] flex items-center space-x-3 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-emerald-100 shadow-lg animate-in fade-in slide-in-from-bottom-4">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
    </span>
    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Clinical Cloud Sync Active</span>
  </div>
);

const Toast: React.FC<{ notification: AppNotification; onClose: () => void }> = ({ notification, onClose }) => (
  <div className="fixed top-24 right-6 z-[300] w-80 bg-white rounded-[2rem] border-2 border-emerald-100 shadow-2xl p-6 animate-in slide-in-from-right-8 fade-in duration-500">
    <div className="flex justify-between items-start mb-2">
      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{notification.title}</span>
      <button onClick={onClose} className="text-slate-300 hover:text-slate-900 transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
    <p className="text-xs text-slate-700 font-medium leading-relaxed">{notification.message}</p>
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    ClinicalAPI.seedDefaultData();
    const checkSession = async () => {
      try {
        if (ClinicalAPI.isConfigured()) {
          const { data: { session } } = await supabase!.auth.getSession();
          if (session) {
            const profile = await ClinicalAPI.getProfile(session.user.id);
            setUser(profile);
          }
        } else {
          const saved = localStorage.getItem('medi_local_session');
          if (saved) setUser(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Session recovery failed:", e);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
    const systemChannel = ClinicalAPI.subscribeToGlobalSystem((payload) => {
      if (payload.type === 'COLLECTION_UPDATE' && payload.data) {
        setIsSyncing(true);
        const { key, data } = payload.data;
        localStorage.setItem(key, JSON.stringify(data));
        window.dispatchEvent(new Event('storage'));
        setTimeout(() => setIsSyncing(false), 2000);
      }
    });
    return () => { systemChannel?.unsubscribe(); };
  }, []);

  const handleLogin = (u: User) => setUser(u);
  const handleLogout = async () => { await ClinicalAPI.signOut(); setUser(null); };
  const handleUpdateUser = async (updatedUser: User) => { setUser(updatedUser); await ClinicalAPI.saveProfile(updatedUser); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderDashboard = () => {
    if (!user) return <Navigate to="/login" />;
    switch (user.role) {
      case UserRole.PATIENT: return <PatientDashboard user={user} />;
      case UserRole.CONSULTANT: return <ConsultantDashboard user={user} />;
      case UserRole.ADMIN: return <AdminDashboard user={user} />;
      case UserRole.PHARMACY: return <PharmacyDashboard user={user} />;
      case UserRole.DISPATCH: return <DispatchDashboard user={user} />;
      default: return <Navigate to="/" />;
    }
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar user={user} onLogout={handleLogout} />
        {activeToast && <Toast notification={activeToast} onClose={() => setActiveToast(null)} />}
        {ClinicalAPI.isConfigured() && <CloudPulse />}
        <main className="flex-grow pt-32">
          <Routes>
            <Route path="/" element={<HospitalHome />} />
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} />
            <Route path="/find-doctor" element={<FindDoctor />} />
            <Route path="/services" element={<Services />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/dashboard" element={renderDashboard()} />
            <Route path="/profile/:id?" element={!user ? <Navigate to="/login" /> : <PatientProfile user={user} onUpdateUser={handleUpdateUser} />} />
            <Route path="*" element={<Navigate to="/" />} />
            <Route
  path="/consultant/profile"
  element={<ConsultantProfile user={user} />}
/>
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
