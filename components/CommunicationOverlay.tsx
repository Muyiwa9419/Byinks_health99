
import { ClinicalAPI } from '../services/apiService.ts';
import { User, UserRole } from '../types.ts';
import React, { useEffect, useRef, useState } from 'react';

interface Message {
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  timestamp: number;
  id: string;
  isSystem?: boolean;
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
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatId = [currentUser.id, targetUser.id].sort().join('--');
  const storageKey = `chat_${chatId}`;

  // Clinical Protocol: 10 Minute Inactivity Auto-Lock
  const EXPIRATION_THRESHOLD = 10 * 60 * 1000; 
  const WARNING_THRESHOLD = 2 * 60 * 1000;

  const getRemainingTime = (msgs: Message[]) => {
    if (msgs.length === 0) return EXPIRATION_THRESHOLD;
    const lastMsg = msgs[msgs.length - 1];
    const elapsed = Date.now() - lastMsg.timestamp;
    return Math.max(0, EXPIRATION_THRESHOLD - elapsed);
  };

  useEffect(() => {
    if (!isOpen) return;

    // 1. Initial Load
    const initialMsgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
    setMessages(initialMsgs);
    const initialRemaining = getRemainingTime(initialMsgs);
    setTimeLeft(initialRemaining);
    setIsExpired(initialRemaining <= 0);

    // 2. Setup Cloud Relay (Supabase Realtime)
    let channel: any = null;
    if (!ClinicalAPI.isConfigured()) {
      setRelayStatus('unavailable');
    } else {
      channel = ClinicalAPI.subscribeToClinicalCloud(chatId, (incomingMsg: Message) => {
        setMessages(prev => {
          if (prev.find(m => m.id === incomingMsg.id)) return prev;
          const newSet = [...prev, incomingMsg].sort((a, b) => a.timestamp - b.timestamp);
          localStorage.setItem(storageKey, JSON.stringify(newSet));
          setTimeLeft(EXPIRATION_THRESHOLD); // Reset local timer on incoming message
          setIsExpired(false);
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
      const remaining = getRemainingTime(updated);
      setTimeLeft(remaining);
      setIsExpired(remaining <= 0);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      channel?.unsubscribe();
    };
  }, [isOpen, chatId, storageKey]);

  // Activity Monitor Timer
  useEffect(() => {
    if (!isOpen || isExpired || timeLeft === null) return;

    const ticker = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 0) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, [isOpen, isExpired, timeLeft]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent, customMsg?: Partial<Message>) => {
    if (e) e.preventDefault();
    if (!customMsg && (!inputText.trim() || isExpired)) return;

    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: customMsg?.text || inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      ...customMsg
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    localStorage.setItem(storageKey, JSON.stringify(updatedMessages));
    window.dispatchEvent(new Event('storage'));
    
    // Reset Timer locally
    setTimeLeft(EXPIRATION_THRESHOLD);
    setIsExpired(false);
    
    // Broadcast to Relay (Cross-Device)
    await ClinicalAPI.broadcastMessage(chatId, newMessage);
    
    if (!customMsg) setInputText('');
  };

  const handleRestartSession = async () => {
    await handleSend(undefined, {
      text: `Clinical Session Re-authorized by ${currentUser.name}`,
      isSystem: true
    });
  };

  const formatTimeLeft = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                {timeLeft !== null && !isExpired && (
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center ${
                    timeLeft < WARNING_THRESHOLD ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-400 border border-slate-100'
                  }`}>
                    Session Lock: {formatTimeLeft(timeLeft)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Security Banners */}
        {timeLeft !== null && timeLeft < WARNING_THRESHOLD && !isExpired && (
          <div className="bg-amber-500 text-white px-8 py-3 text-center text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-full">
            Security Warning: Session will lock in {formatTimeLeft(timeLeft)} due to clinical inactivity.
          </div>
        )}
        {isExpired && (
          <div className="bg-red-600 text-white px-8 py-3 text-center text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-full">
            Clinical Hazard: This session has been locked for your protection.
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/20">
          {messages.map((msg) => (
            msg.isSystem ? (
              <div key={msg.id} className="flex justify-center my-6">
                <span className="px-6 py-2 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200">
                  {msg.text} • {msg.time}
                </span>
              </div>
            ) : (
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
            )
          ))}
          {isExpired && (
            <div className="flex justify-center py-10">
              <div className="bg-white border-2 border-red-100 p-8 rounded-[2rem] text-center max-w-sm shadow-xl animate-in zoom-in-95">
                 <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-2">Session Locked</h4>
                 <p className="text-[10px] text-slate-500 font-bold leading-relaxed mb-6">To ensure medical confidentiality, this interaction hub has been locked due to 10 minutes of inactivity.</p>
                 <button 
                  onClick={handleRestartSession}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition active:scale-95"
                 >
                   Resume Secure Session
                 </button>
              </div>
            </div>
          )}
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
