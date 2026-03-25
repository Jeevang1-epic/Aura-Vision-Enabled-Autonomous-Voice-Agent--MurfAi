import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, LogOut, Mic, Eye, Plus, MessageSquare, Trash2, Volume2 } from 'lucide-react';
import { auth } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  currentSessionId: string | null;
  setCurrentSessionId: (id: string) => void;
  onNewChat: () => void;
  sessions: {id: string, createdAt: any}[];
  voiceId: string;
  setVoiceId: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentSessionId, setCurrentSessionId, onNewChat, sessions, voiceId, setVoiceId }) => {
  return (
    <aside className="w-64 h-screen bg-[#0A0A0A] border-r border-white/5 flex flex-col p-4">
      <div className="flex items-center gap-3 mb-8 px-2 mt-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center">
          <span className="text-white font-bold text-xl">A</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">Aura</h1>
      </div>

      <button
        onClick={onNewChat}
        className="flex items-center gap-3 px-4 py-3 mb-6 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/10"
      >
        <Plus size={20} />
        <span className="font-medium">New chat</span>
      </button>

      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide pr-2">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Your chat
          </span>
        </div>
        
        {sessions.slice(0, 1).map((session) => {
          const date = session.createdAt?.toDate ? session.createdAt.toDate() : new Date();
          const dateString = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const timeString = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          
          return (
            <div key={session.id} className="relative group">
              <button
                onClick={() => setCurrentSessionId(session.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-left",
                  currentSessionId === session.id 
                    ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                <MessageSquare size={16} className={currentSessionId === session.id ? "text-cyan-400" : ""} />
                <div className="flex flex-col overflow-hidden flex-1">
                  <span className="font-medium text-sm truncate">
                    Main Chat
                  </span>
                  <span className="text-[10px] text-zinc-500 truncate">
                    {dateString} at {timeString}
                  </span>
                </div>
              </button>
            </div>
          );
        })}

        <div className="mt-8 px-3">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 block">
            Voice Settings
          </span>
          <div className="space-y-1">
            {[
              { id: "en-US-marcus", label: "Marcus (Professor)" },
              { id: "en-US-terrell", label: "Terrell (Male)" },
              { id: "en-US-natalie", label: "Natalie (Girl)" },
              { id: "en-US-cooper", label: "Cooper (Boy)" }
            ].map(voice => (
              <button
                key={voice.id}
                onClick={() => setVoiceId(voice.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left",
                  voiceId === voice.id 
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                )}
              >
                <Volume2 size={14} className={voiceId === voice.id ? "text-cyan-400" : "text-zinc-500"} />
                <span className="font-medium text-sm">{voice.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => cn(
            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
            isActive ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white hover:bg-white/5"
          )}
        >
          <LayoutDashboard size={20} />
          <span className="font-medium">Workspace</span>
        </NavLink>
        
        <div className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 mt-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Ready
          </div>
          <div className="flex gap-4 text-zinc-400">
            <Mic size={14} />
            <Eye size={14} />
          </div>
        </div>
        
        <button
          onClick={() => auth.signOut()}
          className="flex items-center gap-3 px-3 py-3 w-full text-zinc-500 hover:text-red-400 transition-colors rounded-xl hover:bg-white/5"
        >
          <LogOut size={20} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
