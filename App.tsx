
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole, Appointment, AppNotification } from './types.ts';
import HospitalHome from './pages/HospitalHome.tsx';
import Login from './pages/Login.tsx';
import PatientDashboard from './pages/PatientDashboard.tsx';
import PatientProfile from './pages/PatientProfile.tsx';
import ConsultantDashboard from './pages/ConsultantDashboard.tsx';
import AdminDashboard from './pages/AdminDashboard.tsx';
import FindDoctor from './pages/FindDoctor.tsx';
import Services from './pages/Services.tsx';
import Contact from './pages/Contact.tsx';
import Navbar from './components/Navbar.tsx';
import { ClinicalAPI, supabase } from './services/apiService.ts';

const Toast: React.FC<{ notification: AppNotification; onClose: () => void }> = ({ notification, onClose }) => (
  <div className="fixed top-24 right-6 z-[300] w-80 bg-white rounded-[2rem] border-2 border-emerald-100 shadow-2xl p-6 animate-in slide-in-from-right-8 fade-in duration-500">
    <div className="flex justify-between items-start mb-2">
      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{notification.title}</span>
      <button onClick={onClose} className="text-slate-300 hover:text-slate-900 transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
    <p className="text-xs text-slate-700 font-medium leading-relaxed">{notification.message}</p>
    <div className="mt-4 flex items-center text-[8px] font-black text-slate-300 uppercase tracking-widest">
      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>
      Session Event Recorded
    </div>
  </div>
);

const PendingApproval: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <div className="min-h-[calc(100vh-128px)] flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white p-12 rounded-3xl shadow-xl max-w-lg text-center border border-slate-100">
      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Verification Pending</h2>
      <p className="text-slate-600 mb-8 leading-relaxed">
        Your clinical account is being reviewed. Our team usually verifies credentials within 12-24 hours.
      </p>
      <button onClick={onLogout} className="text-emerald-600 font-black text-sm uppercase tracking-widest hover:underline">Sign out and return later</button>
    </div>
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

  useEffect(() => {
    // Seed default data for local testing
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

    // Setup Cross-Device Global Sync Listener
    const systemChannel = ClinicalAPI.subscribeToGlobalSystem((payload) => {
      console.log("Cloud Sync Event Received:", payload.type);
      // Trigger a local refresh by firing a storage event manually
      // Components like PatientDashboard/ConsultantDashboard listen for 'storage'
      window.dispatchEvent(new Event('storage'));
      
      // If we are on the Admin Dashboard or similar, this will force re-fetches
    });

    let authSubscription: any = null;
    if (ClinicalAPI.isConfigured()) {
      const { data } = supabase!.auth.onAuthStateChange(async (event, session) => {
        if (session) {
          const profile = await ClinicalAPI.getProfile(session.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
      });
      authSubscription = data.subscription;
    }

    return () => {
      authSubscription?.unsubscribe();
      systemChannel?.unsubscribe();
    };
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
  };

  const handleLogout = async () => {
    await ClinicalAPI.signOut();
    setUser(null);
  };

  const handleUpdateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    await ClinicalAPI.saveProfile(updatedUser);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
        <Navbar user={user} onLogout={handleLogout} />
        
        {activeToast && <Toast notification={activeToast} onClose={() => setActiveToast(null)} />}

        <main className="flex-grow pt-32">
          <Routes>
            <Route path="/" element={<HospitalHome />} />
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} />
            <Route path="/find-doctor" element={<FindDoctor />} />
            <Route path="/services" element={<Services />} />
            <Route path="/contact" element={<Contact />} />
            <Route 
              path="/dashboard" 
              element={
                !user ? <Navigate to="/login" /> :
                user.role === UserRole.PATIENT ? <PatientDashboard user={user} /> :
                user.role === UserRole.CONSULTANT ? (
                  user.isApproved ? <ConsultantDashboard user={user} /> : <PendingApproval onLogout={handleLogout} />
                ) :
                user.role === UserRole.ADMIN ? <AdminDashboard user={user} /> :
                <Navigate to="/" />
              } 
            />
            <Route 
              path="/profile" 
              element={
                !user || user.role !== UserRole.PATIENT ? <Navigate to="/login" /> :
                <PatientProfile user={user} onUpdateUser={handleUpdateUser} />
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
