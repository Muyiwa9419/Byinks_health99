
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const isLanding = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
              <span className="text-2xl font-black text-slate-900 tracking-tighter">BYINKS <span className="text-emerald-600">HEALTH</span></span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-12">
            {!user && isLanding && (
              <div className="flex space-x-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                <a href="#" className="hover:text-emerald-600 transition">Our Doctors</a>
                <a href="#" className="hover:text-emerald-600 transition">Services</a>
                <a href="#" className="hover:text-emerald-600 transition">Contact</a>
              </div>
            )}
            
            <div className="flex items-center space-x-6">
              {user ? (
                <div className="flex items-center space-x-6">
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
                  <Link to="/login" className="text-slate-900 hover:text-emerald-600 font-black text-[10px] uppercase tracking-widest px-6 py-3">
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
