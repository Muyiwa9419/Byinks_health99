
import React from 'react';

const Contact: React.FC = () => {
  return (
    <div className="bg-white min-h-screen pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          
          <div className="animate-in fade-in slide-in-from-left-8 duration-700">
            <h1 className="text-xs font-black uppercase tracking-[0.5em] text-emerald-600 mb-6">Contact Us</h1>
            <h2 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter leading-tight mb-10">
              Get in Touch with our <span className="text-emerald-600">Care Team.</span>
            </h2>
            <p className="text-lg text-slate-500 font-medium mb-12 leading-relaxed">
              Whether you have a clinical inquiry, need technical support with the portal, or want to provide feedback, our dedicated support team is available 24/7.
            </p>

            <div className="space-y-10">
              <div className="flex items-start space-x-6">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 mb-1">Medical Center Address</h4>
                  <p className="text-slate-500 font-medium">15 Clinical Avenue, Victoria Island, Lagos, Nigeria.</p>
                </div>
              </div>

              <div className="flex items-start space-x-6">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 mb-1">Direct Clinical Hotline</h4>
                  <p className="text-slate-500 font-medium">+234 800-BYINKS (Main Line)</p>
                  <p className="text-red-500 font-black text-xs uppercase tracking-widest mt-1">Emergency: +234 999-CARE</p>
                </div>
              </div>

              <div className="flex items-start space-x-6">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 mb-1">Digital Support</h4>
                  <p className="text-slate-500 font-medium">care@byinkshealth.com</p>
                </div>
              </div>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
            <div className="bg-slate-50 rounded-[4rem] p-12 lg:p-16 border border-slate-100 shadow-2xl shadow-slate-200/40">
              <h3 className="text-3xl font-black text-slate-900 mb-10 tracking-tight">Send an Enquiry</h3>
              <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input type="text" placeholder="John Doe" className="w-full px-8 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none focus:border-emerald-600 transition shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Protocol</label>
                    <input type="email" placeholder="john@example.com" className="w-full px-8 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none focus:border-emerald-600 transition shadow-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject of Enquiry</label>
                  <select className="w-full px-8 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none focus:border-emerald-600 transition shadow-sm appearance-none">
                    <option>General Enquiries</option>
                    <option>Appointment Scheduling</option>
                    <option>Lab Report Issue</option>
                    <option>Technical Portal Support</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message Content</label>
                  <textarea placeholder="How can we assist you today?" className="w-full px-8 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] font-bold outline-none h-40 resize-none focus:border-emerald-600 transition shadow-sm" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition shadow-2xl shadow-emerald-100 active:scale-95">
                  Dispatch Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
