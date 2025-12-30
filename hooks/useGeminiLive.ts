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
  
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const cleanup = useCallback(() => {
    console.log("Severing JARVIS neural link...");
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    
    scheduledSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    scheduledSourcesRef.current.clear();
    
    if (inputContextRef.current) {
      inputContextRef.current.close().catch(() => {});
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close().catch(() => {});
      outputContextRef.current = null;
    }
    
    setIsConnected(false);
    setIsSpeaking(false);
    setSearchSources([]);
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      setSearchSources([]);
      
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("ERR_AUTH_MISSING");

      const ai = new GoogleGenAI({ apiKey });
      
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      inputContextRef.current = new AudioCtx({ sampleRate: 16000 });
      outputContextRef.current = new AudioCtx({ sampleRate: 24000 });
      
      await inputContextRef.current.resume();
      await outputContextRef.current.resume();

      const outputNode = outputContextRef.current.createGain();
      outputNode.connect(outputContextRef.current.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            console.log("Live Uplink Online.");
            setIsConnected(true);
            if (!inputContextRef.current || !streamRef.current) return;
            
            const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
            sourceRef.current = source;
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Neural Noise Gate (Filter silence)
              let maxVal = 0;
              for(let i=0; i<inputData.length; i++) {
                if(Math.abs(inputData[i]) > maxVal) maxVal = Math.abs(inputData[i]);
              }

              if (maxVal > 0.005) {
                const pcmBlob = createPcmBlob(inputData);
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };
            
            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputContextRef.current) {
              setIsSpeaking(true);
              const ctx = outputContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBytes = decodeBase64(base64Audio);
              const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.onended = () => {
                scheduledSourcesRef.current.delete(source);
                if (scheduledSourcesRef.current.size === 0) setIsSpeaking(false);
              };
              source.start(nextStartTimeRef.current);
              scheduledSourcesRef.current.add(source);
              nextStartTimeRef.current += audioBuffer.duration;
            }

            if (message.serverContent?.interrupted) {
              scheduledSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
              scheduledSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: (e) => {
            console.warn("Server connection severed.", e);
            cleanup();
          },
          onerror: (err: any) => {
            console.error('Session dropped:', err);
            // Parse error for user display
            let msg = "PROTOCOL_TIMEOUT";
            if (err?.message) msg = err.message;
            else if (typeof err === 'string') msg = err;
            
            if (msg.includes("403")) msg = "ERR_API_RESTRICTED";
            if (msg.includes("401")) msg = "ERR_KEY_INVALID";
            
            setError(msg);
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          // Note: googleSearch tool is currently excluded for stability in Live Native Audio protocol
          thinkingConfig: { thinkingBudget: 0 },
          speechConfig: { 
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } 
          },
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError(err.message || "HARDWARE_FAILURE");
      cleanup();
    }
  }, [cleanup]);

  return { connect, disconnect: cleanup, isConnected, isSpeaking, searchSources, error };
};