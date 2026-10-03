import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, ScreenHeader } from "@/components/super-app";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type NotificationKind = "Updates" | "Security" | "Workspace" | "Community";
type NotificationIcon = "auto-awesome" | "verified-user" | "rocket-launch" | "groups" | "error-outline";
interface NotificationItem { id: string; kind: NotificationKind; title: string; body: string; time: string; icon: NotificationIcon; color: string; read: boolean; route: string | null; }

const FILTERS: ("All" | NotificationKind)[] = ["All", "Updates", "Security", "Workspace", "Community"];

function timeLabel(value: string | Date) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d`;
}

function toNotificationItem(notification: { id: string; title: string; message: string; type: "info" | "success" | "warning" | "error" | null; read: boolean | null; createdAt: string | Date }): NotificationItem {
  const source = `${notification.title} ${notification.message}`.toLowerCase();
  const kind: NotificationKind = /security|auth|access|threat|sign-in/.test(source) ? "Security" : /workspace|build|runtime|project|preview|task|provider/.test(source) ? "Workspace" : /community|marketplace|creator/.test(source) ? "Community" : "Updates";
  const icon: NotificationIcon = kind === "Security" ? "verified-user" : kind === "Community" ? "groups" : /failed|error|unavailable|blocked/.test(source) ? "error-outline" : kind === "Workspace" ? "rocket-launch" : "auto-awesome";
  const color = notification.type === "error" ? "#C93D5B" : notification.type === "warning" ? "#E58A2B" : notification.type === "success" ? "#2B8A78" : kind === "Security" ? "#C93D5B" : "#635BFF";
  const route = kind === "Security" ? "/profile" : /project|build|runtime|preview|recovery|runner/.test(source) ? "/live-build-studio" : /wallet/.test(source) ? "/workspace/wallet" : /community|marketplace/.test(source) ? "/workspace/marketplace" : /task|ai task/.test(source) ? "/" : null;
  return { id: notification.id, kind, title: notification.title, body: notification.message, time: timeLabel(notification.createdAt), icon, color, read: Boolean(notification.read), route };
}

export default function NotificationsScreen() {
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const protectedQueryEnabled = isAuthenticated && !authLoading;
  const notificationsQuery = trpc.notifications.list.useQuery({ limit: 50 }, { enabled: protectedQueryEnabled, retry: false, refetchInterval: 15_000 });
  const markReadMutation = trpc.notifications.markRead.useMutation();
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation();
  const notifications = useMemo(() => (notificationsQuery.data ?? []).map(toNotificationItem), [notificationsQuery.data]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const visible = useMemo(() => filter === "All" ? notifications : notifications.filter((notification) => notification.kind === filter), [filter, notifications]);

  const markAllRead = async () => {
    if (!isAuthenticated || markAllReadMutation.isPending || unreadCount === 0) return;
    await markAllReadMutation.mutateAsync();
    await notificationsQuery.refetch();
  };

  const markRead = async (notification: NotificationItem) => {
    if (!isAuthenticated || markReadMutation.isPending) return;
    await markReadMutation.mutateAsync({ notificationId: notification.id });
    await notificationsQuery.refetch();
    if (notification.route) router.push(notification.route as never);
  };

  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow={isAuthenticated ? (unreadCount > 0 ? `${unreadCount} new updates` : "All caught up") : "Account activity"}
          title="Notifications"
          subtitle="Actual workspace, security, and task events from your Geminio account."
          action={isAuthenticated ? <IconButton icon="done-all" label="Mark all notifications as read" onPress={() => void markAllRead()} badge={unreadCount || undefined} /> : undefined}
        />

        {!isAuthenticated && !authLoading ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppIcon name="lock-outline" color={colors.muted} size={28} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to load activity</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>Notifications are account-scoped. Sign in to see real project, security, and AI task events.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push("/auth-screen")} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Sign in</Text></Pressable>
          </View>
        ) : null}

        {isAuthenticated ? <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTERS.map((item) => {
              const active = filter === item;
              return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setFilter(item)} style={({ pressed }) => [styles.filterPill, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.filterText, { color: active ? "#FFFFFF" : colors.muted }]}>{item}</Text></Pressable>;
            })}
          </ScrollView>

          <View style={styles.list}>
            {authLoading || notificationsQuery.isLoading ? <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.emptyBody, { color: colors.muted }]}>Loading your notification history…</Text></View> : null}
            {notificationsQuery.isError ? <View style={[styles.empty, { backgroundColor: `${colors.error}12`, borderColor: colors.error }]}><AppIcon name="error-outline" color={colors.error} size={28} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Could not load notifications</Text><Text style={[styles.emptyBody, { color: colors.muted }]}>Your saved activity is safe. Retry when the API is available.</Text><Pressable accessibilityRole="button" onPress={() => void notificationsQuery.refetch()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.error }, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Retry</Text></Pressable></View> : null}
            {!notificationsQuery.isLoading && !notificationsQuery.isError ? visible.map((notification) => (
              <Pressable key={notification.id} accessibilityRole="button" accessibilityLabel={`${notification.title}. ${notification.read ? "Read" : "Unread"}`} onPress={() => void markRead(notification)} style={({ pressed }) => [styles.notificationCard, { backgroundColor: colors.surface, borderColor: notification.read ? colors.border : notification.color }, !notification.read && styles.unreadCard, pressed && styles.pressed]}>
                <View style={[styles.notificationIcon, { backgroundColor: `${notification.color}18` }]}><AppIcon name={notification.icon} color={notification.color} size={20} /></View>
                <View style={styles.notificationCopy}>
                  <View style={styles.notificationTitleRow}><Text style={[styles.notificationTitle, { color: colors.foreground }]}>{notification.title}</Text><Text style={[styles.notificationTime, { color: colors.muted }]}>{notification.time}</Text></View>
                  <Text style={[styles.notificationBody, { color: colors.muted }]}>{notification.body}</Text>
                  <Text style={[styles.notificationKind, { color: notification.color }]}>{notification.kind}</Text>
                </View>
                {!notification.read ? <View style={[styles.unreadDot, { backgroundColor: notification.color }]} /> : null}
              </Pressable>
            )) : null}
          </View>
          {isAuthenticated && !notificationsQuery.isLoading && !notificationsQuery.isError && visible.length === 0 ? <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><AppIcon name="notifications-none" color={colors.muted} size={28} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No notifications here</Text><Text style={[styles.emptyBody, { color: colors.muted }]}>Geminio will add an entry when a real workspace or security event occurs.</Text></View> : null}
        </> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 40 },
  filterScroll: { gap: 7, paddingVertical: 18 },
  filterPill: { minHeight: 34, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  filterText: { fontSize: 12, fontWeight: "800" },
  list: { gap: 10 },
  notificationCard: { minHeight: 92, borderRadius: 19, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 11 },
  unreadCard: { borderWidth: 1.4 },
  notificationIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  notificationCopy: { flex: 1, gap: 5 },
  notificationTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notificationTitle: { flex: 1, fontSize: 14, fontWeight: "800" },
  notificationTime: { fontSize: 11 },
  notificationBody: { fontSize: 12, lineHeight: 17 },
  notificationKind: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  empty: { minHeight: 160, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 9, padding: 20, marginTop: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: "center", maxWidth: 440 },
  primaryButton: { minHeight: 42, borderRadius: 13, paddingHorizontal: 17, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.72 },
});
