"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface RealtimeSyncPayload {
  source?: string;
  table?: string;
  eventType?: string;
  url?: string;
  method?: string;
  facultyId?: string;
  classId?: string | null;
  requirementCode?: string;
  timestamp: number;
}

type RealtimeListener = (payload: RealtimeSyncPayload) => void;

const CHANNEL_NAME = "pup-focus-live-sync";
const LOCAL_EVENT_NAME = "pup-focus:realtime-sync";

const listeners = new Set<RealtimeListener>();
let activeSupabaseChannel: any = null;
let isSupabaseSubscribed = false;
let pendingBroadcastPayloads: RealtimeSyncPayload[] = [];
let localBroadcastChannel: BroadcastChannel | null = null;
let isFetchHookInstalled = false;

function notifyListeners(payload: RealtimeSyncPayload) {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (err) {
      console.warn("Realtime listener error:", err);
    }
  });
}

function shouldBroadcastApiMutation(urlStr: string, method: string): boolean {
  const upperMethod = method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(upperMethod)) {
    return false;
  }
  if (!urlStr.includes("/api/")) {
    return false;
  }
  if (
    urlStr.includes("/api/auth/session") ||
    urlStr.includes("/api/auth/login-lookup") ||
    urlStr.includes("/api/faculty/submissions/upload-url")
  ) {
    return false;
  }
  return true;
}

function installFetchMutationInterceptor() {
  if (typeof window === "undefined" || isFetchHookInstalled) return;
  isFetchHookInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);

    try {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input?.url || "";
      const method =
        init?.method ||
        (typeof input === "object" && "method" in input ? input.method : "GET") ||
        "GET";

      if (response.ok && shouldBroadcastApiMutation(urlStr, method)) {
        emitRealtimeSync({
          source: "api-mutation",
          url: urlStr,
          method: method.toUpperCase(),
          timestamp: Date.now(),
        });
      }
    } catch {
      // Never block or break fetch response
    }

    return response;
  };
}

function ensureRealtimeInitialized() {
  if (typeof window === "undefined") return;

  installFetchMutationInterceptor();

  if (!localBroadcastChannel && typeof BroadcastChannel !== "undefined") {
    try {
      localBroadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      localBroadcastChannel.onmessage = (event) => {
        if (event?.data) {
          notifyListeners(event.data as RealtimeSyncPayload);
        }
      };
    } catch {
      // BroadcastChannel not supported
    }
  }

  if (!activeSupabaseChannel) {
    try {
      const supabase = createClient() as any;
      if (typeof supabase?.channel === "function") {
        const channel = supabase.channel(CHANNEL_NAME, {
          config: {
            broadcast: { self: false, ack: false },
          },
        });

        channel
          .on("broadcast", { event: "sync" }, (msg: { payload?: RealtimeSyncPayload }) => {
            notifyListeners(
              msg?.payload || {
                source: "broadcast",
                timestamp: Date.now(),
              },
            );
          })
          .on(
            "postgres_changes",
            { event: "*", schema: "public" },
            (change: { table?: string; eventType?: string; new?: any; old?: any }) => {
              const record = change?.new || change?.old || {};
              notifyListeners({
                source: "postgres_changes",
                table: change?.table,
                eventType: change?.eventType,
                facultyId: record.faculty_profile_id || record.profile_id || record.id,
                classId: record.class_id || null,
                timestamp: Date.now(),
              });
            },
          )
          .subscribe((status: string) => {
            isSupabaseSubscribed = status === "SUBSCRIBED";
            if (isSupabaseSubscribed && pendingBroadcastPayloads.length > 0) {
              const queued = [...pendingBroadcastPayloads];
              pendingBroadcastPayloads = [];
              for (const item of queued) {
                try {
                  void channel.send({
                    type: "broadcast",
                    event: "sync",
                    payload: item,
                  });
                } catch {
                  // Ignore send error
                }
              }
            }
          });

        activeSupabaseChannel = channel;
      }
    } catch (err) {
      console.warn("Failed to initialize Supabase realtime channel:", err);
    }
  }
}

export function emitRealtimeSync(partial?: Partial<RealtimeSyncPayload>) {
  if (typeof window === "undefined") return;
  ensureRealtimeInitialized();

  const payload: RealtimeSyncPayload = {
    source: "manual",
    ...partial,
    timestamp: partial?.timestamp || Date.now(),
  };

  // 1. Notify same-tab listeners
  notifyListeners(payload);

  // 2. Notify other tabs in the same browser
  try {
    localBroadcastChannel?.postMessage(payload);
  } catch {
    // Ignore
  }

  // 3. Notify all other connected browsers/accounts (Admin, Staff, Faculty) via Supabase Realtime Broadcast
  if (activeSupabaseChannel) {
    if (isSupabaseSubscribed) {
      try {
        void activeSupabaseChannel.send({
          type: "broadcast",
          event: "sync",
          payload,
        });
      } catch {
        // Ignore
      }
    } else if (typeof activeSupabaseChannel.httpSend === "function") {
      try {
        void activeSupabaseChannel.httpSend("sync", payload).catch(() => {});
      } catch {
        pendingBroadcastPayloads.push(payload);
      }
    } else {
      pendingBroadcastPayloads.push(payload);
    }
  }
}

export function useRealtimeSync(
  onSync: (payload: RealtimeSyncPayload) => void,
  debounceMs = 250,
) {
  const callbackRef = useRef(onSync);
  callbackRef.current = onSync;

  useEffect(() => {
    if (typeof window === "undefined") return;
    ensureRealtimeInitialized();

    let timer: ReturnType<typeof setTimeout> | null = null;
    let latestPayload: RealtimeSyncPayload | null = null;

    const handlePayload = (payload: RealtimeSyncPayload) => {
      latestPayload = payload;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (latestPayload) {
          callbackRef.current(latestPayload);
        }
      }, debounceMs);
    };

    const handleCustomWindowEvent = (e: Event) => {
      const custom = e as CustomEvent<RealtimeSyncPayload>;
      handlePayload(custom.detail || { source: "window-event", timestamp: Date.now() });
    };

    const handleOnline = () => {
      handlePayload({ source: "online", timestamp: Date.now() });
    };

    listeners.add(handlePayload);
    window.addEventListener(LOCAL_EVENT_NAME, handleCustomWindowEvent);
    window.addEventListener("online", handleOnline);

    return () => {
      listeners.delete(handlePayload);
      window.removeEventListener(LOCAL_EVENT_NAME, handleCustomWindowEvent);
      window.removeEventListener("online", handleOnline);
      if (timer) clearTimeout(timer);
    };
  }, [debounceMs]);
}

