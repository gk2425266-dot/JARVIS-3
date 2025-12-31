
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants.ts';
import { createPcmBlob, decodeBase64, decodeAudioData } from '../utils/audio.ts';

export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const cleanup = useCallback(() => {
    console.log("Shutting down link...");
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
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      
      const apiKey = process.env.API_KEY;
      
      // If we are not in AI Studio and no key is found, we can't initialize the client
      if (!apiKey && !window.aistudio) {
        setError("ERR_AUTH_MISSING");
        return;
      }

      // Initialize the SDK. We use an empty string as fallback to let the SDK 
      // handle the missing key error if our local checks are bypassed.
      const ai = new GoogleGenAI({ apiKey: apiKey || "" });
      
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
            console.log("Handshake successful.");
            setIsConnected(true);
            if (!inputContextRef.current || !streamRef.current) return;
            
            const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
            sourceRef.current = source;
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
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
            console.warn("Server closed connection", e);
            cleanup();
          },
          onerror: (err: any) => {
            console.error('Session error:', err);
            const rawMsg = err?.message || String(err) || "";
            let msg = "ERR_SESSION_DROP";
            
            // "Network error" is common when billing isn't enabled for the API key 
            // or if the key is invalid in a way that prevents the socket handshake.
            if (rawMsg.includes("Network error") || rawMsg.includes("401") || rawMsg.includes("403")) {
              msg = "ERR_NETWORK_OR_AUTH";
            } else if (rawMsg.toLowerCase().includes("requested entity was not found")) {
              msg = "ERR_NOT_FOUND";
            } else if (rawMsg.toLowerCase().includes("quota")) {
              msg = "ERR_QUOTA_EXCEEDED";
            } else if (rawMsg.toLowerCase().includes("safety")) {
              msg = "ERR_SAFETY_FILTER";
            }
            
            setError(msg);
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          thinkingConfig: { thinkingBudget: 0 },
          speechConfig: { 
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } 
          },
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
      console.error('Connection failure:', err);
      const rawMsg = err.message || "";
      if (rawMsg.includes("Permission denied") || rawMsg.includes("device not found")) {
        setError("ERR_HARDWARE_ACCESS");
      } else {
        setError("ERR_NETWORK_OR_AUTH");
      }
      cleanup();
    }
  }, [cleanup]);

  return { connect, disconnect: cleanup, isConnected, isSpeaking, error };
};
