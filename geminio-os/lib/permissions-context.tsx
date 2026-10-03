import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PermissionStatus = 'granted' | 'denied' | 'pending' | 'blocked';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'device' | 'media' | 'location' | 'contacts' | 'calendar' | 'health';
  status: PermissionStatus;
  required: boolean;
  lastRequested?: number;
}

interface PermissionsContextType {
  permissions: Permission[];
  requestPermission: (permissionId: string) => Promise<boolean>;
  revokePermission: (permissionId: string) => Promise<void>;
  getPermissionStatus: (permissionId: string) => PermissionStatus;
  hasPermission: (permissionId: string) => boolean;
  getPermissionsByCategory: (category: Permission['category']) => Permission[];
  auditLog: Array<{ timestamp: number; permissionId: string; action: string }>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

const DEFAULT_PERMISSIONS: Permission[] = [
  {
    id: 'camera',
    name: 'Camera',
    description: 'Access device camera for photos and videos',
    category: 'media',
    status: 'pending' as PermissionStatus,
    required: false,
  },
  {
    id: 'microphone',
    name: 'Microphone',
    description: 'Access device microphone for voice input and calls',
    category: 'media',
    status: 'pending' as PermissionStatus,
    required: false,
  },
  {
    id: 'gallery',
    name: 'Photo Gallery',
    description: 'Access device photos and videos',
    category: 'media',
    status: 'pending' as PermissionStatus,
    required: false,
  },
  {
    id: 'location',
    name: 'Location',
    description: 'Access device location for maps and services',
    category: 'location',
    status: 'pending' as PermissionStatus,
    required: false,
  },
  {
    id: 'contacts',
    name: 'Contacts',
    description: 'Access device contacts',
    category: 'contacts',
    status: 'pending' as PermissionStatus,
    required: false,
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Access device calendar events',
    category: 'calendar',
    status: 'pending' as PermissionStatus,
    required: false,
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Send push notifications',
    category: 'device',
    status: 'pending' as PermissionStatus,
    required: true,
  },
  {
    id: 'bluetooth',
    name: 'Bluetooth',
    description: 'Connect to Bluetooth devices',
    category: 'device',
    status: 'pending' as PermissionStatus,
    required: false,
  },
];

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<Permission[]>(DEFAULT_PERMISSIONS);
  const [auditLog, setAuditLog] = useState<Array<{ timestamp: number; permissionId: string; action: string }>>([]);

  React.useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const stored = await AsyncStorage.getItem('permissions');
      if (stored) {
        setPermissions(JSON.parse(stored));
      }
      const logs = await AsyncStorage.getItem('permissionAuditLog');
      if (logs) {
        setAuditLog(JSON.parse(logs));
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  };

  const logPermissionAction = useCallback(async (permissionId: string, action: string) => {
    const newLog = { timestamp: Date.now(), permissionId, action };
    const updatedLog = [...auditLog, newLog];
    setAuditLog(updatedLog);
    try {
      await AsyncStorage.setItem('permissionAuditLog', JSON.stringify(updatedLog));
    } catch (error) {
      console.error('Failed to log permission action:', error);
    }
  }, [auditLog]);

  const requestPermission = useCallback(async (permissionId: string): Promise<boolean> => {
    try {
      const permission = permissions.find(p => p.id === permissionId);
      if (!permission) return false;

      // Simulate permission request
      const granted = Math.random() > 0.3; // 70% chance of being granted for demo

      const updatedPermissions = permissions.map(p =>
        p.id === permissionId
          ? { ...p, status: (granted ? 'granted' : 'denied') as PermissionStatus, lastRequested: Date.now() }
          : p
      );

      setPermissions(updatedPermissions);
      await AsyncStorage.setItem('permissions', JSON.stringify(updatedPermissions));
      await logPermissionAction(permissionId, granted ? 'granted' : 'denied');

      return granted;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return false;
    }
  }, [permissions, logPermissionAction]);

  const revokePermission = useCallback(async (permissionId: string) => {
    try {
      const updatedPermissions = permissions.map(p =>
        p.id === permissionId ? { ...p, status: 'denied' as PermissionStatus } : p
      );
      setPermissions(updatedPermissions);
      await AsyncStorage.setItem('permissions', JSON.stringify(updatedPermissions));
      await logPermissionAction(permissionId, 'revoked');
    } catch (error) {
      console.error('Failed to revoke permission:', error);
    }
  }, [permissions, logPermissionAction]);

  const getPermissionStatus = useCallback((permissionId: string): PermissionStatus => {
    const permission = permissions.find(p => p.id === permissionId);
    return permission?.status ?? 'pending';
  }, [permissions]);

  const hasPermission = useCallback((permissionId: string): boolean => {
    return getPermissionStatus(permissionId) === 'granted';
  }, [getPermissionStatus]);

  const getPermissionsByCategory = useCallback((category: Permission['category']): Permission[] => {
    return permissions.filter(p => p.category === category);
  }, [permissions]);

  const value: PermissionsContextType = {
    permissions,
    requestPermission,
    revokePermission,
    getPermissionStatus,
    hasPermission,
    getPermissionsByCategory,
    auditLog,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
}
