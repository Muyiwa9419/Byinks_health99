
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, UserRole } from '../types';

const FindDoctor: React.FC = () => {
  const [consultants, setConsultants] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpecialty, setActiveSpecialty] = useState('All');
  const navigate = useNavigate();

  const specialties = [
    'All', 'General Medicine', 'Pediatrics', 'Surgery', 
    'Obstetrics & Gynae', 'Diagnostics', 'Pharmacy'
  ];

  useEffect(() => {
    const fetchDoctors = () => {
      const stored = localStorage.getItem('medi_registered_users');
      if (stored) {
        const all: User[] = JSON.parse(stored);
        setConsultants(all.filter(u => u.role === UserRole.CONSULTANT && u.isApproved));
      }
    };
    fetchDoctors();
  }, []);

  const filteredDoctors = consultants.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (doc.specialty && doc.specialty.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSpecialty = activeSpecialty === 'All' || doc.specialty === activeSpecialty;
    return matchesSearch && matchesSpecialty;
  });

  return (
    <div className="bg-white min-h-screen pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-xs font-black uppercase tracking-[0.5em] text-emerald-600 mb-6">Expert Directory</h1>
          <h2 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter leading-[1.1] mb-8">
            Connect with World-Class <span className="text-emerald-600">Specialists.</span>
          </h2>
          <p className="text-lg text-slate-500 font-medium">
            Browse our network of verified medical professionals. Every Byinks Health consultant undergoes a rigorous credential verification process.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-12 space-y-8">
          <div className="relative max-w-2xl mx-auto group">
            <input 
              type="text" 
              placeholder="Search by name, specialty, or clinical focus..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] text-slate-900 font-bold outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-xl shadow-slate-200/20"
            />
            <svg className="w-6 h-6 text-slate-400 absolute left-6 top-6 group-focus-within:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {specialties.map(spec => (
              <button
                key={spec}
                onClick={() => setActiveSpecialty(spec)}
                className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                  activeSpecialty === spec 
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' 
                    : 'bg-white border-slate-100 text-slate-400 hover:border-emerald-200 hover:text-emerald-600'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredDoctors.length > 0 ? filteredDoctors.map((doc, idx) => (
            <div 
              key={doc.id} 
              className="group bg-white rounded-[3.5rem] border border-slate-100 p-10 hover:shadow-2xl hover:border-emerald-100 transition-all duration-500 animate-in fade-in zoom-in-95"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-center space-x-6 mb-8">
                <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center font-black text-emerald-600 text-3xl group-hover:rotate-6 transition-transform">
                  {doc.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition">Dr. {doc.name}</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mt-1">{doc.specialty || 'Medical Specialist'}</p>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                <div className="flex items-center text-slate-500 text-sm font-medium">
                  <svg className="w-4 h-4 mr-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Board Certified Physician
                </div>
                <div className="flex items-center text-slate-500 text-sm font-medium">
                  <svg className="w-4 h-4 mr-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Consultation available via Portal
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => navigate('/login')}
                  className="bg-emerald-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100"
                >
                  Book Slot
                </button>
                <button 
                  onClick={() => navigate('/login')}
                  className="bg-slate-50 text-slate-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition"
                >
                  View Profile
                </button>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-32 text-center bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-200">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 shadow-sm">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">No Matching Specialists</h3>
              <p className="text-slate-400 font-medium max-w-md mx-auto">Try adjusting your filters or search keywords to find the right clinical expert for your needs.</p>
            </div>
          )}
        </div>
      </div>

      {/* Trust Banner */}
      <div className="max-w-7xl mx-auto px-6 mt-32">
        <div className="bg-slate-900 rounded-[4rem] p-16 text-center text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-3xl font-black mb-6 tracking-tight">Can't find your specific specialty?</h3>
            <p className="text-slate-400 font-medium mb-10 max-w-2xl mx-auto">Our global referral network includes over 500+ clinics worldwide. Contact our support team for a specialized referral.</p>
            <Link to="/login" className="inline-block bg-white text-slate-900 px-12 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition shadow-2xl">
              Connect with Care Support
            </Link>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        </div>
      </div>
    </div>
  );
};

export default FindDoctor;
