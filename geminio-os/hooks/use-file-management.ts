import { useState, useCallback } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export interface FileItem {
  id: string;
  name: string;
  type: "document" | "image" | "video" | "audio" | "other";
  size: number;
  uri: string;
  mimeType: string;
  createdAt: number;
  modifiedAt: number;
  tags?: string[];
}

export function useFileManagement() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pick document
  const pickDocument = useCallback(async () => {
    try {
      setIsLoading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        const fileItem: FileItem = {
          id: `file-${Date.now()}`,
          name: asset.name || "document",
          type: "document",
          size: asset.size || 0,
          uri: asset.uri,
          mimeType: asset.mimeType || "application/octet-stream",
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        };

        setFiles((prev) => [fileItem, ...prev]);
        return { success: true, file: fileItem };
      }

      return { success: false, error: "No file selected" };
    } catch (error) {
      console.error("Pick document error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to pick document",
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Pick image
  const pickImage = useCallback(async () => {
    try {
      setIsLoading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];

        const fileItem: FileItem = {
          id: `file-${Date.now()}`,
          name: asset.uri.split("/").pop() || "image.jpg",
          type: "image",
          size: 0,
          uri: asset.uri,
          mimeType: "image/jpeg",
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        };

        setFiles((prev) => [fileItem, ...prev]);
        return { success: true, file: fileItem };
      }

      return { success: false, error: "No image selected" };
    } catch (error) {
      console.error("Pick image error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to pick image",
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete file
  const deleteFile = useCallback(async (fileId: string) => {
    try {
      const file = files.find((f) => f.id === fileId);
      if (!file) {
        return { success: false, error: "File not found" };
      }

      // Delete from filesystem if not in cache
      if (!file.uri.includes("cache")) {
        try {
          await FileSystem.deleteAsync(file.uri);
        } catch (error) {
          console.error("Error deleting file from filesystem:", error);
        }
      }

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      return { success: true };
    } catch (error) {
      console.error("Delete file error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete file",
      };
    }
  }, [files]);

  // Get file content
  const getFileContent = useCallback(async (fileId: string) => {
    try {
      const file = files.find((f) => f.id === fileId);
      if (!file) {
        return { success: false, error: "File not found" };
      }

      const content = await FileSystem.readAsStringAsync(file.uri);
      return { success: true, content };
    } catch (error) {
      console.error("Get file content error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read file",
      };
    }
  }, [files]);

  // Get file as base64
  const getFileAsBase64 = useCallback(async (fileId: string) => {
    try {
      const file = files.find((f) => f.id === fileId);
      if (!file) {
        return { success: false, error: "File not found" };
      }

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: "base64" as any,
      });

      return { success: true, base64 };
    } catch (error) {
      console.error("Get base64 error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to convert file",
      };
    }
  }, [files]);

  // Add tags to file
  const addTags = useCallback((fileId: string, tags: string[]) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, tags: [...(f.tags || []), ...tags] }
          : f
      )
    );
  }, []);

  // Remove tags from file
  const removeTags = useCallback((fileId: string, tags: string[]) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? {
              ...f,
              tags: (f.tags || []).filter((t) => !tags.includes(t)),
            }
          : f
      )
    );
  }, []);

  // Search files
  const searchFiles = useCallback(
    (query: string) => {
      return files.filter(
        (f) =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          (f.tags || []).some((t) => t.toLowerCase().includes(query.toLowerCase()))
      );
    },
    [files]
  );

  // Get files by type
  const getFilesByType = useCallback(
    (type: FileItem["type"]) => {
      return files.filter((f) => f.type === type);
    },
    [files]
  );

  // Get total storage used
  const getTotalStorageUsed = useCallback(() => {
    return files.reduce((sum, f) => sum + f.size, 0);
  }, [files]);

  // Format file size
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }, []);

  return {
    files,
    isLoading,
    pickDocument,
    pickImage,
    deleteFile,
    getFileContent,
    getFileAsBase64,
    addTags,
    removeTags,
    searchFiles,
    getFilesByType,
    getTotalStorageUsed,
    formatFileSize,
  };
}
