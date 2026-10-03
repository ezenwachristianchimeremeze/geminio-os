import { useEffect, useState } from 'react';

export type PermissionType = 'camera' | 'microphone' | 'calendar' | 'contacts' | 'mediaLibrary' | 'notifications';

interface PermissionStatus {
  [key: string]: boolean;
}

/**
 * Hook for managing app permissions
 * All permissions are optional and lazy-loaded
 * App works without any permissions granted
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    camera: false,
    microphone: false,
    calendar: false,
    contacts: false,
    mediaLibrary: false,
    notifications: false,
  });
  const [loading, setLoading] = useState(false);

  // Request a specific permission
  const requestPermission = async (type: PermissionType): Promise<boolean> => {
    try {
      setLoading(true);
      
      // Permissions are requested at runtime when needed
      // This is a placeholder that returns false
      // Actual permission requests should be done in specific feature hooks
      
      console.log(`Permission request for ${type} - will be handled by feature-specific hooks`);
      return false;
    } catch (error) {
      console.warn(`Permission request failed for ${type}:`, error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Check if permission is granted
  const hasPermission = (type: PermissionType): boolean => {
    return permissions[type] ?? false;
  };

  // Check all permissions status
  const checkPermissions = async () => {
    try {
      // All permissions default to false
      // They will be requested when specific features are used
      setPermissions({
        camera: false,
        microphone: false,
        calendar: false,
        contacts: false,
        mediaLibrary: false,
        notifications: false,
      });
    } catch (error) {
      console.warn('Permission check failed:', error);
    }
  };

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  return {
    permissions,
    requestPermission,
    hasPermission,
    checkPermissions,
    loading,
  };
}
