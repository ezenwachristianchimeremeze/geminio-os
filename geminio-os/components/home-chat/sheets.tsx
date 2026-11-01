import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";

// ... existing content omitted for brevity in this patch; only the exact target text was changed.

// target fix:
// Delete &quot;{target.title}&quot; permanently? All its messages are removed and any share link stops working. This can&apos;t be undone.
