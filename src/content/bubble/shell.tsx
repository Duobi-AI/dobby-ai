import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { BRAND_MARK_DATA_URI, BRAND_NAME } from '../../shared/brand.js';
import { getColorPalette } from '../../shared/color-palette.js';
import { OPEN_OPTIONS_MESSAGE } from '../../shared/runtime-messages.js';
import type { HistoryEntry, ImageContentPart, Preset } from '../../shared/types';
import { rawResponses } from '../shared/state.js';
import { TIMING } from '../shared/constants.js';
import { renderMarkdown } from './markdown.js';
import { useBubbleViewState, type BubbleViewMessage } from './view-model.js';

const colors = getColorPalette('light');

export type BubblePresetSelection = {
  detectionLabel?: string;
  presets: Preset[];
  customPlaceholder: string;
  onPreset: (preset: Preset) => void;
  onCustom: (instruction: string) => void;
  onEscape: () => void;
};

export type BubbleShellProps = {
  styles: string;
  previewText: string;
  previewLabel: string;
  images?: ImageContentPart[] | null;
  presets?: BubblePresetSelection;
  onFollowUp: (question: string) => void;
  onHistory: () => void;
  onHistoryEntry: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
};

function PinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17v5" />
      <path d="M9 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7" />
      <path d="M5 15h14l-1.5-4H6.5L5 15z" />
    </svg>
  );
}

function ResizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12">
      <line x1="8" y1="4" x2="4" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="8" x2="8" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Preview({
  previewText,
  previewLabel,
  images,
}: Pick<BubbleShellProps, 'previewText' | 'previewLabel' | 'images'>) {
  if (!previewText && !images?.length) return null;

  return (
    <div className="selected-text-preview">
      <div className="label">{previewLabel || (images?.length ? 'Image' : 'Selected text')}</div>
      {images?.length ? (
        <div className="image-preview">
          {images.map((image, index) => (
            <img
              key={`${image.image_url.url}-${index}`}
              src={image.image_url.url}
              alt="Preview"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ))}
        </div>
      ) : null}
      {previewText ? <div className="text">{previewText}</div> : null}
    </div>
  );
}

function PresetSelection({ selection }: { selection: BubblePresetSelection }) {
  const handlePresetMouseDown = (
    event: ReactMouseEvent<HTMLDivElement>,
    preset: Preset,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    selection.onPreset(preset);
  };

  const handleCustomKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.currentTarget.value.trim()) {
      selection.onCustom(event.currentTarget.value.trim());
    }
    if (event.key === 'Escape') selection.onEscape();
  };

  return (
    <>
      {selection.detectionLabel ? (
        <div className="detection-badge">{selection.detectionLabel}</div>
      ) : null}
      <div className="preset-chips">
        {selection.presets.slice(0, 4).map((preset) => (
          <div
            className="preset-chip"
            key={`${preset.label}-${preset.instruction}`}
            onMouseDown={(event) => handlePresetMouseDown(event, preset)}
          >
            {preset.label}
          </div>
        ))}
      </div>
      <input
        className="preset-input"
        placeholder={selection.customPlaceholder}
        onKeyDown={handleCustomKeyDown}
      />
    </>
  );
}

function CopyButton({ responseIdx }: { responseIdx: number }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const text = rawResponses[responseIdx];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_DURATION);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), TIMING.COPY_FEEDBACK_DURATION);
    }
  };

  return (
    <button
      className={`copy-btn${copied ? ' copied' : ''}`}
      title={failed ? 'Copy failed' : 'Copy'}
      aria-label="Copy response"
      data-response-idx={String(responseIdx)}
      style={failed ? { color: colors.danger } : undefined}
      onClick={copy}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function ConversationMessage({ message }: { message: BubbleViewMessage }) {
  if (message.role === 'user') {
    return <div className="message-user">{message.content}</div>;
  }

  return (
    <div className="message-ai">
      <div className="message-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
      {message.errorMessage ? (
        <div className="error-msg">
          {message.errorMessage}
          <button className="retry-btn" onClick={message.onRetry}>Retry</button>
        </div>
      ) : null}
      {message.responseIdx != null ? <CopyButton responseIdx={message.responseIdx} /> : null}
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function BubbleBody({
  onHistoryEntry,
  onClearHistory,
}: Pick<BubbleShellProps, 'onHistoryEntry' | 'onClearHistory'>) {
  const view = useBubbleViewState();
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    lightboxRef.current?.focus();
  }, [lightbox]);

  const openResponseImage = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('response-img')) return;
    const image = target as HTMLImageElement;
    flushSync(() => setLightbox({ src: image.src, alt: image.alt }));
  };

  if (view.bodyMode === 'rate-limit') {
    return (
      <div className="bubble-body">
        <div className="rate-limit-msg">
          <p>You've used your 30 free questions today.</p>
          <p style={{ marginTop: '8px' }}>Add your own API key in Settings for unlimited access.</p>
          <span className="cta" onClick={() => chrome.runtime.sendMessage(OPEN_OPTIONS_MESSAGE)}>
            Open Settings →
          </span>
        </div>
      </div>
    );
  }

  if (view.bodyMode === 'history') {
    return (
      <div className="bubble-body">
        <div className="history-panel">
          {view.historyMessage ? <p className="history-empty">{view.historyMessage}</p> : null}
          {!view.historyMessage && view.historyEntries.length === 0 ? (
            <p className="history-empty">No history yet</p>
          ) : null}
          {!view.historyMessage ? view.historyEntries.map((entry, index) => (
            <div className="history-entry" key={entry.id || `${entry.timestamp}-${index}`} onClick={() => onHistoryEntry(entry)}>
              <div className="history-instruction">
                {(entry.text || entry.instruction || '').substring(0, 60)}
              </div>
              <div className="history-meta">
                {entry.pageTitle || 'Unknown page'} · {getTimeAgo(entry.timestamp)}
              </div>
            </div>
          )) : null}
          {view.historyEntries.length > 0 && !view.historyMessage ? (
            <span className="clear-link" onClick={onClearHistory}>Clear all history</span>
          ) : null}
        </div>
      </div>
    );
  }

  const lightboxTarget = bodyRef.current?.getRootNode();
  const lightboxView = lightbox && lightboxTarget instanceof ShadowRoot
    ? createPortal(
      <div
        className="img-lightbox"
        tabIndex={0}
        ref={lightboxRef}
        onClick={() => flushSync(() => setLightbox(null))}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.stopPropagation();
          flushSync(() => setLightbox(null));
        }}
      >
        <img src={lightbox.src} alt={lightbox.alt} />
      </div>,
      lightboxTarget,
    )
    : null;

  return (
    <>
      <div className="bubble-body" ref={bodyRef} onClick={openResponseImage}>
        {view.restoredResponse ? (
          <div className="response-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(view.restoredResponse) }} />
        ) : (
          <div className="response-text">
            {view.messages.map((message) => <ConversationMessage key={message.id} message={message} />)}
          </div>
        )}
        <span className={`cursor blink${view.cursorVisible ? '' : ' hidden'}`} />
      </div>
      {lightboxView}
    </>
  );
}

function ResponseSection({
  onFollowUp,
  onHistory,
  onHistoryEntry,
  onClearHistory,
}: Pick<BubbleShellProps, 'onFollowUp' | 'onHistory' | 'onHistoryEntry' | 'onClearHistory'>) {
  const view = useBubbleViewState();

  const handleFollowUpKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !event.currentTarget.value.trim()) return;
    const question = event.currentTarget.value.trim();
    event.currentTarget.value = '';
    onFollowUp(question);
  };

  return (
    <div className={`response-section${view.responseActive ? ' active' : ''}`}>
      <BubbleBody onHistoryEntry={onHistoryEntry} onClearHistory={onClearHistory} />
      <div className="bubble-footer">
        <input
          className="follow-up-input"
          placeholder="Ask a follow-up..."
          disabled={view.followUpDisabled}
          onKeyDown={handleFollowUpKeyDown}
        />
        <button className="action-btn history-btn" title="History" onClick={onHistory}>🕐</button>
      </div>
    </div>
  );
}

export function BubbleShell({
  styles,
  previewText,
  previewLabel,
  images,
  presets,
  onFollowUp,
  onHistory,
  onHistoryEntry,
  onClearHistory,
}: BubbleShellProps) {
  const view = useBubbleViewState();
  return (
    <>
      <style>{styles}</style>
      <div className="bubble">
        <div className="bubble-header">
          <span className="bubble-logo">
            <img className="bubble-logo-mark" src={BRAND_MARK_DATA_URI} alt="" aria-hidden="true" />
            <span>{BRAND_NAME}</span>
          </span>
          <span className="bubble-status">{view.status}</span>
          <button className="pin-btn" title="Pin">
            <PinIcon />
          </button>
          <button className="close-btn" title="Close">✕</button>
        </div>
        <Preview previewText={previewText} previewLabel={view.previewLabel || previewLabel} images={images} />
        {presets ? (
          <div className={view.presetsCollapsed ? 'presets-section collapsed' : 'presets-section'}>
            <PresetSelection selection={presets} />
          </div>
        ) : null}
        <ResponseSection
          onFollowUp={onFollowUp}
          onHistory={onHistory}
          onHistoryEntry={onHistoryEntry}
          onClearHistory={onClearHistory}
        />
        <div className="resize-handle" title="Drag to resize">
          <ResizeIcon />
        </div>
      </div>
    </>
  );
}
