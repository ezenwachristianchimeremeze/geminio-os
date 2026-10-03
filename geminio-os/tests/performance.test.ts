import { preloadFonts, analyzeBundleSize, dynamicallyLoadModule, setupPerformanceMonitoring, runHeavyComputationInBackground } from "@/lib/performance-optimizer";
import { describe, it, expect, vi } from "vitest";
import * as Font from "expo-font";

vi.mock("expo-font", () => ({
  loadAsync: vi.fn(() => Promise.resolve()),
}));

describe("Performance Optimizer", () => {
  it("should preload fonts successfully", async () => {
    const mockFonts = { "Inter-Bold": "mock://Inter-Bold.ttf" };
    await preloadFonts(mockFonts);
    expect(Font.loadAsync).toHaveBeenCalledWith(mockFonts);
  });

  it("should log bundle size analysis message", () => {
    const consoleSpy = vi.spyOn(console, "log");
    analyzeBundleSize();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Analyzing bundle size..."));
    consoleSpy.mockRestore();
  });

  it("should dynamically load a module", async () => {
    const mockModule = { default: { value: "test" } };
    const loadedModule = await dynamicallyLoadModule(() => Promise.resolve(mockModule));
    expect(loadedModule).toEqual(mockModule.default);
  });

  it("should log performance monitoring setup message", () => {
    const consoleSpy = vi.spyOn(console, "log");
    setupPerformanceMonitoring();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Setting up performance monitoring..."));
    consoleSpy.mockRestore();
  });

  it("should run heavy computation in background", async () => {
    const mockTask = () => 1 + 2;
    const result = await runHeavyComputationInBackground(mockTask);
    expect(result).toBe(3);
  });

  it("should handle errors in background computation", async () => {
    const mockTask = () => {
      throw new Error("Computation failed");
    };
    await expect(runHeavyComputationInBackground(mockTask)).rejects.toThrow("Computation failed");
  });
});
