
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { User, UserRole, Transaction } from '../types';

interface Message {
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  id: string;
}

interface ClinicalObservation {
  category: string;
  detail: string;
}

interface CommunicationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  targetUser: { name: string; role: string; id: string };
  mode: 'chat' | 'video';
}

const CommunicationOverlay: React.FC<CommunicationOverlayProps> = ({ 
  isOpen, onClose, currentUser, targetUser, mode 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [observations, setObservations] = useState<ClinicalObservation[]>([]);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  // Revenue / Payment state
  const [isPaid, setIsPaid] = useState(false);
  const SESSION_FEE = 45;

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const chatId = [currentUser.id, targetUser.id].sort().join('--');

  useEffect(() => {
    if (!isOpen) return;

    // Check payment status for this specific session
    if (currentUser.role === UserRole.PATIENT) {
      const paymentsStr = localStorage.getItem('medi_transactions') || '[]';
      const payments: Transaction[] = JSON.parse(paymentsStr);
      const paid = payments.some(t => t.userId === currentUser.id && t.description.includes(targetUser.id));
      setIsPaid(paid);
    } else {
      setIsPaid(true); // Consultants don't pay
    }

    const loadMessages = () => {
      const stored = localStorage.getItem(`chat_${chatId}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 1000); 

    return () => clearInterval(interval);
  }, [isOpen, chatId, currentUser.id, currentUser.role, targetUser.id]);

  useEffect(() => {
    if (isOpen && isPaid) {
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      if (mode === 'video') {
        startMedia();
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopMedia();
    }
  }, [isOpen, mode, isPaid]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handlePayment = () => {
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      amount: SESSION_FEE,
      type: 'consultation',
      timestamp: new Date().toISOString(),
      description: `Telehealth Session with ${targetUser.name} (${targetUser.id})`
    };

    const transactions = JSON.parse(localStorage.getItem('medi_transactions') || '[]');
    transactions.push(newTransaction);
    localStorage.setItem('medi_transactions', JSON.stringify(transactions));
    
    setIsPaid(true);
  };

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCalling(true);
      await connectToGeminiLive(stream);
    } catch (err) {
      console.error("Media Error:", err);
      alert("Permission denied.");
      onClose();
    }
  };

  const stopMedia = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    sessionRef.current?.close();
    if (audioContextRef.current) audioContextRef.current.close();
    setIsCalling(false);
  };

  const connectToGeminiLive = async (stream: MediaStream) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const inputCtx = new AudioContext({ sampleRate: 16000 });
    const outputCtx = new AudioContext({ sampleRate: 24000 });
    audioContextRef.current = outputCtx;

    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        systemInstruction: `Scribe Assistant. Call: ${currentUser.name} & ${targetUser.name}. Log symptoms & intent.`
      },
      callbacks: {
        onopen: () => {
          setIsLiveActive(true);
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
            sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } }));
          };
          source.connect(processor);
          processor.connect(inputCtx.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
          if (msg.serverContent?.outputTranscription) {
            setTranscription(prev => (prev + ' ' + msg.serverContent!.outputTranscription!.text).slice(-300));
          }
        },
        onclose: () => setIsLiveActive(false)
      }
    });
    sessionRef.current = await sessionPromise;
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: Message = { 
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: inputText, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    localStorage.setItem(`chat_${chatId}`, JSON.stringify(updated));
    setInputText('');
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative w-full h-full max-w-6xl bg-slate-900 md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/5">
        
        {/* Main Interface */}
        <div className="flex-grow flex flex-col bg-slate-950 relative">
          {!isPaid ? (
            <div className="flex-grow flex items-center justify-center p-12 text-center bg-slate-900">
              <div className="max-w-md animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-900/40">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h3 className="text-3xl font-black text-white mb-4">Secure Consultation</h3>
                <p className="text-slate-400 mb-8 leading-relaxed font-medium">Connect with <span className="text-blue-400 font-bold">{targetUser.name}</span> instantly. Platform fee applies for this session.</p>
                <div className="bg-slate-800 p-6 rounded-[2rem] border border-white/5 mb-8">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400 text-sm font-bold uppercase tracking-widest">Provider Fee</span>
                    <span className="text-white font-black text-xl">${SESSION_FEE}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-tight text-left">Includes AI Scribe and Secure Video/Audio line</p>
                </div>
                <button 
                  onClick={handlePayment}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black hover:bg-blue-500 transition shadow-2xl shadow-blue-900/50 flex items-center justify-center space-x-3"
                >
                  <span>Pay & Start Session</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
                <button onClick={onClose} className="mt-6 text-slate-500 font-bold text-sm hover:text-slate-300 transition">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {mode === 'video' ? (
                <div className="flex-grow relative overflow-hidden group">
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover grayscale-[0.2]" />
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/80"></div>
                  
                  {/* Remote User Placeholder (Simulated) */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-32 h-32 rounded-full border-4 border-blue-500/30 p-1 mb-6">
                      <img src={`https://picsum.photos/seed/${targetUser.id}/200`} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <h4 className="text-2xl font-bold text-white mb-2">{targetUser.name}</h4>
                    <span className="text-xs font-black text-blue-400 uppercase tracking-[0.3em] flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-ping"></span> Live Signal
                    </span>
                  </div>

                  {/* Controls */}
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center space-x-4 bg-slate-900/80 backdrop-blur-xl p-4 rounded-[2.5rem] border border-white/10 shadow-2xl">
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-4 rounded-full transition ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                    <button onClick={onClose} className="p-6 bg-red-600 text-white rounded-full hover:bg-red-500 transition shadow-xl shadow-red-900/50">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col bg-slate-900">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg">
                        {targetUser.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white leading-none mb-1">{targetUser.name}</h3>
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">{targetUser.role} • {formatDuration(duration)}</p>
                      </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition p-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  <div className="flex-grow overflow-y-auto p-8 space-y-4">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-3xl ${
                          m.senderId === currentUser.id 
                            ? 'bg-blue-600 text-white rounded-br-none shadow-xl shadow-blue-900/10' 
                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-white/5'
                        }`}>
                          <p className="text-[10px] opacity-60 font-black uppercase tracking-widest mb-1">{m.senderName}</p>
                          <p className="text-sm font-medium">{m.text}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={sendMessage} className="p-8 bg-slate-900/50 border-t border-white/5">
                    <div className="flex space-x-4">
                      <input 
                        type="text" 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Secure clinical message..."
                        className="flex-grow bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                      />
                      <button type="submit" className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-500 transition shadow-xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Clinical Sidebar */}
        <div className="w-full md:w-80 bg-slate-900/50 border-l border-white/5 p-8 flex flex-col">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8">Clinical Summary</h4>
          
          <div className="flex-grow space-y-6">
            <div className="p-6 bg-blue-600/5 rounded-3xl border border-blue-500/20">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block mb-2">AI Scribe Insight</span>
              <p className="text-xs text-slate-400 leading-relaxed italic">"{transcription || 'Awaiting live clinical dialogue for real-time transcription...'}"</p>
            </div>

            <div className="space-y-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Observations</p>
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-white/5 flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-[11px] text-slate-300 font-medium tracking-tight">Signal Integrity: High</span>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-white/5 flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-[11px] text-slate-300 font-medium tracking-tight">Encrypted Session: AES-256</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/5">
            <button className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl transition border border-white/5">
              Request Clinical History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationOverlay;
