
import React from 'react';
import { Link } from 'react-router-dom';

const Services: React.FC = () => {
  const departments = [
    { title: 'Cardiology', icon: '❤️', desc: 'Advanced heart care, including diagnostics and non-invasive procedures.' },
    { title: 'Neurology', icon: '🧠', desc: 'Expert treatment for complex disorders of the nervous system and brain.' },
    { title: 'Pediatrics', icon: '🧸', desc: 'Compassionate healthcare tailored for the unique needs of children.' },
    { title: 'Orthopedics', icon: '🦴', desc: 'Comprehensive bone and joint care with a focus on rapid recovery.' },
    { title: 'Oncology', icon: '🧬', desc: 'Personalized cancer treatment plans using the latest medical breakthroughs.' },
    { title: 'Dermatology', icon: '✨', desc: 'Specialized care for skin, hair, and nail health using advanced therapies.' },
  ];

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-xs font-black uppercase tracking-[0.5em] text-emerald-600 mb-6">Medical Excellence</h1>
          <h2 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter leading-tight mb-8">
            Clinical <span className="text-emerald-600">Departments.</span>
          </h2>
          <p className="text-lg text-slate-500 font-medium">
            Byinks Health provides a full spectrum of specialized medical services. Our departments are equipped with state-of-the-art technology and managed by world-class specialists.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {departments.map((dept, idx) => (
            <div 
              key={idx} 
              className="group bg-slate-50 rounded-[4rem] p-12 border border-transparent hover:border-emerald-100 hover:bg-white hover:shadow-2xl transition-all duration-500 animate-in fade-in zoom-in-95"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-10 shadow-sm group-hover:scale-110 group-hover:bg-emerald-600 transition-all duration-500">
                <span className="group-hover:filter-none transition-all">{dept.icon}</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4">{dept.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-10">{dept.desc}</p>
              <Link to="/find-doctor" className="inline-flex items-center text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:translate-x-2 transition-transform">
                Consult Specialist
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>
          ))}
        </div>

        {/* Diagnostic Highlight */}
        <div className="mt-32 bg-slate-900 rounded-[5rem] p-16 lg:p-24 relative overflow-hidden text-center lg:text-left">
          <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h3 className="text-4xl lg:text-6xl font-black text-white tracking-tighter mb-8 leading-tight">
                24/7 Advanced <br /><span className="text-emerald-500">Diagnostics Lab.</span>
              </h3>
              <p className="text-slate-400 text-lg font-medium mb-12">
                Our in-house laboratory offers rapid results for radiology, pathology, and molecular diagnostics, ensuring your treatment path is accurate and swift.
              </p>
              <Link to="/contact" className="inline-block bg-white text-slate-900 px-12 py-6 rounded-[2.5rem] font-black uppercase tracking-widest text-xs hover:bg-emerald-500 hover:text-white transition shadow-2xl">
                Request Lab Booking
              </Link>
            </div>
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-6">
                 {[
                   { label: 'CT Scans', icon: '📸' },
                   { label: 'MRI Unit', icon: '📡' },
                   { label: 'Pathology', icon: '🧪' },
                   { label: 'Blood Bank', icon: '🩸' }
                 ].map((item, i) => (
                   <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-[3rem] text-center backdrop-blur-md">
                     <span className="text-3xl block mb-4">{item.icon}</span>
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">{item.label}</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
        </div>
      </div>
    </div>
  );
};

export default Services;
