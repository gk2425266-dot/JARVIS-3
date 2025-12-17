import React, { useState, useEffect, useCallback } from 'react';
import { Mic, Power, Terminal, AlertTriangle, ShieldCheck, Share2 } from 'lucide-react';
import Orb from './components/Orb';
import { useGeminiLive } from './hooks/useGeminiLive';
import { AppState } from './types';
import { PERMISSION_PROMPT } from './constants';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const { connect, disconnect, isConnected, isSpeaking, error } = useGeminiLive();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-4), `> ${msg}`]);
  };

  // Sync internal state with hook state
  useEffect(() => {
    if (isConnected) {
      setAppState(AppState.LISTENING);
      addLog("J.A.R.V.I.S. Connected.");
    } else if (appState === AppState.LISTENING) {
        // If hook disconnected but we thought we were listening
       setAppState(AppState.IDLE);
       addLog("Connection lost.");
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Errors
  useEffect(() => {
    if (error) {
      setAppState(AppState.ERROR);
      addLog(`ERROR: ${error}`);
    }
  }, [error]);

  const speakSystemMessage = useCallback((text: string, onEnd?: () => void) => {
    const utterance = new SpeechSynthesisUtterance(text);
    // Try to find a good system voice
    const voices = window.speechSynthesis.getVoices();
    const systemVoice = voices.find(v => v.name.includes('Male') || v.name.includes('Google US English')) || voices[0];
    if (systemVoice) utterance.voice = systemVoice;
    utterance.pitch = 0.9;
    utterance.rate = 1.0;
    
    utterance.onend = () => {
        if (onEnd) onEnd();
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleInitialize = () => {
    setAppState(AppState.REQUESTING_PERMISSION);
    addLog("Initializing authentication protocol...");
    
    // Slight delay for effect
    setTimeout(() => {
        speakSystemMessage(PERMISSION_PROMPT);
    }, 500);
  };

  const handlePermissionGranted = () => {
    addLog("Permission granted. Accessing audio hardware...");
    // Stop any browser TTS if overlapping
    window.speechSynthesis.cancel(); 
    connect();
  };

  const handleShutdown = () => {
    disconnect();
    window.speechSynthesis.cancel();
    setAppState(AppState.IDLE);
    addLog("System shutting down...");
  };

  const handleShare = async () => {
    try {
        await navigator.clipboard.writeText(window.location.href);
        addLog("LINK COPIED TO CLIPBOARD");
    } catch (e) {
        addLog("SHARE FAILED");
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden relative selection:bg-cyan-500/30">
      
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-black"></div>

      {/* Header */}
      <div className="absolute top-8 left-0 right-0 flex justify-between px-8 items-center z-10">
        <div className="flex items-center gap-2">
            <Terminal className="text-cyan-500 w-6 h-6" />
            <h1 className="text-2xl font-bold tracking-widest text-cyan-500 font-mono">J.A.R.V.I.S.</h1>
        </div>
        <div className="flex items-center gap-4">
            <button 
                onClick={handleShare}
                className="text-cyan-700 hover:text-cyan-400 transition-colors"
                title="Copy Link"
            >
                <Share2 className="w-5 h-5" />
            </button>
            <div className="text-xs text-cyan-700 font-mono hidden sm:block">
                V.3.1.4 // SECURE
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="z-10 flex flex-col items-center gap-12 w-full max-w-2xl px-4">
        
        {/* The Core */}
        <div className="transform scale-100 md:scale-125 transition-transform">
             <Orb 
                isActive={appState !== AppState.IDLE && appState !== AppState.ERROR}
                isSpeaking={isSpeaking}
                state={appState === AppState.REQUESTING_PERMISSION ? 'WAITING' : isConnected ? 'LISTENING' : 'IDLE'}
             />
        </div>

        {/* Interaction Area */}
        <div className="w-full flex flex-col items-center gap-6 min-h-[150px]">
            
            {appState === AppState.IDLE && (
                <button 
                    onClick={handleInitialize}
                    className="group relative px-8 py-3 bg-cyan-950/30 border border-cyan-500/50 text-cyan-400 font-bold tracking-widest hover:bg-cyan-500 hover:text-black transition-all duration-300 uppercase clip-path-polygon"
                >
                    <span className="flex items-center gap-2">
                        <Power className="w-4 h-4" /> Initialize System
                    </span>
                    <div className="absolute inset-0 border border-cyan-500/20 scale-105 opacity-0 group-hover:scale-110 group-hover:opacity-100 transition-all"></div>
                </button>
            )}

            {appState === AppState.REQUESTING_PERMISSION && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <p className="text-cyan-100 text-lg text-center max-w-md bg-black/50 p-4 border-l-2 border-cyan-500">
                        "{PERMISSION_PROMPT}"
                    </p>
                    <div className="flex gap-4">
                         <button 
                            onClick={handlePermissionGranted}
                            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-black font-bold uppercase tracking-wider transition-colors"
                        >
                            Yes, Listen
                        </button>
                        <button 
                            onClick={() => {
                                setAppState(AppState.IDLE);
                                addLog("Permission denied.");
                            }}
                            className="px-6 py-2 border border-red-500/50 text-red-400 hover:bg-red-950/30 font-bold uppercase tracking-wider transition-colors"
                        >
                            Abort
                        </button>
                    </div>
                </div>
            )}

            {appState === AppState.LISTENING && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in">
                    <div className="flex items-center gap-2 text-cyan-300 bg-cyan-950/20 px-4 py-2 rounded-full border border-cyan-500/20">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-widest">Protocol Active</span>
                    </div>
                    <button 
                        onClick={handleShutdown}
                        className="text-xs text-red-500 hover:text-red-400 hover:underline uppercase tracking-widest mt-4"
                    >
                        Deactivate
                    </button>
                </div>
            )}

            {appState === AppState.ERROR && (
                <div className="text-red-500 flex flex-col items-center gap-2">
                    <AlertTriangle className="w-8 h-8" />
                    <p className="text-center max-w-xs font-mono">{error}</p>
                    <button 
                        onClick={() => setAppState(AppState.IDLE)}
                        className="mt-4 text-xs border border-red-500 px-4 py-2 hover:bg-red-900/20"
                    >
                        RESET PROTOCOL
                    </button>
                </div>
            )}
        </div>

        {/* System Logs */}
        <div className="w-full max-w-md font-mono text-xs text-cyan-700/60 mt-8 space-y-1 h-24 flex flex-col justify-end border-t border-cyan-900/30 pt-4">
            {logs.map((log, i) => (
                <div key={i} className="animate-pulse">{log}</div>
            ))}
        </div>

      </div>
    </div>
  );
};

export default App;