
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, AppNotification } from '../types.ts';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const [syncToken, setSyncToken] = useState('');
  const [syncEmail, setSyncEmail] = useState('');

  const syncRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchNotifs = () => {
      if (!user) return;
      const all: AppNotification[] = JSON.parse(localStorage.getItem('medi_notifications') || '[]');
      setNotifications(all.filter(n => n.userId === user.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };

    fetchNotifs();
    window.addEventListener('storage', fetchNotifs);
    return () => window.removeEventListener('storage', fetchNotifs);
  }, [user]);

  const handleExport = () => {
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
    alert("Clinical Data Token Copied! Paste this in the Sync Hub on your target device.");
  };

  const handleImport = () => {
    try {
      if (!syncToken.trim()) {
        alert("Please provide a Clinical Token for synchronization.");
        return;
      }
      const raw = atob(syncToken);
      const data = JSON.parse(raw);
      
      // If user is logged in, we verify the email
      if (user && syncEmail && user.email.toLowerCase() !== syncEmail.toLowerCase()) {
        alert("Verification Mismatch: The provided email does not match your active clinical identity.");
        return;
      }

      if (data.users) localStorage.setItem('medi_registered_users', data.users);
      if (data.apps) localStorage.setItem('medi_appointments', data.apps);
      if (data.trans) localStorage.setItem('medi_transactions', data.trans);
      if (data.logs) localStorage.setItem('medi_audit_logs', data.logs);
      if (data.avail) localStorage.setItem('medi_availability', data.avail);
      if (data.notifs) localStorage.setItem('medi_notifications', data.notifs);

      alert("Clinical Synchronization Finalized! System is refreshing to update clinical records.");
      setIsSyncOpen(false);
      window.location.reload(); 
    } catch (e) {
      alert("Synchronization Error: The provided token is invalid or corrupted.");
    }
  };

  const clearStorage = () => {
    if (confirm("Clinical Hazard: Permanent deletion of all hospital records. Proceed?")) {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('medi_') || key.startsWith('chat_')) localStorage.removeItem(key);
      });
      alert("Local Infrastructure Purged.");
      window.location.reload();
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled || isMobileMenuOpen ? 'bg-white/95 backdrop-blur-2xl py-4 shadow-xl shadow-slate-200/20' : 'bg-transparent py-8'
    }`}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" onClick={closeMobileMenu} className="flex items-center space-x-4 group">
              <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-xl shadow-emerald-200 group-hover:rotate-12 transition-transform">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase whitespace-nowrap">BYINKS <span className="text-emerald-600">HEALTH</span></span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <div className="flex space-x-8 text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
              <Link to="/find-doctor" className={`${location.pathname === '/find-doctor' ? 'text-emerald-600' : 'hover:text-emerald-600'} transition`}>Doctors</Link>
              <Link to="/services" className={`${location.pathname === '/services' ? 'text-emerald-600' : 'hover:text-emerald-600'} transition`}>Clinical</Link>
              <Link to="/contact" className={`${location.pathname === '/contact' ? 'text-emerald-600' : 'hover:text-emerald-600'} transition`}>Help</Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setIsSyncOpen(true)}
                className="p-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-2xl transition group relative shadow-inner"
                title="Global Sync Mobility Hub"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
              </button>

              {user ? (
                <div className="flex items-center space-x-4">
                  <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-3 bg-slate-50 text-slate-400 hover:text-emerald-600 rounded-2xl transition relative">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
                  </button>
                  <Link to="/dashboard" className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition">Dashboard</Link>
                  <button onClick={() => { onLogout(); navigate('/'); }} className="p-3 bg-slate-50 text-slate-400 hover:text-red-500 rounded-2xl transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </button>
                </div>
              ) : (
                <Link to="/login" className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition">Portal Access</Link>
              )}
            </div>
          </div>

          <div className="md:hidden flex items-center space-x-4">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-3 bg-slate-50 text-slate-900 rounded-2xl transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{isMobileMenuOpen ? <path strokeWidth="3" d="M6 18L18 6M6 6l12 12" /> : <path strokeWidth="3" d="M4 8h16M4 16h16" />}</svg>
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-slate-50 shadow-2xl z-[100] animate-in slide-in-from-top-4">
          <div className="p-8 space-y-6">
            <Link to="/find-doctor" onClick={closeMobileMenu} className="block text-xs font-black uppercase tracking-widest text-slate-900">Doctors</Link>
            <Link to="/services" onClick={closeMobileMenu} className="block text-xs font-black uppercase tracking-widest text-slate-900">Services</Link>
            <button onClick={() => { setIsSyncOpen(true); closeMobileMenu(); }} className="block text-xs font-black uppercase tracking-widest text-emerald-600">Clinical Sync Hub</button>
            <div className="pt-6 border-t border-slate-50">
              {user ? (
                <Link to="/dashboard" onClick={closeMobileMenu} className="block w-full py-4 bg-slate-900 text-white text-center rounded-2xl text-[10px] font-black uppercase tracking-widest">Dashboard</Link>
              ) : (
                <Link to="/login" onClick={closeMobileMenu} className="block w-full py-4 bg-emerald-600 text-white text-center rounded-2xl text-[10px] font-black uppercase tracking-widest">Portal Access</Link>
              )}
            </div>
          </div>
        </div>
      )}

      {isSyncOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsSyncOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[3.5rem] shadow-2xl p-10 overflow-hidden" ref={syncRef}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-50"></div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 relative z-10">Administrative Sync Hub</h3>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-8 relative z-10">Identity & Infrastructure Mobility</p>
            
            <div className="space-y-8 relative z-10">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Export Protocol</h4>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">Generate a secure token for this terminal.</p>
                <button onClick={handleExport} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100">Copy Sync Token</button>
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Import & Verify</h4>
                <input 
                  type="email" 
                  value={syncEmail} 
                  onChange={(e) => setSyncEmail(e.target.value)} 
                  placeholder="Clinical Identity (Email)" 
                  className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold mb-3 outline-none focus:border-emerald-600" 
                />
                <textarea 
                  value={syncToken} 
                  onChange={(e) => setSyncToken(e.target.value)} 
                  placeholder="Paste clinical token here..." 
                  className="w-full h-24 p-4 bg-white border border-slate-200 rounded-2xl text-[9px] font-mono outline-none focus:border-emerald-600 mb-4" 
                />
                <button onClick={handleImport} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition shadow-xl">Authorize & Overwrite</button>
              </div>

              {user?.role === UserRole.ADMIN && (
                <div className="pt-4 text-center border-t border-slate-100">
                  <button onClick={clearStorage} className="text-red-500 text-[9px] font-black uppercase tracking-widest hover:underline">Clear Local Infrastructure</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
