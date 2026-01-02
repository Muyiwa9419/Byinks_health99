
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Transaction, AppNotification } from '../types.ts';
import { summarizePatientHistory } from '../services/geminiService.ts';

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

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const CommunicationOverlay: React.FC<CommunicationOverlayProps> = ({ 
  isOpen, onClose, currentUser, targetUser, mode 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [transcription, setTranscription] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const SESSION_FEE = 45;

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
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
    const interval = setInterval(loadMessages, 3000); 
    return () => clearInterval(interval);
  }, [isOpen, chatId]);

  useEffect(() => {
    if (isOpen && !sessionCompleted) {
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      startMedia();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      stopMedia();
    }
    return () => stopMedia();
  }, [isOpen, sessionCompleted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: mode === 'video' 
      });
      streamRef.current = stream;
      if (mode === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      await connectToGeminiLive(stream);
    } catch (err) {
      console.error("Media initialization failed:", err);
    }
  };

  const stopMedia = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const connectToGeminiLive = async (stream: MediaStream) => {
    if (!process.env.API_KEY) {
      console.warn("AI Scribe unavailable: Missing API Key.");
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = inputCtx;
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          outputAudioTranscription: {}, 
          systemInstruction: `You are a Clinical Scribe for Byinks Health. You are listening to a session between ${currentUser.name} and Dr. ${targetUser.name}. Transcribe the conversation and identify medical symptoms or concerns.`
        },
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmData = new Uint8Array(int16.buffer);
              const base64 = encode(pcmData);
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              setTranscription(prev => (prev + '\nAI: ' + message.serverContent!.outputTranscription!.text).slice(-1500));
            } else if (message.serverContent?.inputTranscription) {
              setTranscription(prev => (prev + '\nUser: ' + message.serverContent!.inputTranscription!.text).slice(-1500));
            }
          },
          onerror: (e) => console.error("Clinical AI Scribe Error:", e),
          onclose: () => console.log("Clinical AI Scribe Disconnected")
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e) {
      console.warn("Clinical AI failed to initialize.", e);
    }
  };

  const syncAiInsights = async () => {
    if (messages.length === 0) {
      alert("Awaiting more clinical data for synchronization.");
      return;
    }
    setIsAiLoading(true);
    try {
      const historyStr = messages.map(m => `${m.senderName}: ${m.text}`).join('\n');
      const analysis = await summarizePatientHistory(historyStr);
      setAiAnalysis(analysis);
    } catch (err) {
      setAiAnalysis("Clinical analysis failed to synchronize.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const endSession = () => {
    if (currentUser.role === UserRole.PATIENT) {
      setSessionCompleted(true);
    } else {
      onClose();
    }
  };

  const handlePayment = () => {
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      amount: SESSION_FEE,
      type: 'consultation',
      timestamp: new Date().toISOString(),
      description: `Session: Dr. ${targetUser.name}`
    };

    const transactions = JSON.parse(localStorage.getItem('medi_transactions') || '[]');
    transactions.push(newTransaction);
    localStorage.setItem('medi_transactions', JSON.stringify(transactions));
    
    setIsPaid(true);
    setTimeout(onClose, 1500);
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
    
    const stored = JSON.parse(localStorage.getItem(`chat_${chatId}`) || '[]');
    const updated = [...stored, newMsg];
    setMessages(updated);
    localStorage.setItem(`chat_${chatId}`, JSON.stringify(updated));
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-10">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={endSession}></div>
      
      <div className="relative w-full h-full max-w-6xl bg-slate-900 md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/5">
        <div className="flex-grow flex flex-col bg-slate-950 relative">
          {sessionCompleted ? (
            <div className="flex-grow flex items-center justify-center p-12 bg-slate-900">
              <div className="max-w-md text-center">
                {isPaid ? (
                  <div className="animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-widest">Authorized</h3>
                  </div>
                ) : (
                  <>
                    <h3 className="text-3xl font-black text-white mb-6 tracking-tight">Checkout: ${SESSION_FEE}</h3>
                    <button onClick={handlePayment} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition shadow-2xl">Pay for Consultation</button>
                    <button onClick={onClose} className="mt-6 text-slate-500 text-[10px] font-black uppercase tracking-widest">Dismiss</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {mode === 'video' ? (
                <div className="flex-grow relative bg-slate-900">
                  <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="w-32 h-32 rounded-full border-4 border-emerald-500/20 p-1 mb-4">
                       <div className="w-full h-full bg-slate-800/80 rounded-full flex items-center justify-center text-3xl font-black text-emerald-500 backdrop-blur-md">
                         {targetUser.name.charAt(0)}
                       </div>
                    </div>
                    <h4 className="text-2xl font-black text-white tracking-tight">Dr. {targetUser.name}</h4>
                    <div className="mt-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Clinical Signal Active</div>
                  </div>
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex space-x-4 bg-black/40 p-4 rounded-3xl backdrop-blur-xl border border-white/10">
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-4 rounded-full transition ${isMuted ? 'bg-red-500' : 'bg-white/10'}`}>
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                    <button onClick={endSession} className="p-4 bg-red-600 rounded-full hover:bg-red-500 transition shadow-xl">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col h-full bg-slate-900">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-950/50">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center font-black text-white text-lg">
                        {targetUser.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-white font-black">Dr. {targetUser.name}</h3>
                        <p className="text-[8px] text-emerald-500 font-black uppercase tracking-widest">Encrypted Direct Link</p>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button onClick={syncAiInsights} disabled={isAiLoading} className="p-2 bg-white/5 text-emerald-500 hover:bg-white/10 rounded-xl transition border border-white/5" title="Generate AI Clinical Insights">
                        {isAiLoading ? <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" fill="none"></circle><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" fill="none"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                      </button>
                      <button onClick={endSession} className="p-2 bg-white/5 text-slate-500 hover:text-white rounded-xl transition border border-white/5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex-grow overflow-y-auto p-8 space-y-4 custom-scrollbar bg-slate-950/20">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-3xl ${
                          m.senderId === currentUser.id 
                            ? 'bg-emerald-600 text-white rounded-br-none shadow-lg' 
                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-white/5'
                        }`}>
                          <p className="text-[7px] font-black uppercase tracking-widest opacity-60 mb-1">{m.senderName}</p>
                          <p className="text-sm font-medium">{m.text}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={sendMessage} className="p-6 border-t border-white/5 bg-slate-950/80">
                    <div className="flex space-x-4">
                      <input 
                        value={inputText} 
                        onChange={(e) => setInputText(e.target.value)} 
                        placeholder="Secure clinical communication..." 
                        className="flex-grow bg-slate-900 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-emerald-600 transition" 
                      />
                      <button type="submit" className="bg-emerald-600 text-white px-6 rounded-2xl hover:bg-emerald-500 transition shadow-xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        <div className="w-full md:w-80 bg-slate-950 p-8 border-l border-white/5 flex flex-col">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8">Clinical Intelligence</h4>
          <div className="space-y-6 flex-grow overflow-y-auto custom-scrollbar pr-2">
            <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl">
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-3">Live Scribe Logs</span>
              <p className="text-[11px] text-slate-400 leading-relaxed font-medium italic whitespace-pre-wrap">
                {transcription || 'Awaiting clinical data stream from session...'}
              </p>
            </div>

            {aiAnalysis && (
              <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest block mb-3">Diagnostic Insights</span>
                <p className="text-[11px] text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">{aiAnalysis}</p>
              </div>
            )}

            <div className="p-6 bg-slate-900 rounded-3xl border border-white/5 text-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Session Timer</span>
              <span className="text-2xl font-black text-white tabular-nums">{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest">
            <span>Byinks Global Node</span>
            <span className="text-emerald-500">Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationOverlay;
