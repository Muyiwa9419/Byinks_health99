
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, AppNotification } from '../types.ts';
import { summarizePatientHistory } from '../services/geminiService.ts';

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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatId = [currentUser.id, targetUser.id].sort().join('--');

  useEffect(() => {
    if (!isOpen) return;

    const loadMessages = () => {
      const stored = localStorage.getItem(`chat_${chatId}`);
      if (stored) setMessages(JSON.parse(stored));
    };

    loadMessages();
    window.addEventListener('storage', loadMessages);
    
    return () => {
      window.removeEventListener('storage', loadMessages);
    };
  }, [isOpen, chatId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 10MB limit for local storage friendliness
    if (file.size > 5 * 1024 * 1024) {
      alert("Clinical Limit: 5MB per file for secure transmission.");
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

  const saveMessage = (msg: Message) => {
    const stored = JSON.parse(localStorage.getItem(`chat_${chatId}`) || '[]');
    const updated = [...stored, msg];
    setMessages(updated);
    localStorage.setItem(`chat_${chatId}`, JSON.stringify(updated));
    // Trigger local storage event for cross-tab sync
    window.dispatchEvent(new Event('storage'));
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
    
    const analysis = await summarizePatientHistory(textContext || "The clinical dialogue consists primarily of shared medical records and files.");
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
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                  Secure Clinical Channel
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
                <p className="text-xs font-black uppercase tracking-widest">End-to-End Encrypted Session</p>
                <p className="text-[10px] font-medium mt-2">Clinical dialogue and file exchange is private between you and the practitioner.</p>
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
                          <img 
                            src={msg.file.data} 
                            alt="Clinical Attachment" 
                            className="rounded-2xl max-h-80 w-full object-cover border border-white/10 shadow-lg" 
                          />
                          <a 
                            href={msg.file.data} 
                            download={msg.file.name}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl transition-opacity backdrop-blur-sm"
                          >
                            <div className="bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest">Download Asset</div>
                          </a>
                        </div>
                      ) : (
                        <div className={`flex items-center space-x-4 p-5 rounded-2xl border ${
                          msg.senderId === currentUser.id 
                            ? 'bg-white/10 border-white/20' 
                            : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-900/20">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="flex-grow overflow-hidden">
                            <p className="text-[11px] font-black uppercase truncate tracking-widest">{msg.file.name}</p>
                            <p className="text-[9px] font-bold opacity-50">{(msg.file.size / 1024).toFixed(1)} KB • Medical Record</p>
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
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*,.pdf,.doc,.docx"
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className={`p-5 bg-slate-50 border-2 border-slate-100 text-slate-400 hover:text-emerald-600 hover:border-emerald-600 rounded-2xl transition-all duration-300 shadow-sm ${isUploading ? 'animate-pulse' : ''}`}
              title="Attach Clinical Asset"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </button>
            <input 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Secure clinical message..."
              className="flex-grow px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.75rem] font-bold text-sm outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-sm"
            />
            <button 
              type="submit" 
              disabled={!inputText.trim()}
              className="p-5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 disabled:opacity-50 active:scale-95"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>

        {/* Sidebar: Clinical Insights */}
        <div className="hidden lg:flex w-96 flex-col bg-slate-50/50 p-10 space-y-10 overflow-y-auto custom-scrollbar backdrop-blur-md">
          <section className="animate-in fade-in duration-700">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6">Patient Context</h3>
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/20">
              <div className="flex items-center space-x-4 mb-6 pb-6 border-b border-slate-50">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 font-black">
                  {targetUser.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{targetUser.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{targetUser.role}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Shared Assets</span>
                  <span className="text-[10px] font-bold text-slate-900">{messages.filter(m => m.file).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Interaction</span>
                  <span className="text-[10px] font-bold text-slate-900">{messages.length} Events</span>
                </div>
              </div>
            </div>
          </section>

          <section className="flex-grow flex flex-col min-h-0 animate-in fade-in duration-700 delay-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.4em]">Clinical AI Scribe</h3>
              <button 
                onClick={handleSummarize}
                disabled={isAiLoading || messages.length === 0}
                className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-30 tracking-widest"
              >
                {isAiLoading ? 'Analyzing...' : 'Refresh Summary'}
              </button>
            </div>
            
            <div className="flex-grow bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl min-h-[300px]">
              <div className="relative z-10">
                {aiAnalysis ? (
                  <div className="space-y-4">
                    <p className="text-xs font-medium leading-relaxed italic opacity-90 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {aiAnalysis}
                    </p>
                    <div className="pt-4 border-t border-white/10">
                       <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500">Auto-Generated Summary</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 opacity-30">
                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] leading-loose">Initialize AI analysis to distill clinical patterns and session highlights.</p>
                  </div>
                )}
              </div>
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl -mr-24 -mt-24"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -ml-16 -mb-16"></div>
            </div>
          </section>

          <div className="pt-8 animate-in fade-in duration-700 delay-500">
             <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 flex items-start space-x-4">
               <svg className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               <div>
                 <p className="text-[9px] text-amber-900 font-black uppercase tracking-widest mb-1">Encrypted Session</p>
                 <p className="text-[10px] text-amber-800 font-medium leading-relaxed">Identity verification active. All medical data is handled under strict Byinks Health protocols.</p>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationOverlay;
