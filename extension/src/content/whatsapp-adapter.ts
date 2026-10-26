import { sendToBackground } from '../services/messaging';
import type { ExtensionMessage, MessageResponse } from '../services/messaging';
import type { ChatMessage } from '@sayso/shared';
import { startCandidateObserver, openChatByContactName, getCandidateByRef } from './candidate-detector';

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

function isOutgoingMessage(row: Element): boolean {
  const dataIdEl = row.hasAttribute('data-id') ? row : row.querySelector('[data-id]');
  const dataId = dataIdEl?.getAttribute('data-id');
  if (dataId) {
    if (dataId.startsWith('true_')) return true;
    if (dataId.startsWith('false_')) return false;
  }

  const hasOutgoingIcon = !!(
    row.querySelector('span[data-icon="msg-check"]') ||
    row.querySelector('span[data-icon="msg-dblcheck"]') ||
    row.querySelector('span[data-icon="msg-dblcheck-ack"]') ||
    row.querySelector('span[data-icon="msg-time"]') ||
    row.querySelector('svg[data-icon="msg-check"]') ||
    row.querySelector('svg[data-icon="msg-dblcheck"]') ||
    row.querySelector('svg[data-icon="msg-dblcheck-ack"]') ||
    row.querySelector('svg[data-icon="msg-time"]')
  );
  if (hasOutgoingIcon) return true;

  if (row.classList.contains('message-out') || row.querySelector('.message-out')) {
    return true;
  }
  if (row.classList.contains('message-in') || row.querySelector('.message-in')) {
    return false;
  }

  return false;
}

function extractMessageText(row: Element): string | null {
  const quotedBox = row.querySelector('[data-testid="quoted-message"], [class*="quoted"]');
  const textEls = Array.from(row.querySelectorAll(SEL.messageText));
  const mainTextEl = textEls.find((el) => !quotedBox || !quotedBox.contains(el)) || textEls[textEls.length - 1];
  return mainTextEl?.textContent?.trim() || null;
}

function isActiveChatGroup(contactName: string): boolean {
  const header = document.querySelector('header');
  if (header) {
    if (
      header.querySelector('span[data-icon="default-group"]') ||
      header.querySelector('span[data-icon="community"]') ||
      header.querySelector('[data-icon*="group"]') ||
      header.querySelector('[data-icon*="community"]') ||
      header.querySelector('[data-testid*="group"]')
    ) {
      return true;
    }
  }

  const ref = contactRefFrom(contactName);
  const candidate = getCandidateByRef(ref);
  if (candidate?.isGroup !== undefined) {
    return candidate.isGroup;
  }

  return false;
}

function getActiveUnreadCount(rows: NodeListOf<Element>, contactRef: string): number {
  for (let i = 0; i < rows.length; i++) {
    const text = (rows[i].textContent || '').toLowerCase();
    if (
      text.includes('unread message') ||
      rows[i].querySelector('[data-testid="unread-bar"], [data-testid="unread-message-bar"]')
    ) {
      return Math.max(rows.length - 1 - i, 1);
    }
  }

  const candidate = getCandidateByRef(contactRef);
  if (candidate?.unreadCount && candidate.unreadCount > 0) {
    return candidate.unreadCount;
  }

  return 0;
}

function extractMessages(maxMessages = 50): { messages: ChatMessage[]; unreadCount: number } {
  const startedAt = performance.now();
  const rows = document.querySelectorAll(SEL.messageContainer);
  const messages: ChatMessage[] = [];

  const start = Math.max(0, rows.length - maxMessages);
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    const isOut = isOutgoingMessage(row);
    const text = extractMessageText(row);
    if (!text) continue;

    const timeEl = row.querySelector(SEL.messageTime);
    const authorEl = row.querySelector('[data-testid="author"], span[class*="author"], span[dir="auto"][style*="color"]');
    const senderName = isOut ? 'You' : authorEl?.textContent?.trim() || undefined;

    messages.push({
      role: isOut ? 'me' : 'them',
      text,
      timestamp: timeEl?.textContent?.trim(),
      senderName,
    });
  }

  const contactName = getActiveContactName() || '';
  const contactRef = contactRefFrom(contactName);
  const unreadCount = getActiveUnreadCount(rows, contactRef);

  console.debug(`[SaySo timing] whatsapp context extraction: ${Math.round(performance.now() - startedAt)}ms (${messages.length} messages)`);
  return { messages, unreadCount };
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
let expectedContactName: string | null = null;
let previousContextFingerprint: string | null = null;
let stableContextSamples = 0;
let lastContextMutationAt = 0;

function getContextFingerprint(): string | null {
  const contactName = getActiveContactName();
  if (!contactName || !document.querySelector(SEL.chatInput)) return null;
  if (expectedContactName && cleanString(contactName).toLowerCase() !== expectedContactName) return null;

  const rows = Array.from(document.querySelectorAll(SEL.messageContainer)).slice(-50);
  if (rows.length === 0) return null;

  const contactRef = contactRefFrom(contactName);
  const unreadCount = getActiveUnreadCount(document.querySelectorAll(SEL.messageContainer), contactRef);
  const isGroup = isActiveChatGroup(contactName);
  let hash = 2166136261;
  const content = rows.map((row) => row.textContent || '').join('\u0000');
  for (let index = 0; index < content.length; index++) {
    hash = Math.imul(hash ^ content.charCodeAt(index), 16777619);
  }

  return `${contactRef}:${isGroup}:${unreadCount}:${rows.length}:${hash >>> 0}`;
}

function forwardContext(): void {
  const contactName = getActiveContactName();
  if (!contactName) return;

  const { messages, unreadCount } = extractMessages();
  if (messages.length === 0) return;

  const contactRef = contactRefFrom(contactName);
  const isGroup = isActiveChatGroup(contactName);

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
      isGroup,
      unreadCount,
    },
  }).catch((err) => console.error('[SaySo] Failed to forward context:', err));
}

function debouncedForward(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  lastContextMutationAt = performance.now();
  debounceTimer = setTimeout(checkContextStability, 150);
}

function checkContextStability(): void {
  const fingerprint = getContextFingerprint();
  if (!fingerprint) {
    stableContextSamples = 0;
    previousContextFingerprint = null;
  } else if (fingerprint === previousContextFingerprint) {
    stableContextSamples++;
  } else {
    previousContextFingerprint = fingerprint;
    stableContextSamples = 1;
  }

  if (stableContextSamples >= 2) {
    console.debug(`[SaySo timing] WhatsApp context stable after ${Math.round(performance.now() - lastContextMutationAt)}ms`);
    expectedContactName = null;
    stableContextSamples = 0;
    previousContextFingerprint = null;
    forwardContext();
    return;
  }

  debounceTimer = setTimeout(checkContextStability, 150);
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
      if (ok) expectedContactName = cleanString(message.payload.contactName).toLowerCase();
      sendResponse(ok ? { success: true } : { success: false, error: 'Contact not found' });
      return;
    }
  },
);
