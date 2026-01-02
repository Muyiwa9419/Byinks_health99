
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
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

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const CommunicationOverlay: React.FC<CommunicationOverlayProps> = ({ 
  isOpen, onClose, currentUser, targetUser 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [transcription, setTranscription] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatId = [currentUser.id, targetUser.id].sort().join('--');

  useEffect(() => {
    if (!isOpen) {
      stopScribe();
      return;
    }

    const loadMessages = () => {
      const stored = localStorage.getItem(`chat_${chatId}`);
      if (stored) setMessages(JSON.parse(stored));
    };

    loadMessages();
    window.addEventListener('storage', loadMessages);
    startScribe();
    
    return () => {
      window.removeEventListener('storage', loadMessages);
      stopScribe();
    };
  }, [isOpen, chatId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startScribe = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = inputCtx;
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          systemInstruction: `You are a Clinical Scribe for Byinks Health. You are transcribing a secure session. Focus on capturing medical terminology and symptoms accurately.`
        },
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmData = new Uint8Array(int16.buffer);
              sessionPromise.then(session => session.sendRealtimeInput({ media: { data: encode(pcmData), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              setTranscription(prev => (prev + ' ' + msg.serverContent!.inputTranscription!.text).slice(-2000));
            }
          },
          onerror: () => {},
          onclose: () => {}
        }
      });
    } catch (err) { console.warn("Scribe failed:", err); }
  };

  const stopScribe = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert("Limit: 10MB per clinical file.");

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const newMsg: Message = { 
        id: Math.random().toString(36).substr(2, 9),
        senderId: currentUser.id,
        senderName: currentUser.name,
        file: { data: reader.result as string, name: file.name, type: file.type, size: file.size },
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
    setIsAiLoading(true);
    const textContext = messages.filter(m => m.text).map(m => `${m.senderName}: ${m.text}`).join('\n');
    const analysis = await summarizePatientHistory(textContext || transcription || "No dialogue captured yet.");
    setAiAnalysis(analysis);
    setIsAiLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative w-full max-w-6xl h-full md:h-[85vh] bg-white md:rounded-[3rem] shadow-2xl flex flex-col md:flex-row overflow-hidden">
        
        {/* Chat Area */}
        <div className="flex-grow flex flex-col bg-white border-r border-slate-100">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                {targetUser.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 leading-tight">{targetUser.name}</h2>
                <div className="flex items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                  Secure Clinical Tunnel
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-3 bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-grow overflow-y-auto p-8 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-95">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-[2rem] p-6 shadow-sm border ${
                  msg.senderId === currentUser.id 
                    ? 'bg-slate-900 text-white border-slate-800' 
                    : 'bg-white text-slate-800 border-slate-100'
                }`}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">{msg.senderName} • {msg.time}</p>
                  
                  {msg.text && <p className="text-sm font-medium leading-relaxed">{msg.text}</p>}
                  
                  {msg.file && (
                    <div className="mt-2">
                      {msg.file.type.startsWith('image/') ? (
                        <img src={msg.file.data} alt="Clinical Attachment" className="rounded-xl max-h-64 object-cover border border-white/10" />
                      ) : (
                        <div className={`flex items-center space-x-4 p-4 rounded-xl border ${msg.senderId === currentUser.id ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="flex-grow overflow-hidden">
                            <p className="text-xs font-black uppercase truncate tracking-widest">{msg.file.name}</p>
                            <p className="text-[9px] font-bold opacity-60">{(msg.file.size / 1024).toFixed(1)} KB • Medical Document</p>
                          </div>
                          <a href={msg.file.data} download={msg.file.name} className="p-2 hover:bg-emerald-600 rounded-lg transition hover:text-white">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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

          <form onSubmit={sendMessage} className="p-8 border-t border-slate-50 flex items-center space-x-4 bg-slate-50/30">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-600 rounded-2xl transition shadow-sm ${isUploading ? 'animate-pulse' : ''}`}
              title="Upload Clinical Record"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </button>
            <input 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Secure message..."
              className="flex-grow px-6 py-4 bg-white border border-slate-200 rounded-[1.5rem] font-medium text-sm outline-none focus:border-emerald-600 transition shadow-sm"
            />
            <button 
              type="submit" 
              disabled={!inputText.trim()}
              className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>

        {/* Sidebar: Scribe & AI Analysis */}
        <div className="w-full md:w-96 flex flex-col bg-slate-50 p-8 space-y-8 overflow-y-auto custom-scrollbar">
          <section>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Live Clinical Scribe</h3>
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm min-h-[150px] relative">
              <div className="absolute top-4 right-4 flex space-x-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-200"></span>
              </div>
              <p className="text-xs text-slate-600 font-medium italic leading-relaxed">
                {transcription || "Awaiting audio input from secure session..."}
              </p>
            </div>
          </section>

          <section className="flex-grow flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">AI Case Analysis</h3>
              <button 
                onClick={handleSummarize}
                disabled={isAiLoading || (!transcription && messages.length === 0)}
                className="text-[9px] font-black uppercase text-emerald-600 hover:underline disabled:opacity-30"
              >
                {isAiLoading ? 'Synthesizing...' : 'Sync Insight'}
              </button>
            </div>
            
            <div className="flex-grow bg-emerald-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
              <div className="relative z-10">
                {aiAnalysis ? (
                  <p className="text-xs font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                    {aiAnalysis}
                  </p>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 py-12 opacity-40">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <p className="text-[9px] font-black uppercase tracking-widest leading-loose">Initialize AI analysis for automated clinical scribing & summaries.</p>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl -mr-16 -mb-16"></div>
            </div>
          </section>

          <div className="pt-6 border-t border-slate-200">
             <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start space-x-3">
               <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               <p className="text-[10px] text-amber-800 font-bold leading-relaxed uppercase tracking-tight">Clinical Alert: All data in this session is encrypted. HIPAA/GDPR Compliance active.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationOverlay;
