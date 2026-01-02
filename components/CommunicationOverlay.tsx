
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, AppNotification } from '../types.ts';
import { summarizePatientHistory } from '../services/geminiService.ts';
import { ClinicalAPI } from '../services/apiService.ts';

interface Message {
  senderId: string;
  senderName: string;
  text: string;
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
  const [relayStatus, setRelayStatus] = useState<'connecting' | 'active' | 'unavailable'>('connecting');
  const [isExpired, setIsExpired] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatId = [currentUser.id, targetUser.id].sort().join('--');
  const storageKey = `chat_${chatId}`;

  const EXPIRATION_THRESHOLD = 24 * 60 * 60 * 1000;

  const checkExpiration = (msgs: Message[]) => {
    if (msgs.length === 0) return false;
    const lastMsg = msgs[msgs.length - 1];
    return (Date.now() - lastMsg.timestamp > EXPIRATION_THRESHOLD);
  };

  useEffect(() => {
    if (!isOpen) return;

    // 1. Initial Load
    const initialMsgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
    setMessages(initialMsgs);
    setIsExpired(checkExpiration(initialMsgs));

    // 2. Setup Cloud Relay (Supabase Realtime)
    if (!ClinicalAPI.isConfigured()) {
      setRelayStatus('unavailable');
    } else {
      const channel = ClinicalAPI.subscribeToClinicalCloud(chatId, (incomingMsg: Message) => {
        setMessages(prev => {
          if (prev.find(m => m.id === incomingMsg.id)) return prev;
          const newSet = [...prev, incomingMsg].sort((a, b) => a.timestamp - b.timestamp);
          localStorage.setItem(storageKey, JSON.stringify(newSet));
          setIsExpired(checkExpiration(newSet));
          return newSet;
        });
      });
      
      if (channel) {
        setRelayStatus('active');
      }
    }

    // 3. Setup Tab Relay (BroadcastChannel fallback)
    const handleStorageChange = () => {
      const updated = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setMessages(updated);
      setIsExpired(checkExpiration(updated));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isOpen, chatId, storageKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isExpired) return;

    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    localStorage.setItem(storageKey, JSON.stringify(updatedMessages));
    window.dispatchEvent(new Event('storage'));
    
    // Broadcast to Relay (Cross-Device)
    await ClinicalAPI.broadcastMessage(chatId, newMessage);
    
    setInputText('');
    setIsExpired(checkExpiration(updatedMessages));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-8 lg:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-6xl h-full md:h-[90vh] bg-white md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        
        {/* Relay Doctor Status Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 bg-emerald-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-100">
              {targetUser.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{targetUser.name}</h2>
              <div className="flex items-center space-x-4 mt-1">
                <div className={`flex items-center text-[9px] font-black uppercase tracking-widest ${
                  relayStatus === 'active' ? 'text-emerald-500' : 
                  relayStatus === 'connecting' ? 'text-amber-500' : 'text-slate-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    relayStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 
                    relayStatus === 'connecting' ? 'bg-amber-500 animate-bounce' : 'bg-slate-300'
                  }`}></span>
                  {relayStatus === 'active' ? 'Cross-Device Relay Active' : 
                   relayStatus === 'connecting' ? 'Opening Bridge...' : 'Local Tab-Only Mode'}
                </div>
                {relayStatus === 'unavailable' && (
                  <span className="text-[8px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded uppercase">
                    Requires API Keys for PC-to-Tablet Sync
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/20">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[75%] p-6 rounded-[2rem] shadow-sm border ${
                msg.senderId === currentUser.id 
                  ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' 
                  : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'
              }`}>
                <div className="flex items-center justify-between mb-2 opacity-50">
                  <span className="text-[9px] font-black uppercase tracking-widest">{msg.senderName}</span>
                  <span className="text-[9px] font-bold">{msg.time}</span>
                </div>
                <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-8 border-t border-slate-50 bg-white">
          <form onSubmit={handleSend} className="flex items-center space-x-4">
            <input 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              disabled={isExpired}
              placeholder={isExpired ? "Session Locked" : "Type secure clinical message..."} 
              className="flex-grow px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.75rem] font-bold text-sm outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-inner disabled:opacity-50" 
            />
            <button 
              type="submit" 
              disabled={!inputText.trim() || isExpired}
              className="p-5 bg-emerald-600 text-white rounded-2xl shadow-xl hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
          {relayStatus === 'unavailable' && (
            <p className="mt-4 text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest italic">
              Note: Messages will not appear on other devices without a configured Cloud Relay.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunicationOverlay;
