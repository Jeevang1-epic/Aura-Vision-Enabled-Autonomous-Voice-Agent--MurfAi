import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const texts = [
    "It looks like the primary point of friction is in the validation of that `wait` node.",
    "If you look at the error output in your right-hand panel, it's flagging a missing required property within that block.",
    "Correcting those values should clear that error flag and get the flow moving again.",
    "It's exceptional for handling dynamic, JavaScript-heavy sites that standard requests might miss."
  ];

  for (const text of texts) {
    try {
      const response = await axios.post(
        "https://api.murf.ai/v1/speech/generate",
        {
          text,
          voiceId: "en-US-marcus",
          format: "MP3",
          sampleRate: 24000,
          encode: true
        },
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.MURF_API_KEY
          },
          timeout: 20000
        }
      );
      console.log("Success:", text.substring(0, 50));
    } catch (e: any) {
      console.error("Error for:", text.substring(0, 50));
      console.error(e.response?.status, e.response?.data);
    }
  }
}

test();
