import React from 'react';

interface OrbProps {
  isActive: boolean;
  isSpeaking: boolean;
  state: 'IDLE' | 'LISTENING' | 'SPEAKING' | 'WAITING';
}

const Orb: React.FC<OrbProps> = ({ isActive, isSpeaking, state }) => {
  let innerColor = "bg-cyan-500";
  let outerGlow = "shadow-[0_0_60px_rgba(6,182,212,0.6)]";
  
  if (state === 'IDLE') {
    innerColor = "bg-gray-600";
    outerGlow = "shadow-none";
  } else if (state === 'WAITING') {
    innerColor = "bg-yellow-500";
    outerGlow = "shadow-[0_0_60px_rgba(234,179,8,0.6)]";
  } else if (isSpeaking) {
    innerColor = "bg-blue-400";
    outerGlow = "shadow-[0_0_100px_rgba(96,165,250,0.8)]";
  }

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Outer Rings - Rotating */}
      <div className={`absolute w-full h-full rounded-full border border-cyan-500/30 ${isActive ? 'animate-[spin_4s_linear_infinite]' : ''}`}></div>
      <div className={`absolute w-[90%] h-[90%] rounded-full border border-cyan-400/20 ${isActive ? 'animate-[spin_6s_linear_infinite_reverse]' : ''}`}></div>
      <div className={`absolute w-[110%] h-[110%] rounded-full border-2 border-dashed border-cyan-600/20 ${isActive ? 'animate-[spin_10s_linear_infinite]' : ''}`}></div>

      {/* Core Orb */}
      <div 
        className={`relative w-32 h-32 rounded-full ${innerColor} ${outerGlow} transition-all duration-500 flex items-center justify-center`}
      >
        <div className={`absolute w-full h-full rounded-full bg-white/20 blur-md ${isSpeaking ? 'animate-pulse' : ''}`}></div>
      </div>
      
      {/* Status Label */}
      <div className="absolute -bottom-12 text-cyan-400 tracking-[0.2em] font-bold text-sm">
        {state === 'IDLE' ? 'SYSTEM OFFLINE' : 
         state === 'WAITING' ? 'AWAITING PERMISSION' :
         state === 'LISTENING' && !isSpeaking ? 'LISTENING...' : 
         isSpeaking ? 'SPEAKING...' : 'ONLINE'}
      </div>
    </div>
  );
};

export default Orb;
