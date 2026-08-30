import { create } from "zustand";

export type NotificationConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

interface NotificationStore {
  /** Global unread count shown in Header bell badge */
  unreadCount: number;
  /** Unread count for chat-activity notifications only (shown on Activity Bell in Messages) */
  chatActivityCount: number;
  /** Timestamp of last refresh - used to trigger re-fetches */
  lastRefresh: number;
  /** Health of the global notification SSE connection */
  connectionStatus: NotificationConnectionStatus;
  /** Set the unread count */
  setUnreadCount: (count: number) => void;
  /** Set the chat-activity unread count */
  setChatActivityCount: (count: number) => void;
  /** Trigger a refresh across all notification consumers */
  triggerRefresh: () => void;
  /** Update the global notification SSE connection health */
  setConnectionStatus: (status: NotificationConnectionStatus) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  unreadCount: 0,
  chatActivityCount: 0,
  lastRefresh: Date.now(),
  connectionStatus: "disconnected",
  setUnreadCount: (count) => set({ unreadCount: count }),
  setChatActivityCount: (count) => set({ chatActivityCount: count }),
  triggerRefresh: () => {
    set({ lastRefresh: Date.now() });
  },
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
