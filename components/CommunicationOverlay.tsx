
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { User, UserRole, Transaction, Appointment, AppNotification } from '../types';

interface Message {
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  id: string;
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
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Post-Consultation Payment state
  const [sessionCompleted, setSessionCompleted] = useState(false);
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
    if (!isOpen) {
      setSessionCompleted(false);
      setIsPaid(false);
      return;
    }

    const loadMessages = () => {
      const stored = localStorage.getItem(`chat_${chatId}`);
      if (stored) setMessages(JSON.parse(stored));
    };

    loadMessages();
    const interval = setInterval(loadMessages, 1000); 
    return () => clearInterval(interval);
  }, [isOpen, chatId]);

  useEffect(() => {
    if (isOpen && !sessionCompleted) {
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      if (mode === 'video') startMedia();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      stopMedia();
    }
  }, [isOpen, mode, sessionCompleted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addNotification = (userId: string, title: string, message: string, appId?: string) => {
    const notifications: AppNotification[] = JSON.parse(localStorage.getItem('medi_notifications') || '[]');
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      appId,
      title,
      message,
      timestamp: new Date().toISOString(),
      isRead: false,
      type: 'system'
    };
    notifications.push(newNotif);
    localStorage.setItem('medi_notifications', JSON.stringify(notifications));
    window.dispatchEvent(new Event('storage'));
  };

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCalling(true);
      
      // Notify target user about incoming video call
      addNotification(
        targetUser.id,
        'Incoming Video Call',
        `${currentUser.name} is initiating a clinical video consultation.`
      );

      await connectToGeminiLive(stream);
    } catch (err) {
      alert("Media access required for video consultations.");
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

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        systemInstruction: `Clinical Scribe. Logging interaction between ${currentUser.name} and Dr. ${targetUser.name}.`
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

  const endSession = () => {
    if (currentUser.role === UserRole.PATIENT) {
      setSessionCompleted(true);
    } else {
      onClose(); // Consultants just close
    }
  };

  const handlePayment = () => {
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      amount: SESSION_FEE,
      type: 'consultation',
      timestamp: new Date().toISOString(),
      description: `Completed session with ${targetUser.name}`
    };

    const transactions = JSON.parse(localStorage.getItem('medi_transactions') || '[]');
    transactions.push(newTransaction);
    localStorage.setItem('medi_transactions', JSON.stringify(transactions));
    
    // Update appointment status to completed/paid
    const apps = JSON.parse(localStorage.getItem('medi_appointments') || '[]');
    const updatedApps = apps.map((a: Appointment) => 
      (a.patientId === currentUser.id && a.consultantId === targetUser.id && a.status === 'confirmed')
      ? { ...a, status: 'completed', paymentStatus: 'paid' } 
      : a
    );
    localStorage.setItem('medi_appointments', JSON.stringify(updatedApps));

    setIsPaid(true);
    setTimeout(onClose, 1500); // Close after success message
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
    
    // Notify target user about new message
    addNotification(
      targetUser.id,
      'New Secure Message',
      `You have a new clinical message from ${currentUser.name}.`
    );

    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-10 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={endSession}></div>
      
      <div className="relative w-full h-full max-w-6xl bg-slate-900 md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/5">
        
        {/* Main Workspace */}
        <div className="flex-grow flex flex-col bg-slate-950 relative">
          {sessionCompleted ? (
            <div className="flex-grow flex items-center justify-center p-12 bg-slate-900 animate-in zoom-in-95 duration-500">
              <div className="max-w-md text-center">
                {isPaid ? (
                  <div className="animate-in fade-in slide-up duration-500">
                    <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-900/40">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-3xl font-black text-white mb-2">Payment Successful</h3>
                    <p className="text-slate-400 font-medium">Session recorded in your clinical history.</p>
                  </div>
                ) : (
                  <>
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-8">
                      Session Completed • {Math.ceil(duration / 60)} Minutes
                    </div>
                    <h3 className="text-4xl font-black text-white mb-6 tracking-tight">Post-Consultation Summary</h3>
                    
                    <div className="bg-slate-800/50 p-8 rounded-[2.5rem] border border-white/5 mb-10 text-left">
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Consultation Fee</span>
                        <span className="text-3xl font-black text-white">${SESSION_FEE}.00</span>
                      </div>
                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <div className="flex items-center text-slate-300 text-sm font-medium italic">
                          <svg className="w-4 h-4 mr-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Clinical context synchronized to MediSphere.
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handlePayment}
                      className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition shadow-2xl shadow-emerald-900/50 flex items-center justify-center space-x-3 active:scale-95"
                    >
                      <span>Settle Consultation Bill</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </button>
                    <button onClick={onClose} className="mt-8 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition">Cancel & Close Portal</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {mode === 'video' ? (
                <div className="flex-grow relative overflow-hidden group bg-slate-900">
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60"></div>
                  
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-40 h-40 rounded-[3rem] border-4 border-emerald-500/20 p-2 mb-8 bg-slate-800 flex items-center justify-center">
                       <span className="text-5xl font-black text-emerald-600 opacity-20">{targetUser.name.charAt(0)}</span>
                    </div>
                    <h4 className="text-3xl font-black text-white tracking-tight">Dr. {targetUser.name}</h4>
                    <div className="flex items-center mt-4 space-x-2">
                       <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                       <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Signal</span>
                    </div>
                  </div>

                  <div className="absolute bottom-12 left-12">
                     <div className="bg-black/40 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10">
                        <span className="text-xs font-black text-white/80 tabular-nums">LIVE • {new Date(duration * 1000).toISOString().substr(14, 5)}</span>
                     </div>
                  </div>

                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center space-x-6 bg-slate-900/60 backdrop-blur-2xl p-5 rounded-[3rem] border border-white/10">
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-5 rounded-full transition ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                    <button onClick={endSession} className="p-8 bg-red-600 text-white rounded-full hover:bg-red-500 transition shadow-2xl shadow-red-900/40">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col bg-slate-900">
                  <div className="p-10 border-b border-white/5 flex items-center justify-between bg-slate-950/30">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-xl shadow-emerald-900/20">
                        {targetUser.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white leading-none mb-1">Dr. {targetUser.name}</h3>
                        <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Consulting Specialist • {new Date(duration * 1000).toISOString().substr(14, 5)}</p>
                      </div>
                    </div>
                    <button onClick={endSession} className="p-3 bg-white/5 text-slate-500 hover:text-white rounded-2xl transition">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  <div className="flex-grow overflow-y-auto p-10 space-y-6">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] p-6 rounded-[2rem] ${
                          m.senderId === currentUser.id 
                            ? 'bg-emerald-600 text-white rounded-br-none shadow-xl' 
                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-white/5'
                        }`}>
                          <p className="text-[9px] opacity-60 font-black uppercase tracking-widest mb-2">{m.senderName}</p>
                          <p className="text-sm font-medium leading-relaxed">{m.text}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={sendMessage} className="p-10 bg-slate-950/50 border-t border-white/5">
                    <div className="flex space-x-5">
                      <input 
                        type="text" 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Secure clinical enquiry..."
                        className="flex-grow bg-slate-900 border-2 border-white/5 rounded-[1.5rem] px-8 py-5 text-white focus:border-emerald-600 outline-none transition font-medium"
                      />
                      <button type="submit" className="bg-emerald-600 text-white px-8 rounded-[1.5rem] hover:bg-emerald-700 transition shadow-xl">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Clinical Intelligence Sidebar */}
        <div className="w-full md:w-80 bg-slate-950 border-l border-white/5 p-10 flex flex-col">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10">Clinical Intelligence</h4>
          
          <div className="flex-grow space-y-8">
            <div className="p-8 bg-emerald-600/5 rounded-[2.5rem] border border-emerald-500/10">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block mb-4">Live Scribe Active</span>
              <p className="text-xs text-slate-500 leading-relaxed italic font-medium">"{transcription || 'Awaiting live dialogue for secure transcription...'}"</p>
            </div>

            <div className="space-y-4">
               <div className="flex items-center space-x-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End-to-End Encryption</span>
               </div>
               <div className="flex items-center space-x-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                 <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Locality: Nigeria</span>
               </div>
            </div>
          </div>

          <div className="mt-10 pt-10 border-t border-white/5 text-center">
             <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Post-Session Billing</p>
             <div className="text-2xl font-black text-white mb-2">${SESSION_FEE}</div>
             <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">Standard Specialist Consultation Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationOverlay;
