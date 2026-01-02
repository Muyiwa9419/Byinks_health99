
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
  const [isCloudActive, setIsCloudActive] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatId = [currentUser.id, targetUser.id].sort().join('--');
  const storageKey = `chat_${chatId}`;

  const EXPIRATION_THRESHOLD = 24 * 60 * 60 * 1000; // 24 Hours

  // Logic to calculate expiration based on message list
  const checkExpiration = (msgs: Message[]) => {
    if (msgs.length === 0) return false;
    const lastMsg = msgs[msgs.length - 1];
    return (Date.now() - lastMsg.timestamp > EXPIRATION_THRESHOLD);
  };

  useEffect(() => {
    if (!isOpen) return;

    // 1. Initial Load from Local Storage
    const initialMsgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
    setMessages(initialMsgs);
    setIsExpired(checkExpiration(initialMsgs));

    // 2. Setup Real-time Cloud Mirroring
    const channel = ClinicalAPI.subscribeToClinicalCloud(chatId, (incomingMsg: Message) => {
      setMessages(prev => {
        // Prevent duplicate messages (id-based check)
        if (prev.find(m => m.id === incomingMsg.id)) return prev;
        
        const newSet = [...prev, incomingMsg].sort((a, b) => a.timestamp - b.timestamp);
        
        // PERSIST IMMEDIATELY to local storage for other tabs
        localStorage.setItem(storageKey, JSON.stringify(newSet));
        window.dispatchEvent(new Event('storage'));
        
        setIsExpired(checkExpiration(newSet));
        return newSet;
      });
    });

    if (channel) {
      setIsCloudActive(true);
    }

    // 3. Listen for changes from other tabs on same device
    const handleStorageChange = (e: StorageEvent | Event) => {
      const updated = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setMessages(updated);
      setIsExpired(checkExpiration(updated));
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      channel?.unsubscribe();
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

    // Update Local State
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    localStorage.setItem(storageKey, JSON.stringify(updatedMessages));
    window.dispatchEvent(new Event('storage'));
    
    // Broadcast to Cloud (Cross-Device)
    await ClinicalAPI.broadcastMessage(chatId, newMessage);
    
    setInputText('');
    setIsExpired(checkExpiration(updatedMessages));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-8 lg:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-6xl h-full md:h-[90vh] bg-white md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        
        {/* Real-time Status Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 bg-emerald-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-100">
              {targetUser.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{targetUser.name}</h2>
              <div className="flex items-center space-x-3 mt-1">
                <div className={`flex items-center text-[9px] font-black uppercase tracking-widest ${isCloudActive ? 'text-emerald-500' : 'text-slate-300'}`}>
                  <span className={`w-2 h-2 rounded-full mr-2 ${isCloudActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                  {isCloudActive ? 'Secure Cloud Link' : 'Connecting...'}
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

        {/* Message Stream */}
        <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/20">
          {messages.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">Secure clinical thread initiated</p>
            </div>
          )}
          
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

        {/* Input Control Area */}
        <div className="p-8 border-t border-slate-50 bg-white">
          {isExpired ? (
            <div className="bg-red-50/50 border-2 border-dashed border-red-100 p-8 rounded-[2.5rem] text-center">
              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">Protocol Lockdown: Session Inactive</p>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                No activity detected for 24 hours. This thread has been closed for medical safety. <br />
                Please schedule a new appointment to re-open the communication line.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex items-center space-x-4">
              <div className="flex-grow relative group">
                <input 
                  value={inputText} 
                  onChange={(e) => setInputText(e.target.value)} 
                  placeholder="Type secure clinical message..." 
                  className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.75rem] font-bold text-sm outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-inner" 
                />
              </div>
              <button 
                type="submit" 
                disabled={!inputText.trim()}
                className="p-5 bg-emerald-600 text-white rounded-2xl shadow-xl active:scale-95 hover:bg-emerald-700 transition-all shadow-emerald-100 disabled:opacity-50 disabled:grayscale"
              >
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
