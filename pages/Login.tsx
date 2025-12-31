
import React, { useState } from 'react';
import { User, UserRole } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState(1); // 1: Auth Info, 2: Medical Info (for Patients)
  const [role, setRole] = useState<UserRole>(UserRole.PATIENT);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  
  // Patient Medical State
  const [age, setAge] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [genotype, setGenotype] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  const [error, setError] = useState('');

  const MASTER_KEY = "BYINKS-HEALTH-99";

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister && role === UserRole.PATIENT && step === 1) {
      setStep(2);
    } else {
      handleSubmit(e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const registeredUsersStr = localStorage.getItem('medi_registered_users') || '[]';
    const registeredUsers: User[] = JSON.parse(registeredUsersStr);

    if (isRegister) {
      const isAdmin = role === UserRole.ADMIN;
      
      if (isAdmin && adminSecret !== MASTER_KEY) {
        setError('Invalid System Master Key. Administrative registration denied.');
        return;
      }

      if (registeredUsers.find(u => u.email === email)) {
        setError('An account with this email already exists.');
        return;
      }

      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        email,
        role: isAdmin ? UserRole.ADMIN : UserRole.PATIENT,
        isApproved: true,
        // Optional Medical fields if Patient
        ...(role === UserRole.PATIENT ? {
          age: parseInt(age),
          bloodType,
          genotype,
          height,
          weight,
          phone,
          address
        } : {})
      };

      registeredUsers.push(newUser);
      localStorage.setItem('medi_registered_users', JSON.stringify(registeredUsers));
      onLogin(newUser);

    } else {
      // Login Flow
      const foundUser = registeredUsers.find(u => u.email === email);
      
      if (foundUser) {
        onLogin(foundUser);
      } else {
        if (email.includes('admin') && !registeredUsers.length) {
           const adminUser: User = { 
             id: 'admin-1', 
             name: 'System Admin', 
             email, 
             role: UserRole.ADMIN, 
             isApproved: true 
           };
           onLogin(adminUser);
        } else {
           setError('Account not found. Consultants must be invited by an Administrator.');
        }
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden transition-all duration-500">
        <div className="p-8 md:p-10">
          <div className="text-center mb-8">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl transition-all duration-500 ${role === UserRole.ADMIN && isRegister ? 'bg-indigo-600' : 'bg-blue-600'}`}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {isRegister ? (role === UserRole.ADMIN ? 'Admin Setup' : 'Join MediSphere') : 'Welcome Back'}
            </h2>
            <p className="text-slate-500 mt-2 font-medium">
              {isRegister 
                ? (step === 1 ? 'Step 1: Account Information' : 'Step 2: Medical Intake') 
                : 'Access your health dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center space-x-3 text-red-600">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-[10px] font-bold uppercase tracking-wide">{error}</p>
            </div>
          )}

          <form onSubmit={handleNextStep} className="space-y-4">
            {isRegister && step === 1 && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => setRole(UserRole.PATIENT)}
                  className={`py-2 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider ${role === UserRole.PATIENT ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}
                >Patient</button>
                <button
                  type="button"
                  onClick={() => setRole(UserRole.ADMIN)}
                  className={`py-2 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider ${role === UserRole.ADMIN ? 'bg-indigo-600 shadow-md text-white' : 'text-slate-500'}`}
                >Admin</button>
              </div>
            )}

            {step === 1 ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                {isRegister && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition" placeholder="John Doe" />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition" placeholder="you@example.com" />
                </div>
                {isRegister && role === UserRole.ADMIN && (
                  <div>
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 ml-1">Master Key</label>
                    <input type="password" required value={adminSecret} onChange={(e) => setAdminSecret(e.target.value)} className="w-full px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition" placeholder="••••••••" />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition" placeholder="••••••••" />
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-500 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Age</label>
                    <input type="number" required value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Genotype</label>
                    <input type="text" required value={genotype} onChange={(e) => setGenotype(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="AA" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Blood Group</label>
                  <select required value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                    <option value="">Select...</option>
                    <option value="A+">A+</option><option value="A-">A-</option>
                    <option value="B+">B+</option><option value="B-">B-</option>
                    <option value="O+">O+</option><option value="O-">O-</option>
                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Height (cm)</label>
                    <input type="text" required value={height} onChange={(e) => setHeight(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="175" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Weight (kg)</label>
                    <input type="text" required value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="70" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="+1..." />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Residential Address</label>
                  <textarea required value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none h-20 resize-none" placeholder="123 Health St..." />
                </div>
              </div>
            )}

            <div className="pt-4 flex space-x-3">
              {step === 2 && (
                <button type="button" onClick={() => setStep(1)} className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">Back</button>
              )}
              <button
                type="submit"
                className={`flex-grow py-4 rounded-2xl font-bold text-white shadow-xl transition-all transform active:scale-95 ${role === UserRole.ADMIN && isRegister ? 'bg-indigo-600' : 'bg-blue-600'}`}
              >
                {isRegister && step === 1 && role === UserRole.PATIENT ? 'Continue to Intake' : isRegister ? 'Complete Registration' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <button onClick={() => { setIsRegister(!isRegister); setStep(1); setError(''); }} className="text-blue-600 font-bold hover:underline text-sm">
              {isRegister ? 'Already have an account? Sign In' : 'Need an account? Join as Patient'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
