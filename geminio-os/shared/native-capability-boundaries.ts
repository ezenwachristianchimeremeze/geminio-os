export type NativeCapabilityStatus = "available" | "permission-required" | "unsupported" | "unavailable";
export type CapabilityPlatform = "web" | "native";

export interface NativeCapabilityResult<T> {
  status: NativeCapabilityStatus;
  value?: T;
  message: string;
}

export function getNativeCapabilityStatus(platform: CapabilityPlatform) {
  return {
    barcodeScanner: (): NativeCapabilityResult<never> => ({
      status: platform === "web" ? "unsupported" : "unavailable",
      message: platform === "web" ? "Barcode scanning requires a native camera runtime." : "Barcode scanner module is not configured in this build.",
    }),
    nfc: (): NativeCapabilityResult<never> => ({
      status: platform === "web" ? "unsupported" : "unavailable",
      message: platform === "web" ? "NFC is not available in web builds." : "NFC capability requires a device build with an NFC adapter.",
    }),
    flashlight: (): NativeCapabilityResult<never> => ({
      status: platform === "web" ? "unsupported" : "unavailable",
      message: platform === "web" ? "Flashlight control is not available in web builds." : "Flashlight control requires a device camera/torch adapter.",
    }),
    backgroundLocation: (): NativeCapabilityResult<never> => ({
      status: platform === "web" ? "unsupported" : "permission-required",
      message: platform === "web" ? "Background location is not available in web builds." : "Background location requires explicit foreground and background permission approval.",
    }),
    contacts: (): NativeCapabilityResult<never> => ({
      status: platform === "web" ? "unsupported" : "permission-required",
      message: platform === "web" ? "Contacts access is not available in web builds." : "Contacts access requires user permission and supports cancellation without data loss.",
    }),
    calendar: (): NativeCapabilityResult<never> => ({
      status: platform === "web" ? "unsupported" : "permission-required",
      message: platform === "web" ? "Calendar access is not available in web builds." : "Calendar access requires user permission before reading or creating events.",
    }),
    network: (): NativeCapabilityResult<{ connected: boolean }> => ({
      status: "available",
      value: { connected: true },
      message: "Network state is resolved by the runtime adapter and may change while the app is active.",
    }),
  };
}
