
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Power, Terminal, ShieldAlert, Database, Lock, ExternalLink, Globe, Key, ShieldCheck, HelpCircle } from 'lucide-react';
import Orb from './components/Orb.tsx';
import { useGeminiLive } from './hooks/useGeminiLive.ts';
import { useAmbientSound } from './hooks/useAmbientSound.ts';
import { AppState } from './types.ts';
import { PERMISSION_PROMPT } from './constants.ts';

// Add type safety for AI Studio environment
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

const ERROR_GUIDANCE: Record<string, { title: string; detail: string; action?: string }> = {
  ERR_AUTH_MISSING: {
    title: "Security Credentials Missing",
    detail: "The system core is lacking an authentication token. Check deployment environment variables.",
    action: "Re-verify API_KEY configuration."
  },
  ERR_KEY_INVALID: {
    title: "Invalid Token Detected",
    detail: "The provided handshake token was rejected by the neural server. It may be expired or revoked.",
    action: "Update API credentials in system settings."
  },
  ERR_NOT_FOUND: {
    title: "Resource Not Found",
    detail: "The requested model 'Gemini 2.5' or specific resource is unavailable for this project.",
    action: "Check project permissions or select a different key."
  },
  ERR_QUOTA_EXCEEDED: {
    title: "Bandwidth Quota Exceeded",
    detail: "The neural link has hit its transmission limit for this period.",
    action: "Await system cool-down or upgrade plan."
  },
  ERR_HARDWARE_ACCESS: {
    title: "Hardware Interface Error",
    detail: "Failed to establish a link with the local audio input devices.",
    action: "Grant microphone permissions in browser."
  },
  ERR_SESSION_DROP: {
    title: "Uplink Interrupted",
    detail: "The connection to the server was severed unexpectedly.",
    action: "Check network stability and retry."
  },
  ERR_SAFETY_FILTER: {
    title: "Safety Protocol Breach",
    detail: "The last transmission triggered automated safety filters.",
    action: "Refine input parameters and attempt re-link."
  },
  ERR_LINK_FAILURE: {
    title: "Neural Handshake Failure",
    detail: "A critical error occurred during the system initialization phase.",
    action: "Inspect terminal logs for diagnostic data."
  }
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [needsKey, setNeedsKey] = useState(false);
  const { connect, disconnect, isConnected, isSpeaking, error } = useGeminiLive();
  const [logs, setLogs] = useState<string[]>([]);

  useAmbientSound(appState === AppState.LISTENING);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-4), `> ${msg}`]);
  };

  useEffect(() => {
    addLog("Environment: Secure");
    addLog("Neural Engine: Ready");
    addLog("Protocol: MR. ANSH RAJ");
  }, []);

  useEffect(() => {
    if (isConnected) {
      setAppState(AppState.LISTENING);
      setNeedsKey(false);
      addLog("Link established. Systems online.");
    } else if (appState === AppState.LISTENING) {
       setAppState(AppState.IDLE);
       addLog("Link severed. Dormant.");
    }
  }, [isConnected, appState]);

  useEffect(() => {
    if (error) {
      if (error === "ERR_AUTH_MISSING" || error === "ERR_KEY_INVALID" || error === "ERR_NOT_FOUND") {
        if (window.aistudio) {
          setNeedsKey(true);
        } else {
          addLog("CRITICAL: Authentication hardware missing on host.");
        }
      }
      setAppState(AppState.ERROR);
      addLog(`ERR: ${error.toUpperCase()}`);
    }
  }, [error]);

  const errorDetail = useMemo(() => {
    if (!error) return null;
    return ERROR_GUIDANCE[error] || { 
      title: "Unknown Protocol Error", 
      detail: "An unspecified error occurred. Consult diagnostic logs.", 
      action: "Attempt system reset." 
    };
  }, [error]);

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

  const handleInitialize = async () => {
    setAppState(AppState.REQUESTING_PERMISSION);
    addLog("Initiating handshake...");
    
    if (window.aistudio) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setNeedsKey(true);
          addLog("Awaiting external auth token...");
        }
      } catch (e) {
        console.warn("AI Studio key check failed", e);
      }
    }
    
    setTimeout(() => speakSystemMessage(PERMISSION_PROMPT), 300);
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setNeedsKey(false);
        addLog("Key selection synchronized.");
        connect();
      } catch (e) {
        addLog("ERR: Key selection aborted.");
      }
    }
  };

  const handlePermissionGranted = () => {
    addLog("Handshake verified.");
    window.speechSynthesis.cancel(); 
    if (needsKey && window.aistudio) {
      handleSelectKey();
    } else {
      connect();
    }
  };

  const handleShutdown = () => {
    disconnect();
    window.speechSynthesis.cancel();
    setAppState(AppState.IDLE);
    setNeedsKey(false);
    addLog("Manual link termination.");
  };

  const getOrbState = () => {
    if (appState === AppState.ERROR) return 'ERROR';
    if (appState === AppState.REQUESTING_PERMISSION) return 'WAITING';
    if (isConnected) return 'LISTENING';
    return 'IDLE';
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden relative selection:bg-cyan-500/30 font-mono">
      
      {/* HUD Background Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:30px_30px]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.05)_0%,transparent_70%)]"></div>

      {/* Top HUD */}
      <div className="absolute top-8 left-0 right-0 flex justify-between px-10 items-start z-10">
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Terminal className="text-cyan-500 w-5 h-5" />
                <h1 className="text-xl font-bold tracking-[0.2em] text-cyan-500 uppercase">J.A.R.V.I.S. <span className="text-[10px] font-normal opacity-50">V2.5</span></h1>
            </div>
            <div className="text-[10px] text-cyan-700/60 uppercase tracking-widest pl-7">Developed by Ansh Raj</div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-[10px] bg-cyan-950/20 border border-cyan-500/30 px-3 py-1.5 rounded-sm text-cyan-400">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cyan-400 animate-pulse' : appState === AppState.ERROR ? 'bg-red-500' : 'bg-gray-600'}`}></div>
                {isConnected ? 'STABLE' : appState === AppState.ERROR ? 'BREACH' : 'OFFLINE'}
            </div>
            {isConnected && <div className="text-[9px] text-cyan-500/40 uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Secure Connection
            </div>}
        </div>
      </div>

      {/* Main UI */}
      <div className="z-10 flex flex-col items-center justify-center gap-12 w-full max-w-xl px-10">
        
        <div className="relative group">
            <div className="absolute -inset-8 border border-cyan-500/10 rounded-full animate-[spin_15s_linear_infinite]"></div>
            <Orb 
                isActive={appState !== AppState.IDLE && appState !== AppState.ERROR}
                isSpeaking={isSpeaking}
                state={getOrbState()}
             />
        </div>

        <div className="w-full flex flex-col items-center gap-8 min-h-[160px]">
            {appState === AppState.IDLE && (
                <button 
                    onClick={handleInitialize}
                    className="relative group px-12 py-4 bg-transparent border border-cyan-500/40 text-cyan-400 font-bold tracking-[0.4em] hover:bg-cyan-500 hover:text-black transition-all duration-500 uppercase pulse-activation"
                >
                    <div className="absolute inset-0 bg-cyan-500/5 group-hover:bg-cyan-500 transition-colors"></div>
                    <span className="relative flex items-center gap-3">
                        <Power className="w-4 h-4" /> System Initiation
                    </span>
                </button>
            )}

            {appState === AppState.REQUESTING_PERMISSION && !needsKey && (
                <div className="flex flex-col items-center gap-6 animate-in zoom-in duration-300">
                    <p className="text-cyan-100/60 text-center text-[11px] leading-relaxed uppercase tracking-widest border-x border-cyan-500/20 px-6 max-w-xs">
                        "{PERMISSION_PROMPT}"
                    </p>
                    <div className="flex gap-6">
                         <button 
                            onClick={handlePermissionGranted}
                            className="px-10 py-2 bg-cyan-500 text-black font-bold uppercase tracking-[0.2em] text-xs hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                        >
                            Authorize
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

            {needsKey && (
                <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom duration-500 bg-cyan-950/20 p-6 border border-cyan-500/20 rounded-lg backdrop-blur-md">
                    <div className="flex items-center gap-2 text-cyan-400 mb-2">
                        <Lock className="w-4 h-4" />
                        <h3 className="text-xs font-bold uppercase tracking-widest">Auth Token Required</h3>
                    </div>
                    <p className="text-[10px] text-cyan-100/60 text-center leading-relaxed mb-4 max-w-xs">
                        JARVIS requires a valid API key from a paid GCP project to establish a high-bandwidth neural link.
                    </p>
                    <button 
                        onClick={handleSelectKey}
                        className="w-full flex items-center justify-center gap-3 px-8 py-3 bg-cyan-500 text-black font-bold uppercase tracking-[0.2em] text-xs hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    >
                        <Key className="w-4 h-4" /> Select API Key
                    </button>
                    <a 
                        href="https://ai.google.dev/gemini-api/docs/billing" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[9px] text-cyan-500/50 hover:text-cyan-400 transition-colors underline flex items-center gap-1 mt-2"
                    >
                        Billing Documentation <ExternalLink className="w-2 h-2" />
                    </a>
                </div>
            )}

            {appState === AppState.LISTENING && (
                <div className="flex flex-col items-center gap-5">
                    <div className="flex flex-col items-center gap-2">
                         <div className="flex gap-1 h-4 items-center">
                            {[...Array(5)].map((_, i) => (
                                <div 
                                  key={i} 
                                  className={`w-1 bg-cyan-500/40 ${isSpeaking ? 'animate-[bounce_0.6s_ease-in-out_infinite]' : 'animate-pulse'}`} 
                                  style={{ height: `${20 + (i % 2 === 0 ? 40 : 80)}%`, animationDelay: `${i * 0.1}s` }}
                                ></div>
                            ))}
                         </div>
                         <span className="text-[10px] text-cyan-500 uppercase tracking-[0.3em] font-bold">Protocol Active</span>
                    </div>
                    <button 
                        onClick={handleShutdown}
                        className="group flex items-center gap-2 text-[9px] text-red-500/60 hover:text-red-400 uppercase tracking-[0.2em] transition-colors border-b border-transparent hover:border-red-500/50 pb-1"
                    >
                        Sever Link
                    </button>
                </div>
            )}

            {appState === AppState.ERROR && !needsKey && errorDetail && (
                <div className="flex flex-col items-center gap-4 animate-in shake duration-500 max-w-md w-full">
                     <div className="flex flex-col gap-3 bg-red-950/20 p-5 border border-red-500/30 rounded-lg backdrop-blur-md">
                        <div className="flex items-center gap-2 text-red-500 border-b border-red-500/20 pb-2">
                            <ShieldAlert className="w-5 h-5 shrink-0" />
                            <h3 className="text-xs uppercase font-bold tracking-widest">{errorDetail.title}</h3>
                        </div>
                        <p className="text-[10px] text-red-100/60 leading-relaxed uppercase">
                          {errorDetail.detail}
                        </p>
                        <div className="flex items-center gap-2 text-[9px] text-cyan-400 bg-cyan-950/30 p-2 rounded border border-cyan-500/10">
                          <HelpCircle className="w-3 h-3 shrink-0" />
                          <span>SUGGESTION: {errorDetail.action}</span>
                        </div>
                     </div>
                     <button 
                        onClick={() => { setAppState(AppState.IDLE); disconnect(); }}
                        className="text-[9px] text-cyan-500/60 hover:text-cyan-400 uppercase tracking-widest border border-cyan-500/20 px-6 py-2 hover:bg-cyan-500/5 transition-all"
                     >
                        Initiate System Recovery
                     </button>
                </div>
            )}
        </div>
        
        {/* Terminal Logs */}
        <div className="w-full bg-cyan-950/5 border border-cyan-500/10 p-3 rounded-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[9px] text-cyan-500/40 mb-2 border-b border-cyan-500/10 pb-1">
                <Database className="w-3 h-3" /> FEED_0x2A
            </div>
            <div className="h-20 flex flex-col justify-end gap-1 overflow-hidden">
                {logs.map((log, i) => (
                    <div key={i} className={`text-[10px] truncate font-mono flex gap-2 ${log.includes('ERR') ? 'text-red-500' : 'text-cyan-400/80'}`}>
                        <span className="opacity-30">[{new Date().toLocaleTimeString([], {hour12: false})}]</span>
                        {log}
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 flex flex-col items-center gap-1 opacity-20 hover:opacity-100 transition-opacity duration-500 group">
        <div className="h-[1px] w-20 bg-cyan-500/30 group-hover:w-40 transition-all"></div>
        <div className="text-[9px] tracking-[0.4em] text-cyan-500 uppercase">MR. ANSH RAJ // JARVIS_CORE</div>
      </div>
    </div>
  );
};

export default App;
