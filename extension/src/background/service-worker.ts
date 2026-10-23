/**
 * SaySo Chrome Extension — Background Service Worker (MV3)
 *
 * Responsibilities:
 * 1. Open side panel when extension action is clicked
 * 2. Route messages between content-script ↔ sidepanel
 * 3. Forward GENERATE_REQUEST to the API and relay results
 * 4. Sync and manage unreplied candidates (inbox management)
 */

import { onMessage, sendToContentScript } from '../services/messaging';
import type { ExtensionMessage, MessageResponse } from '../services/messaging';
import { api, formatFriendlyError } from '../services/api-client';
import type { ChatMessage, ReplyCandidate } from '@sayso/shared';

// ─── State ───────────────────────────────────────────────────────────
let whatsappTabId: number | null = null;

/** Track the latest conversation context forwarded by the content script */
let latestContext: {
  contactRef: string;
  contactName: string;
  messages: ChatMessage[];
  isGroup?: boolean;
  unreadCount?: number;
} | null = null;

/** Cached list of active candidates */
let activeCandidates: ReplyCandidate[] = [];

// ─── Side Panel Setup ────────────────────────────────────────────────
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ─── Tab Tracking & Injection ────────────────────────────────────────
function initWhatsAppTabs(): void {
  chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        whatsappTabId = tab.id;
        chrome.sidePanel.setOptions({
          tabId: tab.id,
          path: 'sidepanel.html',
          enabled: true,
        }).catch(() => {});

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        }).catch(() => {});
      }
    }
  });
}

initWhatsAppTabs();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url?.includes('web.whatsapp.com') && changeInfo.status === 'complete') {
    whatsappTabId = tabId;
    // Enable the side panel only on WhatsApp tabs
    chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true,
    }).catch(() => {});

    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    }).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === whatsappTabId) whatsappTabId = null;
});

// ─── Message Router ──────────────────────────────────────────────────
onMessage(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: MessageResponse) => void,
  ): boolean | void => {
    switch (message.type) {
      // Content script → service worker: new conversation context
      case 'CONVERSATION_CONTEXT': {
        latestContext = message.payload;
        if (sender.tab?.id) whatsappTabId = sender.tab.id;

        // Broadcast to open side panel views so they update immediately
        chrome.runtime.sendMessage(message).catch(() => {});
        sendResponse({ success: true });
        return;
      }

      // Side panel → service worker: ready — send current context & candidates
      case 'SIDE_PANEL_READY': {
        sendResponse({
          success: true,
          data: {
            context: latestContext,
            candidates: activeCandidates,
          },
        });
        return;
      }

      // Content script → service worker: candidate sync request
      case 'CANDIDATES_SYNC_REQUEST': {
        const rawCandidates = message.payload.candidates;

        // Try syncing with API server (MongoDB Atlas)
        api
          .syncInbox({ candidates: rawCandidates })
          .then(async () => {
            const res = await api.getActiveCandidates();
            activeCandidates = res.candidates ?? [];
            chrome.runtime.sendMessage({
              type: 'CANDIDATES_UPDATED',
              payload: { candidates: activeCandidates },
            }).catch(() => {});
          })
          .catch(() => {
            // Offline/fallback mode: map raw candidate items directly
            activeCandidates = rawCandidates.map((c) => ({
              userId: 'local',
              contactRef: c.contactRef,
              contactName: c.contactName,
              revision: c.revision,
              status: 'active' as const,
              lastMessageDirection: c.lastMessageDirection,
              lastMessageTimestamp: c.lastMessageTimestamp,
              unreadCount: c.unreadCount,
              isGroup: c.isGroup,
              updatedAt: new Date().toISOString(),
            }));
            chrome.runtime.sendMessage({
              type: 'CANDIDATES_UPDATED',
              payload: { candidates: activeCandidates },
            }).catch(() => {});
          });

        sendResponse({ success: true });
        return;
      }

      // Side panel → service worker: get active candidates
      case 'GET_CANDIDATES': {
        if (activeCandidates.length > 0) {
          sendResponse({ success: true, data: activeCandidates });
          return;
        }

        api
          .getActiveCandidates()
          .then((res) => {
            activeCandidates = res.candidates ?? [];
            sendResponse({ success: true, data: activeCandidates });
          })
          .catch(() => {
            sendResponse({ success: true, data: activeCandidates });
          });

        return true;
      }

      // Side panel → service worker: dismiss candidate
      case 'DISMISS_CANDIDATE': {
        const { contactRef, revision } = message.payload;
        activeCandidates = activeCandidates.filter((c) => c.contactRef !== contactRef);

        api
          .dismissCandidate({ contactRef, revision })
          .catch(console.error);

        chrome.runtime.sendMessage({
          type: 'CANDIDATES_UPDATED',
          payload: { candidates: activeCandidates },
        }).catch(() => {});

        sendResponse({ success: true });
        return;
      }

      // Side panel → service worker → content script: open specific chat
      case 'OPEN_CHAT': {
        chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
          const tab = tabs.find((t) => t.active) || tabs[0];
          if (!tab?.id) {
            sendResponse({ success: false, error: 'WhatsApp tab not found' });
            return;
          }
          whatsappTabId = tab.id;
          // Bring the tab into focus
          chrome.tabs.update(tab.id, { active: true }).catch(() => {});

          sendToContentScript(tab.id, message)
            .then((r) => sendResponse(r))
            .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        });
        return true;
      }

      // Side panel → service worker: generate replies for current contact
      case 'GENERATE_REQUEST': {
        if (!latestContext) {
          sendResponse({ success: false, error: 'No conversation context available. Please click on a chat in WhatsApp Web first.' });
          return;
        }

        const isGroup = message.payload.isGroup ?? latestContext.isGroup;
        const unreadCount = message.payload.unreadCount ?? latestContext.unreadCount;

        api
          .generateReplies({
            contactRef: message.payload.contactRef,
            replyMode: message.payload.replyMode ?? 'all_at_once',
            isGroup,
            unreadCount,
            context: {
              messages: latestContext.messages,
              activeContactName: message.payload.contactName,
              isGroup,
              unreadCount,
            },
          })
          .then((result) => sendResponse({ success: true, data: result }))
          .catch((err: Error) => {
            const friendly = formatFriendlyError(err);
            sendResponse({ success: false, error: friendly });
          });

        return true;
      }

      // Side panel → service worker → content script: insert reply text
      case 'INSERT_REPLY': {
        if (!whatsappTabId) {
          sendResponse({ success: false, error: 'WhatsApp tab not found' });
          return;
        }

        sendToContentScript(whatsappTabId, message)
          .then((r) => sendResponse(r))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));

        return true; // async
      }

      case 'PING': {
        sendResponse({ success: true });
        return;
      }

      default:
        return;
    }
  },
);
