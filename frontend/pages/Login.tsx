
import React, { useState } from 'react';
import { User, UserRole } from '../types.ts';
import { ClinicalAPI } from '../services/apiService.ts';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole>(UserRole.PATIENT);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [genotype, setGenotype] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (role === UserRole.PATIENT && step === 1) {
          setStep(2);
          setLoading(false);
          return;
        }

        const newUser: User = {
          id: '', 
          name,
          email: email.toLowerCase(),
          role,
          isApproved: [UserRole.PATIENT, UserRole.ADMIN].includes(role) ? true : false, 
          ...(role === UserRole.PATIENT ? { 
            age: parseInt(age), 
            bloodType, 
            genotype, 
            address 
          } : {})
        };

        const registeredUser = await ClinicalAPI.signUp(email, password, newUser);
        onLogin(registeredUser);
      } else {
        const loggedUser = await ClinicalAPI.signIn(email, password);
        onLogin(loggedUser);
      }
    } catch (err: any) {
      setError(err.message || "Portal unreachable. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-emerald-50 rounded-bl-[15rem] -z-0 opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-1/4 h-1/3 bg-slate-100 rounded-tr-[10rem] -z-0 opacity-40"></div>

      <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden relative z-10 transition-all duration-500">
        <div className="p-10 md:p-14">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-200 group-hover:rotate-6 transition-transform">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
              {isRegister ? 'Register' : 'Login'}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Secure Healthcare Infrastructure</p>
          </div>

          {error && (
            <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-[1.5rem] animate-in slide-in-from-top-4">
              <div className="flex items-center space-x-3 text-red-700">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 ? (
              <div className="space-y-4">
                {isRegister && (
                  <div className="grid grid-cols-5 gap-1 p-1.5 bg-slate-100 rounded-2xl mb-6">
                    {[UserRole.PATIENT, UserRole.CONSULTANT, UserRole.PHARMACY, UserRole.DISPATCH, UserRole.ADMIN].map((r) => (
                      <button 
                        key={r} 
                        type="button" 
                        onClick={() => setRole(r)} 
                        className={`py-2 text-[7px] font-black rounded-xl transition uppercase tracking-tighter ${role === r ? 'bg-white shadow text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {r.substring(0, 5)}
                      </button>
                    ))}
                  </div>
                )}
                {isRegister && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input required placeholder="Dr. John Doe / Global Clinic" value={name} onChange={e => setName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-sm focus:border-emerald-600 transition" />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <input required type="email" placeholder="email@byinkshealth.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-sm focus:border-emerald-600 transition" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                  <input required type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-sm focus:border-emerald-600 transition" />
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-in slide-in-from-right-8 duration-500">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                     <input required type="number" placeholder="25" value={age} onChange={e => setAge(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-sm focus:border-emerald-600 transition" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Blood Group</label>
                     <input required placeholder="O+" value={bloodType} onChange={e => setBloodType(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-sm focus:border-emerald-600 transition" />
                   </div>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Genotype </label>
                   <input required placeholder="AA" value={genotype} onChange={e => setGenotype(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold text-sm focus:border-emerald-600 transition" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinical Residence</label>
                   <textarea required placeholder="Verified Street Address..." value={address} onChange={e => setAddress(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none h-24 font-bold text-sm resize-none focus:border-emerald-600 transition" />
                 </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="group relative w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] overflow-hidden transition-all hover:bg-emerald-700 shadow-2xl shadow-emerald-200 active:scale-95 disabled:opacity-50"
            >
              <span className="relative z-10">
                {loading ? 'Initializing Protocol...' : 
                 isRegister && step === 1 && role === UserRole.PATIENT ? 'Signup' : 
                 isRegister ? 'Signup' : 'Login'}
              </span>
            </button>
          </form>

          <div className="mt-12 pt-10 border-t border-slate-50 text-center">
            <button 
              onClick={() => { setIsRegister(!isRegister); setStep(1); setError(''); }} 
              className="text-emerald-600 font-black text-[9px] uppercase tracking-widest hover:underline decoration-2 underline-offset-4"
            >
              {isRegister ? 'Return to Login' : 'Signup'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Footer hint for admin (dev-friendly) */}
      {!isRegister && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center animate-in fade-in duration-1000 delay-500">
           <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Administrative Hub Authorization Required</p>
        </div>
      )}
    </div>
  );
};

export default Login;
