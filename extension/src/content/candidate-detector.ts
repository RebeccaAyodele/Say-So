/**
 * SaySo — WhatsApp Web Candidate Detector (Content Script)
 *
 * Scans the visible WhatsApp Web chat list to identify unreplied conversations:
 *  - Chats with unread message badges
 *  - Chats where the most recent message was incoming
 *
 * Strict Privacy:
 *  - Only extracts metadata (contactRef, contactName, timestamp, direction, unreadCount)
 *  - Message contents are NEVER extracted or transmitted by this detector
 */

import type { CandidateSyncItem } from '@sayso/shared';
import { sendToBackground } from '../services/messaging';

// ─── Selectors ────────────────────────────────────────────────────────
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

// ─── Group Classification ─────────────────────────────────────────────
type ChatKind = { isGroup: boolean; reason: string };

/** Chats positively identified as groups. Sticky because the list is virtualized
 *  and the evidence (icon, sender prefix) isn't visible on every render. */
const knownGroups = new Set<string>();

// Labels that look like "Word: text" but are not a group sender
const NON_SENDER_LABELS = new Set([
  'draft', 'note', 'reminder', 'reply', 'update', 'urgent', 'important',
  'fyi', 'ps', 're', 'fwd', 'time', 'date', 'venue', 'link', 'question',
]);

// Tiny, whole-word-only list, used as a last resort
const GROUP_NAME_WORDS =
  /\b(group|community|announcements?|bootcamp|cohort|alumni|committee|channel|class of)\b/i;

export function classifyConversation(cell: Element, contactName: string): ChatKind {
  const ref = contactRefFrom(contactName);
  if (knownGroups.has(ref)) return { isGroup: true, reason: 'cached' };

  // 1. Strong: group / community icon or testid
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

  // 2. Sender prefix at the START of the preview line only
  //    Only trust strong sender indicators that can't appear in normal DM text
  const sec = cell.querySelector('div[data-testid="cell-frame-secondary"]');
  const preview = cleanString(sec?.textContent ?? '');
  const m = preview.match(/^([^:\n]{1,40}):\s+\S/);
  if (m) {
    const prefix = m[1].trim();
    const lowerPrefix = prefix.toLowerCase();
    // Only match unambiguous group sender patterns:
    //  - "You: ..." (user's own message in a group)
    //  - "~Name: ..." (unsaved contact, WhatsApp prefixes with ~)
    //  - "+234 80...: ..." (phone number prefix)
    const isSender =
      lowerPrefix === 'you' ||
      prefix.startsWith('~') ||
      /^\+?\d[\d\s-]{6,}$/.test(prefix); // unsaved number only
    if (isSender) {
      knownGroups.add(ref);
      return { isGroup: true, reason: `sender-prefix:${prefix}` };
    }
  }

  // 3. Weak: whole-word name hint (covers groups whose last message is a system message)
  if (GROUP_NAME_WORDS.test(contactName)) {
    return { isGroup: true, reason: 'name-word' };
  }

  // Default: direct chat
  return { isGroup: false, reason: 'default-dm' };
}

/** Kept so existing imports don't break */
export function isGroupConversation(cell: Element, contactName: string): boolean {
  return classifyConversation(cell, contactName).isGroup;
}

/** Check if outgoing checkmark is present strictly in cell-frame-secondary.
 *  ONLY checks for actual icon elements, NOT generic containers like
 *  [data-testid="last-msg-status"] which exist on all cells (incoming too). */
function hasOutgoingCheckmark(cell: Element): boolean {
  const sec = cell.querySelector('div[data-testid="cell-frame-secondary"]');
  if (!sec) return false;

  // Only actual checkmark/clock icons — these ONLY appear on outgoing messages
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

/** Extract unread count safely without false-positive checkmark matches */
function extractUnreadCount(cell: Element): number {
  const badgeEl = cell.querySelector(
    'span[data-testid="icon-unread-count"], [data-testid="unread-count"], [aria-label*="unread" i]'
  );
  if (!badgeEl) return 0;

  const label = badgeEl.getAttribute('aria-label') || badgeEl.textContent || '';
  const match = label.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/** Generate a deterministic revision tag for candidate state */
function generateRevision(contactRef: string, timestamp?: string, unread?: number): string {
  const cleanTime = (timestamp ?? 'unknown').replace(/[^a-zA-Z0-9]/g, '');
  return `${contactRef}_${cleanTime}_u${unread ?? 0}`;
}

/** Memory accumulator to persist discovered candidates as user scrolls virtualized list */
const candidateCache = new Map<string, CandidateSyncItem>();

/**
 * Scans the sidebar chat list and extracts candidates awaiting reply
 */
export function detectCandidates(): CandidateSyncItem[] {
  const pane =
    document.querySelector(CANDIDATE_SEL.paneSide) ??
    document.querySelector(CANDIDATE_SEL.chatListAria);

  if (!pane) return Array.from(candidateCache.values());

  // Find all chat cells
  let cells = pane.querySelectorAll(CANDIDATE_SEL.cellContainer);
  if (cells.length === 0) {
    cells = pane.querySelectorAll(CANDIDATE_SEL.rowFallback);
  }

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];

    // Contact name: prioritize cell-frame-title container specifically
    const titleContainer = cell.querySelector(CANDIDATE_SEL.titleContainer);
    const titleSpan = titleContainer?.querySelector('span[title]') ?? titleContainer?.querySelector('span');
    const rawName = titleSpan?.getAttribute('title') || titleSpan?.textContent || titleContainer?.textContent;
    const contactName = rawName ? cleanContactName(rawName) : '';

    if (!contactName) continue;

    // Filter out status updates, archived, or self
    const lower = contactName.toLowerCase();
    if (lower === 'status' || lower === 'archived' || lower === 'you' || cell.querySelector('[data-testid="message-yourself-row"]')) {
      continue;
    }

    const contactRef = contactRefFrom(contactName);
    const { isGroup, reason } = classifyConversation(cell, contactName);
    console.debug(`[SaySo] ${contactName} -> ${isGroup ? 'group' : 'dm'} (${reason})`);
    const unreadCount = extractUnreadCount(cell);
    const hasCheckmark = hasOutgoingCheckmark(cell);
    const lastMessageDirection: 'incoming' | 'outgoing' = hasCheckmark ? 'outgoing' : 'incoming';

    // Timestamp
    const timeEl = cell.querySelector(CANDIDATE_SEL.metaTime);
    const lastMessageTimestamp = timeEl?.textContent?.trim() || undefined;

    // If chat has an outgoing checkmark and 0 unread messages, it has been replied to
    if (hasCheckmark && unreadCount === 0) {
      console.debug(`[SaySo] REMOVING ${contactName} (checkmark=true, unread=0)`);
      candidateCache.delete(contactRef);
      continue;
    }

    // Awaiting response:
    // 1. Unread count > 0, OR
    // 2. Last message was incoming
    if (unreadCount > 0 || lastMessageDirection === 'incoming') {
      const revision = generateRevision(contactRef, lastMessageTimestamp, unreadCount);
      candidateCache.set(contactRef, {
        contactRef,
        contactName,
        revision,
        lastMessageDirection,
        lastMessageTimestamp,
        unreadCount,
        isGroup,
      });
    }
  }

  return Array.from(candidateCache.values());
}

/**
 * Click on a contact row in WhatsApp Web to switch the active chat
 */
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
      // Find the best clickable element in WhatsApp's structure
      const clickable =
        cell.querySelector('div[role="button"]') ??
        cell.querySelector('div[role="gridcell"]') ??
        cell.closest('div[role="row"]') ??
        (cell as HTMLElement);

      (clickable as HTMLElement).scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });

      // Dispatch full mouse event sequence for React synthetic event compatibility
      clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }
  }

  return false;
}

// ─── Observer & Sync ──────────────────────────────────────────────────
let lastSyncHash = '';
let scanDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scanAndSync(): void {
  const candidates = detectCandidates();
  console.log(`[SaySo] Scan detected ${candidates.length} candidate(s) awaiting reply`);

  const currentHash = candidates.length === 0 ? '__empty__' : candidates.map((c) => c.revision).join('|');
  if (currentHash === lastSyncHash) return; // Unchanged

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
    console.log('[SaySo] Candidate observer attached to chat pane');
    const observer = new MutationObserver(() => {
      if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
      scanDebounceTimer = setTimeout(scanAndSync, 1000);
    });

    observer.observe(pane, { childList: true, subtree: true, characterData: true });
    // Initial run
    scanAndSync();

    // Also run periodic scan every 4s to catch async scroll/updates
    setInterval(scanAndSync, 4000);
  } else {
    // Retry when WhatsApp finishes loading
    setTimeout(startCandidateObserver, 1500);
  }
}
