import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { BRAND_MARK_DATA_URI, BRAND_NAME } from '../../shared/brand.js';
import type { Preset, ToolbarHost, ToolbarState } from '../../shared/types';

type ToolbarShellProps = {
  styles: string;
  host: ToolbarHost;
  getPresets: () => Preset[];
  onPreset: (preset: Preset) => void;
  onCustom: (instruction: string) => void;
  onModeChange: (mode: ToolbarState) => void;
  onEnterInput: () => void;
  onExitInput: () => void;
  onPauseAutoHide: () => void;
  onResumeAutoHide: () => void;
};

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function ToolbarShell({
  styles,
  host,
  getPresets,
  onPreset,
  onCustom,
  onModeChange,
  onEnterInput,
  onExitInput,
  onPauseAutoHide,
  onResumeAutoHide,
}: ToolbarShellProps) {
  const [mode, setMode] = useState<ToolbarState>('collapsed');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [input, setInput] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const changeMode = (nextMode: ToolbarState) => {
    onModeChange(nextMode);
    flushSync(() => setMode(nextMode));
  };

  const expand = () => {
    onPauseAutoHide();
    if (mode !== 'collapsed') return;
    const nextPresets = getPresets();
    onModeChange('expanded');
    flushSync(() => {
      setPresets(nextPresets);
      setMode('expanded');
    });
  };

  const collapse = () => {
    if (mode !== 'expanded') return;
    changeMode('collapsed');
    onResumeAutoHide();
  };

  const enterInput = () => {
    onPauseAutoHide();
    onEnterInput();
    flushSync(() => setInput(''));
    changeMode('input');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const exitInput = () => {
    onExitInput();
    flushSync(() => setInput(''));
    changeMode('expanded');
    onResumeAutoHide();
  };

  const submit = () => {
    const instruction = inputRef.current?.value.trim() || input.trim();
    if (instruction) onCustom(instruction);
  };

  useLayoutEffect(() => {
    if (mode !== 'expanded') return;
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    toolbar.style.width = 'auto';
    const naturalWidth = toolbar.scrollWidth;
    toolbar.style.width = '';
    toolbar.style.setProperty('--toolbar-expanded-width', `${Math.max(naturalWidth + 8, 180)}px`);
  }, [mode, presets]);

  useEffect(() => {
    if (mode !== 'input') return;
    const handleOutsideClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!host.contains(target) && !host.shadowRoot?.contains(target)) exitInput();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleOutsideClick, true), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, [mode, host]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      exitInput();
    }
  };

  const handlePencilClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (mode === 'input') exitInput();
    else enterInput();
  };

  return (
    <>
      <style>{styles}</style>
      <div
        className={`toolbar${mode !== 'collapsed' ? ' expanded' : ''}`}
        ref={toolbarRef}
        onMouseEnter={expand}
        onMouseLeave={collapse}
      >
        <div className="toolbar-row">
          <div className="toolbar-icon">
            <img src={BRAND_MARK_DATA_URI} alt={BRAND_NAME} />
          </div>
          <div className="toolbar-expand">
            <div className="toolbar-sep" style={mode === 'input' ? { opacity: 0 } : undefined} />
            <div
              className="toolbar-actions"
              style={mode === 'input' ? { opacity: 0, pointerEvents: 'none' } : undefined}
            >
              {presets.slice(0, 2).map((preset) => (
                <button
                  className="toolbar-action"
                  key={`${preset.label}-${preset.instruction}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPreset(preset);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="toolbar-sep" style={mode === 'input' ? { opacity: 0 } : undefined} />
            <button
              className={`toolbar-pencil${mode === 'input' ? ' close-mode' : ''}`}
              title={mode === 'input' ? 'Cancel' : 'Custom prompt'}
              onClick={handlePencilClick}
            >
              {mode === 'input' ? <CloseIcon /> : <PencilIcon />}
            </button>
          </div>
          <div className={`toolbar-input-section${mode === 'input' ? ' visible' : ''}`}>
            <input
              className="toolbar-input-field"
              type="text"
              placeholder="Ask about this..."
              ref={inputRef}
              value={input}
              onInput={(event) => flushSync(() => setInput(event.currentTarget.value))}
              onKeyDown={handleInputKeyDown}
            />
            <button
              className={`toolbar-send${input.trim() ? '' : ' disabled'}`}
              title="Send"
              onClick={(event) => {
                event.stopPropagation();
                submit();
              }}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
