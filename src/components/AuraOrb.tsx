import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface AuraOrbProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
  audioLevel?: number;
}

export const AuraOrb: React.FC<AuraOrbProps> = ({ isListening, isSpeaking, isThinking, audioLevel = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.02;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 80;
      const pulse = Math.sin(time * 2) * 5;
      const thinkingPulse = isThinking ? Math.sin(time * 8) * 15 : 0;
      const reactiveRadius = baseRadius + pulse + thinkingPulse + (audioLevel * 50);

      // Outer Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, reactiveRadius * 2);
      const color = isSpeaking ? 'rgba(168, 85, 247, 0.4)' : 
                    isThinking ? 'rgba(245, 158, 11, 0.4)' :
                    isListening ? 'rgba(34, 211, 238, 0.4)' : 
                    'rgba(255, 255, 255, 0.1)';
      
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, reactiveRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(centerX, centerY, reactiveRadius, 0, Math.PI * 2);
      ctx.strokeStyle = isSpeaking ? '#A855F7' : 
                        isThinking ? '#F59E0B' :
                        isListening ? '#22D3EE' : 
                        '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner particles/waves
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const r = reactiveRadius * (0.5 + Math.sin(time + i) * 0.2);
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        const innerColor = isSpeaking ? `rgba(168, 85, 247, ${0.3 - i * 0.1})` : 
                           isThinking ? `rgba(245, 158, 11, ${0.3 - i * 0.1})` :
                           `rgba(34, 211, 238, ${0.3 - i * 0.1})`;
        ctx.strokeStyle = innerColor;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isListening, isSpeaking, isThinking, audioLevel]);

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="max-w-full max-h-full"
      />
      <motion.div
        animate={{
          scale: isListening || isSpeaking || isThinking ? [1, 1.1, 1] : 1,
          opacity: isListening || isSpeaking || isThinking ? 1 : 0.5,
          borderColor: isSpeaking ? '#A855F7' : isThinking ? '#F59E0B' : isListening ? '#22D3EE' : '#FFFFFF'
        }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute w-32 h-32 rounded-full bg-white/5 backdrop-blur-3xl border border-white/20"
      />
    </div>
  );
};
