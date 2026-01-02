
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, AppNotification } from '../types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
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
    const interval = setInterval(fetchNotifs, 10000);
    return () => {
      window.removeEventListener('storage', fetchNotifs);
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = () => {
    if (!user) return;
    const all: AppNotification[] = JSON.parse(localStorage.getItem('medi_notifications') || '[]');
    const updated = all.map(n => n.userId === user.id ? { ...n, isRead: true } : n);
    localStorage.setItem('medi_notifications', JSON.stringify(updated));
    setNotifications(updated.filter(n => n.userId === user.id));
  };

  const clearNotifications = () => {
    if (!user) return;
    const all: AppNotification[] = JSON.parse(localStorage.getItem('medi_notifications') || '[]');
    const updated = all.filter(n => n.userId !== user.id);
    localStorage.setItem('medi_notifications', JSON.stringify(updated));
    setNotifications([]);
    setIsNotifOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled ? 'bg-white/90 backdrop-blur-2xl py-4 shadow-xl shadow-slate-200/20' : 'bg-transparent py-8'
    }`}>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-4 group">
              <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-xl shadow-emerald-200 group-hover:rotate-12 transition-transform">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase">BYINKS <span className="text-emerald-600">HEALTH</span></span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-12">
            <div className="flex space-x-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              <Link to="/find-doctor" className={`${location.pathname === '/find-doctor' ? 'text-emerald-600' : 'hover:text-emerald-600'} transition`}>Our Doctors</Link>
              <Link to="/services" className={`${location.pathname === '/services' ? 'text-emerald-600' : 'hover:text-emerald-600'} transition`}>Services</Link>
              <Link to="/contact" className={`${location.pathname === '/contact' ? 'text-emerald-600' : 'hover:text-emerald-600'} transition`}>Contact</Link>
            </div>
            
            <div className="flex items-center space-x-6">
              {user ? (
                <div className="flex items-center space-x-6">
                  <div className="relative" ref={notifRef}>
                    <button 
                      onClick={() => { setIsNotifOpen(!isNotifOpen); if(!isNotifOpen) markAsRead(); }}
                      className="p-3 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition relative"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                      {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                      )}
                    </button>

                    {isNotifOpen && (
                      <div className="absolute right-0 mt-6 w-96 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Clinical Alerts</h4>
                          <button onClick={clearNotifications} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition">Clear All</button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3 custom-scrollbar">
                          {notifications.length > 0 ? notifications.map(n => (
                            <div key={n.id} className={`p-5 rounded-2xl border ${n.isRead ? 'bg-white border-slate-50' : 'bg-emerald-50/30 border-emerald-100'} transition`}>
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">{n.title}</span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">{n.message}</p>
                            </div>
                          )) : (
                            <div className="py-20 text-center">
                              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                              </div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No new alerts</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] font-black text-slate-900 leading-none">{user.name}</p>
                    <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest mt-1">{user.role}</p>
                  </div>
                  <Link to="/dashboard" className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition shadow-2xl shadow-slate-200">
                    Dashboard
                  </Link>
                  <button 
                    onClick={() => { onLogout(); navigate('/'); }}
                    className="p-3 bg-slate-100 text-slate-400 hover:text-red-500 rounded-2xl transition"
                    title="Logout"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link to="/login" className="text-slate-900 hover:text-emerald-600 font-black text-[10px] uppercase tracking-widest px-6 py-3 transition">
                    Sign In
                  </Link>
                  <Link to="/login" className="bg-emerald-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 hover:scale-105 transition-all shadow-xl shadow-emerald-200">
                    Portal Access
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
