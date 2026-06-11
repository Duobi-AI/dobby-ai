import type { ImageContentPart, StreamRequestHandle } from './ai';
import type { ContentSubtype, ContentType } from './content';

export type Cleanup = () => void;
export type ToolbarState = 'collapsed' | 'expanded' | 'input' | 'morphed';

export type PreservedSelection = {
  rangeCount: 1;
  getRangeAt: (index: 0) => Range;
};

export type SelectionData = {
  text?: string;
  anchorNode?: Node | null;
  images?: ImageContentPart[] | null;
  selection?: Selection | PreservedSelection | null;
};

export interface ToolbarHost extends HTMLDivElement {
  _themeCleanup?: Cleanup;
  _reactCleanup?: Cleanup;
  _detectedType?: ContentType;
  _detectedSubType?: ContentSubtype;
  _selectedText?: string;
  _anchorNode?: Node | null;
  _images?: ImageContentPart[] | null;
  _imagesPromise?: Promise<ImageContentPart[] | null> | null;
  _selectionForImages?: PreservedSelection | null;
  _selectionRequestId?: number;
  _isMorphing?: boolean;
}

export interface BubbleHost extends HTMLDivElement {
  _isPinned?: boolean;
  _escHandler?: (event: KeyboardEvent) => void;
  _themeCleanup?: Cleanup;
  _reactCleanup?: Cleanup;
  _dragCleanup?: Cleanup;
  _resizeCleanup?: Cleanup;
}

export interface ScreenshotOverlay extends HTMLDivElement {
  _escHandler?: (event: KeyboardEvent) => void;
}

export type ScreenshotState = {
  overlay: ScreenshotOverlay | null;
  startX: number;
  startY: number;
  rect: HTMLDivElement | null;
  dragStarted: boolean;
};

export type LongPressState = {
  timer: ReturnType<typeof setTimeout> | null;
  startX: number;
  startY: number;
  ring: HTMLDivElement | null;
  ringTimer: ReturnType<typeof setTimeout> | null;
};

export type ContentScriptState = {
  bubbleHost: BubbleHost | null;
  currentRequest: StreamRequestHandle | null;
  triggerButton: ToolbarHost | null;
  toolbarHost: ToolbarHost | null;
  toolbarState: ToolbarState;
  screenshotState: ScreenshotState;
  longPressState: LongPressState;
};
