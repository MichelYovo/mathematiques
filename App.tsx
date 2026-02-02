
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GcdResult, GcdStep } from './types';
import { getInitialExplanation, speakExplanation, createMathChat } from './services/geminiService';

const App: React.FC = () => {
  const [n, setN] = useState<string>('');
  const [m, setM] = useState<string>('');
  const [result, setResult] = useState<GcdResult | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatInstance = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Audio state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const decodeAudioData = async (buffer: ArrayBuffer) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    
    // The data returned by Gemini TTS is raw PCM 16-bit
    const dataInt16 = new Int16Array(buffer);
    const frameCount = dataInt16.length;
    const audioBuffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return audioBuffer;
  };

  const playAudio = async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const audioData = await speakExplanation(text);
      const audioBuffer = await decodeAudioData(audioData);
      const ctx = audioContextRef.current!;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (err) {
      console.error(err);
      setIsSpeaking(false);
    }
  };

  const calculateGCD = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setExplanation('');
    setChatMessages([]);
    
    const numN = parseInt(n);
    const numM = parseInt(m);

    if (isNaN(numN) || isNaN(numM) || numN <= 0 || numM <= 0) {
      setError("Veuillez entrer deux nombres entiers positifs.");
      return;
    }

    setLoading(true);

    let currentN = numN;
    let currentM = numM;
    const steps: GcdStep[] = [];
    
    let remainder = currentN % currentM;
    steps.push({ n: currentN, m: currentM, remainder });

    while (remainder !== 0) {
      currentN = currentM;
      currentM = remainder;
      remainder = currentN % currentM;
      steps.push({ n: currentN, m: currentM, remainder });
    }

    const gcdResult: GcdResult = {
      steps,
      gcd: currentM,
      n: numN,
      m: numM
    };

    setResult(gcdResult);
    
    try {
      const exp = await getInitialExplanation(gcdResult);
      setExplanation(exp);
      chatInstance.current = createMathChat(gcdResult);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [n, m]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !chatInstance.current) return;

    const message = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: message }]);
    setChatLoading(true);

    try {
      const response = await chatInstance.current.sendMessage({ message });
      setChatMessages(prev => [...prev, { role: 'ai', text: response.text }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Oups, j'ai eu un petit problème technique. Peux-tu reformuler ?" }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-10">
          <div className="inline-block px-4 py-1.5 mb-4 text-xs font-bold tracking-widest text-blue-600 uppercase bg-blue-100 rounded-full">
            Mathématiques & Intelligence Artificielle
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">
            Maître <span className="text-blue-600">PGCD</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Calculez le PGCD et comprenez chaque étape grâce à notre assistant pédagogique propulsé par l'IA.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Calculation Column */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <form onSubmit={calculateGCD} className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
                <div>
                  <label htmlFor="n" className="block text-sm font-semibold text-slate-700 mb-2">Nombre A (n)</label>
                  <input
                    type="number"
                    id="n"
                    value={n}
                    onChange={(e) => setN(e.target.value)}
                    placeholder="Ex: 120"
                    className="block w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg font-medium"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="m" className="block text-sm font-semibold text-slate-700 mb-2">Nombre B (m)</label>
                  <input
                    type="number"
                    id="m"
                    value={m}
                    onChange={(e) => setM(e.target.value)}
                    placeholder="Ex: 45"
                    className="block w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg font-medium"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full flex justify-center py-4 px-4 rounded-xl shadow-lg text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {loading ? 'Calcul et Analyse...' : 'Calculer le PGCD'}
                  </button>
                </div>
              </form>
              {error && <p className="mt-4 text-sm text-red-600 font-medium text-center">{error}</p>}
            </section>

            {result && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-blue-600 rounded-2xl p-8 text-white text-center shadow-xl shadow-blue-100 overflow-hidden relative">
                   <div className="absolute top-0 right-0 p-4 opacity-10">
                      <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.11 3.89,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.11,3 19,3M19,19H5V5H19V19M11,7H13V9H11V7M11,11H13V13H11V11M11,15H13V17H11V15Z"/></svg>
                   </div>
                   <h2 className="text-lg font-medium opacity-80 mb-1 tracking-wide uppercase">Le Plus Grand Commun Diviseur est</h2>
                   <div className="text-7xl font-black">{result.gcd}</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                    <span className="bg-blue-50 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center mr-3 text-sm font-black">1</span>
                    Algorithme d'Euclide
                  </h3>
                  <div className="space-y-3">
                    {result.steps.map((step, idx) => (
                      <div key={idx} className="group p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center hover:bg-white hover:border-blue-200 transition-all">
                        <div className="flex items-center space-x-4">
                           <span className="text-xs text-slate-400 font-bold w-4">#{idx+1}</span>
                           <span className="mono text-slate-700 font-medium">{step.n} <span className="text-blue-400 font-normal">divisé par</span> {step.m}</span>
                        </div>
                        <div className="mono text-right">
                           <span className="text-xs text-slate-400 block uppercase">Reste</span>
                           <span className="font-bold text-blue-600 text-xl">{step.remainder}</span>
                        </div>
                      </div>
                    ))}
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-700 font-bold">Reste nul atteint !</span>
                      </div>
                      <span className="font-black text-green-700 text-lg tracking-tight">PGCD = {result.gcd}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Side Column */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[600px] lg:h-[700px] overflow-hidden">
              <header className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-600 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg shadow-purple-100">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">Assistant Mathématique</h3>
                    <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider flex items-center">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span> IA NLP Active
                    </p>
                  </div>
                </div>
                {explanation && (
                  <button 
                    onClick={() => playAudio(explanation)}
                    disabled={isSpeaking}
                    className={`p-2 rounded-full transition-all ${isSpeaking ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white'}`}
                    title="Écouter l'explication"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                  </button>
                )}
              </header>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30 scroll-smooth">
                {!result && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    </div>
                    <p className="text-slate-500 font-medium">Entrez deux nombres pour démarrer la discussion pédagogique.</p>
                  </div>
                )}

                {explanation && (
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm animate-in zoom-in-95 duration-300">
                    <p className="text-slate-700 text-sm leading-relaxed">{explanation}</p>
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start animate-pulse">
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {result && (
                <footer className="p-4 border-t border-slate-100 bg-white">
                  <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Posez une question sur le résultat..."
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm outline-none"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !userInput.trim()}
                      className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    </button>
                  </form>
                </footer>
              )}
            </section>
          </div>
        </div>

        <footer className="mt-16 text-center">
          <div className="flex justify-center space-x-4 mb-4">
             <div className="h-px bg-slate-200 w-12 self-center"></div>
             <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Outil d'apprentissage intelligent</p>
             <div className="h-px bg-slate-200 w-12 self-center"></div>
          </div>
          <p className="text-slate-400 text-sm italic">
            "Comprendre l'arithmétique n'a jamais été aussi simple."
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;
