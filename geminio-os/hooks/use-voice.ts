import { useState, useCallback } from "react";
import * as Speech from "expo-speech";
import { Platform } from "react-native";

interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
}

export function useVoice() {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSpeaking: false,
    transcript: "",
    error: null,
  });

  // Start listening for voice input
  const startListening = useCallback(async () => {
    if (Platform.OS === "web") {
      // Web Speech API fallback
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setState((prev) => ({ ...prev, error: "Speech recognition not supported on this browser" }));
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      setState((prev) => ({ ...prev, isListening: true, error: null }));

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setState((prev) => ({ ...prev, transcript }));
      };

      recognition.onerror = (event: any) => {
        setState((prev) => ({ ...prev, error: event.error, isListening: false }));
      };

      recognition.onend = () => {
        setState((prev) => ({ ...prev, isListening: false }));
      };

      recognition.start();
    } else {
      // Native implementation for iOS/Android
      try {
        setState((prev) => ({ ...prev, isListening: true, error: null, transcript: "" }));

        // Simulate voice input for now
        // In production, integrate with native speech recognition APIs
        setTimeout(() => {
          setState((prev) => ({ ...prev, isListening: false }));
        }, 3000);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Voice input failed",
          isListening: false,
        }));
      }
    }
  }, []);

  // Stop listening
  const stopListening = useCallback(() => {
    setState((prev) => ({ ...prev, isListening: false }));
  }, []);

  // Speak text using text-to-speech
  const speak = useCallback(async (text: string) => {
    try {
      setState((prev) => ({ ...prev, isSpeaking: true, error: null }));

      // Configure speech options
      const options: Speech.SpeechOptions = {
        language: "en-US",
        pitch: 1.0,
        rate: 1.0,
        onDone: () => {
          setState((prev) => ({ ...prev, isSpeaking: false }));
        },
        onError: (error: any) => {
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            error: error?.message || "Speech failed",
          }));
        },
      };

      await Speech.speak(text, options);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSpeaking: false,
        error: error instanceof Error ? error.message : "Speech failed",
      }));
    }
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(async () => {
    try {
      await Speech.stop();
      setState((prev) => ({ ...prev, isSpeaking: false }));
    } catch (error) {
      console.error("Error stopping speech:", error);
    }
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState((prev) => ({ ...prev, transcript: "" }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearTranscript,
    clearError,
  };
}
