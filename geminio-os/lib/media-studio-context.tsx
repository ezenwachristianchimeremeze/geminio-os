import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MediaType = 'image' | 'video';
export type GenerationType = 'text-to-image' | 'image-to-video' | 'text-to-video' | 'enhance' | 'edit';

export interface MediaProject {
  id: string;
  name: string;
  type: MediaType;
  generationType: GenerationType;
  prompt: string;
  status: 'draft' | 'generating' | 'completed' | 'failed';
  result?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MediaSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  style: string;
  aspectRatio: string;
  duration?: number; // for videos
}

interface MediaStudioContextType {
  projects: MediaProject[];
  currentProject: MediaProject | null;
  settings: MediaSettings;
  isGenerating: boolean;
  generationProgress: number;
  createProject: (name: string, type: MediaType, generationType: GenerationType) => Promise<MediaProject>;
  updateProject: (id: string, updates: Partial<MediaProject>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: MediaProject | null) => void;
  updateSettings: (settings: Partial<MediaSettings>) => Promise<void>;
  generateMedia: (prompt: string) => Promise<string>;
  getProjects: (type?: MediaType) => MediaProject[];
}

const MediaStudioContext = createContext<MediaStudioContextType | undefined>(undefined);

const DEFAULT_SETTINGS: MediaSettings = {
  quality: 'high',
  style: 'realistic',
  aspectRatio: '16:9',
  duration: 10,
};

export function MediaStudioProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<MediaProject[]>([]);
  const [currentProject, setCurrentProject] = useState<MediaProject | null>(null);
  const [settings, setSettings] = useState<MediaSettings>(DEFAULT_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  React.useEffect(() => {
    loadProjects();
    loadSettings();
  }, []);

  const loadProjects = async () => {
    try {
      const stored = await AsyncStorage.getItem('mediaStudioProjects');
      if (stored) {
        setProjects(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load media projects:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('mediaStudioSettings');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load media settings:', error);
    }
  };

  const createProject = useCallback(
    async (name: string, type: MediaType, generationType: GenerationType): Promise<MediaProject> => {
      const newProject: MediaProject = {
        id: Date.now().toString(),
        name,
        type,
        generationType,
        prompt: '',
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const updated = [...projects, newProject];
      setProjects(updated);
      await AsyncStorage.setItem('mediaStudioProjects', JSON.stringify(updated));
      setCurrentProject(newProject);
      return newProject;
    },
    [projects]
  );

  const updateProject = useCallback(
    async (id: string, updates: Partial<MediaProject>) => {
      const updated = projects.map(p =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      );
      setProjects(updated);
      await AsyncStorage.setItem('mediaStudioProjects', JSON.stringify(updated));

      if (currentProject?.id === id) {
        setCurrentProject({ ...currentProject, ...updates, updatedAt: Date.now() });
      }
    },
    [projects, currentProject]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      await AsyncStorage.setItem('mediaStudioProjects', JSON.stringify(updated));

      if (currentProject?.id === id) {
        setCurrentProject(null);
      }
    },
    [projects, currentProject]
  );

  const updateSettings = useCallback(async (newSettings: Partial<MediaSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await AsyncStorage.setItem('mediaStudioSettings', JSON.stringify(updated));
  }, [settings]);

  const generateMedia = useCallback(async (prompt: string): Promise<string> => {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);

      // Simulate generation with progress updates
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setGenerationProgress(i);
      }

      // Mock result URL
      const resultUrl = `https://example.com/media/${Date.now()}.jpg`;

      if (currentProject) {
        await updateProject(currentProject.id, {
          prompt,
          status: 'completed',
          result: resultUrl,
        });
      }

      return resultUrl;
    } catch (error) {
      console.error('Failed to generate media:', error);
      if (currentProject) {
        await updateProject(currentProject.id, { status: 'failed' });
      }
      throw error;
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }, [currentProject, updateProject]);

  const getProjects = useCallback(
    (type?: MediaType) => {
      if (!type) return projects;
      return projects.filter(p => p.type === type);
    },
    [projects]
  );

  const value: MediaStudioContextType = {
    projects,
    currentProject,
    settings,
    isGenerating,
    generationProgress,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    updateSettings,
    generateMedia,
    getProjects,
  };

  return (
    <MediaStudioContext.Provider value={value}>
      {children}
    </MediaStudioContext.Provider>
  );
}

export function useMediaStudio() {
  const context = useContext(MediaStudioContext);
  if (!context) {
    throw new Error('useMediaStudio must be used within MediaStudioProvider');
  }
  return context;
}
