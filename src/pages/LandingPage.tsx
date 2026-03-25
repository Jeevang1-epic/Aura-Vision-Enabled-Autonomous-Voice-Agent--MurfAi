import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup } from '../firebase';
import { ArrowRight, Mic, Eye, Zap, Shield } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export const LandingPage: React.FC = () => {
  const a = useNavigate();
  const b = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from('.hero-title', {
        y: 100,
        opacity: 0,
        duration: 1.5,
        ease: 'power4.out',
      });

      gsap.from('.hero-sub', {
        y: 50,
        opacity: 0,
        duration: 1.2,
        delay: 0.5,
        ease: 'power3.out',
      });

      gsap.from('.feature-card', {
        scrollTrigger: {
          trigger: '.features-grid',
          start: 'top 80%',
        },
        y: 100,
        opacity: 0,
        stagger: 0.2,
        duration: 1,
        ease: 'back.out(1.7)',
      });
    }, b);

    return () => c.revert();
  }, []);

  const d = async () => {
    a('/dashboard');
  };

  return (
    <div ref={b} className="bg-[#0A0A0A] text-white min-h-screen overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 px-8 py-6 flex justify-between items-center backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-600" />
          <span className="text-xl font-bold tracking-tighter">AURA</span>
        </div>
        <button 
          onClick={d}
          className="px-6 py-2 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-colors"
        >
          Enter Workspace
        </button>
      </nav>

      <section className="relative h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <h1 className="hero-title text-7xl md:text-9xl font-bold tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
          Vision-Enabled <br /> Autonomous Voice.
        </h1>
        <p className="hero-sub text-xl md:text-2xl text-zinc-400 max-w-2xl mb-12">
          The first real-time AI agent that sees what you see, hears what you say, and acts before you ask.
        </p>
        
        <div className="flex gap-4">
          <button 
            onClick={d}
            className="group px-8 py-4 rounded-full bg-white text-black font-bold flex items-center gap-2 hover:scale-105 transition-transform"
          >
            Enter Workspace
            <ArrowRight className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      <section className="py-32 px-8 max-w-7xl mx-auto">
        <div className="features-grid grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Mic className="text-cyan-400" />}
            title="Neural Voice"
            description="Powered by Murf AI for ultra-realistic, low-latency speech synthesis."
          />
          <FeatureCard 
            icon={<Eye className="text-purple-400" />}
            title="Visual Context"
            description="Real-time screen and camera analysis to understand your workspace."
          />
          <FeatureCard 
            icon={<Zap className="text-yellow-400" />}
            title="Instant Action"
            description="WebRTC powered by LiveKit for sub-100ms response times."
          />
        </div>
      </section>

      <footer className="py-12 px-8 border-t border-white/5 text-center text-zinc-600 text-sm">
        © 2026 Aura AI. Built for the future of work.
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="feature-card p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group">
    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-2xl font-bold mb-4">{title}</h3>
    <p className="text-zinc-400 leading-relaxed">{description}</p>
  </div>
);