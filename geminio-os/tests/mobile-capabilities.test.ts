import { describe, expect, it } from "vitest";
import { getCapabilitiesByGroup, getCapabilitySummary, MOBILE_CAPABILITIES } from "@/shared/mobile-capabilities";

describe("Mobile capability registry", () => {
  it("contains unique capability identifiers", () => {
    const ids = MOBILE_CAPABILITIES.map((capability) => capability.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every capability traceable to an implementation and test id", () => {
    for (const capability of MOBILE_CAPABILITIES) {
      expect(capability.implementation.length).toBeGreaterThan(0);
      expect(capability.testId.length).toBeGreaterThan(0);
      expect(capability.platforms.length).toBeGreaterThan(0);
    }
  });

  it("exposes provider boundaries separately from implemented capabilities", () => {
    const summary = getCapabilitySummary();
    expect(summary.implemented).toBeGreaterThan(0);
    expect(summary.boundary).toBeGreaterThan(0);
    expect(summary.planned).toBe(0);
    expect(getCapabilitiesByGroup("billing").some((capability) => capability.status === "boundary")).toBe(true);
  });
});


describe("native capability boundaries", () => {
  it("exposes safe boundary states for device-only features", async () => {
    const { getNativeCapabilityStatus } = await import("../shared/native-capability-boundaries");
    const nativeCapabilityStatus = getNativeCapabilityStatus("web");
    const barcode = nativeCapabilityStatus.barcodeScanner();
    const nfc = nativeCapabilityStatus.nfc();
    const flashlight = nativeCapabilityStatus.flashlight();
    const backgroundLocation = nativeCapabilityStatus.backgroundLocation();
    expect(["available", "permission-required", "unsupported", "unavailable"]).toContain(barcode.status);
    expect(nfc.message.length).toBeGreaterThan(10);
    expect(flashlight.message.length).toBeGreaterThan(10);
    expect(backgroundLocation.message.length).toBeGreaterThan(10);
  });
});


describe("extended native capability boundaries", () => {
  it("returns safe web states for device-only capabilities", async () => {
    const { getNativeCapabilityStatus } = await import("../shared/native-capability-boundaries");
    const web = getNativeCapabilityStatus("web");
    expect(web.flashlight().status).toBe("unsupported");
    expect(web.contacts().status).toBe("unsupported");
    expect(web.calendar().status).toBe("unsupported");
    expect(web.backgroundLocation().status).toBe("unsupported");
    expect(web.network().value?.connected).toBe(true);
  });
});
