import React, { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type { ChatMessage, ReplyOption, GenerateRepliesResponse, ReplyCandidate } from '@sayso/shared';
import { sendToBackground } from '../../services/messaging';
import { formatFriendlyError } from '../../services/api-client';

export type AppView = 'home' | 'replies' | 'editor' | 'settings';

export interface AppState {
  view: AppView;
  contactRef: string | null;
  contactName: string | null;
  messages: ChatMessage[];
  candidates: ReplyCandidate[];
  replyOptions: ReplyOption[];
  selectedOption: ReplyOption | null;
  draftText: string;
  requestId: string | null;
  isLoading: boolean;
  isScanning: boolean;
  replyMode: 'all_at_once' | 'point_by_point';
  isGroup: boolean;
  unreadCount: number;
  error: string | null;
}

const initialState: AppState = {
  view: 'home',
  contactRef: null,
  contactName: null,
  messages: [],
  candidates: [],
  replyOptions: [],
  selectedOption: null,
  draftText: '',
  requestId: null,
  isLoading: false,
  isScanning: true,
  replyMode: 'all_at_once',
  isGroup: false,
  unreadCount: 0,
  error: null,
};

type Action =
  | { type: 'SET_CONTEXT'; payload: { contactRef: string; contactName: string; messages: ChatMessage[]; isGroup?: boolean; unreadCount?: number } }
  | { type: 'SET_CANDIDATES'; payload: ReplyCandidate[] }
  | { type: 'SET_SCANNING'; payload: boolean }
  | { type: 'SET_REPLY_MODE'; payload: 'all_at_once' | 'point_by_point' }
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; payload: GenerateRepliesResponse }
  | { type: 'GENERATE_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SELECT_OPTION'; payload: ReplyOption }
  | { type: 'UPDATE_DRAFT'; payload: string }
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'RESET' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CONTEXT': {
      const isGroup =
        action.payload.isGroup ??
        state.candidates.find((c) => c.contactRef === action.payload.contactRef)?.isGroup ??
        false;
      const unreadCount =
        action.payload.unreadCount ??
        state.candidates.find((c) => c.contactRef === action.payload.contactRef)?.unreadCount ??
        0;

      return {
        ...state,
        contactRef: action.payload.contactRef,
        contactName: action.payload.contactName,
        messages: action.payload.messages,
        isGroup,
        unreadCount,
        view: 'home',
        error: null,
      };
    }
    case 'SET_CANDIDATES': {
      const sorted = [...action.payload].sort((a, b) => {
        return (a.listPosition ?? Number.MAX_SAFE_INTEGER) - (b.listPosition ?? Number.MAX_SAFE_INTEGER);
      });
      return {
        ...state,
        candidates: sorted,
        isScanning: false,
      };
    }
    case 'SET_SCANNING':
      return {
        ...state,
        isScanning: action.payload,
      };
    case 'SET_REPLY_MODE':
      return {
        ...state,
        replyMode: action.payload,
      };
    case 'GENERATE_START':
      return { ...state, isLoading: true, error: null, replyOptions: [], selectedOption: null };
    case 'GENERATE_SUCCESS':
      return {
        ...state,
        isLoading: false,
        replyOptions: action.payload.options,
        requestId: action.payload.requestId,
        view: 'replies',
      };
    case 'GENERATE_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SELECT_OPTION':
      return { ...state, selectedOption: action.payload, draftText: action.payload.text, view: 'editor' };
    case 'UPDATE_DRAFT':
      return { ...state, draftText: action.payload };
    case 'SET_VIEW':
      return { ...state, view: action.payload };
    case 'RESET':
      return { ...initialState, contactRef: state.contactRef, contactName: state.contactName, messages: state.messages, candidates: state.candidates, isScanning: false };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  generateReplies: () => Promise<void>;
  insertReply: (text: string) => Promise<void>;
  dismissCandidate: (contactRef: string, revision: string) => Promise<void>;
  openChat: (contactName: string) => Promise<void>;
  refreshCandidates: () => Promise<void>;
  setReplyMode: (mode: 'all_at_once' | 'point_by_point') => void;
  clearError: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside <AppProvider>');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const generationRef = useRef(0);
  const activeContactRef = useRef<string | null>(null);
  const pendingContactSwitchRef = useRef(false);

  // On mount tell the service worker we're ready → get latest context & candidates
  useEffect(() => {
    sendToBackground({ type: 'SIDE_PANEL_READY' })
      .then((res) => {
        if (res.success && res.data) {
          const data = res.data as {
            context?: { contactRef: string; contactName: string; messages: ChatMessage[] } | null;
            candidates?: ReplyCandidate[];
          };

          if (data.context) {
            if (!pendingContactSwitchRef.current && activeContactRef.current === null) {
              activeContactRef.current = data.context.contactRef;
              dispatch({ type: 'SET_CONTEXT', payload: data.context });
            }
          }

          if (data.candidates) {
            dispatch({
              type: 'SET_CANDIDATES',
              payload: data.candidates,
            });
          }
        }
      })
      .catch(console.error);

    // Initial fetch of candidates
    refreshCandidates();

    // Track the last incoming message to avoid duplicate generation while allowing newer messages.
    let lastGeneratedContextKey = '';

    // Listen for live updates forwarded via background
    const handler = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'CONVERSATION_CONTEXT') {
        const payload = message.payload as {
          contactRef: string;
          contactName: string;
          messages: ChatMessage[];
          isGroup?: boolean;
          unreadCount?: number;
        };
        dispatch({
          type: 'SET_CONTEXT',
          payload,
        });
        if (activeContactRef.current !== payload.contactRef) {
          generationRef.current++;
        }
        activeContactRef.current = payload.contactRef;
        pendingContactSwitchRef.current = false;

        // Instant Auto-Predict / Auto-Summarize:
        const msgs = payload.messages;
        const lastMsg = msgs[msgs.length - 1];
        const contextKey = lastMsg
          ? JSON.stringify([payload.contactRef, lastMsg.role, lastMsg.timestamp ?? '', lastMsg.text])
          : '';
        if (lastMsg && lastMsg.role === 'them' && contextKey !== lastGeneratedContextKey) {
          lastGeneratedContextKey = contextKey;
          executeGenerate(payload.contactRef, payload.contactName, payload.isGroup, payload.unreadCount);
        }
      }

      if (message.type === 'CANDIDATES_UPDATED') {
        const payload = message.payload as { candidates: ReplyCandidate[] };
        if (payload?.candidates) {
          dispatch({
            type: 'SET_CANDIDATES',
            payload: payload.candidates,
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function executeGenerate(
    contactRef: string,
    contactName: string,
    isGroupOverride?: boolean,
    unreadOverride?: number,
  ): Promise<void> {
    const generation = ++generationRef.current;
    performance.clearMarks('sayso-generation-start');
    performance.mark('sayso-generation-start');
    dispatch({ type: 'GENERATE_START' });

    const isGroup =
      isGroupOverride ??
      state.isGroup ??
      state.candidates.find((c) => c.contactRef === contactRef)?.isGroup ??
      false;
    const unreadCount =
      unreadOverride ??
      state.unreadCount ??
      state.candidates.find((c) => c.contactRef === contactRef)?.unreadCount ??
      0;

    try {
      const res = await sendToBackground({
        type: 'GENERATE_REQUEST',
        payload: {
          contactRef,
          contactName,
          replyMode: state.replyMode,
          isGroup,
          unreadCount,
        },
      });

      // A response can arrive after the user has switched chats. Never render
      // it into the new conversation.
      if (generation !== generationRef.current || activeContactRef.current !== contactRef) return;
      if (res.success && res.data) {
        dispatch({ type: 'GENERATE_SUCCESS', payload: res.data as GenerateRepliesResponse });
      } else {
        const rawErr = (res as { error?: string }).error ?? 'Generation failed';
        dispatch({ type: 'GENERATE_ERROR', payload: formatFriendlyError(rawErr) });
      }
    } catch (err) {
      if (generation === generationRef.current && activeContactRef.current === contactRef) {
        dispatch({ type: 'GENERATE_ERROR', payload: formatFriendlyError(err) });
      }
    }
  }

  async function generateReplies(): Promise<void> {
    if (!state.contactRef || !state.contactName) return;
    await executeGenerate(state.contactRef, state.contactName, state.isGroup, state.unreadCount);
  }

  async function insertReply(text: string): Promise<void> {
    await sendToBackground({ type: 'INSERT_REPLY', payload: { text } });
  }

  async function dismissCandidate(contactRef: string, revision: string): Promise<void> {
    // Optimistic UI update
    dispatch({
      type: 'SET_CANDIDATES',
      payload: state.candidates.filter((c) => c.contactRef !== contactRef),
    });

    await sendToBackground({
      type: 'DISMISS_CANDIDATE',
      payload: { contactRef, revision },
    }).catch(console.error);
  }

  async function openChat(contactName: string): Promise<void> {
    const candidate = state.candidates.find(
      (c) => (c.contactName || c.contactRef.replace('wa:', '')) === contactName
    );

    const generation = ++generationRef.current;
    activeContactRef.current = candidate?.contactRef ?? null;
    pendingContactSwitchRef.current = true;

    // Make the panel responsive while WhatsApp updates the DOM and emits the
    // authoritative context event (which starts the actual request).
    dispatch({ type: 'GENERATE_START' });
    try {
      const result = await sendToBackground({
        type: 'OPEN_CHAT',
        payload: { contactName },
      });
      if (!result.success && generation === generationRef.current && pendingContactSwitchRef.current) {
        pendingContactSwitchRef.current = false;
        dispatch({ type: 'GENERATE_ERROR', payload: formatFriendlyError(result.error) });
      }
    } catch (err) {
      if (generation === generationRef.current && pendingContactSwitchRef.current) {
        pendingContactSwitchRef.current = false;
        dispatch({ type: 'GENERATE_ERROR', payload: formatFriendlyError(err) });
      }
    }

    // Generation is triggered by the authoritative CONVERSATION_CONTEXT event
    // from WhatsApp. Starting another delayed request here caused duplicate
    // model calls and allowed stale replies to race the new contact.
  }

  async function refreshCandidates(): Promise<void> {
    dispatch({ type: 'SET_SCANNING', payload: true });
    try {
      const res = await sendToBackground({ type: 'GET_CANDIDATES' });
      if (res.success && res.data) {
        dispatch({
          type: 'SET_CANDIDATES',
          payload: res.data as ReplyCandidate[],
        });
      } else {
        dispatch({ type: 'SET_SCANNING', payload: false });
      }
    } catch (err) {
      console.error('Failed to refresh candidates:', err);
      dispatch({ type: 'SET_SCANNING', payload: false });
    }
  }

  function setReplyMode(mode: 'all_at_once' | 'point_by_point'): void {
    dispatch({ type: 'SET_REPLY_MODE', payload: mode });
  }

  function clearError(): void {
    dispatch({ type: 'CLEAR_ERROR' });
  }

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        generateReplies,
        insertReply,
        dismissCandidate,
        openChat,
        refreshCandidates,
        setReplyMode,
        clearError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
