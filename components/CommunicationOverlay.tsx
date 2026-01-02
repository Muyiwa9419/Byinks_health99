
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, AppNotification } from '../types.ts';
import { summarizePatientHistory } from '../services/geminiService.ts';
import { ClinicalAPI } from '../services/apiService.ts';

interface SharedFile {
  data: string; // Base64
  name: string;
  type: string;
  size: number;
}

interface Message {
  senderId: string;
  senderName: string;
  text?: string;
  file?: SharedFile;
  time: string;
  id: string;
}

interface CommunicationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  targetUser: { name: string; role: string; id: string };
}

const CommunicationOverlay: React.FC<CommunicationOverlayProps> = ({ 
  isOpen, onClose, currentUser, targetUser 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatId = [currentUser.id, targetUser.id].sort().join('--');

  // Real-time listener for cross-device and cross-tab sync
  useEffect(() => {
    if (!isOpen) return;

    const loadMessages = () => {
      const stored = localStorage.getItem(`chat_${chatId}`);
      if (stored) setMessages(JSON.parse(stored));
    };

    loadMessages();

    // 1. Same-device cross-tab sync
    window.addEventListener('storage', loadMessages);
    
    // 2. Cross-device cross-browser sync (Supabase Realtime)
    const channel = ClinicalAPI.subscribeToClinicalCloud(chatId, (msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        const updated = [...prev, msg];
        localStorage.setItem(`chat_${chatId}`, JSON.stringify(updated));
        return updated;
      });
    });

    if (channel) setIsCloudConnected(true);

    return () => {
      window.removeEventListener('storage', loadMessages);
      channel?.unsubscribe();
    };
  }, [isOpen, chatId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessage = (msg: Message) => {
    const stored = JSON.parse(localStorage.getItem(`chat_${chatId}`) || '[]');
    if (stored.find((m: Message) => m.id === msg.id)) return;
    
    const updated = [...stored, msg];
    setMessages(updated);
    localStorage.setItem(`chat_${chatId}`, JSON.stringify(updated));
    
    // Broadcast to Cloud (Other Devices)
    ClinicalAPI.broadcastMessage(chatId, msg);
    
    // Broadcast to Local Bridge (Other Tabs)
    window.dispatchEvent(new Event('storage'));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Clinical Limit: 5MB per file.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const newMsg: Message = { 
        id: Math.random().toString(36).substr(2, 9),
        senderId: currentUser.id,
        senderName: currentUser.name,
        file: { 
          data: reader.result as string, 
          name: file.name, 
          type: file.type, 
          size: file.size 
        },
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
      saveMessage(newMsg);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    saveMessage({ 
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: inputText, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    });
    setInputText('');
  };

  const handleSummarize = async () => {
    if (messages.length === 0) return;
    setIsAiLoading(true);
    const textContext = messages
      .filter(m => m.text)
      .map(m => `${m.senderName}: ${m.text}`)
      .join('\n');
    
    const analysis = await summarizePatientHistory(textContext || "Clinical dialogue exchange.");
    setAiAnalysis(analysis);
    setIsAiLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-8 lg:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative w-full max-w-6xl h-full md:h-[90vh] bg-white md:rounded-[3rem] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/20">
        
        {/* Chat Area */}
        <div className="flex-grow flex flex-col bg-white border-r border-slate-100 min-w-0">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 bg-emerald-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-100">
                {targetUser.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">{targetUser.name}</h2>
                <div className="flex items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                  <span className={`w-2 h-2 rounded-full mr-2 ${isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                  {isCloudConnected ? 'Global Clinical Sync Active' : 'Local Sandbox Mode'}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-4 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 p-12">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <p className="text-xs font-black uppercase tracking-widest">End-to-End Clinical Session</p>
                <p className="text-[10px] font-medium mt-2">Chat and records are synchronized across all your devices.</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[80%] md:max-w-[70%] rounded-[2rem] p-6 shadow-sm border ${
                  msg.senderId === currentUser.id 
                    ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' 
                    : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'
                }`}>
                  <div className="flex items-center justify-between mb-3 opacity-60">
                    <span className="text-[9px] font-black uppercase tracking-widest">{msg.senderName}</span>
                    <span className="text-[9px] font-bold">{msg.time}</span>
                  </div>
                  
                  {msg.text && <p className="text-sm font-medium leading-relaxed">{msg.text}</p>}
                  
                  {msg.file && (
                    <div className="mt-4">
                      {msg.file.type.startsWith('image/') ? (
                        <div className="relative group">
                          <img src={msg.file.data} alt="Clinical Asset" className="rounded-2xl max-h-80 w-full object-cover border border-white/10 shadow-lg" />
                          <a href={msg.file.data} download={msg.file.name} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl transition-opacity backdrop-blur-sm">
                            <div className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest">Download Asset</div>
                          </a>
                        </div>
                      ) : (
                        <div className={`flex items-center space-x-4 p-5 rounded-2xl border ${msg.senderId === currentUser.id ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-900/20">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="flex-grow overflow-hidden">
                            <p className="text-[11px] font-black uppercase truncate tracking-widest">{msg.file.name}</p>
                            <p className="text-[9px] font-bold opacity-50">{(msg.file.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <a href={msg.file.data} download={msg.file.name} className="p-3 bg-white/10 hover:bg-emerald-600 rounded-xl transition-all hover:text-white">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-8 border-t border-slate-50 flex items-center space-x-4 bg-white sticky bottom-0 z-10">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-5 bg-slate-50 border-2 border-slate-100 text-slate-400 hover:text-emerald-600 hover:border-emerald-600 rounded-2xl transition-all duration-300 shadow-sm ${isUploading ? 'animate-pulse' : ''}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </button>
            <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Secure clinical message..." className="flex-grow px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.75rem] font-bold text-sm outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-sm" />
            <button type="submit" disabled={!inputText.trim()} className="p-5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 disabled:opacity-50 active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>

        {/* Sidebar: Clinical Insights */}
        <div className="hidden lg:flex w-96 flex-col bg-slate-50/50 p-10 space-y-10 overflow-y-auto custom-scrollbar backdrop-blur-md">
          <section className="animate-in fade-in duration-700">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6">Device Mobility</h3>
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/20">
               <p className="text-[10px] font-medium text-slate-600 leading-relaxed mb-4 italic">
                 "Messages sent here are broadcasted via Supabase Realtime to all authorized devices."
               </p>
               <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                 <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Global Sync</span>
                 <div className={`w-2 h-2 rounded-full ${isCloudConnected ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-slate-300'}`}></div>
               </div>
            </div>
          </section>

          <section className="flex-grow flex flex-col min-h-0 animate-in fade-in duration-700 delay-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.4em]">Clinical AI Scribe</h3>
              <button onClick={handleSummarize} disabled={isAiLoading || messages.length === 0} className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-30 tracking-widest">
                {isAiLoading ? 'Analyzing...' : 'Refresh Summary'}
              </button>
            </div>
            
            <div className="flex-grow bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl min-h-[300px]">
              <div className="relative z-10">
                {aiAnalysis ? (
                  <div className="space-y-4">
                    <p className="text-xs font-medium leading-relaxed italic opacity-90 animate-in fade-in slide-in-from-bottom-2 duration-500">{aiAnalysis}</p>
                    <div className="pt-4 border-t border-white/10">
                       <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500">Auto-Generated Snapshot</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 opacity-30">
                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] leading-loose">Awaiting AI synthesis...</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CommunicationOverlay;
