
import React, { useState, useEffect } from 'react';
import { User, UserRole, Appointment, Transaction } from '../types.ts';
import { ClinicalAPI } from '../services/apiService.ts';

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
    { label: 'Cloud Synchronized Patients', value: '0', trend: 'Global', color: 'blue' },
    { label: 'Active Specialists', value: '0', trend: 'Verified', color: 'purple' },
    { label: 'Consultations Today', value: '0', trend: 'Real-time', color: 'green' },
    { label: 'Network Revenue', value: '$0', trend: 'Authorized', color: 'indigo' },
  ]);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const users = await ClinicalAPI.getAllUsers();
    
    // In hybrid mode, we might need to sync stats differently
    const totalPatients = users.filter(u => u.role === UserRole.PATIENT).length;
    const activeConsultants = users.filter(u => u.role === UserRole.CONSULTANT && u.isApproved).length;
    
    // We'll use local stats for things not in profile
    const storedApps: Appointment[] = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const storedTrans: Transaction[] = JSON.parse(localStorage.getItem('medi_transactions') || '[]');
    const storedLogs: AuditLog[] = JSON.parse(localStorage.getItem('medi_audit_logs') || '[]');

    const appsToday = storedApps.filter(a => a.date === new Date().toISOString().split('T')[0]).length;
    const totalRevenue = storedTrans.reduce((acc, curr) => acc + curr.amount, 0);

    setLiveStats([
      { label: 'Cloud Identities', value: totalPatients.toLocaleString(), trend: 'Global', color: 'blue' },
      { label: 'Clinical Specialists', value: activeConsultants.toLocaleString(), trend: 'Verified', color: 'purple' },
      { label: 'Appointments Today', value: appsToday.toLocaleString(), trend: 'Live', color: 'green' },
      { label: 'Total Network Revenue', value: `$${totalRevenue.toLocaleString()}`, trend: 'Gross', color: 'indigo' },
    ]);

    setAllUsers(users);
    setAuditLogs(storedLogs);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('storage', fetchData);
    return () => window.removeEventListener('storage', fetchData);
  }, []);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await ClinicalAPI.updateUserStatus(userId, { role: newRole });
      fetchData();
      alert(`User role updated to ${newRole}`);
    } catch (e) {
      alert("Failed to update user role.");
    }
  };

  const handleApproveDoctor = async (userId: string) => {
    try {
      await ClinicalAPI.updateUserStatus(userId, { isApproved: true });
      fetchData();
      alert("Consultant credentials verified and approved.");
    } catch (e) {
      alert("Failed to approve consultant.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Central Command</h1>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-[0.2em]">Clinical Infrastructure Control</p>
        </div>
        <div className="flex space-x-4">
          <div className="px-6 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center">
            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3 animate-pulse"></span>
            System Node Active
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        {liveStats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{stat.label}</p>
            <div className="flex items-center justify-between">
              <h3 className="text-4xl font-black text-slate-900">{stat.value}</h3>
              <span className="text-[9px] font-black px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg uppercase tracking-widest">{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-12 space-y-10">
          <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden">
             <div className="mb-10 flex justify-between items-center">
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">Clinical Registry Management</h2>
               <button onClick={fetchData} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
                 <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               </button>
             </div>
             
             {loading ? (
                <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div></div>
             ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-50">
                        <th className="pb-4">Clinical Identity</th>
                        <th className="pb-4">Primary Role</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4 text-right">Administrative Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allUsers.map(u => (
                        <tr key={u.id} className="group transition-all hover:bg-slate-50/50">
                          <td className="py-6">
                            <div className="flex items-center space-x-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${u.role === UserRole.ADMIN ? 'bg-slate-900' : 'bg-emerald-600'}`}>
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-900">{u.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-6">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${
                              u.role === UserRole.ADMIN ? 'bg-slate-900 text-white' : 
                              u.role === UserRole.CONSULTANT ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-6">
                            <div className="flex items-center">
                              {u.isApproved ? (
                                <span className="flex items-center text-emerald-600 text-[9px] font-black uppercase tracking-widest">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>Verified
                                </span>
                              ) : (
                                <span className="flex items-center text-amber-500 text-[9px] font-black uppercase tracking-widest">
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-2 animate-pulse"></span>Pending Approval
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-6 text-right">
                            <div className="flex justify-end space-x-2">
                              {u.role === UserRole.CONSULTANT && !u.isApproved && (
                                <button 
                                  onClick={() => handleApproveDoctor(u.id)}
                                  className="px-4 py-2 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition"
                                >
                                  Approve
                                </button>
                              )}
                              <select 
                                onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                                value={u.role}
                                className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none focus:border-emerald-600"
                              >
                                <option value={UserRole.PATIENT}>Patient</option>
                                <option value={UserRole.CONSULTANT}>Consultant</option>
                                <option value={UserRole.ADMIN}>Admin</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             )}
          </section>

          <section className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400 mb-8">Clinical Event Log</h2>
              <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                {auditLogs.length > 0 ? auditLogs.map(log => (
                  <div key={log.id} className="p-5 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition">
                    <p className="text-[11px] font-black text-white mb-1 uppercase tracking-tight">{log.action}</p>
                    <p className="text-[9px] text-slate-500 font-bold leading-relaxed">{log.target} • {log.performedBy}</p>
                    <p className="text-[8px] text-slate-600 mt-2 font-mono uppercase">{log.timestamp}</p>
                  </div>
                )) : (
                  <div className="py-20 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">Awaiting system events...</div>
                )}
              </div>
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl"></div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
