
import React, { useState, useEffect } from 'react';
import { User, UserRole, Appointment, Transaction, SyncRequest } from '../types.ts';
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
  const [activeTab, setActiveTab] = useState<'users' | 'sync'>('users');
  const [liveStats, setLiveStats] = useState([
    { label: 'Cloud Identities', value: '0', trend: 'Global', color: 'blue' },
    { label: 'Clinical Specialists', value: '0', trend: 'Verified', color: 'purple' },
    { label: 'Appointments Today', value: '0', trend: 'Real-time', color: 'green' },
    { label: 'Total Revenue', value: '$0', trend: 'Authorized', color: 'indigo' },
  ]);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [syncRequests, setSyncRequests] = useState<SyncRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);

  // Onboarding Form State
  setOnboardForm({
  name: '',
  email: '',
  password: '',
  role: UserRole.CONSULTANT,
  specialty: ''
});

  const fetchData = async () => {
    setLoading(true);
    const users = await ClinicalAPI.getAllUsers();
    const syncs = await ClinicalAPI.getSyncRequests();
    
    const totalPatients = users.filter(u => u.role === UserRole.PATIENT).length;
    const activeConsultants = users.filter(u => (u.role === UserRole.CONSULTANT || u.role === UserRole.PHARMACY || u.role === UserRole.DISPATCH) && u.isApproved).length;
    
    const appointments =
  await ClinicalAPI.getAppointments();
    const storedTrans: Transaction[] = JSON.parse(localStorage.getItem('medi_transactions') || '[]');
    const storedLogs: AuditLog[] = JSON.parse(localStorage.getItem('medi_audit_logs') || '[]');

    const appsToday = storedApps.filter(a => a.date === new Date().toISOString().split('T')[0]).length;
    const totalRevenue = storedTrans.reduce((acc, curr) => acc + curr.amount, 0);

    setLiveStats([
      { label: 'Total Identities', value: users.length.toString(), trend: 'Global', color: 'blue' },
      { label: 'Verified Staff', value: activeConsultants.toLocaleString(), trend: 'Verified', color: 'purple' },
      { label: 'Appointments Today', value: appsToday.toLocaleString(), trend: 'Live', color: 'green' },
      { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, trend: 'Gross', color: 'indigo' },
    ]);

    setAllUsers(users);
    setSyncRequests(syncs);
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
    } catch (e) { alert("Failed to update user role."); }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await ClinicalAPI.updateUserStatus(userId, { isApproved: true });
      fetchData();
    } catch (e) { alert("Failed to approve user."); }
  };

  const handleApproveAllPending = async () => {
    const pendingUsers = allUsers.filter(u => !u.isApproved);
    if (pendingUsers.length === 0) {
      alert("No pending applications found.");
      return;
    }
    
    if (!confirm(`Clinical Protocol: Are you sure you want to approve all ${pendingUsers.length} pending applications?`)) return;

    try {
      for (const u of pendingUsers) {
        await ClinicalAPI.updateUserStatus(u.id, { isApproved: true });
      }
      fetchData();
      alert(`Success: All ${pendingUsers.length} identities verified.`);
    } catch (e) {
      alert("System Error during bulk verification.");
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (userId === user.id) {
      alert("Infrastructure Lockout Prevention: You cannot decommission your own administrative identity.");
      return;
    }

    if (!confirm(`Clinical Hazard: You are about to permanently remove ${userName} from the MediSphere clinical registry. This action is irreversible and will synchronize across all nodes. Proceed?`)) {
      return;
    }

    try {
      await ClinicalAPI.removeUser(userId);
      fetchData();
    } catch (e) {
      alert("System Error: Failed to decommission clinical identity.");
    }
  };

  const handleUpdateSyncStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      await ClinicalAPI.updateSyncRequestStatus(requestId, status);
      fetchData();
      alert(`Device sync request ${status}.`);
    } catch (e) { alert("Failed to update sync request."); }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newUser: User = {
  id: '', 
  name: onboardForm.name,
  email: onboardForm.email.toLowerCase(),
  password: onboardForm.password,
  role: onboardForm.role,
  specialty: onboardForm.role === UserRole.CONSULTANT
    ? onboardForm.specialty
    : undefined,
  isApproved: true
};
      await ClinicalAPI.adminCreateUser(newUser);
      setIsOnboardOpen(false);
      setOnboardForm({ name: '', email: '', role: UserRole.CONSULTANT, specialty: '' });
      fetchData();
      alert("Account provisioned successfully.");
    } catch (err: any) { alert(err.message || "Failed to onboard identity."); }
  };

  const pendingCount = allUsers.filter(u => !u.isApproved).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Central Command</h1>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-[0.2em]">Clinical Infrastructure Control</p>
        </div>
        <div className="flex space-x-4">
          {pendingCount > 0 && (
            <button 
              onClick={handleApproveAllPending}
              className="px-6 py-4 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition shadow-sm"
            >
              Approve All Pending ({pendingCount})
            </button>
          )}
          <button onClick={() => setIsOnboardOpen(true)} className="px-6 py-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition">
            Onboard Identity
          </button>
          <div className="hidden lg:flex px-6 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl items-center">
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

      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/20">
        <div className="flex space-x-8 border-b border-slate-50 mb-10">
          <button onClick={() => setActiveTab('users')} className={`pb-6 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}>Clinical Registry</button>
          <button onClick={() => setActiveTab('sync')} className={`pb-6 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'sync' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400'}`}>
            Sync Authorizations
            {syncRequests.filter(r => r.status === 'pending').length > 0 && <span className="absolute top-0 -right-2 w-2 h-2 bg-amber-500 rounded-full"></span>}
          </button>
        </div>

        {activeTab === 'users' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-4">Clinical Identity</th>
                  <th className="pb-4">Role</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allUsers.map(u => (
                  <tr key={u.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                    <td className="py-6">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${u.role === UserRole.ADMIN ? 'bg-slate-900' : 'bg-emerald-600'}`}>{u.name.charAt(0)}</div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{u.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-6">
                      <div className="flex flex-col">
                        <span className={`inline-block w-fit text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${u.role === UserRole.ADMIN ? 'bg-slate-900 text-white' : 'bg-emerald-50 text-emerald-600'}`}>{u.role}</span>
                        {u.specialty && <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase ml-1">{u.specialty}</span>}
                      </div>
                    </td>
                    <td className="py-6">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${u.isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500 animate-pulse'}`}>
                        {u.isApproved ? 'Verified' : 'Pending Verification'}
                      </span>
                    </td>
                    <td className="py-6 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        {!u.isApproved && (
                          <button onClick={() => handleApproveUser(u.id)} className="px-4 py-2 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition shadow-md shadow-emerald-100">Verify</button>
                        )}
                        <select onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)} value={u.role} className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none focus:border-emerald-500 transition">
                          <option value={UserRole.PATIENT}>Patient</option>
                          <option value={UserRole.CONSULTANT}>Consultant</option>
                          <option value={UserRole.PHARMACY}>Pharmacy</option>
                          <option value={UserRole.DISPATCH}>Dispatch</option>
                          <option value={UserRole.ADMIN}>Admin</option>
                        </select>
                        {u.id !== user.id && (
                          <button 
                            onClick={() => handleRemoveUser(u.id, u.name)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Decommission Identity"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
            {syncRequests.length > 0 ? syncRequests.map(req => (
              <div key={req.id} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center space-x-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white ${req.status === 'approved' ? 'bg-emerald-600' : req.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 tracking-tight">Sync Authorization: {req.requesterEmail}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{req.deviceInfo} • {new Date(req.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  {req.status === 'pending' ? (
                    <>
                      <button onClick={() => handleUpdateSyncStatus(req.id, 'approved')} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100">Authorize Sync</button>
                      <button onClick={() => handleUpdateSyncStatus(req.id, 'rejected')} className="px-8 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition">Reject</button>
                    </>
                  ) : (
                    <span className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                      {req.status === 'approved' ? 'Authorization Granted' : 'Rejected'}
                    </span>
                  )}
                </div>
              </div>
            )) : (
              <div className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">No pending device sync requests.</div>
            )}
          </div>
        )}
      </div>

      {isOnboardOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsOnboardOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[3.5rem] shadow-2xl p-10">
            <h3 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Direct Clinical Onboarding</h3>
            <form onSubmit={handleOnboardSubmit} className="space-y-6">
              <input 
              required 
              placeholder="Identity Name / Entity Name" 
              value={onboardForm.name} 
              onChange={(e) => setOnboardForm({...onboardForm, name: e.target.value})} 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition" />
              <input required type="email" placeholder="Clinical Email Identifier" value={onboardForm.email} onChange={(e) => setOnboardForm({...onboardForm, email: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition" />
              <input
  required
  type="password"
  placeholder="Temporary Login Password"
  value={onboardForm.password}
  onChange={(e) =>
    setOnboardForm({
      ...onboardForm,
      password: e.target.value
    })
  }
  minLength={8}
  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition"
/>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select System Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { role: UserRole.CONSULTANT, label: 'Specialist' },
                    { role: UserRole.PHARMACY, label: 'Pharmacy' },
                    { role: UserRole.DISPATCH, label: 'Logistics' },
                    { role: UserRole.ADMIN, label: 'Admin' },
                  ].map((r) => (
                    <button 
                      key={r.role}
                      type="button" 
                      onClick={() => setOnboardForm({...onboardForm, role: r.role})} 
                      className={`py-3 text-[9px] font-black rounded-xl transition uppercase tracking-widest border-2 ${onboardForm.role === r.role ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-slate-50 border-slate-50 text-slate-400 hover:border-emerald-100'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {onboardForm.role === UserRole.CONSULTANT && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Clinical Specialty</label>
                  <input required placeholder="e.g. Cardiology, Neurology" value={onboardForm.specialty} onChange={(e) => setOnboardForm({...onboardForm, specialty: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-emerald-600 transition" />
                </div>
              )}

              <button type="submit" className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition shadow-xl shadow-emerald-200 mt-4">
                Authorize System Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
