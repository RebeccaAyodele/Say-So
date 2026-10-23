import type { ChatMessage, ReplyCandidate, CandidateSyncItem } from '@sayso/shared';

// ─── Message Types ───────────────────────────────────────────────────
export type ExtensionMessage =
  | { type: 'CONVERSATION_CONTEXT'; payload: { contactRef: string; contactName: string; messages: ChatMessage[] } }
  | { type: 'CANDIDATE_DETECTED'; payload: ReplyCandidate }
  | { type: 'CANDIDATES_SYNC_REQUEST'; payload: { candidates: CandidateSyncItem[] } }
  | { type: 'CANDIDATES_UPDATED'; payload: { candidates: ReplyCandidate[] } }
  | { type: 'GET_CANDIDATES' }
  | { type: 'DISMISS_CANDIDATE'; payload: { contactRef: string; revision: string } }
  | { type: 'OPEN_CHAT'; payload: { contactName: string } }
  | { type: 'INSERT_REPLY'; payload: { text: string } }
  | { type: 'GENERATE_REQUEST'; payload: { contactRef: string; contactName: string; replyMode?: 'all_at_once' | 'point_by_point' } }
  | { type: 'AUTH_STATE_CHANGED'; payload: { isAuthenticated: boolean } }
  | { type: 'SIDE_PANEL_READY' }
  | { type: 'PING' };

export type MessageResponse =
  | { success: true; data?: unknown }
  | { success: false; error: string };

// ─── Send ────────────────────────────────────────────────────────────

/** Send a message from any context (content-script, sidepanel, popup) to the service worker */
export function sendToBackground(
  message: ExtensionMessage,
): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(message);
}

/** Send a message from the service worker to the active WhatsApp tab's content script */
export async function sendToContentScript(
  tabId: number,
  message: ExtensionMessage,
): Promise<MessageResponse> {
  return chrome.tabs.sendMessage(tabId, message);
}

// ─── Listen ──────────────────────────────────────────────────────────

type MessageHandler = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
) => boolean | void;

/** Register a message handler (can be used in any extension context) */
export function onMessage(handler: MessageHandler): void {
  chrome.runtime.onMessage.addListener(handler);
}

/** Remove a previously registered handler */
export function offMessage(handler: MessageHandler): void {
  chrome.runtime.onMessage.removeListener(handler);
}
