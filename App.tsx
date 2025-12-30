import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Power, Terminal, AlertTriangle, ShieldCheck, Share2, RefreshCw, Lock, ExternalLink, Search, Zap, ShieldAlert, WifiOff, Globe, Database } from 'lucide-react';
import Orb from './components/Orb.tsx';
import { useGeminiLive } from './hooks/useGeminiLive.ts';
import { useAmbientSound } from './hooks/useAmbientSound.ts';
import { AppState } from './types.ts';
import { PERMISSION_PROMPT } from './constants.ts';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const { connect, disconnect, isConnected, isSpeaking, error, searchSources } = useGeminiLive();
  const [logs, setLogs] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useAmbientSound(appState === AppState.LISTENING);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-4), `> ${msg}`]);
  };

  useEffect(() => {
    addLog("Environment: Secure");
    addLog("Network: Vercel Edge Node Synced");
    addLog("Model: Gemini 3 Flash Hybrid");
    addLog("Developer: MR. ANSH RAJ");
  }, []);

  useEffect(() => {
    if (isConnected) {
      setAppState(AppState.LISTENING);
      addLog("J.A.R.V.I.S. Uplink Active");
    } else if (appState === AppState.LISTENING) {
       setAppState(AppState.IDLE);
       addLog("System Dormant.");
    }
  }, [isConnected]);

  useEffect(() => {
    if (error) {
      setAppState(AppState.ERROR);
      addLog(`PROTOCOL_FAILURE: ${error}`);
    }
  }, [error]);

  useEffect(() => {
    if (searchSources.length > 0) {
      setIsScanning(true);
      addLog(`GROUNDING: ${searchSources.length} external nodes synced.`);
      const timer = setTimeout(() => setIsScanning(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchSources.length]);

  const speakSystemMessage = useCallback((text: string, onEnd?: () => void) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const systemVoice = voices.find(v => v.name.includes('Male') || v.name.includes('Google US English')) || voices[0];
    if (systemVoice) utterance.voice = systemVoice;
    utterance.pitch = 0.85;
    utterance.rate = 1.1; 
    utterance.onend = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleInitialize = () => {
    setAppState(AppState.REQUESTING_PERMISSION);
    addLog("Requesting biometric clearance...");
    setTimeout(() => speakSystemMessage(PERMISSION_PROMPT), 300);
  };

  const handlePermissionGranted = () => {
    addLog("Authorization acknowledged.");
    window.speechSynthesis.cancel(); 
    connect();
  };

  const handleShutdown = () => {
    disconnect();
    window.speechSynthesis.cancel();
    setAppState(AppState.IDLE);
    addLog("Uplink severed.");
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden relative selection:bg-cyan-500/30 font-mono">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.05)_0%,transparent_70%)]"></div>

      {/* Top HUD */}
      <div className="absolute top-8 left-0 right-0 flex justify-between px-10 items-start z-10">
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Terminal className="text-cyan-500 w-5 h-5" />
                <h1 className="text-xl font-bold tracking-[0.2em] text-cyan-500">J.A.R.V.I.S. <span className="text-[10px] font-normal opacity-50 underline">OS_CORE</span></h1>
            </div>
            <div className="text-[10px] text-cyan-700/60 uppercase tracking-widest pl-7">Advanced Intelligence Protocol</div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-[10px] bg-cyan-950/20 border border-cyan-500/30 px-3 py-1.5 rounded-sm text-cyan-400">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cyan-400 animate-pulse' : 'bg-red-500'}`}></div>
                {isConnected ? 'LIVE_UPLINK' : 'OFFLINE'} // NODE_VERCEL
            </div>
            {isScanning && (
                <div className="flex items-center gap-2 text-[9px] text-cyan-400 animate-pulse">
                    <Globe className="w-3 h-3" /> SCANNING_GLOBAL_NETWORKS...
                </div>
            )}
        </div>
      </div>

      {/* Main Interface */}
      <div className="z-10 flex flex-col lg:flex-row items-center justify-center gap-16 w-full max-w-7xl px-10">
        
        {/* Core AI Section */}
        <div className="flex flex-col items-center gap-10 w-full lg:w-1/2">
            <div className="relative group">
                {/* Decorative Hexagon/Circle elements */}
                <div className="absolute -inset-8 border border-cyan-500/10 rounded-full animate-[spin_15s_linear_infinite]"></div>
                <div className="absolute -inset-12 border border-cyan-500/5 rounded-full animate-[spin_20s_linear_infinite_reverse]"></div>
                
                <Orb 
                    isActive={appState !== AppState.IDLE && appState !== AppState.ERROR}
                    isSpeaking={isSpeaking}
                    state={appState === AppState.REQUESTING_PERMISSION ? 'WAITING' : isConnected ? 'LISTENING' : 'IDLE'}
                 />
            </div>

            <div className="w-full flex flex-col items-center gap-8 min-h-[140px]">
                {appState === AppState.IDLE && (
                    <button 
                        onClick={handleInitialize}
                        className="relative group px-12 py-4 bg-transparent border border-cyan-500/40 text-cyan-400 font-bold tracking-[0.4em] hover:bg-cyan-500 hover:text-black transition-all duration-500 uppercase overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-cyan-500/10 group-hover:bg-cyan-500 transition-colors"></div>
                        <span className="relative flex items-center gap-3">
                            <Power className="w-4 h-4" /> System Initiation
                        </span>
                    </button>
                )}

                {appState === AppState.REQUESTING_PERMISSION && (
                    <div className="flex flex-col items-center gap-6 animate-in zoom-in duration-300">
                        <p className="text-cyan-100/60 text-center max-w-sm text-[11px] leading-relaxed uppercase tracking-widest border-x border-cyan-500/20 px-4">
                            "{PERMISSION_PROMPT}"
                        </p>
                        <div className="flex gap-6">
                             <button 
                                onClick={handlePermissionGranted}
                                className="px-10 py-2 bg-cyan-500 text-black font-bold uppercase tracking-[0.2em] text-xs hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                            >
                                Confirm
                            </button>
                            <button 
                                onClick={() => setAppState(AppState.IDLE)}
                                className="px-10 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold uppercase tracking-[0.2em] text-xs transition-all"
                            >
                                Abort
                            </button>
                        </div>
                    </div>
                )}

                {appState === AppState.LISTENING && (
                    <div className="flex flex-col items-center gap-5">
                        <div className="flex flex-col items-center gap-2">
                             <div className="flex gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-1 h-4 bg-cyan-500/30 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>
                                ))}
                             </div>
                             <span className="text-[10px] text-cyan-500 uppercase tracking-[0.3em]">Neural Link Established</span>
                        </div>
                        <button 
                            onClick={handleShutdown}
                            className="group flex items-center gap-2 text-[9px] text-red-500/60 hover:text-red-400 uppercase tracking-[0.2em] transition-colors border-b border-transparent hover:border-red-500/50 pb-1"
                        >
                            <Power className="w-3 h-3" /> Shutdown Sequence
                        </button>
                    </div>
                )}
            </div>
            
            {/* Terminal Feed */}
            <div className="w-full max-w-md bg-cyan-950/5 border border-cyan-500/10 p-3 rounded-sm">
                <div className="flex items-center gap-2 text-[9px] text-cyan-500/40 mb-2 border-b border-cyan-500/10 pb-1">
                    <Database className="w-3 h-3" /> SYSTEM_LOG_STREAM
                </div>
                <div className="h-20 flex flex-col justify-end gap-1">
                    {logs.map((log, i) => (
                        <div key={i} className="text-[10px] text-cyan-400/80 truncate font-mono flex gap-2">
                            <span className="opacity-30">[{new Date().toLocaleTimeString([], {hour12: false})}]</span>
                            {log}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Intelligence Hub (Search Results) */}
        <div className={`w-full lg:w-1/3 flex flex-col gap-4 transition-all duration-700 ${searchSources.length > 0 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <div className="flex items-center gap-2 text-cyan-400">
                    <Globe className="w-4 h-4" />
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em]">Intelligence Grounding</h2>
                </div>
                <div className="text-[8px] text-cyan-700 font-bold uppercase tracking-widest bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10">
                    G-SEARCH_ENABLED
                </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
                {searchSources.map((source, index) => (
                    <a 
                        key={index}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative p-4 bg-cyan-950/10 border border-cyan-500/10 hover:border-cyan-400/60 transition-all duration-300 scanner-effect"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="text-[11px] font-bold text-cyan-100 group-hover:text-cyan-400 transition-colors uppercase leading-tight pr-4">
                                {source.title}
                            </h3>
                            <ExternalLink className="w-3 h-3 text-cyan-800 group-hover:text-cyan-400" />
                        </div>
                        <div className="text-[8px] text-cyan-700 truncate font-mono group-hover:text-cyan-600 transition-colors">
                            {source.uri}
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-cyan-500/50"></div>
                            <span className="text-[7px] text-cyan-900 uppercase tracking-widest">Verified External Node</span>
                        </div>
                    </a>
                ))}
            </div>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 flex flex-col items-center gap-1 opacity-20 hover:opacity-100 transition-opacity duration-500 group">
        <div className="h-[1px] w-20 bg-cyan-500/30 group-hover:w-40 transition-all"></div>
        <div className="text-[9px] tracking-[0.4em] text-cyan-500">DEVELOPED BY MR. ANSH RAJ</div>
      </div>
    </div>
  );
};

export default App;