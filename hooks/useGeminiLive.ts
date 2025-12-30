import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants.ts';
import { createPcmBlob, decodeBase64, decodeAudioData } from '../utils/audio.ts';

export interface SearchSource {
  uri: string;
  title: string;
}

export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchSources, setSearchSources] = useState<SearchSource[]>([]);
  
  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Audio Playback
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }
    
    // Stop all scheduled audio
    scheduledSourcesRef.current.forEach(s => {
        try { s.stop(); } catch (e) {}
    });
    scheduledSourcesRef.current.clear();
    
    setIsConnected(false);
    setIsSpeaking(false);
    setSearchSources([]);
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      setSearchSources([]);
      
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
          throw new Error("ERR_AUTH_MISSING");
      }

      // Create a fresh instance for the connection
      const ai = new GoogleGenAI({ apiKey });
      
      try {
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } catch (e) {
        throw new Error("ERR_HARDWARE_FAIL");
      }
      
      const outputNode = outputContextRef.current.createGain();
      outputNode.connect(outputContextRef.current.destination);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (e) {
        if (e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
           throw new Error("ERR_MIC_DENIED");
        }
        throw new Error("ERR_MIC_GENERAL");
      }

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            setIsConnected(true);
            
            if (!inputContextRef.current || !streamRef.current) return;
            
            const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
            sourceRef.current = source;
            
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const groundingMetadata = (message.serverContent as any)?.groundingMetadata;
            if (groundingMetadata?.groundingChunks) {
              const sources: SearchSource[] = groundingMetadata.groundingChunks
                .filter((chunk: any) => chunk.web)
                .map((chunk: any) => ({
                  uri: chunk.web.uri,
                  title: chunk.web.title || 'Source Link'
                }));
              
              if (sources.length > 0) {
                setSearchSources(prev => {
                  const combined = [...prev, ...sources];
                  return Array.from(new Map(combined.map(s => [s.uri, s])).values());
                });
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputContextRef.current) {
              setIsSpeaking(true);
              const ctx = outputContextRef.current;
              
              nextStartTimeRef.current = Math.max(
                nextStartTimeRef.current,
                ctx.currentTime
              );
              
              const audioBytes = decodeBase64(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              
              source.addEventListener('ended', () => {
                scheduledSourcesRef.current.delete(source);
                if (scheduledSourcesRef.current.size === 0) {
                    setIsSpeaking(false);
                }
              });
              
              source.start(nextStartTimeRef.current);
              scheduledSourcesRef.current.add(source);
              
              nextStartTimeRef.current += audioBuffer.duration;
            }

            if (message.serverContent?.interrupted) {
              scheduledSourcesRef.current.forEach(s => {
                 try { s.stop(); } catch (e) {}
              });
              scheduledSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: (e) => {
            console.log('Gemini Live Session Closed', e);
            cleanup();
          },
          onerror: (err: any) => {
            console.error('Gemini Live Error', err);
            let msg = "ERR_SESSION_DROP";
            if (err instanceof Error) {
                if (err.message.includes("403")) msg = "ERR_QUOTA_EXCEEDED";
                else if (err.message.includes("401")) msg = "ERR_AUTH_INVALID";
                else msg = err.message;
            }
            setError(msg);
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 0 }, // Optimized for zero-latency quick answers
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          },
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "ERR_INITIALIZATION");
      cleanup();
    }
  }, [cleanup]);

  return {
    connect,
    disconnect: cleanup,
    isConnected,
    isSpeaking,
    searchSources,
    error
  };
};