import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SharedItem {
  id: string;
  itemId: string;
  itemType: "task" | "goal" | "note" | "project";
  sharedWith: string[];
  permissions: "view" | "edit" | "admin";
  sharedAt: Date;
  expiresAt?: Date;
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "viewer" | "editor" | "admin";
  joinedAt: Date;
}

export function useCollaboration() {
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  // Share an item with others
  const shareItem = useCallback(
    async (
      itemId: string,
      itemType: SharedItem["itemType"],
      emails: string[],
      permissions: "view" | "edit" | "admin" = "view"
    ) => {
      try {
        const sharedItem: SharedItem = {
          id: `${Date.now()}-${Math.random()}`,
          itemId,
          itemType,
          sharedWith: emails,
          permissions,
          sharedAt: new Date(),
        };

        const updated = [...sharedItems, sharedItem];
        setSharedItems(updated);

        // Save to storage
        await AsyncStorage.setItem("shared_items", JSON.stringify(updated));

        return {
          success: true,
          sharedItem,
        };
      } catch (error) {
        console.error("Share error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Share failed",
        };
      }
    },
    [sharedItems]
  );

  // Revoke sharing
  const revokeShare = useCallback(
    async (shareId: string) => {
      try {
        const updated = sharedItems.filter((item) => item.id !== shareId);
        setSharedItems(updated);

        await AsyncStorage.setItem("shared_items", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Revoke error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Revoke failed",
        };
      }
    },
    [sharedItems]
  );

  // Add collaborator
  const addCollaborator = useCallback(
    async (name: string, email: string, role: Collaborator["role"] = "editor") => {
      try {
        const collaborator: Collaborator = {
          id: `${Date.now()}-${Math.random()}`,
          name,
          email,
          role,
          joinedAt: new Date(),
        };

        const updated = [...collaborators, collaborator];
        setCollaborators(updated);

        await AsyncStorage.setItem("collaborators", JSON.stringify(updated));

        return {
          success: true,
          collaborator,
        };
      } catch (error) {
        console.error("Add collaborator error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to add collaborator",
        };
      }
    },
    [collaborators]
  );

  // Remove collaborator
  const removeCollaborator = useCallback(
    async (collaboratorId: string) => {
      try {
        const updated = collaborators.filter((c) => c.id !== collaboratorId);
        setCollaborators(updated);

        await AsyncStorage.setItem("collaborators", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Remove collaborator error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to remove collaborator",
        };
      }
    },
    [collaborators]
  );

  // Update collaborator role
  const updateCollaboratorRole = useCallback(
    async (collaboratorId: string, newRole: Collaborator["role"]) => {
      try {
        const updated = collaborators.map((c) =>
          c.id === collaboratorId ? { ...c, role: newRole } : c
        );
        setCollaborators(updated);

        await AsyncStorage.setItem("collaborators", JSON.stringify(updated));

        return { success: true };
      } catch (error) {
        console.error("Update role error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update role",
        };
      }
    },
    [collaborators]
  );

  // Get shared items for a specific collaborator
  const getSharedItemsFor = useCallback(
    (email: string) => {
      return sharedItems.filter((item) => item.sharedWith.includes(email));
    },
    [sharedItems]
  );

  // Check if user has permission to access item
  const hasPermission = useCallback(
    (itemId: string, userEmail: string, requiredPermission: "view" | "edit" | "admin" = "view") => {
      const shared = sharedItems.find((item) => item.itemId === itemId && item.sharedWith.includes(userEmail));

      if (!shared) return false;

      const permissions = { view: 1, edit: 2, admin: 3 };
      return permissions[shared.permissions] >= permissions[requiredPermission];
    },
    [sharedItems]
  );

  // Generate share link
  const generateShareLink = useCallback(
    (itemId: string, expiresIn?: number) => {
      const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : undefined;

      return {
        shareCode,
        link: `geminio://share/${shareCode}`,
        expiresAt,
      };
    },
    []
  );

  return {
    sharedItems,
    collaborators,
    shareItem,
    revokeShare,
    addCollaborator,
    removeCollaborator,
    updateCollaboratorRole,
    getSharedItemsFor,
    hasPermission,
    generateShareLink,
  };
}
