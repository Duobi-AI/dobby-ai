import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { BRAND_MARK_DATA_URI, BRAND_NAME } from '../../shared/brand.js';
import type { ImageContentPart, Preset } from '../../shared/types';

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
    <div className="presets-section">
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
    </div>
  );
}

export function BubbleShell({
  styles,
  previewText,
  previewLabel,
  images,
  presets,
}: BubbleShellProps) {
  return (
    <>
      <style>{styles}</style>
      <div className="bubble">
        <div className="bubble-header">
          <span className="bubble-logo">
            <img className="bubble-logo-mark" src={BRAND_MARK_DATA_URI} alt="" aria-hidden="true" />
            <span>{BRAND_NAME}</span>
          </span>
          <span className="bubble-status" />
          <button className="pin-btn" title="Pin">
            <PinIcon />
          </button>
          <button className="close-btn" title="Close">✕</button>
        </div>
        <Preview previewText={previewText} previewLabel={previewLabel} images={images} />
        {presets ? <PresetSelection selection={presets} /> : null}
        <div className="response-section">
          <div className="bubble-body">
            <div className="response-text" />
            <span className="cursor blink" />
          </div>
          <div className="bubble-footer">
            <input className="follow-up-input" placeholder="Ask a follow-up..." disabled />
            <button className="action-btn history-btn" title="History">🕐</button>
          </div>
        </div>
        <div className="resize-handle" title="Drag to resize">
          <ResizeIcon />
        </div>
      </div>
    </>
  );
}
