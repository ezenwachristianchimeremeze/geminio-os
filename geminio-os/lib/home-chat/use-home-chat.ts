/**
 * Home chat controller hook. All state that matters (conversation, messages, run status, credits) comes from the
 * server; this hook only holds UI state machines (turn / voice / speech) that are driven by real events.
 * UNVERIFIED AT RUNTIME: written without Expo/React Native installed in the build sandbox.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { needsWebSearch } from "../../shared/home-chat-intents";
import { trpc } from "../trpc";
import { toSpeechText } from "./markdown";
import { pickDocument, pickImage, PickError, type Picked } from "./pick";
import { copyText, createRecorder, createTts, isRecordingSupported, RecorderError, type Recorder, type Tts } from "./platform";
import { elapsedMs, eventFromOutcome, initialVoice, isTooLong, isTooShort, voiceReducer } from "./recorder-machine";
import { initialSpeech, speechReducer } from "./speech-machine";
import { isBusy, statusLabel, turnReducer, type SearchReport } from "./turn-machine";

export type WebMode = "auto" | "on" | "off";
export type ModuleHint = { module: string; label: string; route: string; executable: boolean; note?: string } | null;

function errorCode(e: unknown): "INSUFFICIENT_CREDITS" | "UNAUTHENTICATED" | "OTHER" {
  const code = (e as { data?: { code?: string } })?.data?.code;
  return code === "PRECONDITION_FAILED" ? "INSUFFICIENT_CREDITS" : code === "UNAUTHORIZED" ? "UNAUTHENTICATED" : "OTHER";
}
const errMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export function useHomeChat() {
  const utils = trpc.useUtils();
  const config = trpc.homeChat.config.useQuery(undefined, { staleTime: 60_000 });
  const balance = trpc.homeChat.balance.useQuery(undefined, { staleTime: 5_000 });

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [temporary, setTemporary] = useState(false);
  const [webMode, setWebMode] = useState<WebMode>("auto");
  const planTypes = trpc.homeChat.planTypes.useQuery(undefined, { staleTime: 300_000 });
  const [planType, setPlanType] = useState<string | null>(null);
  type PreviewOk = { ok: true; understood: string; planType: string | null; steps: { title: string; role: string }[]; usesWebSearch: boolean; estimatedCredits: number; available: number | null; canAfford: boolean | null };
  const [preview, setPreview] = useState<{ message: string; type: string; roleIds: string[] | null; data: PreviewOk | { ok: false; problems: string[] } } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [contextSel, setContextSel] = useState<{ historyMode: "conversation" | "message_only"; conversationIds: string[]; workspaceId: string | null }>({ historyMode: "conversation", conversationIds: [], workspaceId: null });
  const [lastContext, setLastContext] = useState<{ conversations: { title: string; messages: number }[]; workspaceFiles: { path: string }[]; secretFilesExcluded: number; omittedFiles: number } | null>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [moduleHint, setModuleHint] = useState<ModuleHint>(null);
  const [searchReport, setSearchReport] = useState<SearchReport>({ attempted: false });
  const [notice, setNotice] = useState<string | null>(null);

  const [turn, dispatchTurn] = useReducer(turnReducer, { s: "idle" });
  const [voice, dispatchVoice] = useReducer(voiceReducer, initialVoice);
  const [speech, dispatchSpeech] = useReducer(speechReducer, initialSpeech);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const send = trpc.homeChat.send.useMutation();
  const regenerate = trpc.homeChat.regenerate.useMutation();
  const edit = trpc.homeChat.messages.edit.useMutation();
  const stop = trpc.homeChat.stop.useMutation();
  const pauseMut = trpc.homeChat.tasks.pause.useMutation();
  const resumeMut = trpc.homeChat.tasks.resume.useMutation();
  const transcribe = trpc.homeChat.transcribe.useMutation();
  const feedback = trpc.homeChat.messages.feedback.useMutation();
  const upload = trpc.homeChat.uploadAttachment.useMutation();
  const variantMut = trpc.homeChat.messages.selectVariant.useMutation();
  const [attachments, setAttachments] = useState<{ id: string; name: string; kind: string; sizeBytes: number }[]>([]);
  const [uploading, setUploading] = useState(false);

  const conversation = trpc.homeChat.conversations.get.useQuery({ id: conversationId ?? "none" }, { enabled: Boolean(conversationId), retry: false });
  const history = trpc.homeChat.conversations.list.useQuery({ archived: false, limit: 50 }, { staleTime: 10_000 });

  const runId = turn.s === "running" || turn.s === "stopping" || turn.s === "paused" ? turn.runId : null;
  const runQuery = trpc.homeChat.run.useQuery({ runId: runId ?? "none" }, { enabled: Boolean(runId), refetchInterval: (q: { state: { data?: { streaming?: boolean } } }) => (q.state.data?.streaming ? 700 : 1200), retry: 2 });

  // Drive the turn machine ONLY from real poll results.
  useEffect(() => {
    const d = runQuery.data;
    if (!d || !runId || d.runId !== runId) return;
    dispatchTurn({ type: "POLL", status: d.status, steps: d.steps, error: d.error });
    if (d.terminal) {
      void utils.homeChat.conversations.get.invalidate(); void utils.homeChat.conversations.list.invalidate(); void balance.refetch();
      setPendingUser(null);
    }
  }, [runQuery.data, runId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (runQuery.error && runId) dispatchTurn({ type: "POLL", status: "failed", steps: [], error: { message: errMessage(runQuery.error), retryable: true } }); }, [runQuery.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const ttsRef = useRef<Tts | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  if (!ttsRef.current) ttsRef.current = createTts();
  useEffect(() => () => { ttsRef.current?.stop(); recorderRef.current?.cancel(); }, []);
  useEffect(() => { if (voice.s !== "recording") return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [voice.s]);

  const startNew = useCallback((opts?: { temporary?: boolean }) => {
    ttsRef.current?.stop(); dispatchSpeech({ type: "STOP" }); recorderRef.current?.cancel(); dispatchVoice({ type: "CANCEL" });
    dispatchTurn({ type: "RESET" }); setAttachments([]); setLastContext(null); setConversationId(null); setPendingUser(null); setModuleHint(null); setSearchReport({ attempted: false }); setDraft(""); setNotice(null);
    setTemporary(Boolean(opts?.temporary));
  }, []);
  const openConversation = useCallback((id: string) => { startNew(); setConversationId(id); }, [startNew]);

  const accept = (r: { runId: string; conversationId: string; search: SearchReport; moduleHint: ModuleHint; contextSummary?: { conversations: { title: string; messages: number }[]; workspaceFiles: { path: string }[]; secretFilesExcluded: number; omittedFiles: number } }) => {
    setLastContext(r.contextSummary && (r.contextSummary.conversations.length || r.contextSummary.workspaceFiles.length) ? r.contextSummary : null);
    setConversationId(r.conversationId); setSearchReport(r.search); setModuleHint(r.moduleHint);
    dispatchTurn({ type: "ACCEPTED", runId: r.runId, search: r.search });
    void utils.homeChat.conversations.get.invalidate();
  };
  const fail = (e: unknown) => { dispatchTurn({ type: "SEND_FAILED", message: errMessage(e), code: errorCode(e) }); setPendingUser(null); void balance.refetch(); };

  const sendMessage = useCallback(async (text?: string, plan?: { type: string; roleIds?: string[] }) => {
    const message = (text ?? draft).trim();
    if (!message || isBusy(turn) || uploading) return false;
    dispatchTurn({ type: "SEND", predictedSearch: needsWebSearch(message, webMode) });
    setPendingUser(message); setDraft(""); setNotice(null);
    try {
      accept(await send.mutateAsync({ message, conversationId, webSearch: webMode, temporary, plan: plan ?? null, context: contextSel, attachmentIds: attachments.map((a) => a.id), clientRequestId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}` }) as never);
      setAttachments([]);
      return true;
    } catch (e) { fail(e); setDraft(message); return false; }
  }, [draft, turn, webMode, conversationId, temporary, attachments, uploading, contextSel]); // eslint-disable-line react-hooks/exhaustive-deps

  /** A plan mode first shows the plan and its server-computed cost; nothing runs until the user approves. */
  const loadPreview = useCallback(async (message: string, type: string, roleIds: string[] | null) => {
    setPreviewing(true); setNotice(null);
    try { setPreview({ message, type, roleIds, data: (await utils.homeChat.preview.fetch({ message, plan: { type, roleIds: roleIds ?? undefined }, webSearch: webMode })) as never }); }
    catch (e) { setNotice(`Couldn't prepare the plan: ${errMessage(e)}`); }
    finally { setPreviewing(false); }
  }, [webMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const requestSend = useCallback(async (text?: string) => {
    const message = (text ?? draft).trim();
    if (!message || isBusy(turn) || uploading) return false;
    if (!planType) return sendMessage(message);
    await loadPreview(message, planType, null);
    return true;
  }, [draft, turn, uploading, planType, loadPreview, sendMessage]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Edit Plan: the edited step list is re-validated and re-priced by the server; the UI never decides what is allowed. */
  const editPlan = useCallback((roleIds: string[]) => { if (preview) void loadPreview(preview.message, preview.type, roleIds); }, [preview, loadPreview]);
  const approvePreview = useCallback(async () => {
    if (!preview || !preview.data.ok) return;
    const { message, type } = preview; const roleIds = preview.data.steps.map((x) => x.role);
    setPreview(null); await sendMessage(message, { type, roleIds });
  }, [preview, sendMessage]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancelPreview = useCallback(() => setPreview(null), []);


  const retryLast = useCallback(async () => {
    if (!conversationId || isBusy(turn)) return;
    dispatchTurn({ type: "SEND", predictedSearch: false });
    try { accept(await regenerate.mutateAsync({ conversationId, webSearch: webMode }) as never); } catch (e) { fail(e); }
  }, [conversationId, turn, webMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const editMessage = useCallback(async (messageId: string, content: string) => {
    if (isBusy(turn)) return;
    dispatchTurn({ type: "SEND", predictedSearch: needsWebSearch(content, webMode) });
    try { accept(await edit.mutateAsync({ messageId, content, webSearch: webMode }) as never); } catch (e) { fail(e); }
  }, [turn, webMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const pauseRun = useCallback(async () => {
    if (turn.s !== "running") return;
    try { await pauseMut.mutateAsync({ runId: turn.runId }); setNotice("Pause requested — the current step will finish first."); } catch (e) { setNotice(`Couldn't pause: ${errMessage(e)}`); }
  }, [turn]); // eslint-disable-line react-hooks/exhaustive-deps
  const resumeRun = useCallback(async () => {
    if (turn.s !== "paused") return;
    try { await resumeMut.mutateAsync({ runId: turn.runId }); dispatchTurn({ type: "RESUMED" }); } catch (e) { setNotice(`Couldn't resume: ${errMessage(e)}`); }
  }, [turn]); // eslint-disable-line react-hooks/exhaustive-deps
  const stopGeneration = useCallback(async () => {
    if (turn.s !== "running" && turn.s !== "paused") return;
    dispatchTurn({ type: "STOP" });
    try { await stop.mutateAsync({ runId: turn.runId }); dispatchTurn({ type: "STOPPED" }); void conversation.refetch(); void balance.refetch(); }
    catch (e) { setNotice(`Couldn't stop the request: ${errMessage(e)}`); }
  }, [turn]); // eslint-disable-line react-hooks/exhaustive-deps

  const attach = useCallback(async (source: "image" | "document") => {
    if (attachments.length >= 5) { setNotice("You can attach up to 5 files per message."); return; }
    let picked: Picked | null = null;
    try { picked = source === "image" ? await pickImage() : await pickDocument(); } catch (e) { setNotice(e instanceof PickError ? e.message : `Couldn't open the picker: ${errMessage(e)}`); return; }
    if (!picked) return;
    setUploading(true);
    try { const a = await upload.mutateAsync({ name: picked.name, mimeType: picked.mimeType, dataBase64: picked.dataBase64 }); setAttachments((x) => [...x, a]); }
    catch (e) { setNotice(`Upload failed: ${errMessage(e)}`); }
    finally { setUploading(false); }
  }, [attachments.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const removeAttachment = useCallback((id: string) => setAttachments((x) => x.filter((a) => a.id !== id)), []);

  // ---- feedback / copy / speech ----
  const setFeedback = useCallback(async (messageId: string, value: "up" | "down" | null, note?: string) => {
    try { await feedback.mutateAsync({ messageId, feedback: value, note: note ?? null }); await conversation.refetch(); } catch (e) { setNotice(`Feedback not saved: ${errMessage(e)}`); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const copy = useCallback(async (text: string, label = "Copied") => { setNotice((await copyText(text)) ? label : "Copy isn't available on this device."); }, []);

  const speak = useCallback((messageId: string, markdown: string, language?: string) => {
    const tts = ttsRef.current!;
    if (!tts.available) { dispatchSpeech({ type: "PLAY", messageId, total: 0 }); setNotice("Speech playback isn't supported here."); return; }
    const text = toSpeechText(markdown);
    const { chunks } = tts.speak(text, { language }, { onChunkDone: () => dispatchSpeech({ type: "CHUNK_DONE" }), onError: (m) => dispatchSpeech({ type: "ERROR", message: m }) });
    dispatchSpeech({ type: "PLAY", messageId, total: chunks });
  }, []);
  const pauseSpeech = useCallback(() => { ttsRef.current?.pause(); dispatchSpeech({ type: "PAUSE" }); }, []);
  const resumeSpeech = useCallback(() => { ttsRef.current?.resume(); dispatchSpeech({ type: "RESUME" }); }, []);
  const stopSpeech = useCallback(() => { ttsRef.current?.stop(); dispatchSpeech({ type: "STOP" }); }, []);

  // ---- voice input ----
  const micSupported = isRecordingSupported();
  const micAvailable = micSupported && config.data?.speechToText !== false;
  const startRecording = useCallback(async () => {
    if (!micSupported) { dispatchVoice({ type: "UNSUPPORTED" }); return; }
    if (config.data && !config.data.speechToText) { dispatchVoice({ type: "PRESS_MIC" }); dispatchVoice({ type: "PERMISSION_GRANTED", now: Date.now() }); dispatchVoice({ type: "STOP" }); dispatchVoice(eventFromOutcome({ status: "unavailable", reason: "Speech recognition isn't configured on this server. Type your message instead." })); return; }
    stopSpeech(); dispatchVoice({ type: "PRESS_MIC" });
    const rec = createRecorder(); recorderRef.current = rec;
    try { await rec.start(); dispatchVoice({ type: "PERMISSION_GRANTED", now: Date.now() }); }
    catch (e) {
      const kind = e instanceof RecorderError ? e.kind : "recording_failed";
      dispatchVoice(kind === "permission_denied" ? { type: "PERMISSION_DENIED" } : kind === "mic_unavailable" ? { type: "MIC_UNAVAILABLE" } : kind === "unsupported" ? { type: "UNSUPPORTED" } : { type: "RECORDING_ERROR", message: errMessage(e) });
      recorderRef.current = null;
    }
  }, [micSupported, config.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const pauseRecording = useCallback(() => { recorderRef.current?.pause(); dispatchVoice({ type: "PAUSE", now: Date.now() }); }, []);
  const resumeRecording = useCallback(() => { recorderRef.current?.resume(); dispatchVoice({ type: "RESUME", now: Date.now() }); }, []);
  const cancelRecording = useCallback(() => { recorderRef.current?.cancel(); recorderRef.current = null; dispatchVoice({ type: "CANCEL" }); }, []);
  const stopRecording = useCallback(async () => {
    const rec = recorderRef.current; if (!rec) return;
    dispatchVoice({ type: "STOP" }); recorderRef.current = null;
    try {
      const out = await rec.stop();
      if (isTooShort(out.durationMs)) { dispatchVoice(eventFromOutcome({ status: "invalid", code: "TOO_SMALL", reason: "That was too short to transcribe. Hold the microphone a little longer." })); return; }
      const o = await transcribe.mutateAsync({ audioBase64: out.base64, mimeType: out.mimeType });
      dispatchVoice(eventFromOutcome(o as never));
    } catch (e) {
      dispatchVoice(e instanceof RecorderError ? { type: "FAILED", error: "recording_failed", message: e.message, retryable: true } : { type: "FAILED", error: "network", message: `Couldn't reach the server to transcribe: ${errMessage(e)}`, retryable: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (voice.s === "recording" && isTooLong(elapsedMs(voice, now))) void stopRecording(); }, [now, voice, stopRecording]);
  /** Moves the reviewed transcript into the composer for editing. It is NEVER sent automatically. */
  const acceptTranscript = useCallback(() => { if (voice.s === "review") { setDraft((d) => (d ? `${d} ${voice.text}` : voice.text)); dispatchVoice({ type: "CANCEL" }); } }, [voice]);

  const streamingText = runId && runQuery.data?.runId === runId && runQuery.data.streaming ? runQuery.data.text : null;
  const allMessages = (conversation.data?.messages ?? []) as unknown as { id: string; role: string; active?: boolean; variantOf?: string | null; createdAt: Date | string }[];
  const messages = (allMessages as typeof allMessages).filter((m) => m.active !== false) as unknown as NonNullable<typeof conversation.data>["messages"];
  /** Alternates of an answer (regenerated replies to the same user message), oldest first. */
  const variantsFor = useCallback((id: string) => {
    const m = allMessages.find((x) => x.id === id);
    if (!m || m.role !== "assistant" || !m.variantOf) return null;
    const sib = allMessages.filter((x) => x.variantOf === m.variantOf).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    const i = sib.findIndex((x) => x.id === id);
    return { index: i + 1, total: sib.length, prevId: i > 0 ? sib[i - 1].id : null, nextId: i < sib.length - 1 ? sib[i + 1].id : null };
  }, [allMessages]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectVariant = useCallback(async (id: string) => { try { await variantMut.mutateAsync({ messageId: id }); await conversation.refetch(); } catch (e) { setNotice(`Couldn't switch response: ${errMessage(e)}`); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lastAssistantId = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant")?.id ?? null, [messages]);

  return {
    config: config.data, balance: balance.data, conversationId, conversation: conversation.data?.conversation ?? null, messages, lastAssistantId,
    conversationError: conversation.error ? errMessage(conversation.error) : null, loadingConversation: conversation.isLoading && Boolean(conversationId),
    history: history.data ?? [], refreshHistory: () => utils.homeChat.conversations.list.invalidate(),
    contextSel, setContextSel, lastContext, variantsFor, selectVariant, streamingText, pendingUser, turn, busy: isBusy(turn), status: statusLabel(turn), moduleHint, searchReport, notice, clearNotice: () => setNotice(null), setNotice,
    attachments, uploading, attach, removeAttachment,
    planTypes: planTypes.data ?? [], planType, setPlanType, preview, previewing, requestSend, editPlan, approvePreview, cancelPreview,
    draft, setDraft, webMode, setWebMode, temporary, setTemporary,
    startNew, openConversation, sendMessage, retryLast, editMessage, stopGeneration, setFeedback, copy,
    speech, speak, pauseSpeech, resumeSpeech, stopSpeech, canPauseSpeech: ttsRef.current?.canPause ?? false,
    voice, voiceElapsedMs: elapsedMs(voice, now), micSupported, micAvailable, startRecording, pauseRecording, resumeRecording, stopRecording, cancelRecording, acceptTranscript, dismissVoiceError: () => dispatchVoice({ type: "DISMISS" }),
  };
}
