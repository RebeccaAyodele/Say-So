import { sendToBackground } from '../services/messaging';
import type { ExtensionMessage, MessageResponse } from '../services/messaging';
import type { ChatMessage } from '@sayso/shared';
import { startCandidateObserver, openChatByContactName } from './candidate-detector';

const SEL = {
  contactHeader: 'header span[data-testid="conversation-info-header-chat-title"], #main header span[title], div[role="main"] header span[title], header div[role="button"] span[title]',
  messageContainer: '#main div[role="row"], div[role="main"] div[role="row"], div[data-testid="msg-container"]',
  messageIn: 'div.message-in',
  messageOut: 'div.message-out',
  messageText: 'span.selectable-text',
  messageTime: 'span[data-testid="msg-meta"]',
  chatInput: 'div[data-testid="conversation-compose-box-input"], #main footer div[contenteditable="true"], div[role="textbox"][contenteditable="true"]',
} as const;

function cleanString(str: string): string {
  return str.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();
}

function cleanContactName(raw: string): string {
  return raw
    .replace(/^(\d+\s+)?unread\s+messages?\s*/i, '')
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .trim();
}

function getActiveContactName(): string | null {
  const el = document.querySelector(SEL.contactHeader);
  const raw = el?.getAttribute('title') || el?.textContent;
  return raw ? cleanContactName(raw) : null;
}

function contactRefFrom(name: string): string {
  return `wa:${cleanContactName(name).replace(/\s+/g, '_').toLowerCase()}`;
}

function extractMessages(maxMessages = 25): ChatMessage[] {
  const rows = document.querySelectorAll(SEL.messageContainer);
  const messages: ChatMessage[] = [];

  const start = Math.max(0, rows.length - maxMessages);
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    const isOut = row.querySelector(SEL.messageOut) !== null;
    const textEl = row.querySelector(SEL.messageText);
    const text = textEl?.textContent?.trim();
    if (!text) continue;

    const timeEl = row.querySelector(SEL.messageTime);
    messages.push({
      role: isOut ? 'me' : 'them',
      text,
      timestamp: timeEl?.textContent?.trim(),
    });
  }

  return messages;
}

function insertReplyText(text: string): boolean {
  const input = document.querySelector(SEL.chatInput) as HTMLElement | null;
  if (!input) return false;

  input.focus();
  document.execCommand('selectAll', false);
  document.execCommand('insertText', false, text);
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  return true;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastForwardedRef = '';
let lastMessageCount = 0;

function forwardContext(): void {
  const contactName = getActiveContactName();
  if (!contactName) return;

  const messages = extractMessages();
  if (messages.length === 0) return;

  const contactRef = contactRefFrom(contactName);

  if (contactRef === lastForwardedRef && messages.length === lastMessageCount) {
    return;
  }

  lastForwardedRef = contactRef;
  lastMessageCount = messages.length;

  sendToBackground({
    type: 'CONVERSATION_CONTEXT',
    payload: {
      contactRef,
      contactName,
      messages,
    },
  }).catch((err) => console.error('[SaySo] Failed to forward context:', err));
}

function debouncedForward(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(forwardContext, 400);
}

function startObserving(): void {
  const observer = new MutationObserver(() => {
    debouncedForward();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  debouncedForward();
  setInterval(debouncedForward, 3000);
}

startObserving();
startCandidateObserver();

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (r: MessageResponse) => void,
  ) => {
    if (message.type === 'INSERT_REPLY') {
      const ok = insertReplyText(message.payload.text);
      sendResponse(ok ? { success: true } : { success: false, error: 'Input not found' });
      return;
    }

    if (message.type === 'OPEN_CHAT') {
      const ok = openChatByContactName(message.payload.contactName);
      sendResponse(ok ? { success: true } : { success: false, error: 'Contact not found' });
      return;
    }
  },
);
