
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole } from './types';
import HospitalHome from './pages/HospitalHome';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import PatientProfile from './pages/PatientProfile';
import ConsultantDashboard from './pages/ConsultantDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';

const PendingApproval: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white p-12 rounded-3xl shadow-xl max-w-lg text-center border border-slate-100">
      <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Approval Pending</h2>
      <p className="text-slate-600 mb-8 leading-relaxed">
        Your consultant account has been registered successfully. For security reasons, a MediSphere administrator must review and approve your credentials before you can access the dashboard.
      </p>
      <div className="flex flex-col gap-3">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-500 italic">
          Typical review time: 1-2 business days.
        </div>
        <button 
          onClick={onLogout}
          className="text-blue-600 font-bold hover:underline"
        >
          Sign out and check back later
        </button>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('medi_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('medi_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('medi_user');
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('medi_user', JSON.stringify(updatedUser));

    const storedUsers: User[] = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
    const updatedUsers = storedUsers.map(u => u.id === updatedUser.id ? updatedUser : u);
    localStorage.setItem('medi_registered_users', JSON.stringify(updatedUsers));
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar user={user} onLogout={handleLogout} />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HospitalHome />} />
            <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} />
            <Route 
              path="/dashboard" 
              element={
                !user ? <Navigate to="/login" /> :
                user.role === UserRole.PATIENT ? <PatientDashboard user={user} /> :
                user.role === UserRole.CONSULTANT ? (
                  user.isApproved ? <ConsultantDashboard user={user} /> : <PendingApproval onLogout={handleLogout} />
                ) :
                <AdminDashboard user={user} />
              } 
            />
            <Route 
              path="/profile" 
              element={
                !user || user.role !== UserRole.PATIENT ? <Navigate to="/login" /> :
                <PatientProfile user={user} onUpdateUser={handleUpdateUser} />
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
