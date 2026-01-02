
import React, { useState } from 'react';
import { User, UserRole } from '../types.ts';

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
  const [adminSecret, setAdminSecret] = useState('');
  const [age, setAge] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [genotype, setGenotype] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importToken, setImportToken] = useState('');

  const MASTER_KEY = "BYINKS-HEALTH-99";

  const handleCloudSync = () => {
    try {
      if (!importToken.trim()) {
        setError("Clinical Alert: Token field cannot be empty.");
        return;
      }
      const data = JSON.parse(atob(importToken));
      
      const storageMapping: Record<string, string> = {
        'users': 'medi_registered_users',
        'apps': 'medi_appointments',
        'trans': 'medi_transactions',
        'logs': 'medi_audit_logs',
        'avail': 'medi_availability',
        'notifs': 'medi_notifications'
      };

      Object.entries(data).forEach(([key, val]) => {
        const fullKey = storageMapping[key];
        if (fullKey && val) {
          localStorage.setItem(fullKey, val as string);
        }
      });
      
      window.dispatchEvent(new Event('storage'));
      alert("Byinks Cloud Identity synchronized! You can now sign in with your account from the other device.");
      setShowImport(false);
      setImportToken('');
      setError('');
    } catch (e) {
      setError("Cloud Sync Failed: The provided Identity Token is invalid or expired.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isRegister && role === UserRole.PATIENT && step === 1) {
      setStep(2);
      return;
    }

    const registeredUsers: User[] = JSON.parse(localStorage.getItem('medi_registered_users') || '[]');

    if (isRegister) {
      if (role === UserRole.ADMIN && adminSecret !== MASTER_KEY) {
        setError('Security Violation: Invalid Genesis Master Key.');
        return;
      }
      if (registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        setError('Clinical Alert: This identity already exists in the central database.');
        return;
      }

      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        email: email.toLowerCase(),
        role,
        isApproved: true,
        ...(role === UserRole.PATIENT ? { age: parseInt(age), bloodType, genotype, address } : {})
      };

      registeredUsers.push(newUser);
      localStorage.setItem('medi_registered_users', JSON.stringify(registeredUsers));
      window.dispatchEvent(new Event('storage'));
      onLogin(newUser);
    } else {
      const foundUser = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (foundUser) {
        onLogin(foundUser);
      } else {
        setError('Identity Not Found: If you registered on another device, use the "Byinks Cloud Connector" below.');
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden relative">
        <div className="p-10 md:p-12 relative z-10">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {showImport ? 'Byinks Cloud' : isRegister ? 'Clinical Intake' : 'Portal Access'}
            </h2>
            <p className="text-slate-500 mt-2 font-medium text-sm leading-relaxed">
              {showImport ? 'Bridging your device to the global network' : 'Secure Clinical Identity Gateway'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-[10px] font-black text-red-700 uppercase tracking-widest leading-relaxed flex items-start space-x-3">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>{error}</span>
            </div>
          )}

          {showImport ? (
            <div className="space-y-6 animate-in slide-in-from-bottom-4">
              <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl">
                <p className="text-[10px] text-blue-700 font-black uppercase tracking-widest mb-2">Instructions</p>
                <p className="text-[11px] text-blue-600 font-medium leading-relaxed">
                  1. Open this app on your <strong>main device</strong>.<br/>
                  2. Use the <strong>Sync Icon</strong> in the Navbar to copy your token.<br/>
                  3. Paste that token here to synchronize.
                </p>
              </div>
              <textarea 
                value={importToken}
                onChange={(e) => setImportToken(e.target.value)}
                placeholder="Paste the copied Global Cloud Token here..."
                className="w-full h-32 p-5 bg-slate-50 border border-slate-200 rounded-2xl text-[9px] font-mono outline-none focus:border-emerald-600 transition"
              />
              <div className="flex space-x-3">
                <button onClick={() => setShowImport(false)} className="flex-grow py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
                <button onClick={handleCloudSync} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition">Authorize & Sync</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 ? (
                <div className="space-y-5">
                  {isRegister && (
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-4">
                      <button type="button" onClick={() => setRole(UserRole.PATIENT)} className={`py-2.5 text-[10px] font-black rounded-xl transition uppercase tracking-widest ${role === UserRole.PATIENT ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>Patient</button>
                      <button type="button" onClick={() => setRole(UserRole.ADMIN)} className={`py-2.5 text-[10px] font-black rounded-xl transition uppercase tracking-widest ${role === UserRole.ADMIN ? 'bg-emerald-600 shadow text-white' : 'text-slate-400'}`}>Admin</button>
                    </div>
                  )}
                  {isRegister && (
                    <input required placeholder="Legal Name" value={name} onChange={e => setName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium" />
                  )}
                  <input required type="email" placeholder="Email Identifier" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium" />
                  {isRegister && role === UserRole.ADMIN && (
                    <input required type="password" placeholder="Genesis Master Key" value={adminSecret} onChange={e => setAdminSecret(e.target.value)} className="w-full px-6 py-4 bg-emerald-50 border border-emerald-200 rounded-2xl outline-none font-medium" />
                  )}
                  <input required type="password" placeholder="Portal Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium" />
                </div>
              ) : (
                <div className="space-y-5 animate-in slide-in-from-right-4">
                   <div className="grid grid-cols-2 gap-4">
                     {/* Fixed: Corrected onChange handler for age input by wrapping setAge in an arrow function to prevent immediate execution */}
                     <input required type="number" placeholder="Age" value={age} onChange={e => setAge(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium" />
                     <input required placeholder="Blood Group" value={bloodType} onChange={e => setBloodType(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium" />
                   </div>
                   <input required placeholder="Genotype (e.g., AA)" value={genotype} onChange={e => setGenotype(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium" />
                   <textarea required placeholder="Residential Address" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none h-24 font-medium" />
                </div>
              )}

              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-200">
                {isRegister && step === 1 && role === UserRole.PATIENT ? 'Next: Medical Profile' : isRegister ? 'Initialize Identity' : 'Secure Sign In'}
              </button>
            </form>
          )}

          <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col space-y-4 text-center">
            <button onClick={() => { setIsRegister(!isRegister); setStep(1); setShowImport(false); }} className="text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline">
              {isRegister ? 'Return to Authenticator' : 'Provision a New Patient Identity'}
            </button>
            <div className="flex flex-col items-center space-y-4 pt-2">
              <button onClick={() => setShowImport(true)} className="flex items-center space-x-2 text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] hover:text-emerald-600 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
                <span>Provision via Byinks Cloud Connector</span>
              </button>
            </div>
          </div>
        </div>
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500"></div>
      </div>
    </div>
  );
};

export default Login;
