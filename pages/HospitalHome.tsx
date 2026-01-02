
import React from 'react';
import { Link } from 'react-router-dom';

const HospitalHome: React.FC = () => {
  const specialties = [
    { title: 'General Medicine', icon: '🩺', desc: 'Comprehensive healthcare for families and individuals.' },
    { title: 'Pediatrics', icon: '👶', desc: 'Specialized care for infants, children, and adolescents.' },
    { title: 'Obstetrics & Gynae', icon: '🤰', desc: 'Expert care for women through all stages of life.' },
    { title: 'Surgery', icon: '🔪', desc: 'Modern surgical procedures with rapid recovery focus.' },
    { title: 'Diagnostics', icon: '🧪', desc: 'State-of-the-art laboratory and imaging services.' },
    { title: 'Pharmacy', icon: '💊', desc: 'Fully stocked pharmacy with verified medications.' },
  ];

  const stats = [
    { label: 'Happy Patients', value: '15,000+' },
    { label: 'Expert Doctors', value: '45+' },
    { label: 'Success Rate', value: '99.9%' },
    { label: 'Years Excellence', value: '12+' },
  ];

  return (
    <div className="bg-white selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-50 -z-10 rounded-l-[20rem] hidden lg:block"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-50 rounded-full blur-3xl opacity-60"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10 animate-in fade-in slide-in-from-left-12 duration-1000">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 mb-8">
              <span className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Premier Healthcare in Nigeria</span>
            </div>
            
            <h1 className="text-6xl lg:text-8xl font-black text-slate-900 leading-[0.9] tracking-tighter mb-8">
              Quality Care, <br />
              <span className="text-emerald-600">Healthier Lives.</span>
            </h1>
            
            <p className="text-xl text-slate-500 font-medium mb-12 max-w-lg leading-relaxed">
              Byinks Health is dedicated to providing world-class medical services with a touch of compassion. We combine advanced technology with human empathy.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6">
              <Link 
                to="/find-doctor" 
                className="group relative px-12 py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black uppercase tracking-widest text-xs overflow-hidden shadow-2xl shadow-emerald-200 transition-all hover:scale-105"
              >
                <span className="relative z-10 flex items-center justify-center">
                  Book Appointment
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </span>
              </Link>
              <Link 
                to="/login" 
                className="px-12 py-6 bg-white border-2 border-slate-100 text-slate-900 rounded-[2.5rem] font-black uppercase tracking-widest text-xs hover:border-emerald-600 hover:text-emerald-600 transition-all text-center"
              >
                Patient Portal
              </Link>
            </div>

            <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-8">
              {stats.map((s, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-3xl font-black text-slate-900 leading-none mb-2">{s.value}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-in fade-in zoom-in-95 duration-1000 delay-300">
            <div className="relative rounded-[6rem] overflow-hidden shadow-2xl border-[12px] border-white">
              <img 
                src="https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=1200" 
                alt="Medical Excellence" 
                className="w-full h-[700px] object-cover hover:scale-105 transition-transform duration-[3s]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent"></div>
              
              {/* Floating Status Card */}
              <div className="absolute bottom-12 left-12 right-12 p-8 bg-white/90 backdrop-blur-2xl rounded-[3rem] shadow-2xl border border-white/20">
                <div className="flex items-center space-x-5">
                  <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-lg">Trusted & Secure</h4>
                    <p className="text-sm text-slate-500 font-medium">Your health data is protected with 256-bit encryption.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specialties Section */}
      <section className="py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-24">
            <h2 className="text-xs font-black uppercase tracking-[0.5em] text-emerald-600 mb-6">Our Specialties</h2>
            <h3 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter leading-tight">
              Exceptional Medical Care Tailored to Your Needs.
            </h3>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {specialties.map((s, i) => (
              <div key={i} className="group p-12 bg-white rounded-[4rem] border border-transparent hover:border-emerald-100 hover:shadow-2xl transition-all duration-500">
                <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-4xl mb-10 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:rotate-6 transition-all duration-500">
                  <span className="group-hover:filter-none grayscale group-hover:grayscale-0 transition-all">{s.icon}</span>
                </div>
                <h4 className="text-2xl font-black text-slate-900 mb-4">{s.title}</h4>
                <p className="text-slate-500 font-medium leading-relaxed">{s.desc}</p>
                <Link to="/find-doctor" className="mt-8 inline-flex items-center text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:translate-x-2 transition-transform">
                  Learn More
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center">
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1504813184591-01592fd039e5?auto=format&fit=crop&q=80&w=1000" 
              alt="Medical Tech" 
              className="rounded-[5rem] shadow-2xl"
            />
            <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-emerald-600 rounded-[3rem] flex flex-col items-center justify-center text-white shadow-2xl p-8">
              <span className="text-5xl font-black mb-2">24/7</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-center">Emergency Response Support</span>
            </div>
          </div>
          
          <div className="space-y-10">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.5em] text-emerald-600 mb-6">Why Choose Byinks</h2>
              <h3 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter leading-tight mb-8">
                Leading the Digital Health <br /><span className="text-emerald-600">Revolution.</span>
              </h3>
              <p className="text-lg text-slate-500 font-medium leading-relaxed">
                Byinks Health integrates with the MediSphere platform to provide patients with seamless access to their health records, AI-driven diagnostics, and instant consultant access.
              </p>
            </div>
            
            <div className="space-y-6">
              {[
                { t: 'Advanced AI Diagnostics', d: 'Get preliminary assessments using Gemini technology.' },
                { t: 'Global Consultant Network', d: 'Connect with specialists across the globe instantly.' },
                { t: 'Seamless Medical History', d: 'Your records are always with you, secure and portable.' }
              ].map((item, i) => (
                <div key={i} className="flex items-start space-x-6 p-6 rounded-[2rem] hover:bg-slate-50 transition">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-emerald-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 mb-1">{item.t}</h4>
                    <p className="text-sm text-slate-500 font-medium">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto bg-slate-900 rounded-[5rem] p-16 lg:p-24 relative overflow-hidden shadow-2xl">
          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <h2 className="text-5xl lg:text-7xl font-black text-white mb-10 tracking-tighter">
              Ready for <br /><span className="text-emerald-500">Better Healthcare?</span>
            </h2>
            <p className="text-slate-400 text-lg mb-12 font-medium">
              Join thousands of patients who trust Byinks Health for their medical needs. Secure your session today.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Link to="/find-doctor" className="bg-emerald-600 text-white px-12 py-6 rounded-[2.5rem] font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition shadow-xl shadow-emerald-900/40">
                Join the Patient Portal
              </Link>
              <Link to="/login" className="bg-white/10 text-white px-12 py-6 rounded-[2.5rem] font-black uppercase tracking-widest text-xs hover:bg-white/20 transition backdrop-blur-md border border-white/10">
                Register as Consultant
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-32 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-16">
          <div className="col-span-2">
            <h5 className="text-2xl font-black text-slate-900 mb-6 flex items-center">
              <div className="bg-emerald-600 p-2 rounded-lg mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              BYINKS HEALTH
            </h5>
            <p className="text-slate-500 font-medium max-w-sm leading-relaxed">
              Setting a new standard for international healthcare through compassion, integrity, and technology.
            </p>
          </div>
          <div>
            <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Explore</h6>
            <ul className="space-y-4 text-sm font-bold text-slate-600">
              <li><Link to="/login" className="hover:text-emerald-600 transition">Patient Portal</Link></li>
              <li><Link to="/login" className="hover:text-emerald-600 transition">Onboard Consultant</Link></li>
              <li><Link to="/find-doctor" className="hover:text-emerald-600 transition">Find a Doctor</Link></li>
            </ul>
          </div>
          <div>
            <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Contact</h6>
            <ul className="space-y-4 text-sm font-bold text-slate-600">
              <li>Lagos, Nigeria</li>
              <li>+234 800-BYINKS</li>
              <li>care@byinkshealth.com</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HospitalHome;
