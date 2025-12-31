
import React, { useState, useEffect } from 'react';
import { User, UserRole, Appointment, Transaction } from '../types';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

interface AdminDashboardProps {
  user: User;
}

interface AuditLog {
  id: string;
  action: string;
  target: string;
  performedBy: string;
  timestamp: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [liveStats, setLiveStats] = useState([
    { label: 'Total Patients', value: '0', trend: 'Updating...', color: 'blue' },
    { label: 'Active Consultants', value: '0', trend: 'Updating...', color: 'purple' },
    { label: 'Appointments Today', value: '0', trend: 'Updating...', color: 'green' },
    { label: 'Platform Revenue', value: '$0', trend: 'Updating...', color: 'indigo' },
  ]);

  const [allConsultants, setAllConsultants] = useState<User[]>([]);
  const [pendingConsultants, setPendingConsultants] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  
  // Forms visibility
  const [showAddConsultant, setShowAddConsultant] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  
  // New Consultant Form
  const [newCName, setNewCName] = useState('');
  const [newCEmail, setNewCEmail] = useState('');
  const [newCSpecialty, setNewCSpecialty] = useState('');
  
  // New Admin Form
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Mock analytics for graphs
  const registrationTrend = [
    { month: 'Jan', patients: 450, consultants: 12 },
    { month: 'Feb', patients: 520, consultants: 15 },
    { month: 'Mar', patients: 610, consultants: 18 },
    { month: 'Apr', patients: 580, consultants: 22 },
    { month: 'May', patients: 720, consultants: 25 },
    { month: 'Jun', patients: 890, consultants: 30 },
  ];

  const syncData = () => {
    const storedUsers: User[] = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
    const storedApps: Appointment[] = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const storedTrans: Transaction[] = JSON.parse(localStorage.getItem('medi_transactions') || '[]');
    const storedLogs: AuditLog[] = JSON.parse(localStorage.getItem('medi_audit_logs') || '[]');
    
    // Calculate Stats
    const totalPatients = storedUsers.filter(u => u.role === UserRole.PATIENT).length;
    const activeConsultants = storedUsers.filter(u => u.role === UserRole.CONSULTANT && u.isApproved).length;
    const today = new Date().toISOString().split('T')[0];
    const appsToday = storedApps.filter(a => a.date === today).length;
    const totalRevenue = storedTrans.reduce((acc, curr) => acc + curr.amount, 0);

    setLiveStats([
      { label: 'Total Patients', value: totalPatients.toLocaleString(), trend: '+ Live', color: 'blue' },
      { label: 'Active Consultants', value: activeConsultants.toLocaleString(), trend: '+ Active', color: 'purple' },
      { label: 'Appointments Today', value: appsToday.toLocaleString(), trend: 'Real-time', color: 'green' },
      { label: 'Platform Revenue', value: `$${totalRevenue.toLocaleString()}`, trend: 'Actual Total', color: 'indigo' },
    ]);

    // Update Rosters
    setAllConsultants(storedUsers.filter(u => u.role === UserRole.CONSULTANT && u.isApproved));
    setPendingConsultants(storedUsers.filter(u => u.role === UserRole.CONSULTANT && !u.isApproved));
    setAdmins(storedUsers.filter(u => u.role === UserRole.ADMIN));
    setAuditLogs(storedLogs);
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 5000);
    return () => clearInterval(interval);
  }, []);

  const pushAuditLog = (action: string, target: string) => {
    const newLog: AuditLog = { 
      id: Math.random().toString(36).substr(2, 9), 
      action, 
      target, 
      performedBy: user.name, 
      timestamp: new Date().toLocaleString() 
    };
    const storedLogs = JSON.parse(localStorage.getItem('medi_audit_logs') || '[]');
    const updated = [newLog, ...storedLogs].slice(0, 50);
    localStorage.setItem('medi_audit_logs', JSON.stringify(updated));
    setAuditLogs(updated);
  };

  const handleAddConsultantDirect = (e: React.FormEvent) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
    if (users.find((u: User) => u.email === newCEmail)) {
      alert("Email already registered.");
      return;
    }

    const newC: User = { 
      id: Math.random().toString(36).substr(2, 9), 
      name: newCName, 
      email: newCEmail, 
      role: UserRole.CONSULTANT, 
      specialty: newCSpecialty, 
      isApproved: true 
    };
    
    users.push(newC);
    localStorage.setItem('medi_registered_users', JSON.stringify(users));
    pushAuditLog('Onboarded Specialist', newC.name);
    
    setNewCName('');
    setNewCEmail('');
    setNewCSpecialty('');
    setShowAddConsultant(false);
    syncData();
  };

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
    if (users.find((u: User) => u.email === newAdminEmail)) {
      alert("Email already registered.");
      return;
    }

    const newAdmin: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: newAdminName,
      email: newAdminEmail,
      role: UserRole.ADMIN,
      isApproved: true
    };

    users.push(newAdmin);
    localStorage.setItem('medi_registered_users', JSON.stringify(users));
    pushAuditLog('Authorized Admin', newAdmin.name);
    
    setNewAdminName('');
    setNewAdminEmail('');
    setShowAddAdmin(false);
    syncData();
  };

  const handleRevokeAdmin = (id: string) => {
    if (id === user.id) {
      alert("Security Protocol: You cannot revoke your own administrative privileges.");
      return;
    }
    if (window.confirm("Revoke admin access?")) {
      const users = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
      const filtered = users.filter((u: User) => u.id !== id);
      localStorage.setItem('medi_registered_users', JSON.stringify(filtered));
      pushAuditLog('Admin Access Revoked', id);
      syncData();
    }
  };

  const handleApproveConsultant = (id: string) => {
    const users = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
    const updated = users.map((u: User) => u.id === id ? { ...u, isApproved: true } : u);
    localStorage.setItem('medi_registered_users', JSON.stringify(updated));
    pushAuditLog('Consultant Verified', id);
    syncData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-end mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">MediSphere Central</h1>
          <p className="text-slate-500 font-medium">Health System Infrastructure Dashboard</p>
        </div>
        <div className="bg-indigo-600 px-4 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-xl">Admin Node Active</div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {liveStats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
              <span className="text-[10px] font-bold px-3 py-1 bg-slate-50 text-indigo-600 rounded-lg">{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Governance & Audit */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Team Governance Section */}
          <section className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Team Governance</h2>
              <div className="flex space-x-2">
                <button 
                  onClick={() => { setShowAddConsultant(!showAddConsultant); setShowAddAdmin(false); }}
                  className={`p-2 rounded-xl border transition ${showAddConsultant ? 'bg-blue-600 border-blue-400' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  title="Onboard Consultant"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </button>
                <button 
                  onClick={() => { setShowAddAdmin(!showAddAdmin); setShowAddConsultant(false); }}
                  className={`p-2 rounded-xl border transition ${showAddAdmin ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  title="Add Admin"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>

            {/* Add Consultant Form */}
            {showAddConsultant && (
              <form onSubmit={handleAddConsultantDirect} className="mb-8 space-y-3 bg-white/5 p-6 rounded-3xl border border-white/5 animate-in slide-in-from-top-4">
                <p className="text-[10px] font-black text-blue-400 uppercase mb-2">New Medical Specialist</p>
                <input required placeholder="Dr. Name" value={newCName} onChange={e => setNewCName(e.target.value)} className="w-full bg-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input required type="email" placeholder="Email" value={newCEmail} onChange={e => setNewCEmail(e.target.value)} className="w-full bg-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input required placeholder="Specialty" value={newCSpecialty} onChange={e => setNewCSpecialty(e.target.value)} className="w-full bg-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <button type="submit" className="w-full bg-blue-600 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Complete Onboarding</button>
              </form>
            )}

            {/* Add Admin Form */}
            {showAddAdmin && (
              <form onSubmit={handleAddAdmin} className="mb-8 space-y-3 bg-indigo-900/20 p-6 rounded-3xl border border-indigo-500/20 animate-in slide-in-from-top-4">
                <p className="text-[10px] font-black text-indigo-400 uppercase mb-2">New Infrastructure Admin</p>
                <input required placeholder="Admin Name" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} className="w-full bg-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                <input required type="email" placeholder="Admin Email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="w-full bg-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                <button type="submit" className="w-full bg-indigo-600 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Authorize Access</button>
              </form>
            )}

            {/* Admin Roster */}
            <div className="space-y-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">System Administrators</p>
              {admins.map(adm => (
                <div key={adm.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-black text-xs">{adm.name.charAt(0)}</div>
                    <div>
                      <p className="text-xs font-bold">{adm.name} {adm.id === user.id && "(You)"}</p>
                      <p className="text-[9px] text-slate-500 truncate max-w-[120px]">{adm.email}</p>
                    </div>
                  </div>
                  {adm.id !== user.id && (
                    <button onClick={() => handleRevokeAdmin(adm.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-500 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Pending Verifications */}
          {pendingConsultants.length > 0 && (
            <section className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-200 shadow-sm animate-pulse-slow">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-amber-600 mb-6">Pending Verifications</h2>
              <div className="space-y-4">
                {pendingConsultants.map(pc => (
                  <div key={pc.id} className="bg-white p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{pc.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{pc.specialty}</p>
                    </div>
                    <button 
                      onClick={() => handleApproveConsultant(pc.id)}
                      className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition"
                    >
                      Verify
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Audit Trail */}
          <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Audit Trail</h2>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {auditLogs.length > 0 ? auditLogs.map(log => (
                <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[11px] font-black text-slate-900 mb-1">{log.action}</p>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight">By: {log.performedBy} • Target: {log.target}</p>
                  <p className="text-[9px] text-slate-400 mt-2">{log.timestamp}</p>
                </div>
              )) : (
                <p className="text-xs text-slate-400 italic text-center py-4">No recent events recorded.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Analytics & Specialist Roster */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Revenue Chart */}
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
            <div className="mb-10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Revenue Analytics</h2>
                <p className="text-slate-500 font-medium">Platform scaling trends and financial throughput</p>
              </div>
              <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold">
                Q2 Projections: +12%
              </div>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={registrationTrend}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="patients" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Clinical Specialist Network */}
          <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Verified Specialist Network</h2>
              <p className="text-sm text-slate-500 font-medium">Directory of medical providers with active credentials.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[9px] uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-8 py-4 font-black">Medical Provider</th>
                    <th className="px-8 py-4 font-black">Clinical Specialty</th>
                    <th className="px-8 py-4 font-black">Status</th>
                    <th className="px-8 py-4 font-black text-right">Identifier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allConsultants.length > 0 ? allConsultants.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg shadow-indigo-100">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">{c.specialty}</span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center text-green-600 text-[10px] font-black uppercase tracking-widest">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                          Verified
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right font-mono text-[10px] text-slate-300">
                        {c.id.toUpperCase()}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-10 text-center text-slate-400 text-sm italic">
                        No active consultants found. Onboard new providers using the Governance panel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
