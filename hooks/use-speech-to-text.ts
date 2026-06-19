import { useState, useCallback, useRef, useEffect } from "react";

interface UseSpeechToTextReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  setTranscript: (text: string) => void;
  isSupported: boolean;
  isTranscribing: boolean;
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // Check SpeechRecognition support in the browser
  const isSupported = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const transcribeAudio = async (blob: Blob) => {
    if (blob.size < 1000) return; // Ignore tiny chunks

    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Transcription failed");
      }

      if (data.text) {
        // Success! Overwrite the transcript with the high-accuracy Gemini result
        setTranscript(data.text);
      }
    } catch (err) {
      console.error("Gemini Transcription error, falling back to local speech recognition:", err);
      const errorMsg = err instanceof Error ? err.message : "";
      if (errorMsg.includes("API key")) {
        setTranscript("Error: " + errorMsg);
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopListening = useCallback(async () => {
    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Stop Speech Recognition
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent restart on end
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    silenceTimeoutRef.current = setTimeout(() => {
      stopListening();
    }, 5000); // 5 seconds of silence
  }, [stopListening]);

  const startListening = useCallback(async () => {
    try {
      // 1. Start Audio Stream and MediaRecorder for background high-quality audio recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setIsListening(false);
        // Send the recorded audio to Gemini for final high-accuracy correction
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();

      // 2. Start Web Speech API for real-time immediate feedback
      if (isSupported) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || "en-US";

        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const combined = finalTranscript + interimTranscript;
          if (combined) {
            setTranscript(combined);
          }
          resetSilenceTimeout(); // Reset timer on speech result
        };

        recognition.onerror = (e: any) => {
          console.error("Local SpeechRecognition error:", e);
        };

        recognition.onend = () => {
          // If recognition ends but we are still listening, restart it
          if (isListening && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              console.error("Failed to restart SpeechRecognition:", err);
            }
          }
        };

        recognition.start();
      }

      setIsListening(true);
      setTranscript("");
      resetSilenceTimeout(); // Start timer initially
    } catch (err) {
      console.error("Failed to start speech recording:", err);
      throw err;
    }
  }, [isSupported, isListening, resetSilenceTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    isTranscribing,
    transcript,
    startListening,
    stopListening,
    setTranscript,
    isSupported,
  };
}
