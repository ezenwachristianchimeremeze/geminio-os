import { useState, useCallback } from "react";
import { Share, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export interface ExportOptions {
  format: "json" | "csv" | "txt";
  includeMetadata: boolean;
  dateRange?: { from: Date; to: Date };
}

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Convert data to JSON format
  const toJSON = useCallback((data: any, pretty = true) => {
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }, []);

  // Convert data to CSV format
  const toCSV = useCallback((data: any[], headers?: string[]) => {
    if (data.length === 0) return "";

    // Get headers from first object if not provided
    const cols = headers || Object.keys(data[0]);

    // Create CSV header
    const csvHeader = cols.join(",");

    // Create CSV rows
    const csvRows = data.map((row) =>
      cols
        .map((col) => {
          const value = row[col];
          // Escape quotes and wrap in quotes if contains comma
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    );

    return [csvHeader, ...csvRows].join("\n");
  }, []);

  // Convert data to plain text format
  const toTXT = useCallback((data: any) => {
    if (Array.isArray(data)) {
      return data
        .map((item) => {
          if (typeof item === "object") {
            return Object.entries(item)
              .map(([key, value]) => `${key}: ${value}`)
              .join("\n");
          }
          return String(item);
        })
        .join("\n\n");
    }

    if (typeof data === "object") {
      return Object.entries(data)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join("\n");
    }

    return String(data);
  }, []);

  // Export data to file
  const exportToFile = useCallback(
    async (data: any, filename: string, options: ExportOptions) => {
      try {
        setIsExporting(true);
        setExportProgress(0);

        let content = "";

        switch (options.format) {
          case "json":
            content = toJSON(data);
            break;
          case "csv":
            content = toCSV(Array.isArray(data) ? data : [data]);
            break;
          case "txt":
            content = toTXT(data);
            break;
        }

        setExportProgress(50);

        // Add metadata if requested
        if (options.includeMetadata) {
          const metadata = {
            exportedAt: new Date().toISOString(),
            format: options.format,
            itemCount: Array.isArray(data) ? data.length : 1,
          };

          if (options.format === "json") {
            const jsonData = JSON.parse(content);
            content = JSON.stringify({ metadata, data: jsonData }, null, 2);
          } else {
            content = `# Exported at: ${metadata.exportedAt}\n# Format: ${metadata.format}\n# Items: ${metadata.itemCount}\n\n${content}`;
          }
        }

        setExportProgress(75);

        // Save file
        const fileExtension = options.format === "csv" ? "csv" : options.format === "json" ? "json" : "txt";
        const filepath = `${FileSystem.documentDirectory}${filename}.${fileExtension}`;

        await FileSystem.writeAsStringAsync(filepath, content, {
          encoding: "utf8" as any,
        });

        setExportProgress(100);

        return {
          success: true,
          filepath,
          filename: `${filename}.${fileExtension}`,
          size: content.length,
        };
      } catch (error) {
        console.error("Export error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Export failed",
        };
      } finally {
        setIsExporting(false);
      }
    },
    [toJSON, toCSV, toTXT]
  );

  // Share exported file
  const shareExport = useCallback(async (filepath: string, filename: string) => {
    try {
      if (Platform.OS === "web") {
        // For web, create download link
        const content = await FileSystem.readAsStringAsync(filepath);
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // For native platforms, use share
        await Share.share({
          url: filepath,
          title: filename,
          message: `Exported: ${filename}`,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Share error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Share failed",
      };
    }
  }, []);

  // Create backup
  const createBackup = useCallback(
    async (data: any, backupName = "backup") => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${backupName}-${timestamp}`;

      return exportToFile(data, filename, {
        format: "json",
        includeMetadata: true,
      });
    },
    [exportToFile]
  );

  // Restore from backup
  const restoreFromBackup = useCallback(async (filepath: string) => {
    try {
      const content = await FileSystem.readAsStringAsync(filepath);
      const data = JSON.parse(content);
      return {
        success: true,
        data: data.data || data,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error("Restore error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Restore failed",
      };
    }
  }, []);

  return {
    isExporting,
    exportProgress,
    exportToFile,
    shareExport,
    createBackup,
    restoreFromBackup,
    toJSON,
    toCSV,
    toTXT,
  };
}
