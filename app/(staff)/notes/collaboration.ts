import * as Y from "yjs";
import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// Utility: Convert Uint8Array to Base64 string for JSON transport
export function uint8ArrayToBase64(arr: Uint8Array): string {
  if (typeof window === "undefined") return "";
  return btoa(Array.from(arr).map(c => String.fromCharCode(c)).join(""));
}

// Utility: Convert Base64 string back to Uint8Array
export function base64ToUint8Array(str: string): Uint8Array {
  if (typeof window === "undefined") return new Uint8Array(0);
  return new Uint8Array(atob(str).split("").map(c => c.charCodeAt(0)));
}

// Pure Utility: Get caret text selection character offset within a contenteditable element
export function getSelectionCharacterOffsetWithin(element: HTMLElement) {
  if (typeof window === "undefined") return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  
  try {
    const range = sel.getRangeAt(0);
    // Ensure the selection is actually inside our target editor element
    if (!element.contains(range.commonAncestorContainer)) return null;

    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;
    
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const end = preCaretRange.toString().length;
    
    return { start, end };
  } catch (e) {
    return null;
  }
}

// Pure Utility: Restore caret selection position from a character offset within a contenteditable element
export function setSelectionCharacterOffsetWithin(element: HTMLElement, offset: { start: number; end: number }) {
  if (typeof window === "undefined") return;
  const sel = window.getSelection();
  if (!sel) return;
  
  try {
    let charIndex = 0;
    const range = document.createRange();
    range.setStart(element, 0);
    range.collapse(true);
    
    const nodeQueue: Node[] = [element];
    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;
    
    while (nodeQueue.length > 0) {
      const node = nodeQueue.shift()!;
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharIndex = charIndex + node.textContent!.length;
        if (!startNode && offset.start >= charIndex && offset.start <= nextCharIndex) {
          startNode = node;
          startOffset = offset.start - charIndex;
        }
        if (!endNode && offset.end >= charIndex && offset.end <= nextCharIndex) {
          endNode = node;
          endOffset = offset.end - charIndex;
          break;
        }
        charIndex = nextCharIndex;
      } else {
        const childNodes = Array.from(node.childNodes);
        for (let i = childNodes.length - 1; i >= 0; i--) {
          nodeQueue.unshift(childNodes[i]);
        }
      }
    }
    
    if (startNode && endNode) {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } catch (e) {
    console.error("Failed to restore cursor position:", e);
  }
}

// Custom Yjs replication provider over Supabase Realtime Channels
export class SupabaseYjsProvider {
  doc: Y.Doc;
  supabase: SupabaseClient;
  channelName: string;
  channel: RealtimeChannel | null = null;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  onPresenceUpdate: (users: any[]) => void;
  onRemoteCursorUpdate: (cursors: any) => void;
  
  constructor(
    doc: Y.Doc,
    supabase: SupabaseClient,
    channelName: string,
    userId: string,
    userName: string,
    avatarUrl: string | null | undefined,
    onPresenceUpdate: (users: any[]) => void,
    onRemoteCursorUpdate: (cursors: any) => void
  ) {
    this.doc = doc;
    this.supabase = supabase;
    this.channelName = channelName;
    this.userId = userId;
    this.userName = userName;
    this.avatarUrl = avatarUrl;
    this.onPresenceUpdate = onPresenceUpdate;
    this.onRemoteCursorUpdate = onRemoteCursorUpdate;

    this.init();
  }

  init() {
    // 1. Setup Yjs doc change listener
    this.doc.on("update", this.handleDocUpdate);

    // 2. Subscribe to Supabase Realtime Channel
    this.channel = this.supabase.channel(this.channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: this.userId }
      }
    });

    // Handle sync and updates
    this.channel.on("broadcast", { event: "sync-step-1" }, ({ payload }) => {
      try {
        const stateVector = base64ToUint8Array(payload.stateVector);
        const update = Y.encodeStateAsUpdate(this.doc, stateVector);
        this.channel?.send({
          type: "broadcast",
          event: "sync-step-2",
          payload: { update: uint8ArrayToBase64(update) }
        });
      } catch (err) {
        console.error("Yjs sync-step-1 handler failed:", err);
      }
    });

    this.channel.on("broadcast", { event: "sync-step-2" }, ({ payload }) => {
      try {
        const update = base64ToUint8Array(payload.update);
        Y.applyUpdate(this.doc, update, this);
      } catch (err) {
        console.error("Yjs sync-step-2 handler failed:", err);
      }
    });

    this.channel.on("broadcast", { event: "update" }, ({ payload }) => {
      try {
        const update = base64ToUint8Array(payload.update);
        Y.applyUpdate(this.doc, update, this);
      } catch (err) {
        console.error("Yjs update handler failed:", err);
      }
    });

    this.channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      this.onRemoteCursorUpdate(payload);
    });

    // Track active users using Presence
    this.channel.on("presence", { event: "sync" }, () => {
      const state = this.channel?.presenceState();
      if (!state) return;
      const users = Object.values(state).flatMap((presenceList: any) => presenceList);
      this.onPresenceUpdate(users);
    });

    this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try {
          // Register presence
          await this.channel?.track({
            user_id: this.userId,
            name: this.userName,
            avatar_url: this.avatarUrl,
            online_at: new Date().toISOString()
          });

          // Sync request (Send current state vector)
          const stateVector = Y.encodeStateVector(this.doc);
          this.channel?.send({
            type: "broadcast",
            event: "sync-step-1",
            payload: { stateVector: uint8ArrayToBase64(stateVector) }
          });
        } catch (err) {
          console.error("Yjs subscription subscribe failed:", err);
        }
      }
    });
  }

  handleDocUpdate = (update: Uint8Array, origin: any) => {
    // If update originated from remote sync, don't re-broadcast it
    if (origin === this) return;

    try {
      this.channel?.send({
        type: "broadcast",
        event: "update",
        payload: { update: uint8ArrayToBase64(update) }
      });
    } catch (err) {
      console.error("Yjs update broadcast failed:", err);
    }
  };

  broadcastCursor(offset: { start: number; end: number } | null) {
    if (!this.channel) return;
    try {
      this.channel.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          userId: this.userId,
          name: this.userName,
          offset
        }
      });
    } catch (err) {
      console.error("Yjs cursor broadcast failed:", err);
    }
  }

  destroy() {
    this.doc.off("update", this.handleDocUpdate);
    if (this.channel) {
      void this.channel.unsubscribe();
      this.channel = null;
    }
  }
}
