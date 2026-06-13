export type AutosuggestEditor = HTMLTextAreaElement | HTMLElement;

export function isTextareaEditor(editor: AutosuggestEditor): editor is HTMLTextAreaElement {
  return editor instanceof HTMLTextAreaElement;
}

export function getEditableRoot(target: EventTarget | null): AutosuggestEditor | null {
  if (target instanceof HTMLTextAreaElement) return target;
  if (!(target instanceof HTMLElement)) return null;

  let current: HTMLElement | null = target;
  while (current) {
    if (current.hasAttribute('contenteditable')) {
      return current.getAttribute('contenteditable')?.toLowerCase() === 'false' ? null : current;
    }
    current = current.parentElement;
  }
  return null;
}

export function getEditorText(editor: AutosuggestEditor): string {
  if (isTextareaEditor(editor)) return editor.value;
  return editor.innerText || editor.textContent || '';
}

function selectionBelongsToEditor(editor: HTMLElement, selection: Selection | null): selection is Selection {
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer);
}

export function hasCollapsedCaret(editor: AutosuggestEditor): boolean {
  if (isTextareaEditor(editor)) {
    return editor.selectionStart != null
      && editor.selectionEnd != null
      && editor.selectionStart === editor.selectionEnd;
  }
  return selectionBelongsToEditor(editor, window.getSelection());
}

export function getContenteditableCaretRect(editor: HTMLElement): DOMRect | null {
  const selection = window.getSelection();
  if (!selectionBelongsToEditor(editor, selection)) return null;

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(false);
  const rect = range.getBoundingClientRect();
  if (rect.width || rect.height || rect.top || rect.left) return rect;

  const editorRect = editor.getBoundingClientRect();
  return new DOMRect(editorRect.left, editorRect.top, 0, editorRect.height);
}

function createInputEvent(type: 'beforeinput' | 'input', suggestion: string): Event {
  try {
    return new InputEvent(type, {
      bubbles: true,
      cancelable: type === 'beforeinput',
      inputType: 'insertText',
      data: suggestion,
    });
  } catch {
    return new Event(type, { bubbles: true, cancelable: type === 'beforeinput' });
  }
}

function insertWithRange(editor: HTMLElement, suggestion: string): boolean {
  const selection = window.getSelection();
  if (!selectionBelongsToEditor(editor, selection)) return false;
  if (!editor.dispatchEvent(createInputEvent('beforeinput', suggestion))) return false;

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const textNode = document.createTextNode(suggestion);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  editor.dispatchEvent(createInputEvent('input', suggestion));
  return true;
}

function insertIntoContenteditable(editor: HTMLElement, suggestion: string): boolean {
  if (!selectionBelongsToEditor(editor, window.getSelection())) return false;

  let inputObserved = false;
  const markInput = () => { inputObserved = true; };
  editor.addEventListener('input', markInput, { once: true });

  let inserted = false;
  try {
    inserted = typeof document.execCommand === 'function'
      && document.execCommand('insertText', false, suggestion);
  } catch {
    inserted = false;
  }
  editor.removeEventListener('input', markInput);

  if (!inserted) return insertWithRange(editor, suggestion);
  if (!inputObserved) editor.dispatchEvent(createInputEvent('input', suggestion));
  return true;
}

export function insertSuggestion(editor: AutosuggestEditor, suggestion: string): boolean {
  if (!suggestion || !hasCollapsedCaret(editor)) return false;

  if (isTextareaEditor(editor)) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText(suggestion, start, end, 'end');
    editor.dispatchEvent(createInputEvent('input', suggestion));
    return true;
  }

  return insertIntoContenteditable(editor, suggestion);
}
