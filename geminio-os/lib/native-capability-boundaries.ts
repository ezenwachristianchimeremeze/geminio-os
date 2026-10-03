import { Platform } from "react-native";
import { getNativeCapabilityStatus } from "@/shared/native-capability-boundaries";

export * from "@/shared/native-capability-boundaries";

export const nativeCapabilityStatus = getNativeCapabilityStatus(Platform.OS === "web" ? "web" : "native");
