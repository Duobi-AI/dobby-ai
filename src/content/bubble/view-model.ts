// Compatibility facade. The bubble lifecycle module owns both the React snapshot
// and the mutable response state; callers should prefer lifecycle.ts directly.
export {
  activateBubbleResponse,
  addUserResponse,
  completeAssistantResponse,
  failAssistantResponse,
  getBubbleViewState,
  removeBubbleMessage,
  resetBubbleView,
  setAssistantResponse,
  setBubblePreviewLabel,
  setBubbleViewStatus,
  showHistoryView,
  showRateLimitView,
  showRestoredHistoryResponse,
  startAssistantResponse,
  subscribeBubbleView,
  useBubbleViewState,
} from './lifecycle.js';
export type {
  BubbleBodyMode,
  BubbleLifecycleSnapshot,
  BubbleViewMessage,
  BubbleViewState,
} from './lifecycle.js';
