
import { onMessage, sendToContentScript } from '../services/messaging';
import type { ExtensionMessage, MessageResponse } from '../services/messaging';
import { api, formatFriendlyError } from '../services/api-client';
import type { ChatMessage, ReplyCandidate } from '@sayso/shared';

let whatsappTabId: number | null = null;

let latestContext: {
  contactRef: string;
  contactName: string;
  messages: ChatMessage[];
  isGroup?: boolean;
  unreadCount?: number;
} | null = null;

let activeCandidates: ReplyCandidate[] = [];


chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);


function initWhatsAppTabs(): void {
  chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        whatsappTabId = tab.id;
        chrome.sidePanel.setOptions({
          tabId: tab.id,
          path: 'sidepanel.html',
          enabled: true,
        }).catch(() => { });

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        }).catch(() => { });
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
    }).catch(() => { });

    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    }).catch(() => { });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === whatsappTabId) whatsappTabId = null;
});

onMessage(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: MessageResponse) => void,
  ): boolean | void => {
    switch (message.type) {
      case 'CONVERSATION_CONTEXT': {
        latestContext = message.payload;
        if (sender.tab?.id) whatsappTabId = sender.tab.id;

        // Broadcast to open side panel views so they update immediately
        chrome.runtime.sendMessage(message).catch(() => { });
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

      case 'CANDIDATES_SYNC_REQUEST': {
        const rawCandidates = message.payload.candidates;

        api
          .syncInbox({ candidates: rawCandidates })
          .then(async () => {
            const res = await api.getActiveCandidates();
            activeCandidates = res.candidates ?? [];
            chrome.runtime.sendMessage({
              type: 'CANDIDATES_UPDATED',
              payload: { candidates: activeCandidates },
            }).catch(() => { });
          })
          .catch(() => {
            activeCandidates = rawCandidates.map((c) => ({
              userId: 'local',
              contactRef: c.contactRef,
              contactName: c.contactName,
              revision: c.revision,
              status: 'active' as const,
              lastMessageDirection: c.lastMessageDirection,
              lastMessageTimestamp: c.lastMessageTimestamp,
              listPosition: c.listPosition,
              unreadCount: c.unreadCount,
              isGroup: c.isGroup,
              updatedAt: new Date().toISOString(),
            }));
            chrome.runtime.sendMessage({
              type: 'CANDIDATES_UPDATED',
              payload: { candidates: activeCandidates },
            }).catch(() => { });
          });

        sendResponse({ success: true });
        return;
      }

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

      case 'DISMISS_CANDIDATE': {
        const { contactRef, revision } = message.payload;
        activeCandidates = activeCandidates.filter((c) => c.contactRef !== contactRef);

        api
          .dismissCandidate({ contactRef, revision })
          .catch(console.error);

        chrome.runtime.sendMessage({
          type: 'CANDIDATES_UPDATED',
          payload: { candidates: activeCandidates },
        }).catch(() => { });

        sendResponse({ success: true });
        return;
      }

      case 'OPEN_CHAT': {
        chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
          const tab = tabs.find((t) => t.active) || tabs[0];
          if (!tab?.id) {
            sendResponse({ success: false, error: 'WhatsApp tab not found' });
            return;
          }
          whatsappTabId = tab.id;
          // Bring the tab into focus
          chrome.tabs.update(tab.id, { active: true }).catch(() => { });

          sendToContentScript(tab.id, message)
            .then((r) => sendResponse(r))
            .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        });
        return true;
      }

      case 'GENERATE_REQUEST': {
        if (!latestContext) {
          sendResponse({ success: false, error: 'No conversation context available. Please click on a chat in WhatsApp Web first.' });
          return;
        }

        const isGroup = message.payload.isGroup ?? latestContext.isGroup;
        const unreadCount = message.payload.unreadCount ?? latestContext.unreadCount;

        const startedAt = performance.now();
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
          .then((result) => {
            console.debug(`[SaySo timing] extension to backend + backend response: ${Math.round(performance.now() - startedAt)}ms`);
            sendResponse({ success: true, data: result });
          })
          .catch((err: Error) => {
            const friendly = formatFriendlyError(err);
            sendResponse({ success: false, error: friendly });
          });

        return true;
      }

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
