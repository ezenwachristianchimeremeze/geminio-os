import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MemoryItem {
  id: string;
  type: 'conversation' | 'preference' | 'project' | 'goal' | 'task' | 'note';
  content: string;
  timestamp: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface MemoryContextType {
  memories: MemoryItem[];
  addMemory: (item: Omit<MemoryItem, 'id' | 'timestamp'>) => Promise<void>;
  removeMemory: (id: string) => Promise<void>;
  searchMemories: (query: string) => MemoryItem[];
  getMemoriesByType: (type: MemoryItem['type']) => MemoryItem[];
  exportMemories: () => Promise<string>;
  importMemories: (data: string) => Promise<void>;
  clearMemories: () => Promise<void>;
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

const MEMORY_STORAGE_KEY = 'geminio_memories';

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load memories from storage on mount
  useEffect(() => {
    const loadMemories = async () => {
      try {
        const stored = await AsyncStorage.getItem(MEMORY_STORAGE_KEY);
        if (stored) {
          setMemories(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading memories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMemories();
  }, []);

  // Save memories to storage whenever they change
  useEffect(() => {
    if (!isLoading) {
      const saveMemories = async () => {
        try {
          await AsyncStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
        } catch (error) {
          console.error('Error saving memories:', error);
        }
      };

      saveMemories();
    }
  }, [memories, isLoading]);

  const addMemory = async (item: Omit<MemoryItem, 'id' | 'timestamp'>) => {
    const newMemory: MemoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    setMemories((prev) => [newMemory, ...prev]);
  };

  const removeMemory = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const searchMemories = (query: string): MemoryItem[] => {
    const lowerQuery = query.toLowerCase();
    return memories.filter(
      (m) =>
        m.content.toLowerCase().includes(lowerQuery) ||
        m.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  };

  const getMemoriesByType = (type: MemoryItem['type']): MemoryItem[] => {
    return memories.filter((m) => m.type === type);
  };

  const exportMemories = async (): Promise<string> => {
    return JSON.stringify(memories, null, 2);
  };

  const importMemories = async (data: string) => {
    try {
      const imported = JSON.parse(data);
      if (Array.isArray(imported)) {
        setMemories((prev) => [...imported, ...prev]);
      }
    } catch (error) {
      console.error('Error importing memories:', error);
      throw error;
    }
  };

  const clearMemories = async () => {
    setMemories([]);
    await AsyncStorage.removeItem(MEMORY_STORAGE_KEY);
  };

  return (
    <MemoryContext.Provider
      value={{
        memories,
        addMemory,
        removeMemory,
        searchMemories,
        getMemoriesByType,
        exportMemories,
        importMemories,
        clearMemories,
      }}
    >
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemory() {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemory must be used within MemoryProvider');
  }
  return context;
}
