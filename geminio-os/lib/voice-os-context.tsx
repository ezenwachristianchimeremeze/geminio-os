import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceType = 'male' | 'female';
export type VoiceLanguage = 'en' | 'fr' | 'es' | 'ar' | 'zh';

export interface VoiceCommand {
  id: string;
  name: string;
  description: string;
  action: string;
  enabled: boolean;
}

export interface VoiceOSSettings {
  voiceType: VoiceType;
  language: VoiceLanguage;
  volume: number;
  offlineMode: boolean;
  autoRespond: boolean;
  enabledCommands: string[];
}

interface VoiceOSContextType {
  settings: VoiceOSSettings;
  isListening: boolean;
  lastCommand: VoiceCommand | null;
  availableCommands: VoiceCommand[];
  updateSettings: (settings: Partial<VoiceOSSettings>) => Promise<void>;
  startListening: () => void;
  stopListening: () => void;
  executeCommand: (command: VoiceCommand) => Promise<void>;
  getAvailableCommands: () => VoiceCommand[];
}

const VoiceOSContext = createContext<VoiceOSContextType | undefined>(undefined);

const DEFAULT_COMMANDS: VoiceCommand[] = [
  { id: '1', name: 'Open Chat', description: 'Open AI Chat', action: 'open-chat', enabled: true },
  { id: '2', name: 'Open Settings', description: 'Open Settings', action: 'open-settings', enabled: true },
  { id: '3', name: 'Read Notifications', description: 'Read unread notifications', action: 'read-notifications', enabled: true },
  { id: '4', name: 'Create Task', description: 'Create a new task', action: 'create-task', enabled: true },
  { id: '5', name: 'Open Camera', description: 'Open device camera', action: 'open-camera', enabled: true },
  { id: '6', name: 'Open Gallery', description: 'Open photo gallery', action: 'open-gallery', enabled: true },
  { id: '7', name: 'Toggle Flashlight', description: 'Turn flashlight on/off', action: 'toggle-flashlight', enabled: true },
  { id: '8', name: 'Toggle Wi-Fi', description: 'Turn Wi-Fi on/off', action: 'toggle-wifi', enabled: true },
  { id: '9', name: 'Toggle Bluetooth', description: 'Turn Bluetooth on/off', action: 'toggle-bluetooth', enabled: true },
  { id: '10', name: 'Read Messages', description: 'Read recent messages', action: 'read-messages', enabled: true },
];

const DEFAULT_SETTINGS: VoiceOSSettings = {
  voiceType: 'female',
  language: 'en',
  volume: 0.8,
  offlineMode: false,
  autoRespond: true,
  enabledCommands: DEFAULT_COMMANDS.map(cmd => cmd.id),
};

export function VoiceOSProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<VoiceOSSettings>(DEFAULT_SETTINGS);
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);

  // Load settings from storage on mount
  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('voiceOSSettings');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load Voice OS settings:', error);
    }
  };

  const updateSettings = useCallback(async (newSettings: Partial<VoiceOSSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await AsyncStorage.setItem('voiceOSSettings', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update Voice OS settings:', error);
    }
  }, [settings]);

  const startListening = useCallback(() => {
    setIsListening(true);
    // Voice recognition will be implemented with expo-speech-recognition
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);

  const executeCommand = useCallback(async (command: VoiceCommand) => {
    try {
      setLastCommand(command);
      // Command execution logic will be implemented based on action type
      console.log('Executing command:', command.action);
    } catch (error) {
      console.error('Failed to execute command:', error);
    }
  }, []);

  const getAvailableCommands = useCallback(() => {
    return DEFAULT_COMMANDS.filter(cmd => settings.enabledCommands.includes(cmd.id));
  }, [settings.enabledCommands]);

  const value: VoiceOSContextType = {
    settings,
    isListening,
    lastCommand,
    availableCommands: getAvailableCommands(),
    updateSettings,
    startListening,
    stopListening,
    executeCommand,
    getAvailableCommands,
  };

  return (
    <VoiceOSContext.Provider value={value}>
      {children}
    </VoiceOSContext.Provider>
  );
}

export function useVoiceOS() {
  const context = useContext(VoiceOSContext);
  if (!context) {
    throw new Error('useVoiceOS must be used within VoiceOSProvider');
  }
  return context;
}
