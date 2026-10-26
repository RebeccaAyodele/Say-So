import type { CandidateSyncItem } from '@sayso/shared';
import { sendToBackground } from '../services/messaging';

const CANDIDATE_SEL = {
  paneSide: '#pane-side',
  chatListAria: 'div[aria-label="Chat list"]',
  cellContainer: 'div[data-testid="cell-frame-container"]',
  rowFallback: '#pane-side div[role="row"]',
  titleContainer: 'div[data-testid="cell-frame-title"]',
  metaTime: 'div[data-testid="cell-frame-meta"] span, div[data-testid="chat-list-timestamp"]',
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

function contactRefFrom(name: string): string {
  return `wa:${cleanString(name).replace(/\s+/g, '_').toLowerCase()}`;
}

type ChatKind = { isGroup: boolean; reason: string };

const knownGroups = new Set<string>();

const GROUP_NAME_WORDS =
  /\b(group|community|announcements?|bootcamp|cohort|alumni|committee|channel|class of)\b/i;

export function classifyConversation(cell: Element, contactName: string): ChatKind {
  const ref = contactRefFrom(contactName);
  if (knownGroups.has(ref)) return { isGroup: true, reason: 'cached' };

  if (
    cell.querySelector(
      'span[data-icon="default-group"], span[data-icon="community"], ' +
      '[data-icon*="group"], [data-icon*="community"], ' +
      '[data-testid*="group"], [data-testid*="community"]'
    )
  ) {
    knownGroups.add(ref);
    return { isGroup: true, reason: 'icon' };
  }

  const sec = cell.querySelector('div[data-testid="cell-frame-secondary"]');
  const preview = cleanString(sec?.textContent ?? '');
  const m = preview.match(/^([^:\n]{1,40}):\s+\S/);
  if (m) {
    const prefix = m[1].trim();
    const lowerPrefix = prefix.toLowerCase();
    const isSender =
      lowerPrefix === 'you' ||
      prefix.startsWith('~') ||
      /^\+?\d[\d\s-]{6,}$/.test(prefix);
    if (isSender) {
      knownGroups.add(ref);
      return { isGroup: true, reason: `sender-prefix:${prefix}` };
    }
  }

  if (GROUP_NAME_WORDS.test(contactName)) {
    return { isGroup: true, reason: 'name-word' };
  }

  return { isGroup: false, reason: 'default-dm' };
}

export function isGroupConversation(cell: Element, contactName: string): boolean {
  return classifyConversation(cell, contactName).isGroup;
}

function hasOutgoingCheckmark(cell: Element): boolean {
  const sec = cell.querySelector('div[data-testid="cell-frame-secondary"]');
  if (!sec) return false;

  return !!(
    sec.querySelector('span[data-icon="msg-check"]') ||
    sec.querySelector('span[data-icon="msg-dblcheck"]') ||
    sec.querySelector('span[data-icon="msg-dblcheck-ack"]') ||
    sec.querySelector('span[data-icon="msg-time"]') ||
    sec.querySelector('svg[data-icon="msg-check"]') ||
    sec.querySelector('svg[data-icon="msg-dblcheck"]') ||
    sec.querySelector('svg[data-icon="msg-dblcheck-ack"]') ||
    sec.querySelector('svg[data-icon="msg-time"]')
  );
}

function extractUnreadCount(cell: Element): number {
  const badgeEl = cell.querySelector(
    'span[data-testid="icon-unread-count"], [data-testid="unread-count"], [aria-label*="unread" i]'
  );
  if (!badgeEl) return 0;

  const label = badgeEl.getAttribute('aria-label') || badgeEl.textContent || '';
  const match = label.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

function generateRevision(contactRef: string, timestamp?: string, unread?: number): string {
  const cleanTime = (timestamp ?? 'unknown').replace(/[^a-zA-Z0-9]/g, '');
  return `${contactRef}_${cleanTime}_u${unread ?? 0}`;
}

const candidateCache = new Map<string, CandidateSyncItem>();

export function getCandidateByRef(ref: string): CandidateSyncItem | undefined {
  return candidateCache.get(ref);
}

export function detectCandidates(): CandidateSyncItem[] {
  const pane =
    document.querySelector(CANDIDATE_SEL.paneSide) ??
    document.querySelector(CANDIDATE_SEL.chatListAria);

  if (!pane) return Array.from(candidateCache.values());

  let cells = pane.querySelectorAll(CANDIDATE_SEL.cellContainer);
  if (cells.length === 0) {
    cells = pane.querySelectorAll(CANDIDATE_SEL.rowFallback);
  }

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];

    const titleContainer = cell.querySelector(CANDIDATE_SEL.titleContainer);
    const titleSpan = titleContainer?.querySelector('span[title]') ?? titleContainer?.querySelector('span');
    const rawName = titleSpan?.getAttribute('title') || titleSpan?.textContent || titleContainer?.textContent;
    const contactName = rawName ? cleanContactName(rawName) : '';

    if (!contactName) continue;

    const lower = contactName.toLowerCase();
    if (lower === 'status' || lower === 'archived' || lower === 'you' || cell.querySelector('[data-testid="message-yourself-row"]')) {
      continue;
    }

    const contactRef = contactRefFrom(contactName);
    const { isGroup } = classifyConversation(cell, contactName);
    const unreadCount = extractUnreadCount(cell);
    const hasCheckmark = hasOutgoingCheckmark(cell);
    const lastMessageDirection: 'incoming' | 'outgoing' = hasCheckmark ? 'outgoing' : 'incoming';

    const timeEl = cell.querySelector(CANDIDATE_SEL.metaTime);
    const lastMessageTimestamp = timeEl?.textContent?.trim() || undefined;

    if (hasCheckmark && unreadCount === 0) {
      candidateCache.delete(contactRef);
      continue;
    }

    if (unreadCount > 0 || lastMessageDirection === 'incoming') {
      const revision = generateRevision(contactRef, lastMessageTimestamp, unreadCount);
      candidateCache.set(contactRef, {
        contactRef,
        contactName,
        revision,
        lastMessageDirection,
        lastMessageTimestamp,
        listPosition: i,
        unreadCount,
        isGroup,
      });
    }
  }

  return Array.from(candidateCache.values());
}

export function openChatByContactName(name: string): boolean {
  const pane =
    document.querySelector(CANDIDATE_SEL.paneSide) ??
    document.querySelector(CANDIDATE_SEL.chatListAria);

  if (!pane) return false;

  const targetClean = cleanString(name).toLowerCase();
  const cells = pane.querySelectorAll(CANDIDATE_SEL.cellContainer);

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const titleContainer = cell.querySelector(CANDIDATE_SEL.titleContainer);
    const titleSpan = titleContainer?.querySelector('span[title]') ?? titleContainer?.querySelector('span');
    const raw = titleSpan?.getAttribute('title') || titleSpan?.textContent || titleContainer?.textContent;
    const cellTitle = raw ? cleanString(raw).toLowerCase() : '';

    const isMatch =
      cellTitle === targetClean ||
      (cellTitle && targetClean && (cellTitle.includes(targetClean) || targetClean.includes(cellTitle)));

    if (isMatch) {
      const clickable =
        cell.querySelector('div[role="button"]') ??
        cell.querySelector('div[role="gridcell"]') ??
        cell.closest('div[role="row"]') ??
        (cell as HTMLElement);

      (clickable as HTMLElement).scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });

      clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }
  }

  return false;
}

let lastSyncHash = '';
let scanDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scanAndSync(): void {
  const candidates = detectCandidates();

  const currentHash = candidates.length === 0
    ? '__empty__'
    : candidates.map((c) => `${c.revision}:${c.listPosition ?? ''}`).join('|');
  if (currentHash === lastSyncHash) return;

  lastSyncHash = currentHash;

  sendToBackground({
    type: 'CANDIDATES_SYNC_REQUEST',
    payload: { candidates },
  }).catch((err) => console.error('[SaySo] Sync request error:', err));
}

export function startCandidateObserver(): void {
  const pane =
    document.querySelector(CANDIDATE_SEL.paneSide) ??
    document.querySelector(CANDIDATE_SEL.chatListAria);

  if (pane) {
    const observer = new MutationObserver(() => {
      if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
      scanDebounceTimer = setTimeout(scanAndSync, 1000);
    });

    observer.observe(pane, { childList: true, subtree: true, characterData: true });
    scanAndSync();
    setInterval(scanAndSync, 4000);
  } else {
    setTimeout(startCandidateObserver, 1500);
  }
}
