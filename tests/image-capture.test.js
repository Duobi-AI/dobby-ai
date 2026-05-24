// tests/image-capture.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, afterAll, beforeAll } from 'vitest';

// Mock chrome.runtime.sendMessage for captureScreenshot
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};

// Mock window.devicePixelRatio
Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });

// Patch HTMLImageElement.prototype.src so load/error events actually fire.
// jsdom doesn't fire these for network URLs, causing timeouts.
const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set(url) {
      originalSrcDescriptor.set.call(this, url);
      if (url && url.startsWith('data:')) {
        // Simulate successful load for data: URLs
        Object.defineProperty(this, 'naturalWidth', { value: 100, configurable: true });
        Object.defineProperty(this, 'naturalHeight', { value: 100, configurable: true });
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      } else {
        // Simulate error for network URLs
        setTimeout(() => { if (this.onerror) this.onerror(); }, 0);
      }
    },
    get() {
      return originalSrcDescriptor.get.call(this);
    },
    configurable: true,
  });
});

afterAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'src', originalSrcDescriptor);
});

const { captureImage, captureScreenshot, _downsizeBase64, _corsRefetch, _cropImage } = await import('../src/content/image-capture.js');

function spyOnConsoleWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

describe('captureImage', () => {
  it('returns null for empty string', async () => {
    expect(await captureImage('')).toBeNull();
  });

  it('returns null for null input', async () => {
    const warnSpy = spyOnConsoleWarn();
    try {
      expect(await captureImage(null)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('returns null for undefined input', async () => {
    const warnSpy = spyOnConsoleWarn();
    try {
      expect(await captureImage(undefined)).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('returns image_url object for https URL', async () => {
    // Cross-origin in jsdom → _corsRefetch fails → falls back to URL directly
    const result = await captureImage('https://example.com/photo.jpg');
    expect(result).not.toBeNull();
    expect(result.type).toBe('image_url');
    expect(result.image_url.url).toBe('https://example.com/photo.jpg');
  });

  it('returns null for blob: URL', async () => {
    const result = await captureImage('blob:https://example.com/abc-123');
    expect(result).toBeNull();
  });

  it('returns null for http: URL (non-https)', async () => {
    const result = await captureImage('http://example.com/photo.jpg');
    expect(result).toBeNull();
  });

  it('handles data:image/ URL input', async () => {
    const small = 'data:image/jpeg;base64,' + 'A'.repeat(100);
    const result = await captureImage(small);
    expect(result).not.toBeNull();
    expect(result.type).toBe('image_url');
    expect(result.image_url.url).toBe(small);
  });

  it('accepts an img element with src', async () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/test.png';
    const result = await captureImage(img);
    expect(result).not.toBeNull();
    expect(result.type).toBe('image_url');
  });

  it('returns null for img element without src', async () => {
    const img = document.createElement('img');
    const result = await captureImage(img);
    expect(result).toBeNull();
  });
});

describe('captureScreenshot', () => {
  beforeEach(() => {
    chrome.runtime.sendMessage.mockReset();
  });

  it('returns null when sendMessage returns no dataUrl', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({ error: 'failed' });
    const result = await captureScreenshot({ x: 0, y: 0, width: 100, height: 100 });
    expect(result).toBeNull();
  });

  it('returns null when sendMessage throws', async () => {
    const warnSpy = spyOnConsoleWarn();
    chrome.runtime.sendMessage.mockRejectedValue(new Error('no handler'));
    try {
      const result = await captureScreenshot({ x: 0, y: 0, width: 100, height: 100 });
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('[Dobby AI] Screenshot capture failed:', 'no handler');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('sends CAPTURE_SCREENSHOT message', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({ error: 'failed' });
    await captureScreenshot({ x: 0, y: 0, width: 100, height: 100 });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'CAPTURE_SCREENSHOT' });
  });
});

describe('_downsizeBase64', () => {
  it('returns input unchanged when under 1MB', async () => {
    const small = 'data:image/jpeg;base64,' + 'A'.repeat(100);
    const result = await _downsizeBase64(small);
    expect(result).toBe(small);
  });
});

describe('_corsRefetch', () => {
  it('returns null when image fails to load', async () => {
    const result = await _corsRefetch('https://nonexistent.example.com/img.png');
    expect(result).toBeNull();
  });
});

// Helper: capture origCreateElement before any spy wraps it
const origCreateElement = document.createElement.bind(document);

function makeCanvasMock(toDataURLResult) {
  const ctx = { drawImage: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => toDataURLResult),
    _ctx: ctx,
  };
  return canvas;
}

describe('_corsRefetch - canvas draw path', () => {
  let mockCanvas;
  let createElementSpy;

  beforeEach(() => {
    mockCanvas = makeCanvasMock('data:image/jpeg;base64,corsdrawn');
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return mockCanvas;
      return origCreateElement(tag);
    });
  });

  afterEach(() => { createElementSpy.mockRestore(); });

  it('draws loaded image to canvas and returns toDataURL result', async () => {
    const result = await _corsRefetch('data:image/jpeg;base64,validdata');
    expect(result).toBe('data:image/jpeg;base64,corsdrawn');
    expect(mockCanvas._ctx.drawImage).toHaveBeenCalled();
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
  });

  it('returns null when canvas getContext throws', async () => {
    const warnSpy = spyOnConsoleWarn();
    mockCanvas.getContext = vi.fn(() => { throw new Error('canvas unsupported'); });
    try {
      const result = await _corsRefetch('data:image/jpeg;base64,validdata');
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('[Dobby AI] Canvas operation failed:', 'canvas unsupported');
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('_cropImage', () => {
  let mockCanvas;
  let createElementSpy;

  beforeEach(() => {
    mockCanvas = makeCanvasMock('data:image/jpeg;base64,cropped');
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return mockCanvas;
      return origCreateElement(tag);
    });
    window.devicePixelRatio = 1;
  });

  afterEach(() => {
    createElementSpy.mockRestore();
    window.devicePixelRatio = 1;
  });

  it('returns cropped data URL for valid image input', async () => {
    const rect = { x: 10, y: 20, width: 100, height: 80 };
    const result = await _cropImage('data:image/jpeg;base64,fullimage', rect);
    expect(result).toBe('data:image/jpeg;base64,cropped');
    expect(mockCanvas._ctx.drawImage).toHaveBeenCalled();
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
  });

  it('accounts for devicePixelRatio in drawImage coordinates', async () => {
    window.devicePixelRatio = 2;
    const rect = { x: 5, y: 10, width: 50, height: 40 };
    await _cropImage('data:image/jpeg;base64,fullimage', rect);
    // dpr=2: sx=10, sy=20, sw=100, sh=80, dx=0, dy=0, dw=100, dh=80
    expect(mockCanvas._ctx.drawImage).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      10, 20, 100, 80,
      0, 0, 100, 80
    );
  });

  it('returns null when image fails to load', async () => {
    const result = await _cropImage('https://fail.example.com/img.jpg', { x: 0, y: 0, width: 100, height: 100 });
    expect(result).toBeNull();
  });

  it('returns null when canvas throws during draw', async () => {
    const warnSpy = spyOnConsoleWarn();
    mockCanvas.getContext = vi.fn(() => null); // null ctx causes drawImage to throw
    try {
      const result = await _cropImage('data:image/jpeg;base64,fullimage', { x: 0, y: 0, width: 50, height: 50 });
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('[Dobby AI] Canvas operation failed:', expect.any(String));
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('captureScreenshot - success path', () => {
  let mockCanvas;
  let createElementSpy;

  beforeEach(() => {
    chrome.runtime.sendMessage.mockReset();
    mockCanvas = makeCanvasMock('data:image/jpeg;base64,' + 'B'.repeat(100));
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return mockCanvas;
      return origCreateElement(tag);
    });
  });

  afterEach(() => { createElementSpy.mockRestore(); });

  it('returns image_url when screenshot and crop succeed', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,fullscreen' });
    const result = await captureScreenshot({ x: 0, y: 0, width: 200, height: 150 });
    expect(result).not.toBeNull();
    expect(result.type).toBe('image_url');
    expect(result.image_url.url).toBe('data:image/jpeg;base64,' + 'B'.repeat(100));
  });

  it('returns null when canvas throws during crop', async () => {
    const warnSpy = spyOnConsoleWarn();
    chrome.runtime.sendMessage.mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,fullscreen' });
    mockCanvas.getContext = vi.fn(() => null);
    try {
      const result = await captureScreenshot({ x: 0, y: 0, width: 200, height: 150 });
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('[Dobby AI] Canvas operation failed:', expect.any(String));
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('_downsizeBase64 - downscaling path', () => {
  let mockCanvas;
  let createElementSpy;

  beforeEach(() => {
    mockCanvas = makeCanvasMock('data:image/jpeg;base64,' + 'S'.repeat(100));
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return mockCanvas;
      return origCreateElement(tag);
    });
  });

  afterEach(() => { createElementSpy.mockRestore(); });

  it('returns scaled-down URL when base64 part exceeds 1MB', async () => {
    const largeDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(1048577);
    const result = await _downsizeBase64(largeDataUrl);
    expect(result).toBe('data:image/jpeg;base64,' + 'S'.repeat(100));
  });

  it('returns null when image remains too large after max downscale attempts', async () => {
    mockCanvas.toDataURL = vi.fn(() => 'data:image/jpeg;base64,' + 'X'.repeat(1048577));
    const largeDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(1048577);
    const result = await _downsizeBase64(largeDataUrl);
    expect(result).toBeNull();
  });
});
