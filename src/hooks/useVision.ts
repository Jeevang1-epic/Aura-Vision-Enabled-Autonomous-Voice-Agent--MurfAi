import { useState, useCallback, useRef } from 'react';

export const useVision = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false
      });
      streamRef.current = stream;
      setIsCapturing(true);

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      intervalRef.current = setInterval(() => {
        if (ctx && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          // Scale down for thumbnail but keep enough resolution for reading code
          const targetWidth = 1280;
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = targetWidth;
          thumbCanvas.height = (video.videoHeight / video.videoWidth) * targetWidth;
          const thumbCtx = thumbCanvas.getContext('2d');
          thumbCtx?.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
          
          const frame = thumbCanvas.toDataURL('image/jpeg', 0.8);
          setLastFrame(frame);
          
          // Here you would typically send the frame to your vision model
          console.log('Vision frame captured');
        }
      }, 5000); // Every 5 seconds

      stream.getVideoTracks()[0].onended = () => stopCapture();

    } catch (error) {
      console.error('Failed to start vision capture:', error);
      setIsCapturing(false);
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCapturing(false);
    setLastFrame(null);
  }, []);

  return { isCapturing, lastFrame, startCapture, stopCapture };
};
