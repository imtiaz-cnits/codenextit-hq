import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseAudioRecorderReturn {
  isRecording: boolean;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  uploadAudio: (noteId: string, blobOverride?: Blob) => Promise<string | null>;
  setAudioBlob: (blob: Blob | null) => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      throw err;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const uploadAudio = useCallback(async (noteId: string, blobOverride?: Blob): Promise<string | null> => {
    const blobToUpload = blobOverride || audioBlob;
    if (!blobToUpload) return null;

    try {
      const fileName = `${noteId}/${Date.now()}.webm`;
      const { data, error } = await supabase.storage
        .from("note_audios")
        .upload(fileName, blobToUpload, {
          contentType: "audio/webm",
          cacheControl: "3600",
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("note_audios")
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (err) {
      console.error("Audio upload failed:", err);
      return null;
    }
  }, [audioBlob]);

  return {
    isRecording,
    audioBlob,
    startRecording,
    stopRecording,
    uploadAudio,
    setAudioBlob
  };
}
