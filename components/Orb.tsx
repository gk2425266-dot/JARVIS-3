import React from 'react';

interface OrbProps {
  isActive: boolean;
  isSpeaking: boolean;
  state: 'IDLE' | 'LISTENING' | 'SPEAKING' | 'WAITING' | 'ERROR';
}

const Orb: React.FC<OrbProps> = ({ isActive, isSpeaking, state }) => {
  let innerColor = "bg-cyan-500";
  let outerGlow = "shadow-[0_0_60px_rgba(6,182,212,0.6)]";
  
  if (state === 'IDLE') {
    innerColor = "bg-gray-800";
    outerGlow = "shadow-none";
  } else if (state === 'WAITING') {
    innerColor = "bg-amber-500";
    outerGlow = "shadow-[0_0_60px_rgba(245,158,11,0.6)]";
  } else if (state === 'ERROR') {
    innerColor = "bg-red-600";
    outerGlow = "shadow-[0_0_80px_rgba(220,38,38,0.7)]";
  } else if (isSpeaking) {
    innerColor = "bg-cyan-300";
    outerGlow = "shadow-[0_0_100px_rgba(34,211,238,0.9)]";
  }

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Outer Rings - Rotating */}
      <div className={`absolute w-full h-full rounded-full border border-cyan-500/20 ${isActive ? 'animate-[spin_8s_linear_infinite]' : ''}`}></div>
      <div className={`absolute w-[90%] h-[90%] rounded-full border border-cyan-400/10 ${isActive ? 'animate-[spin_12s_linear_infinite_reverse]' : ''}`}></div>
      <div className={`absolute w-[110%] h-[110%] rounded-full border-2 border-dashed border-cyan-600/10 ${isActive ? 'animate-[spin_20s_linear_infinite]' : ''}`}></div>

      {/* Core Orb */}
      <div 
        className={`relative w-32 h-32 rounded-full ${innerColor} ${outerGlow} transition-all duration-700 flex items-center justify-center`}
      >
        <div className={`absolute w-full h-full rounded-full bg-white/10 blur-xl ${isSpeaking ? 'animate-pulse' : ''}`}></div>
        {state === 'ERROR' && <div className="text-white font-bold text-xs animate-pulse tracking-tighter">FAILURE</div>}
      </div>
      
      {/* Status Label */}
      <div className={`absolute -bottom-14 tracking-[0.3em] font-bold text-[10px] uppercase transition-colors duration-500 ${state === 'ERROR' ? 'text-red-500' : 'text-cyan-500/80'}`}>
        {state === 'IDLE' ? 'System Offline' : 
         state === 'WAITING' ? 'Authentication Required' :
         state === 'ERROR' ? 'Protocol Breach' :
         state === 'LISTENING' && !isSpeaking ? 'Listening...' : 
         isSpeaking ? 'Transmitting...' : 'Uplink Established'}
      </div>
    </div>
  );
};

export default Orb;