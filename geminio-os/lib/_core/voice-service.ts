import { Platform } from "react-native";

// Type definitions for expo-speech
type SpeechOptions = {
  language?: string;
  pitch?: number;
  rate?: number;
  onDone?: () => void;
  onError?: (error: any) => void;
};

type Voice = {
  identifier: string;
  name: string;
  language: string;
  quality: number;
};

// Mock Speech module for web
const Speech = {
  speak: async (text: string, options?: SpeechOptions) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = options?.pitch || 1.0;
      utterance.rate = options?.rate || 1.0;
      utterance.lang = options?.language || 'en';
      if (options?.onDone) utterance.onend = options.onDone;
      if (options?.onError) utterance.onerror = options.onError;
      window.speechSynthesis.speak(utterance);
    }
  },
  stop: async () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },
  isSpeakingAsync: async () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  },
  getAvailableVoicesAsync: async (): Promise<Voice[]> => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.getVoices().map((voice: any) => ({
        identifier: voice.voiceURI,
        name: voice.name,
        language: voice.lang,
        quality: voice.default ? 1 : 0,
      }));
    }
    return [];
  },
  setAudioMode: async (options: any) => {
    // No-op for web
  },
};

/**
 * Voice Service - Handles text-to-speech and voice command processing
 * 
 * Features:
 * - Text-to-speech synthesis
 * - Voice output with multiple voices
 * - Speech rate and pitch control
 * - Voice command intent detection
 */

export type VoiceCommand = 
  | "chat"
  | "create-task"
  | "search-jobs"
  | "create-video"
  | "create-music"
  | "open-dashboard"
  | "set-reminder"
  | "send-email"
  | "unknown";



/**
 * Speak text using text-to-speech
 */
export async function speak(
  text: string,
  options?: SpeechOptions
): Promise<void> {
  try {
    // Check if already speaking
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }

    await Speech.speak(text, {
      language: options?.language || "en",
      pitch: options?.pitch || 1.0,
      rate: options?.rate || 1.0,
      onDone: () => {
        console.log("Speech completed");
      },
      onError: (error: any) => {
        console.error("Speech error:", error);
      },
    });
  } catch (error) {
    console.error("Speak error:", error);
    throw error;
  }
}

/**
 * Stop current speech
 */
export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch (error) {
    console.error("Stop speech error:", error);
  }
}

/**
 * Get available voices
 */
export async function getAvailableVoices(): Promise<Voice[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices;
  } catch (error) {
    console.error("Get voices error:", error);
    return [];
  }
}

/**
 * Detect voice command intent from text
 * 
 * Maps user speech to specific commands
 */
export function detectVoiceCommandIntent(text: string): VoiceCommand {
  const lowerText = text.toLowerCase().trim();

  // Chat commands
  if (
    lowerText.includes("chat") ||
    lowerText.includes("talk") ||
    lowerText.includes("say") ||
    lowerText.includes("tell me")
  ) {
    return "chat";
  }

  // Task commands
  if (
    lowerText.includes("create task") ||
    lowerText.includes("add task") ||
    lowerText.includes("new task") ||
    lowerText.includes("remind me")
  ) {
    return "create-task";
  }

  // Job commands
  if (
    lowerText.includes("search job") ||
    lowerText.includes("find job") ||
    lowerText.includes("job search") ||
    lowerText.includes("job opportunity")
  ) {
    return "search-jobs";
  }

  // Video commands
  if (
    lowerText.includes("create video") ||
    lowerText.includes("make video") ||
    lowerText.includes("edit video") ||
    lowerText.includes("video studio")
  ) {
    return "create-video";
  }

  // Music commands
  if (
    lowerText.includes("create music") ||
    lowerText.includes("make music") ||
    lowerText.includes("generate beat") ||
    lowerText.includes("music studio")
  ) {
    return "create-music";
  }

  // Dashboard commands
  if (
    lowerText.includes("open") ||
    lowerText.includes("go to") ||
    lowerText.includes("show")
  ) {
    if (
      lowerText.includes("dashboard") ||
      lowerText.includes("finance") ||
      lowerText.includes("documents") ||
      lowerText.includes("knowledge")
    ) {
      return "open-dashboard";
    }
  }

  // Reminder commands
  if (
    lowerText.includes("set reminder") ||
    lowerText.includes("remind me") ||
    lowerText.includes("alarm")
  ) {
    return "set-reminder";
  }

  // Email commands
  if (
    lowerText.includes("send email") ||
    lowerText.includes("write email") ||
    lowerText.includes("compose email")
  ) {
    return "send-email";
  }

  return "unknown";
}

/**
 * Extract parameters from voice command
 * 
 * For example: "Create a task: Buy groceries" -> { command: "create-task", params: "Buy groceries" }
 */
export function extractCommandParams(text: string): {
  command: VoiceCommand;
  params: string;
} {
  const command = detectVoiceCommandIntent(text);
  
  // Extract params after colon or specific keywords
  let params = text;
  
  if (text.includes(":")) {
    params = text.split(":")[1].trim();
  } else if (text.includes("task")) {
    params = text.replace(/create task|add task|new task/gi, "").trim();
  } else if (text.includes("job")) {
    params = text.replace(/search job|find job|job search/gi, "").trim();
  }

  return { command, params };
}

/**
 * Format voice command response
 * 
 * Creates a natural language response to voice commands
 */
export function formatVoiceResponse(
  command: VoiceCommand,
  result: string
): string {
  const responses: Record<VoiceCommand, string> = {
    "chat": `I understood. ${result}`,
    "create-task": `Task created: ${result}`,
    "search-jobs": `Found job opportunities: ${result}`,
    "create-video": `Creating video: ${result}`,
    "create-music": `Generating music: ${result}`,
    "open-dashboard": `Opening dashboard: ${result}`,
    "set-reminder": `Reminder set: ${result}`,
    "send-email": `Email prepared: ${result}`,
    "unknown": `I didn't understand that command. Could you repeat?`,
  };

  return responses[command] || "Command processed.";
}

/**
 * Initialize voice service
 * 
 * Sets up audio mode for iOS
 */
export async function initializeVoiceService(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      // Enable audio playback in silent mode on iOS
      await Speech.setAudioMode({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        interruptionModeIOS: 1,
      });
    }
  } catch (error) {
    console.error("Initialize voice service error:", error);
  }
}
