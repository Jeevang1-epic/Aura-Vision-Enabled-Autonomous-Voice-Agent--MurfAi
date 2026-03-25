import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { AccessToken } from "livekit-server-sdk";
import axios from "axios";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      config: {
        livekit: !!process.env.LIVEKIT_API_KEY,
        murf: !!process.env.MURF_API_KEY,
        gemini: !!process.env.GEMINI_API_KEY
      }
    });
  });

  // LiveKit Token Generation
  app.post("/api/livekit/token", async (req, res) => {
    try {
      const { roomName, participantName } = req.body;
      
      if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
        return res.status(500).json({ error: "LiveKit credentials missing" });
      }

      const at = new AccessToken(
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
        { identity: participantName }
      );
      at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

      const token = await at.toJwt();
      res.json({ 
        token, 
        url: process.env.LIVEKIT_URL || "wss://your-project.livekit.cloud" 
      });
    } catch (error) {
      console.error("LiveKit token error:", error);
      res.status(500).json({ error: "Failed to generate token" });
    }
  });

  // Murf AI Proxy
  app.post("/api/tts", async (req, res) => {
    const { text, voiceId = "en-US-marcus" } = req.body;
    console.log(`[Murf TTS] Request received. Text length: ${text?.length || 0}`);
    
    try {
      if (!process.env.MURF_API_KEY) {
        console.error("[Murf TTS] CRITICAL: MURF_API_KEY is missing!");
        return res.status(500).json({ error: "Murf API key missing from server environment" });
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: "Text is required for TTS" });
      }

      console.log(`[Murf TTS] Calling Murf API for text: "${text}"`);
      
      const response = await axios.post(
        "https://api.murf.ai/v1/speech/generate",
        {
          text,
          voiceId,
          format: "MP3",
          sampleRate: 24000,
          encode: true
        },
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.MURF_API_KEY
          },
          timeout: 20000 // Increased to 20 seconds
        }
      );

      if (response.status !== 200) {
        console.error("[Murf TTS] Murf API returned non-200 status:", response.status, response.data);
        return res.status(response.status).json({ 
          error: `Murf API error: ${response.status}`, 
          details: response.data 
        });
      }

      console.log("[Murf TTS] API Success. Status:", response.status);
      
      if (response.data.encodedAudio) {
        console.log("[Murf TTS] Received base64 audio. Length:", response.data.encodedAudio.length);
      } else if (response.data.audioFile) {
        console.log("[Murf TTS] Received audio URL:", response.data.audioFile);
      } else if (response.data.audioUrl) {
        console.log("[Murf TTS] Received audio URL:", response.data.audioUrl);
      } else {
        console.warn("[Murf TTS] No audio data in response:", response.data);
      }

      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data || error.message;
      
      console.error(`[Murf TTS] API FAILURE (Status ${status}):`, errorData);
      
      let userFriendlyError = "Failed to generate speech";
      if (status === 401) userFriendlyError = "Murf API: Unauthorized. Check your API key.";
      if (status === 403) userFriendlyError = "Murf API: Forbidden. Check your plan limits.";
      if (error.code === 'ECONNABORTED') userFriendlyError = "Murf API: Request timed out.";

      res.status(status).json({ 
        error: userFriendlyError, 
        details: errorData 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Aura Server running on http://localhost:${PORT}`);
  });
}

startServer();
