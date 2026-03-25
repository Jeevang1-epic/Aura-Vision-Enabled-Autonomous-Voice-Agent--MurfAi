import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../components/Sidebar';
import { AuraOrb } from '../components/AuraOrb';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Camera, Activity, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, limit, updateDoc, doc as firestoreDoc, where, deleteDoc } from 'firebase/firestore';
import { LogEntry } from '../types';
import { useVision } from '../hooks/useVision';
import { GoogleGenAI } from '@google/genai';
import * as LiveKit from 'livekit-client';
import { RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (a: unknown, b: OperationType, c: string | null) => {
  const d: FirestoreErrorInfo = {
    error: a instanceof Error ? a.message : String(a),
    authInfo: {
      userId: 'demo-user',
      email: 'demo@example.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType: b,
    path: c
  };
  console.error('Firestore Error: ', JSON.stringify(d));
  return new Error(JSON.stringify(d));
};

export const Dashboard: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(isListening);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const isThinkingRef = useRef(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const [sessions, setSessions] = useState<{id: string, createdAt: any}[]>([]);
  const [isSessionsLoaded, setIsSessionsLoaded] = useState(false);
  const isCreatingChatRef = useRef(false);
  const [room, setRoom] = useState<LiveKit.Room | null>(null);
  const [voiceId, setVoiceId] = useState("en-US-marcus");
  const voiceIdRef = useRef(voiceId);
  const logEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const recognitionStateRef = useRef<'idle' | 'starting' | 'active'>('idle');
  const handleUserSpeechRef = useRef<any>(null);
  const audioUrlsQueueRef = useRef<string[]>([]);
  const ttsQueueRef = useRef<Promise<any>>(Promise.resolve());
  const isAudioPlayingRef = useRef(false);
  const lastAudioEndTimeRef = useRef<number>(0);
  const lastAuraResponseRef = useRef<string>("");
  const isInterruptedRef = useRef(false);
  const currentGenerationIdRef = useRef<number>(0);
  const visualizerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { isCapturing, lastFrame, startCapture, stopCapture } = useVision();
  const firstInteraction = useRef(true);

  const stopAuraSpeaking = () => {
    isInterruptedRef.current = true;
    currentGenerationIdRef.current += 1;
    audioUrlsQueueRef.current = [];
    
    if (isAudioPlayingRef.current) {
      lastAudioEndTimeRef.current = Date.now();
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (visualizerIntervalRef.current) {
      clearInterval(visualizerIntervalRef.current);
      visualizerIntervalRef.current = null;
    }
    isAudioPlayingRef.current = false;
    setIsSpeaking(false);
    setIsThinking(false);
    setAudioLevel(0);
  };

  const systemInstruction = `You are Aura, a vision-enabled autonomous voice agent. 
    You are professional, highly intelligent, and slightly futuristic. 
    You can see the user's screen or camera feed. 
    Your responses should be concise, conversational, and context-aware. 
    NEVER use a fixed script. Vary your greetings and acknowledgments. 
    If this is the start of a session, be welcoming but unique. 
    If you see visual context, comment on it naturally. 
    If you see "NO SIGNAL", mention you are ready once they share their screen.
    Avoid sounding like a bot. Use natural language patterns.
    Ensure your tone is helpful but maintains a sense of advanced artificial intelligence.
    IMPORTANT: If the user asks for a diagram (e.g., "explain to me the diagram structure" or "ask for a diagram"), you must respond exactly with: "Do you want any diagram?".
    If the user confirms they want a diagram (e.g., "yes", "please", "sure"), you must respond with exactly: "[GENERATE_DIAGRAM] <a detailed prompt for the image generator to create the diagram>". Do not include any other text in this response.`;

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    voiceIdRef.current = voiceId;
  }, [voiceId]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  const handleNewChat = async () => {
    if (isCreatingChatRef.current) return;
    isCreatingChatRef.current = true;
    if (isSpeaking || isThinking) stopAuraSpeaking();
    try {
      const a = await addDoc(collection(db, 'sessions'), {
        userId: 'demo-user',
        createdAt: serverTimestamp(),
        status: 'active'
      });
      setCurrentSessionId(a.id);
      firstInteraction.current = true;
      
      const b = "Aura initialized. Systems online and standing by.";
      await addDoc(collection(db, `sessions/${a.id}/logs`), {
        sessionId: a.id,
        timestamp: serverTimestamp(),
        type: 'system',
        content: b
      });
    } catch (c) {
      handleFirestoreError(c, OperationType.WRITE, 'sessions');
    } finally {
      isCreatingChatRef.current = false;
    }
  };

  useEffect(() => {
    const a = query(
      collection(db, 'sessions'),
      where('userId', '==', 'demo-user'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const b = onSnapshot(a, (c) => {
      const d = c.docs.map(e => ({
        id: e.id,
        createdAt: e.data().createdAt
      }));
      setSessions(d);
      setIsSessionsLoaded(true);
    });

    return () => b();
  }, []);

  useEffect(() => {
    if (!isSessionsLoaded) return;
    
    const a = currentSessionId ? sessions.some(b => b.id === currentSessionId) : false;
    
    if (currentSessionId && !a) {
      if (sessions.length > 0) {
        setCurrentSessionId(sessions[0].id);
      } else {
        setCurrentSessionId(null);
      }
    } else if (!currentSessionId) {
      if (sessions.length > 0) {
        setCurrentSessionId(sessions[0].id);
      } else if (!isCreatingChatRef.current) {
        handleNewChat();
      }
    }
  }, [isSessionsLoaded, currentSessionId, sessions]);

  useEffect(() => {
    const a = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (a) {
      recognitionRef.current = new a();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true; 
      recognitionRef.current.maxAlternatives = 1;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onstart = () => {
        recognitionStateRef.current = 'active';
        setIsListening(true);
        if (currentSessionIdRef.current) {
          addDoc(collection(db, `sessions/${currentSessionIdRef.current}/logs`), {
            sessionId: currentSessionIdRef.current,
            timestamp: serverTimestamp(),
            type: 'system',
            content: 'Aura is now listening. Systems online.'
          }).catch(b => handleFirestoreError(b, OperationType.WRITE, `sessions/${currentSessionIdRef.current}/logs`));
        }
      };

      recognitionRef.current.onaudiostart = () => {};
      recognitionRef.current.onsoundstart = () => {};
      recognitionRef.current.onspeechstart = () => {};
      
      recognitionRef.current.onresult = (b: any) => {
        let c = '';
        let d = '';

        for (let e = b.resultIndex; e < b.results.length; ++e) {
          if (b.results[e].isFinal) {
            d += b.results[e][0].transcript;
          } else {
            c += b.results[e][0].transcript;
          }
        }

        const f = d || c;
        if (!f.trim()) return;

        const g = (h: string) => h.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        const i = g(f);
        const j = g(lastAuraResponseRef.current);
        
        const k = i.split(/\s+/).filter(l => l.length > 0);
        const m = j.split(/\s+/).filter(n => n.length > 0);
        
        let o = 0;
        for (let p = 0; p < k.length; p++) {
          for (let q = 0; q < m.length; q++) {
            let r = 0;
            while (p + r < k.length && q + r < m.length && k[p + r] === m[q + r]) {
              r++;
            }
            if (r > o) {
              o = r;
            }
          }
        }
        
        const s = k.length > 0 ? o / k.length : 0;
        
        let t = false;
        if (k.length >= 4) {
          t = o >= 3 || s > 0.5;
        } else if (k.length > 0) {
          t = o === k.length && isAudioPlayingRef.current;
        }
        
        if ((isAudioPlayingRef.current || Date.now() - lastAudioEndTimeRef.current < 2000) && t) {
          return;
        }

        if (isAudioPlayingRef.current || isThinkingRef.current) {
          stopAuraSpeaking();
        }

        if (d && handleUserSpeechRef.current) {
          handleUserSpeechRef.current(d);
        }
      };

      recognitionRef.current.onerror = (b: any) => {
        if (b.error === 'no-speech') {
          return;
        }

        recognitionStateRef.current = 'idle';
        
        if (b.error === 'audio-capture') {
          return;
        }

        setIsListening(false);
        if (b.error === 'not-allowed' && currentSessionIdRef.current) {
          addDoc(collection(db, `sessions/${currentSessionIdRef.current}/logs`), {
            sessionId: currentSessionIdRef.current,
            timestamp: serverTimestamp(),
            type: 'system',
            content: 'Microphone access denied. Please check browser permissions.'
          });
        }
      };

      recognitionRef.current.onend = () => {
        recognitionStateRef.current = 'idle';
        
        if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current && recognitionStateRef.current === 'idle') {
              try {
                recognitionStateRef.current = 'starting';
                recognitionRef.current.start();
              } catch (b) {
                recognitionStateRef.current = 'idle';
              }
            }
          }, 300); 
        }
      };
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (room) room.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;

    const a = query(
      collection(db, `sessions/${currentSessionId}/logs`),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const b = onSnapshot(a, (c) => {
      const d = c.docs.map(e => ({
        id: e.id,
        ...e.data()
      })) as LogEntry[];
      setLogs(d);
    }, (c) => {
      handleFirestoreError(c, OperationType.LIST, `sessions/${currentSessionId}/logs`);
    });

    return () => b();
  }, [currentSessionId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
  }, []);

  const playNextAudio = async () => {
    if (isAudioPlayingRef.current || audioUrlsQueueRef.current.length === 0) {
      return;
    }
    
    isAudioPlayingRef.current = true;
    const a = audioUrlsQueueRef.current.shift()!;
    
    if (audioRef.current) {
      audioRef.current.src = a;
      audioRef.current.playbackRate = 0.85; 
      try {
        await audioRef.current.play();
        setIsSpeaking(true);
        
        if (visualizerIntervalRef.current) {
          clearInterval(visualizerIntervalRef.current);
        }
        visualizerIntervalRef.current = setInterval(() => {
          setAudioLevel(Math.random() * 0.5 + 0.2);
        }, 100);

        audioRef.current.onended = () => {
          if (visualizerIntervalRef.current) {
            clearInterval(visualizerIntervalRef.current);
            visualizerIntervalRef.current = null;
          }
          setAudioLevel(0);
          
          isAudioPlayingRef.current = false;
          lastAudioEndTimeRef.current = Date.now();
          if (audioUrlsQueueRef.current.length === 0) {
            setIsSpeaking(false);
          }
          playNextAudio();
        };

        audioRef.current.onerror = (b) => {
          if (visualizerIntervalRef.current) {
            clearInterval(visualizerIntervalRef.current);
            visualizerIntervalRef.current = null;
          }
          setAudioLevel(0);
          isAudioPlayingRef.current = false;
          lastAudioEndTimeRef.current = Date.now();
          if (audioUrlsQueueRef.current.length === 0) {
            setIsSpeaking(false);
          }
          playNextAudio();
        };
      } catch (b: any) {
        if (b.name === 'AbortError') {
          return; 
        }
        isAudioPlayingRef.current = false;
        lastAudioEndTimeRef.current = Date.now();
        setIsSpeaking(false);
      }
    } else {
      isAudioPlayingRef.current = false;
      lastAudioEndTimeRef.current = Date.now();
      playNextAudio();
    }
  };

  const base64ToBlobUrl = (a: string, b = 'audio/mp3') => {
    const c = a.replace(/^data:audio\/\w+;base64,/, '');
    const d = window.atob(c);
    const e = [];
    for (let f = 0; f < d.length; f += 512) {
      const g = d.slice(f, f + 512);
      const h = new Array(g.length);
      for (let i = 0; i < g.length; i++) {
        h[i] = g.charCodeAt(i);
      }
      const j = new Uint8Array(h);
      e.push(j);
    }
    const k = new Blob(e, { type: b });
    return URL.createObjectURL(k);
  };

  const processSentence = async (a: string, b: number): Promise<string | null> => {
    if (!a.trim()) return null;
    
    let c = a.replace(/[*_`~#]/g, '').trim();
    if (!c) return null;
    
    if (c.length > 900) {
      c = c.substring(0, 900);
    }
    
    const d = await (ttsQueueRef.current = ttsQueueRef.current.then(async () => {
      if (isInterruptedRef.current || currentGenerationIdRef.current !== b) {
        return null;
      }
      
      let e = 0;
      const f = 2;
      
      while (e <= f) {
        try {
          const g = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: c, voiceId: voiceIdRef.current })
          });
          
          const h = g.headers.get("content-type");
          if (!h || !h.includes("application/json")) {
            const i = await g.text();
            throw new Error(`Server returned non-JSON response: ${i.substring(0, 100)}...`);
          }

          const j = await g.json();

          if (isInterruptedRef.current || currentGenerationIdRef.current !== b) {
            return null;
          }

          if (g.ok) {
            const k = j.audioUrl || j.audioFile;
            if (j.encodedAudio) {
              const l = base64ToBlobUrl(j.encodedAudio);
              audioUrlsQueueRef.current.push(l);
              playNextAudio();
              return j.encodedAudio;
            } else if (k) {
              audioUrlsQueueRef.current.push(k);
              playNextAudio();
              return k;
            } else {
              throw new Error("No audio data returned from TTS API");
            }
          } else {
            if (g.status === 429 && e < f) {
              await new Promise(m => setTimeout(m, 2000));
              e++;
              continue;
            }

            const k = `SYSTEM ERROR: Murf API failed to generate audio (${g.status}: ${j.error || g.statusText})`;
            if (currentSessionIdRef.current) {
              addDoc(collection(db, `sessions/${currentSessionIdRef.current}/logs`), {
                sessionId: currentSessionIdRef.current,
                timestamp: serverTimestamp(),
                type: 'system',
                content: k
              });
            }
            break; 
          }
        } catch (g: any) {
          if (e >= f) {
            if (currentSessionIdRef.current) {
              addDoc(collection(db, `sessions/${currentSessionIdRef.current}/logs`), {
                sessionId: currentSessionIdRef.current,
                timestamp: serverTimestamp(),
                type: 'system',
                content: `SYSTEM ERROR: Aura processing error: ${g.message || 'Network failure'}`
              });
            }
          } else {
            e++;
            await new Promise(h => setTimeout(h, 1000));
            continue;
          }
        }
        break;
      }
      return null;
    }).catch(e => {
      return null;
    }));
    
    return d;
  };

  const handleUserSpeech = async (a: string) => {
    if (!currentSessionId || !a.trim()) return;

    stopAuraSpeaking();

    const b = currentGenerationIdRef.current;

    await addDoc(collection(db, `sessions/${currentSessionId}/logs`), {
      sessionId: currentSessionId,
      timestamp: serverTimestamp(),
      type: 'voice',
      role: 'user',
      content: a
    }).catch(c => handleFirestoreError(c, OperationType.WRITE, `sessions/${currentSessionId}/logs`));

    if (currentGenerationIdRef.current !== b) {
      return;
    }

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing. Please configure it in the Secrets panel.");
      }

      setIsThinking(true);
      
      const c = logs
        .filter(d => d.type === 'voice' && d.content !== '...')
        .slice(-10) 
        .map(d => `${d.role === 'assistant' ? 'Aura' : 'User'}: ${d.content}`)
        .join('\n');
      
      const d: any[] = [{ text: c ? `Previous conversation:\n${c}\n\nUser: ${a}` : a }];
      if (firstInteraction.current && !c) {
        d[0].text = `[INITIAL INTERACTION] ${a}`;
        firstInteraction.current = false;
      }
      
      if (lastFrame) {
        d.push({
          inlineData: {
            data: lastFrame.split(',')[1],
            mimeType: "image/jpeg"
          }
        });
      }

      const e = currentGenerationIdRef.current;
      isInterruptedRef.current = false;

      const f = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: { parts: d },
        config: {
          systemInstruction: systemInstruction
        }
      });

      setIsThinking(false);
      let g = "";
      let h = "";
      let i: string[] = [];
      let j = false;
      
      const k = await addDoc(collection(db, `sessions/${currentSessionId}/logs`), {
        sessionId: currentSessionId,
        timestamp: serverTimestamp(),
        type: 'voice',
        role: 'assistant',
        content: '...'
      }).catch(l => {
        throw handleFirestoreError(l, OperationType.WRITE, `sessions/${currentSessionId}/logs`);
      });

      for await (const l of f) {
        if (isInterruptedRef.current || currentGenerationIdRef.current !== e) {
          break;
        }

        const m = l.text || "";
        g += m;
        
        if (g.includes('[GENERATE_DIAGRAM]')) {
          j = true;
        }

        if (!j) {
          lastAuraResponseRef.current = g;
          h += m;
          
          if (g.length % 20 === 0 || m.includes('.') || m.includes('?') || m.includes('!')) {
            updateDoc(firestoreDoc(db, `sessions/${currentSessionId}/logs`, k.id), {
              content: g
            }).catch(console.error);
          }
          
          const n = h.split(/(?<=[.!?,\n])\s+/);
          
          if (n.length > 1) {
            for (let o = 0; o < n.length - 1; o++) {
              const p = n[o].trim();
              if (p) {
                processSentence(p, e).then(q => {
                  if (q) {
                    i.push(q);
                    updateDoc(firestoreDoc(db, `sessions/${currentSessionId}/logs`, k.id), {
                      metadata: { audioChunks: i }
                    }).catch(console.error);
                  }
                });
              }
            }
            h = n[n.length - 1];
          }
        }
      }
      
      if (j) {
        const l = g.replace('[GENERATE_DIAGRAM]', '').trim() || "A detailed technical diagram";
        
        await updateDoc(firestoreDoc(db, `sessions/${currentSessionId}/logs`, k.id), {
          content: "Generating diagram..."
        });

        try {
          const m = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: l
          });
          
          let n = "";
          for (const o of m.candidates?.[0]?.content?.parts || []) {
            if (o.inlineData) {
              n = `data:${o.inlineData.mimeType};base64,${o.inlineData.data}`;
              break;
            }
          }

          if (n) {
            await updateDoc(firestoreDoc(db, `sessions/${currentSessionId}/logs`, k.id), {
              content: "Here is the diagram you requested:",
              imageUrl: n
            });
            
            processSentence("Here is the diagram you requested.", e).then(o => {
              if (o) {
                i.push(o);
                updateDoc(firestoreDoc(db, `sessions/${currentSessionId}/logs`, k.id), {
                  metadata: { audioChunks: i }
                }).catch(console.error);
              }
            });
          } else {
            await updateDoc(firestoreDoc(db, `sessions/${currentSessionId}/logs`, k.id), {
              content: "I'm sorry, I couldn't generate the diagram."
            });
            processSentence("I'm sorry, I couldn't generate the diagram.", e);
          }
        } catch (m) {
          await updateDoc(firestoreDoc(db, `sessions/${currentSessionId}/logs`, k.id), {
            content: "I encountered an error while generating the diagram."
          });
          processSentence("I encountered an error while generating the diagram.", e);
        }
      } else {
        if (h.trim() && !isInterruptedRef.current && currentGenerationIdRef.current === e) {
          processSentence(h.trim(), e).then(l => {
            if (l) {
              i.push(l);
              updateDoc(firestoreDoc(db, `sessions/${currentSessionId}/logs`, k.id), {
                metadata: { audioChunks: i }
              }).catch(console.error);
            }
          });
        }

        if (!isInterruptedRef.current && currentGenerationIdRef.current === e) {
          await updateDoc(firestoreDoc(db, `sessions/${currentSessionId}/logs`, k.id), {
            content: g
          }).catch(l => {
            throw handleFirestoreError(l, OperationType.UPDATE, `sessions/${currentSessionId}/logs/${k.id}`);
          });
        }
      }

    } catch (b: any) {
      setIsThinking(false);
      setIsSpeaking(false);
      if (currentSessionId) {
        addDoc(collection(db, `sessions/${currentSessionId}/logs`), {
          sessionId: currentSessionId,
          timestamp: serverTimestamp(),
          type: 'system',
          content: `Aura processing error: ${b.message || 'Failed to fetch'}`
        });
      }
    }
  };

  useEffect(() => {
    handleUserSpeechRef.current = handleUserSpeech;
    isListeningRef.current = isListening;
  }, [handleUserSpeech, isListening]);

  const toggleAura = async () => {
    if (isListening) {
      if (isThinking || isSpeaking) {
        stopAuraSpeaking();
      }
      try {
        recognitionRef.current?.stop();
      } catch (a) {
      }
      setIsListening(false);
    } else {
      if (!currentSessionId) return;

      if (isThinking || isSpeaking) {
        stopAuraSpeaking();
      }
      
      lastAudioEndTimeRef.current = 0;

      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1.0;
        if (!audioRef.current.src) {
          audioRef.current.src = "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
        }
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
        }).catch((a) => {
        });
      }

      try {
        const a = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: 'aura-room', participantName: 'Demo User' })
        });
        
        if (!a.ok) {
          const b = await a.json().catch(() => ({}));
          throw new Error(`LiveKit Token Error: ${b.error || a.statusText}`);
        }

        const { token: b, url: c } = await a.json();

        const d = new LiveKit.Room();
        await d.connect(c, b);
        setRoom(d);

        try {
          if (recognitionStateRef.current === 'idle') {
            recognitionStateRef.current = 'starting';
            recognitionRef.current?.start();
          }
        } catch (e) {
          recognitionStateRef.current = 'idle';
        }
        setIsListening(true);
      } catch (a: any) {
        if (currentSessionId) {
          addDoc(collection(db, `sessions/${currentSessionId}/logs`), {
            sessionId: currentSessionId,
            timestamp: serverTimestamp(),
            type: 'system',
            content: `Connection error: ${a.message}`
          });
        }
      }
    }
  };

  const toggleVision = () => {
    if (isCapturing) {
      stopCapture();
      addDoc(collection(db, `sessions/${currentSessionId}/logs`), {
        sessionId: currentSessionId,
        timestamp: serverTimestamp(),
        type: 'system',
        content: 'Vision feed disconnected.'
      });
    } else {
      startCapture();
      addDoc(collection(db, `sessions/${currentSessionId}/logs`), {
        sessionId: currentSessionId,
        timestamp: serverTimestamp(),
        type: 'system',
        content: 'Vision feed initialized. Capturing screen context...'
      });
    }
  };

  const playAudioChunks = async (a: string[]) => {
    if (!a || a.length === 0) return;
    
    audioUrlsQueueRef.current = [];
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    isAudioPlayingRef.current = false;
    
    a.forEach(b => {
      const c = b.startsWith('http') ? b : base64ToBlobUrl(b);
      audioUrlsQueueRef.current.push(c);
    });

    playNextAudio();
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      <Sidebar 
        currentSessionId={currentSessionId} 
        setCurrentSessionId={setCurrentSessionId} 
        onNewChat={handleNewChat} 
        sessions={sessions}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
      />
      <audio ref={audioRef} className="fixed bottom-0 left-0 w-0 h-0 opacity-0 pointer-events-none" />
      {room && <RoomAudioRenderer room={room} />}

      <main className="flex-1 flex flex-col relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[100px]" />
        </div>

        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
              <Activity size={12} />
              Live Session
            </div>

            <span className="text-zinc-500 text-sm">ID: {currentSessionId?.slice(-8)}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Volume2 size={14} className={isSpeaking ? "text-cyan-400 animate-pulse" : "text-zinc-500"} />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">
                    {isSpeaking ? "Output Active" : "Standby"}
                  </span>
                </div>
                <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-cyan-500"
                    animate={{ width: `${audioLevel * 100}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                </div>
              </div>
            </div>
            <button 
              onClick={toggleVision}
              className={`p-2 rounded-lg transition-colors ${isCapturing ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/5 text-zinc-400'}`}
            >
              {isCapturing ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          </div>
        </header>

        <div className="flex-1 flex p-8 gap-8 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center relative rounded-3xl bg-white/[0.02] border border-white/5 overflow-hidden">
            <div className="absolute top-8 left-8 flex items-center gap-2 text-zinc-500">
              <motion.div 
                animate={{ opacity: isListening ? [0.4, 1, 0.4] : 0.4 }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-2 h-2 rounded-full bg-cyan-400" 
              />
              <span className="text-xs font-mono uppercase tracking-widest">Aura Core</span>
            </div>

            <AuraOrb 
              isListening={isListening} 
              isSpeaking={isSpeaking} 
              isThinking={isThinking}
              audioLevel={audioLevel} 
            />

            <div className="absolute bottom-12 flex flex-col items-center gap-6">
              <p className="text-zinc-400 text-sm font-medium h-6">
                {isThinking ? (
                  <motion.span 
                    animate={{ opacity: [0.4, 1, 0.4] }} 
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    Aura is thinking...
                  </motion.span>
                ) : isListening ? (
                  "Listening to your request..."
                ) : isSpeaking ? (
                  "Aura is responding..."
                ) : (
                  "Click to wake Aura"
                )}
              </p>
              <button
                onClick={toggleAura}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isListening 
                    ? "bg-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.4)] scale-110" 
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                <Mic size={24} className={isListening ? "text-black" : "text-white"} />
              </button>
            </div>
          </div>

          <div className="w-96 flex flex-col gap-6">
            <div className="flex-1 rounded-3xl bg-white/[0.02] border border-white/5 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <Terminal size={16} className="text-zinc-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Interaction Logs</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                <AnimatePresence initial={false}>
                  {logs.map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-xl text-sm ${
                        a.type === 'system' ? 'bg-white/5 text-zinc-400 border border-white/5' :
                        a.type === 'voice' ? 'bg-cyan-500/10 text-cyan-100 border border-cyan-500/20' :
                        'bg-purple-500/10 text-purple-100 border border-purple-500/20'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase opacity-50">{a.type}</span>
                          {a.metadata?.audioChunks && a.metadata.audioChunks.length > 0 && (
                            <button 
                              onClick={() => playAudioChunks(a.metadata!.audioChunks)}
                              className="p-1 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 transition-colors"
                              title="Play Audio Manually"
                            >
                              <Volume2 size={10} />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] opacity-30">
                          {a.timestamp ? (
                            (a.timestamp as any).toDate ? 
                            (a.timestamp as any).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                            new Date(a.timestamp as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          ) : ''}
                        </span>
                      </div>
                      <p className="leading-relaxed">{a.content}</p>
                      {a.imageUrl && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-white/10">
                          <img src={a.imageUrl} alt="Generated Diagram" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={logEndRef} />
              </div>
            </div>

            <div className="h-48 rounded-3xl bg-white/[0.02] border border-white/5 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Camera size={16} className="text-zinc-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Vision Feed</span>
                </div>
                {isCapturing && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-500 font-bold animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    CAPTURING
                  </div>
                )}
                {!isCapturing && (
                  <div className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-zinc-500">OFFLINE</div>
                )}
              </div>
              <div className="flex-1 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center relative overflow-hidden group">
                {lastFrame ? (
                  <img src={lastFrame} alt="Vision Feed" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <span className="text-[10px] text-zinc-600 font-mono">NO SIGNAL</span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};