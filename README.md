# Aura: Vision-Enabled Autonomous Voice Agent 

**Aura** is a sub-second, vision-enabled autonomous voice assistant built specifically for desktop power users. Unlike standard consumer AIs locked to mobile devices, Aura lives natively alongside your professional workflows, capturing high-resolution screen context to see what you see, hear what you say, and act before you ask.

**[Watch the Aura Demo Video Here](https://youtu.be/1bLyYdwCWiw)**

##  Key Features
* **Zero-Latency Voice:** Optimized with sentence-chunking for instant audio playback.
* **Context-Aware Vision:** Reads your active screen to understand code, UI elements, and complex errors.
* **Autonomous Diagramming:** Intercepts voice requests to dynamically generate workflow diagrams directly in the chat UI.
* **Acoustic Echo Cancellation (AEC):** Advanced text-matching allows you to interrupt the AI mid-sentence without triggering infinite audio loops.

## API Usage & Architecture
Aura leverages a powerful stack of integrated APIs to achieve real-time multimodal interaction:
* **Murf AI (Voice):** Powers the broadcast-quality, ultra-realistic Text-to-Speech (TTS) engine for Aura's voice.
* **LiveKit (WebRTC):** Handles the sub-100ms bidirectional audio streaming and microphone Voice Activity Detection (VAD).
* **Gemini 3 Flash (Brain & Vision):** The core LLM responsible for analyzing screen captures and generating rapid conversational responses.
* **Gemini Flash Image / Nano Banana 2 (Generation):** Autonomously generates technical diagrams when requested by the user.
* **Firebase (Backend):** Manages real-time session logs and database storage.

## Setup Instructions
To run Aura locally, you must securely manage your API keys using environment variables. 

1. **Clone the repository:**
   
   git clone [https://github.com/YOUR_GITHUB_NAME/Aura-Vision-Enabled-Autonomous-Voice-Agent.git](https://github.com/YOUR_GITHUB_NAME/Aura-Vision-Enabled-Autonomous-Voice-Agent.git)
   cd Aura-Vision-Enabled-Autonomous-Voice-Agent


2. **Install dependencies:**


   npm install

3. **Secure API Key Management (Environment Variables):**

Create a .env.local file in the root directory. Do not commit this file. Add your keys:

Code snippet
GEMINI_API_KEY="your_gemini_api_key"
LIVEKIT_URL="your_livekit_url"
LIVEKIT_API_KEY="your_livekit_key"
LIVEKIT_API_SECRET="your_livekit_secret"
MURF_API_KEY="your_murf_key"

4. **Run the development server:**
       npm run dev
