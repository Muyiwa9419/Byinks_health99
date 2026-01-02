
import React, { useState, useEffect } from 'react';
import { User, UserRole, Appointment, Transaction } from '../types.ts';
import { 
  AreaChart, Area, 
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
    { label: 'Cloud Synchronized Patients', value: '0', trend: 'Global', color: 'blue' },
    { label: 'Active Specialists', value: '0', trend: 'Verified', color: 'purple' },
    { label: 'Consultations Today', value: '0', trend: 'Real-time', color: 'green' },
    { label: 'Network Revenue', value: '$0', trend: 'Authorized', color: 'indigo' },
  ]);

  const [allConsultants, setAllConsultants] = useState<User[]>([]);
  const [pendingConsultants, setPendingConsultants] = useState<User[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [syncToken, setSyncToken] = useState('');

  const syncData = () => {
    const storedUsers: User[] = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');
    const storedApps: Appointment[] = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const storedTrans: Transaction[] = JSON.parse(localStorage.getItem('medi_transactions') || '[]');
    const storedLogs: AuditLog[] = JSON.parse(localStorage.getItem('medi_audit_logs') || '[]');
    
    const totalPatients = storedUsers.filter(u => u.role === UserRole.PATIENT).length;
    const activeConsultants = storedUsers.filter(u => u.role === UserRole.CONSULTANT && u.isApproved).length;
    const appsToday = storedApps.filter(a => a.date === new Date().toISOString().split('T')[0]).length;
    const totalRevenue = storedTrans.reduce((acc, curr) => acc + curr.amount, 0);

    setLiveStats([
      { label: 'Cloud Identities', value: totalPatients.toLocaleString(), trend: 'Global', color: 'blue' },
      { label: 'Clinical Specialists', value: activeConsultants.toLocaleString(), trend: 'Verified', color: 'purple' },
      { label: 'Appointments Today', value: appsToday.toLocaleString(), trend: 'Live', color: 'green' },
      { label: 'Total Network Revenue', value: `$${totalRevenue.toLocaleString()}`, trend: 'Gross', color: 'indigo' },
    ]);

    setAllConsultants(storedUsers.filter(u => u.role === UserRole.CONSULTANT && u.isApproved));
    setPendingConsultants(storedUsers.filter(u => u.role === UserRole.CONSULTANT && !u.isApproved));
    setAdmins(storedUsers.filter(u => u.role === UserRole.ADMIN));
    setAuditLogs(storedLogs);
  };

  useEffect(() => {
    syncData();
    window.addEventListener('storage', syncData);
    return () => window.removeEventListener('storage', syncData);
  }, []);

  const generateSyncToken = () => {
    const data = {
      users: localStorage.getItem('medi_registered_users'),
      apps: localStorage.getItem('medi_appointments'),
      trans: localStorage.getItem('medi_transactions'),
      logs: localStorage.getItem('medi_audit_logs'),
      avail: localStorage.getItem('medi_availability'),
      notifs: localStorage.getItem('medi_notifications')
    };
    const token = btoa(JSON.stringify(data));
    setSyncToken(token);
    navigator.clipboard.writeText(token);
    alert("Byinks Global Cloud Token generated and copied. Paste this on the Login screen of another device to synchronize.");
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Central Command</h1>
          <p className="text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-[0.2em]">Global Clinical Infrastructure</p>
        </div>
        <div className="flex space-x-4">
          <button 
            onClick={() => { setShowSyncPanel(!showSyncPanel); if(!showSyncPanel) generateSyncToken(); }}
            className="px-8 py-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition shadow-2xl shadow-emerald-200"
          >
            Provision New Cloud Node
          </button>
          <div className="px-6 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center">
            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3 animate-pulse"></span>
            Byinks Cloud Active
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
        <div className="lg:col-span-8 space-y-10">
          <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden">
             <div className="mb-10 flex justify-between items-center">
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">Staffing Hub</h2>
               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Global Practitioner Directory</span>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-50">
                     <th className="pb-4">Specialist</th>
                     <th className="pb-4">Clinical Department</th>
                     <th className="pb-4">Cloud Status</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {allConsultants.map(c => (
                     <tr key={c.id} className="group transition-all hover:bg-slate-50/50">
                       <td className="py-6">
                         <div className="flex items-center space-x-4">
                           <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center font-black text-white">{c.name.charAt(0)}</div>
                           <div><p className="text-sm font-black text-slate-900">{c.name}</p><p className="text-[10px] text-slate-400 font-bold">{c.email}</p></div>
                         </div>
                       </td>
                       <td className="py-6"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg">{c.specialty}</span></td>
                       <td className="py-6"><div className="flex items-center text-emerald-600 text-[9px] font-black uppercase tracking-widest"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>Synchronized</div></td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-10">
           <section className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400 mb-8">System Audit Log</h2>
              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-5 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition">
                    <p className="text-[11px] font-black text-white mb-1 uppercase tracking-tight">{log.action}</p>
                    <p className="text-[9px] text-slate-500 font-bold leading-relaxed">{log.target} • {log.performedBy}</p>
                    <p className="text-[8px] text-slate-600 mt-2 font-mono uppercase">{log.timestamp}</p>
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl"></div>
           </section>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
