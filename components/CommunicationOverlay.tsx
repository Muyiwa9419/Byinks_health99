
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
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

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

    // Cloud Listener
    const channel = ClinicalAPI.subscribeToClinicalCloud(chatId, (msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        const updated = [...prev, msg];
        localStorage.setItem(`chat_${chatId}`, JSON.stringify(updated));
        return updated;
      });
    });

    if (channel) setIsCloudConnected(true);
    window.addEventListener('storage', loadMessages);

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
    
    // Global Broadcast
    ClinicalAPI.broadcastMessage(chatId, msg);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-8 lg:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-6xl h-full md:h-[90vh] bg-white md:rounded-[3rem] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/20">
        <div className="flex-grow flex flex-col bg-white border-r border-slate-100 min-w-0">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 bg-emerald-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-100">
                {targetUser.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{targetUser.name}</h2>
                <div className="flex items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                  <span className={`w-2 h-2 rounded-full mr-2 ${isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                  {isCloudConnected ? 'Clinical Cloud Sync Active' : 'Offline Mode'}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-4 bg-slate-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[80%] rounded-[2rem] p-6 shadow-sm border ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'}`}>
                  <div className="flex items-center justify-between mb-2 opacity-60">
                    <span className="text-[9px] font-black uppercase tracking-widest">{msg.senderName}</span>
                    <span className="text-[9px] font-bold">{msg.time}</span>
                  </div>
                  <p className="text-sm font-medium">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} className="p-8 border-t border-slate-50 flex items-center space-x-4">
            <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Secure clinical message..." className="flex-grow px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.75rem] font-bold text-sm outline-none focus:border-emerald-600 transition-all" />
            <button type="submit" className="p-5 bg-emerald-600 text-white rounded-2xl shadow-xl active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CommunicationOverlay;
