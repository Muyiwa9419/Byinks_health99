
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
  timestamp: number;
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
  const [isExpired, setIsExpired] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatId = [currentUser.id, targetUser.id].sort().join('--');

  const EXPIRATION_THRESHOLD = 24 * 60 * 60 * 1000; // 24 Hours

  useEffect(() => {
    if (!isOpen) return;

    const loadMessages = () => {
      const stored = localStorage.getItem(`chat_${chatId}`);
      if (stored) {
        const parsed: Message[] = JSON.parse(stored);
        setMessages(parsed);
        
        // Check Expiration
        if (parsed.length > 0) {
          const lastMsg = parsed[parsed.length - 1];
          if (Date.now() - lastMsg.timestamp > EXPIRATION_THRESHOLD) {
            setIsExpired(true);
          } else {
            setIsExpired(false);
          }
        }
      }
    };

    loadMessages();

    // Cloud Listener for Global Cross-Device Sync
    const channel = ClinicalAPI.subscribeToClinicalCloud(chatId, (msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        const updated = [...prev, msg];
        localStorage.setItem(`chat_${chatId}`, JSON.stringify(updated));
        // Reset expiration on new message
        setIsExpired(false);
        return updated;
      });
    });

    if (channel || !ClinicalAPI.isConfigured()) setIsCloudConnected(true);
    
    // Listen to local tab changes
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
    
    // Global Broadcast (PC to Tablet)
    ClinicalAPI.broadcastMessage(chatId, msg);
    
    // Notify app state for collection update
    window.dispatchEvent(new Event('storage'));
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isExpired) return;
    
    const newMsg: Message = { 
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: inputText, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    saveMessage(newMsg);
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-8 lg:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-6xl h-full md:h-[90vh] bg-white md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 bg-emerald-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-100">
              {targetUser.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{targetUser.name}</h2>
              <div className="flex items-center space-x-3 mt-1">
                <div className="flex items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                  <span className={`w-2 h-2 rounded-full mr-2 ${isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                  {ClinicalAPI.isConfigured() ? 'Cloud Sync Active' : 'Local Mesh Active'}
                </div>
                {isExpired && (
                  <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-[8px] font-black uppercase tracking-widest border border-red-100">
                    Session Expired
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/30">
          {messages.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest italic">
              Initiate secure clinical dialogue
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[80%] rounded-[2rem] p-6 shadow-sm border ${msg.senderId === currentUser.id ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'}`}>
                <div className="flex items-center justify-between mb-2 opacity-60">
                  <span className="text-[9px] font-black uppercase tracking-widest">{msg.senderName}</span>
                  <span className="text-[9px] font-bold">{msg.time}</span>
                </div>
                <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input / Expiration Notice */}
        <div className="p-8 border-t border-slate-50 bg-white">
          {isExpired ? (
            <div className="bg-red-50 border-2 border-dashed border-red-100 p-8 rounded-[2.5rem] text-center">
              <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-2">Clinical Protocol: Session Expired</p>
              <p className="text-xs text-slate-500 font-medium">Inactivity exceeded 24 hours. Please book a new appointment to re-verify clinical necessity.</p>
            </div>
          ) : (
            <form onSubmit={sendMessage} className="flex items-center space-x-4">
              <input 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                placeholder="Secure clinical message..." 
                className="flex-grow px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.75rem] font-bold text-sm outline-none focus:border-emerald-600 transition-all" 
              />
              <button type="submit" className="p-5 bg-emerald-600 text-white rounded-2xl shadow-xl active:scale-95 hover:bg-emerald-700 transition shadow-emerald-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunicationOverlay;
