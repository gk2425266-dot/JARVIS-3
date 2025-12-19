import { useEffect, useRef } from 'react';

export const useAmbientSound = (enabled: boolean) => {
  const contextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  useEffect(() => {
    if (enabled) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        contextRef.current = ctx;

        // Master Gain
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0; // Start silent
        masterGain.connect(ctx.destination);
        masterGainRef.current = masterGain;

        const oscs: OscillatorNode[] = [];

        // 1. Deep Drone (Fundamental)
        // 55Hz is approx A1, a nice deep tech hum
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 55; 
        const gain1 = ctx.createGain();
        gain1.gain.value = 0.1;
        osc1.connect(gain1);
        gain1.connect(masterGain);
        oscs.push(osc1);

        // 2. Detuned Drone (Phasing effect)
        // 55.5Hz creates a slow 0.5Hz binaural beat/pulse
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 55.5; 
        const gain2 = ctx.createGain();
        gain2.gain.value = 0.1;
        osc2.connect(gain2);
        gain2.connect(masterGain);
        oscs.push(osc2);
        
        // 3. High Tech Whine (Subtle)
        // Adds a sense of "power" or "electricity"
        const osc3 = ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.value = 2000; 
        const gain3 = ctx.createGain();
        gain3.gain.value = 0.002; // Extremely quiet
        osc3.connect(gain3);
        gain3.connect(masterGain);
        oscs.push(osc3);

        // Start all oscillators
        oscs.forEach(o => o.start());
        oscillatorsRef.current = oscs;

        // Fade in volume to target
        // Target is low enough to not interfere with speech
        masterGain.gain.setTargetAtTime(0.05, ctx.currentTime, 1);

      } catch (e) {
        console.warn("Audio system initialized failed", e);
      }
    } else {
      // Cleanup sequence
      if (contextRef.current && masterGainRef.current) {
        const ctx = contextRef.current;
        const masterGain = masterGainRef.current;
        
        // Fade out
        masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        
        // Stop and close after fade
        setTimeout(() => {
            oscillatorsRef.current.forEach(o => {
                try { o.stop(); } catch(e){}
            });
            if (contextRef.current && contextRef.current.state !== 'closed') {
                contextRef.current.close();
            }
            contextRef.current = null;
            masterGainRef.current = null;
            oscillatorsRef.current = [];
        }, 600);
      }
    }

    // Unmount cleanup
    return () => {
       if (contextRef.current && contextRef.current.state !== 'closed') {
           try { contextRef.current.close(); } catch(e){}
       }
    };
  }, [enabled]);
};