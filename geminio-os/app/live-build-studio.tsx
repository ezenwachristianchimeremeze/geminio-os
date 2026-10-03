import React, { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

type PreviewTarget = "phone" | "tablet" | "laptop" | "desktop";

const TARGETS: { value: PreviewTarget; label: string }[] = [
  { value: "phone", label: "Phone" },
  { value: "tablet", label: "Tablet" },
  { value: "laptop", label: "Laptop" },
  { value: "desktop", label: "Desktop" },
];

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not saved yet";
  return new Date(value).toLocaleString();
}

export default function LiveBuildStudioScreen() {
  const utils = trpc.useUtils();
  const { width } = useWindowDimensions();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const isCompact = width < 768;
  const protectedQueryEnabled = isAuthenticated && !authLoading;
  const params = useLocalSearchParams<{ workspaceId?: string; template?: string }>();
  const requestedWorkspaceId = typeof params.workspaceId === "string" ? params.workspaceId : null;
  const workspaceList = trpc.liveBuilder.list.useQuery(undefined, { enabled: protectedQueryEnabled, retry: false });
  const [workspaceId, setWorkspaceId] = useState<string | null>(requestedWorkspaceId);
  const workspaceQuery = trpc.liveBuilder.get.useQuery(
    { workspaceId: workspaceId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: protectedQueryEnabled && Boolean(workspaceId), retry: false },
  );
  const createMutation = trpc.liveBuilder.create.useMutation();
  const selectMutation = trpc.liveBuilder.selectElement.useMutation();
  const proposeMutation = trpc.liveBuilder.proposeChange.useMutation();
  const proposeFileMutation = trpc.liveBuilder.proposeFileChange.useMutation();
  const applyMutation = trpc.liveBuilder.applyChange.useMutation();
  const previewMutation = trpc.liveBuilder.startPreview.useMutation();
  const runtimeListQuery = trpc.liveBuilder.listRuntimes.useQuery(
    { workspaceId: workspaceId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: protectedQueryEnabled && Boolean(workspaceId), retry: false, refetchInterval: 5000 },
  );
  const runtimeEventsQuery = trpc.liveBuilder.runtimeEvents.useQuery(
    { sessionId: runtimeListQuery.data?.data?.[0]?.id ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: protectedQueryEnabled && Boolean(runtimeListQuery.data?.data?.[0]?.id), retry: false, refetchInterval: 3000 },
  );
  const runtimeStartMutation = trpc.liveBuilder.startRuntime.useMutation();
  const runtimeStopMutation = trpc.liveBuilder.stopRuntime.useMutation();
  const runtimeRestartMutation = trpc.liveBuilder.restartRuntime.useMutation();
  const runtimeRebuildMutation = trpc.liveBuilder.rebuildRuntime.useMutation();
  const runnerStatusQuery = trpc.liveBuilder.runnerStatus.useQuery(undefined, { enabled: protectedQueryEnabled, retry: false, refetchInterval: 10_000 });
  const validateMutation = trpc.liveBuilder.validate.useMutation();
  const deploymentMutation = trpc.liveBuilder.requestDeployment.useMutation();
  const restoreMutation = trpc.liveBuilder.restoreVersion.useMutation();

  const [prompt, setPrompt] = useState("");
  const [target, setTarget] = useState<PreviewTarget>("desktop");
  const [code, setCode] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const workspaces = useMemo(() => workspaceList.data?.data ?? [], [workspaceList.data?.data]);
  const workspace = workspaceQuery.data?.data ?? null;
  const files = useMemo(() => workspace?.files ?? [], [workspace?.files]);
  const changeSets = useMemo(() => workspace?.changes ?? [], [workspace?.changes]);
  const versions = useMemo(() => workspace?.versions ?? [], [workspace?.versions]);
  const selectedElement = workspace?.selectedElement ?? null;
  const preview = workspace?.preview ?? null;
  const runtimes = useMemo(() => runtimeListQuery.data?.data ?? [], [runtimeListQuery.data?.data]);
  const activeRuntime = runtimes[0] ?? null;
  const runtimeEvents = useMemo(() => runtimeEventsQuery.data?.data ?? [], [runtimeEventsQuery.data?.data]);
  const latestPendingChange = changeSets.find((change: { status: string }) => ["proposed", "review", "awaiting_approval"].includes(change.status)) ?? null;
  const checksForValidation = (value: unknown) => Array.isArray(value)
    ? value.filter((check): check is { name: string; status: string; details: string } => Boolean(check && typeof check === "object" && typeof (check as Record<string, unknown>).name === "string" && typeof (check as Record<string, unknown>).status === "string" && typeof (check as Record<string, unknown>).details === "string")).slice(0, 6)
    : [];

  const activeFile = useMemo(() => files.find((file: { path: string }) => file.path === selectedFilePath) ?? files.find((file: { path: string }) => file.path === "preview.manifest.json") ?? files[0], [files, selectedFilePath]);

  useEffect(() => {
    if (requestedWorkspaceId && requestedWorkspaceId !== workspaceId) setWorkspaceId(requestedWorkspaceId);
    if (!workspaceId && workspaces[0]?.id) setWorkspaceId(workspaces[0].id);
  }, [requestedWorkspaceId, workspaceId, workspaces]);

  useEffect(() => {
    if (activeFile?.content) setCode(activeFile.content);
  }, [activeFile?.content]);

  if (authLoading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-foreground text-base">Checking your Geminio OS session…</Text>
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <View className="max-w-md w-full rounded-3xl border border-border bg-surface p-6 gap-3">
          <Text className="text-2xl font-semibold text-foreground">Sign in to use Live Builder</Text>
          <Text className="text-sm text-muted leading-6">Live project files, runtime sessions, and validation records are protected by your Geminio OS account.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const refresh = async () => {
    await Promise.all([
      utils.liveBuilder.list.invalidate(),
      workspaceId ? utils.liveBuilder.get.invalidate({ workspaceId }) : Promise.resolve(),
      workspaceId ? utils.liveBuilder.listRuntimes.invalidate({ workspaceId }) : Promise.resolve(),
    ]);
  };

  const handleCreate = async () => {
    setMessage(null);
    try {
      const result = await createMutation.mutateAsync({
        name: "New Live Project",
        description: "Created in the Geminio OS Live Builder workspace",
        kind: "website",
        existingProjectId: null,
      });
      if (!result.data) throw new Error("Workspace creation returned no durable record.");
      setWorkspaceId(result.data.id);
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create workspace.");
    }
  };

  const handlePrompt = async () => {
    if (!workspaceId || !prompt.trim()) return;
    setMessage("AI is inspecting the workspace and preparing a scoped change set…");
    try {
      await proposeMutation.mutateAsync({
        workspaceId,
        prompt: prompt.trim(),
        selectedElement,
      });
      setPrompt("");
      await refresh();
      setMessage("Change set proposed. Review it before applying to the live preview.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The AI edit could not be prepared.");
    }
  };

  const handleProposeFileChange = async () => {
    if (!workspaceId || !activeFile?.path || !activeFile.content || code === activeFile.content) return;
    setMessage(`Preparing a reviewed change for ${activeFile.path}…`);
    try {
      await proposeFileMutation.mutateAsync({ workspaceId, filePath: activeFile.path, content: code, summary: `Edit ${activeFile.path}` });
      await refresh();
      setMessage("File change proposed. Approve it in Review & History before it reaches the workspace.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The file change could not be prepared.");
    }
  };

  const handleApply = async () => {
    if (!workspaceId || !latestPendingChange) return;
    setMessage("Applying the approved change set and refreshing the controlled preview…");
    try {
      await applyMutation.mutateAsync({ workspaceId, changeSetId: latestPendingChange.id });
      await refresh();
      setMessage("Change applied. The preview now reflects the approved project version.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The change set could not be applied.");
    }
  };

  const handlePreview = async () => {
    if (!workspaceId) return;
    setMessage(`Starting the isolated ${target} preview boundary…`);
    try {
      await previewMutation.mutateAsync({ workspaceId, target, engine: "controlled_canvas" });
      await runtimeStartMutation.mutateAsync({ workspaceId, target, engine: "controlled_canvas", versionId: versions[0]?.id ?? null });
      await refresh();
      setMessage(`Controlled ${target} preview refreshed. Executable runtime status is shown below.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview runtime could not be started.");
    }
  };

  const handleRuntimeRestart = async () => {
    if (!activeRuntime?.id) return;
    setMessage("Restarting the isolated project runtime…");
    try {
      await runtimeRestartMutation.mutateAsync({ sessionId: activeRuntime.id });
      await refresh();
      setMessage("Runtime restart requested. Diagnostics will update automatically.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Runtime restart could not be requested.");
    }
  };

  const handleRuntimeRebuild = async () => {
    if (!activeRuntime?.id) return;
    setMessage("Rebuilding the current persisted project version…");
    try {
      await runtimeRebuildMutation.mutateAsync({ sessionId: activeRuntime.id });
      await refresh();
      setMessage("Rebuild completed or was safely blocked by the configured runner. Diagnostics are available below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project rebuild could not be requested.");
    }
  };

  const handleRuntimeStop = async () => {
    if (!activeRuntime?.id) return;
    setMessage("Stopping the isolated project runtime…");
    try {
      await runtimeStopMutation.mutateAsync({ sessionId: activeRuntime.id });
      await refresh();
      setMessage("Runtime stopped safely. The controlled preview remains available.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Runtime could not be stopped.");
    }
  };

  const handleValidate = async () => {
    if (!workspaceId) return;
    setMessage("Running responsive, document, and project validation checks…");
    try {
      const result = await validateMutation.mutateAsync({ workspaceId, target, changeSetId: latestPendingChange?.id ?? null });
      await refresh();
      setMessage(result.data?.status === "passed" ? "Validation passed for the selected preview target." : "Validation completed with review findings.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Validation could not be completed.");
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!workspaceId) return;
    setMessage("Restoring the selected project version and refreshing the preview…");
    try {
      await restoreMutation.mutateAsync({ workspaceId, versionId });
      await refresh();
      setMessage("Version restored. Review the refreshed preview before making another change.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The selected version could not be restored.");
    }
  };

  const handleDeploymentReview = async () => {
    if (!workspaceId || !versions[0]?.id) return;
    try {
      await deploymentMutation.mutateAsync({ workspaceId, versionId: versions[0].id, releaseNotes: "Reviewed from Live Builder" });
      await refresh();
      setMessage("Deployment review requested. No external deployment was claimed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deployment review could not be requested.");
    }
  };

  const handleSelectElement = async (element: { elementId: string; label: string; filePath: string; componentName: string | null; properties: Record<string, unknown> }) => {
    if (!workspaceId) return;
    try {
      await selectMutation.mutateAsync({ workspaceId, selection: element });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Element selection could not be saved.");
    }
  };

  return (
    <ScreenContainer className="p-0">
      <View className={isCompact ? "flex-1 flex-col" : "flex-1 flex-row"}>
        <View className={isCompact ? "w-full max-h-40 bg-surface border-b border-border p-3 gap-2" : "w-1/4 bg-surface border-r border-border p-4 gap-4"}>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Projects</Text>
            <Pressable onPress={handleCreate} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="bg-primary rounded-lg px-3 py-2">
              <Text className="text-white font-semibold text-xs">New</Text>
            </Pressable>
          </View>
          <ScrollView>
            {workspaces.map((item: { id: string; projectId: string; kind: string; updatedAt: string | Date }) => (
              <Pressable key={item.id} onPress={() => setWorkspaceId(item.id)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className={`rounded-lg p-3 mb-2 border ${workspaceId === item.id ? "bg-primary/20 border-primary" : "bg-surface border-border"}`}>
                <Text className={`font-semibold ${workspaceId === item.id ? "text-primary" : "text-foreground"}`}>Project {item.projectId.slice(0, 8)}</Text>
                <Text className="text-xs text-muted">{item.kind} · {formatDate(item.updatedAt)}</Text>
              </Pressable>
            ))}
            {workspaces.length === 0 && <Text className="text-xs text-muted">Create a workspace to begin a durable live build.</Text>}
          </ScrollView>
        </View>

        <View className="flex-1 flex-col">
          <View className="bg-surface border-b border-border px-6 py-4 gap-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-bold text-foreground">{workspace ? `Project ${workspace.projectId.slice(0, 8)}` : "Live Build Studio"}</Text>
                <Text className="text-xs text-muted">{workspace ? `${workspace.kind} · version ${versions[0]?.number ?? "draft"}` : "Persistent AI development workspace"}</Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable onPress={handleValidate} disabled={!workspaceId || validateMutation.isPending} style={({ pressed }) => [{ opacity: pressed || validateMutation.isPending ? 0.6 : 1 }]} className="bg-primary/20 rounded-lg px-3 py-2"><Text className="text-primary font-semibold text-sm">Test</Text></Pressable>
                <Pressable onPress={handleDeploymentReview} disabled={!versions[0]?.id} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="bg-success rounded-lg px-3 py-2"><Text className="text-white font-semibold text-sm">Review Deploy</Text></Pressable>
              </View>
            </View>
            <View className="flex-row gap-2">
              <TextInput value={prompt} onChangeText={setPrompt} onSubmitEditing={handlePrompt} returnKeyType="send" placeholder="Ask AI to build, change, fix, remove, move, or make the selected element responsive…" placeholderTextColor="#8A8F98" className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground" />
              <Pressable onPress={handlePrompt} disabled={!workspaceId || proposeMutation.isPending} style={({ pressed }) => [{ opacity: pressed || proposeMutation.isPending ? 0.6 : 1 }]} className="bg-primary rounded-lg px-4 py-2 justify-center"><Text className="text-white font-semibold">{proposeMutation.isPending ? "Planning…" : "Ask AI"}</Text></Pressable>
            </View>
            {message && <Text className="text-xs text-muted">{message}</Text>}
          </View>

          <View className={isCompact ? "flex-1 flex-col" : "flex-1 flex-row"}>
            <View className={isCompact ? "w-full min-h-96 border-b border-border p-3 gap-2" : "flex-1 border-r border-border p-4 gap-2"}>
              <View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-foreground">Project Files</Text><Text className="text-xs text-muted">{files.length} files</Text></View>
              <ScrollView className="max-h-28">{files.map((file: { path: string; kind: string; status: string }) => <Pressable key={file.path} onPress={() => setSelectedFilePath(file.path)} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]} className={`rounded-md px-2 py-1 ${activeFile?.path === file.path ? "bg-primary/15" : ""}`}><Text className={`text-xs py-1 ${activeFile?.path === file.path ? "text-primary" : "text-muted"}`}>{file.status === "active" ? "▸" : "·"} {file.path} · {file.kind}</Text></Pressable>)}</ScrollView>
              <View className="flex-row items-center justify-between"><View><Text className="text-sm font-semibold text-foreground">Code Editor</Text><Text className="text-xs text-muted">{activeFile?.path ?? "No editable file selected"}</Text></View><Pressable onPress={handleProposeFileChange} disabled={!activeFile?.content || code === activeFile.content || proposeFileMutation.isPending} style={({ pressed }) => [{ opacity: pressed || proposeFileMutation.isPending ? 0.6 : 1 }]} className="bg-primary/20 rounded-lg px-3 py-2"><Text className="text-primary text-xs font-semibold">{proposeFileMutation.isPending ? "Planning…" : "Propose File Edit"}</Text></Pressable></View>
              <View className="flex-1 bg-black rounded-lg p-3 border border-border"><TextInput value={code} onChangeText={setCode} multiline editable={Boolean(activeFile?.content)} textAlignVertical="top" style={{ color: "#00ff00", fontFamily: "monospace", fontSize: 12 }} className="flex-1" /></View>
            </View>

            <View className={isCompact ? "w-full flex-col" : "flex-1 flex-col border-l border-border"}>
              <View className="p-4 gap-3 border-b border-border">
                <View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-foreground">Live Preview</Text><View className="flex-row gap-2"><Pressable onPress={handleRuntimeRebuild} disabled={!activeRuntime?.id || runtimeRebuildMutation.isPending} style={({ pressed }) => [{ opacity: pressed || runtimeRebuildMutation.isPending ? 0.6 : 1 }]} className="bg-primary/15 rounded-lg px-3 py-2"><Text className="text-primary text-xs font-semibold">{runtimeRebuildMutation.isPending ? "Rebuilding…" : "Rebuild"}</Text></Pressable><Pressable onPress={handleRuntimeRestart} disabled={!activeRuntime?.id || runtimeRestartMutation.isPending} style={({ pressed }) => [{ opacity: pressed || runtimeRestartMutation.isPending ? 0.6 : 1 }]} className="bg-warning/15 rounded-lg px-3 py-2"><Text className="text-warning text-xs font-semibold">Restart</Text></Pressable><Pressable onPress={handleRuntimeStop} disabled={!activeRuntime?.id || runtimeStopMutation.isPending} style={({ pressed }) => [{ opacity: pressed || runtimeStopMutation.isPending ? 0.6 : 1 }]} className="bg-error/15 rounded-lg px-3 py-2"><Text className="text-error text-xs font-semibold">Stop</Text></Pressable><Pressable onPress={handlePreview} disabled={!workspaceId || previewMutation.isPending || runtimeStartMutation.isPending} style={({ pressed }) => [{ opacity: pressed || previewMutation.isPending || runtimeStartMutation.isPending ? 0.6 : 1 }]} className="bg-primary/20 rounded-lg px-3 py-2"><Text className="text-primary text-xs font-semibold">{runtimeStartMutation.isPending ? "Starting…" : "Run"}</Text></Pressable></View></View>
                <View className="flex-row gap-2">{TARGETS.map((item) => <Pressable key={item.value} onPress={() => setTarget(item.value)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className={`rounded-lg px-3 py-2 border ${target === item.value ? "bg-primary border-primary" : "bg-surface border-border"}`}><Text className={`text-xs font-semibold ${target === item.value ? "text-white" : "text-muted"}`}>{item.label}</Text></Pressable>)}</View>
                <View className="flex-1 min-h-48 bg-surface rounded-lg p-4 border border-border gap-2">
                  <Text className="text-xs text-muted">{preview ? `${preview.route} · ${target} controlled canvas` : "No controlled preview started yet."}</Text>
                  <View className="rounded-lg border border-border bg-background p-3 gap-1"><Text className="text-xs font-semibold text-foreground">Sandbox runtime · {activeRuntime?.status ?? "not started"}</Text><Text className="text-[11px] text-muted">{activeRuntime?.engine === "external_runner" ? "Executable runner is provider-bound and unavailable until an isolated runner is configured." : activeRuntime?.engine === "controlled_canvas" ? "Controlled declarative preview is active; project code is not executed in the main application process." : "Start Run to create an isolated preview session."}</Text><Text className="text-[11px] text-muted">Preview gateway: {activeRuntime?.status === "ready" ? "authenticated session created" : activeRuntime?.status === "failed" ? "unavailable; retry is safe" : "waiting for runtime"}</Text><Text className="text-[11px] text-muted">External provider: {runnerStatusQuery.data?.data.providers.container.configured ? "configured" : "not configured"}</Text>{activeRuntime?.lastError ? <Text className="text-[11px] text-error">{activeRuntime.lastError}</Text> : null}</View>
                  {(preview?.nodes ?? []).map((component: { id: string; label: string; filePath: string; componentName: string | null; properties: Record<string, unknown> }) => <Pressable key={component.id} onPress={() => handleSelectElement({ elementId: component.id, label: component.label, filePath: component.filePath, componentName: component.componentName, properties: component.properties })} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]} className={`rounded-lg border p-3 ${selectedElement?.elementId === component.id ? "border-primary bg-primary/10" : "border-border bg-background"}`}><Text className="text-sm font-semibold text-foreground">{component.label}</Text><Text className="text-xs text-muted">{component.componentName ?? "Component"} · {component.filePath}</Text></Pressable>)}
                  {runtimeEvents.slice(-6).reverse().map((event: { id: string; type: string; message: string; createdAt: string | Date }) => <View key={event.id} className="rounded-lg border border-border bg-background p-2"><Text className="text-[11px] font-semibold text-foreground">{event.type}</Text><Text className="text-[11px] text-muted">{event.message} · {formatDate(event.createdAt)}</Text></View>)}
                </View>
              </View>

              <View className="flex-1 p-4 gap-3">
                <View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-foreground">Review & History</Text><Text className="text-xs text-muted">{changeSets.length} changes · {versions.length} versions</Text></View>
                {latestPendingChange && <View className="bg-warning/10 border border-warning rounded-lg p-3 gap-2"><Text className="text-sm font-semibold text-foreground">{latestPendingChange.summary}</Text><Text className="text-xs text-muted">{latestPendingChange.patches?.length ?? 0} scoped file patches · {latestPendingChange.status}</Text><Pressable onPress={handleApply} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]} className="bg-primary rounded-lg px-3 py-2 self-start"><Text className="text-white text-xs font-semibold">Approve & Apply</Text></Pressable></View>}
                <ScrollView>
                  {versions.map((version: { id: string; number: number; label: string; createdAt: string | Date }) => <View key={version.id} className="bg-surface rounded-lg p-3 mb-2 border border-border gap-2"><View className="flex-row items-center justify-between"><View><Text className="text-sm font-semibold text-foreground">v{version.number} · {version.label}</Text><Text className="text-xs text-muted">{formatDate(version.createdAt)}</Text></View><Pressable onPress={() => handleRestore(version.id)} disabled={restoreMutation.isPending} style={({ pressed }) => [{ opacity: pressed || restoreMutation.isPending ? 0.6 : 1 }]} className="bg-primary/20 rounded-lg px-2 py-1"><Text className="text-primary text-xs font-semibold">Restore</Text></Pressable></View></View>)}
                  {(workspace?.validations ?? []).slice(0, 4).map((validation: { id: string; target: string; status: string; logSummary: string | null; checks: unknown; createdAt: string | Date }) => <View key={validation.id} className="bg-surface rounded-lg p-3 mb-2 border border-border gap-1"><Text className="text-xs font-semibold text-foreground">Validation · {validation.target} · {validation.status}</Text><Text className="text-xs text-muted">{validation.logSummary ?? formatDate(validation.createdAt)}</Text>{checksForValidation(validation.checks).map((check) => <Text key={`${validation.id}-${check.name}`} className="text-[11px] text-muted">{check.status === "passed" ? "✓" : check.status === "blocked" ? "·" : "!"} {check.name}: {check.details}</Text>)}</View>)}
                  {(workspace?.previewSessions ?? []).slice(0, 3).map((session: { id: string; target: string; engine: string; status: string; error: string | null; updatedAt: string | Date }) => <View key={session.id} className="bg-surface rounded-lg p-3 mb-2 border border-border"><Text className="text-xs font-semibold text-foreground">Preview · {session.target} · {session.status}</Text><Text className="text-xs text-muted">Engine: {session.engine}{session.error ? ` · ${session.error}` : ""} · {formatDate(session.updatedAt)}</Text></View>)}
                  {(workspace?.deployments ?? []).slice(0, 3).map((deployment: { id: string; status: string; provider: string | null; updatedAt: string | Date }) => <View key={deployment.id} className="bg-surface rounded-lg p-3 mb-2 border border-border"><Text className="text-xs font-semibold text-foreground">Deployment review · {deployment.status}</Text><Text className="text-xs text-muted">Provider boundary: {deployment.provider ?? "not connected"} · Approval is required before any external deployment. · {formatDate(deployment.updatedAt)}</Text></View>)}
                  {!latestPendingChange && versions.length === 0 && (workspace?.validations ?? []).length === 0 && <Text className="text-xs text-muted text-center mt-4">AI-proposed changes, validation results, and versions will appear here.</Text>}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
