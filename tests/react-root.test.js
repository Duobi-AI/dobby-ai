// @vitest-environment jsdom

import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mountReactRoot } from '../src/shared/react-root.js';

let handle;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  handle = null;
});

afterEach(async () => {
  if (handle) {
    await act(async () => handle.unmount());
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function createShadowRoot() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

describe('mountReactRoot', () => {
  it('mounts a React node inside an existing ShadowRoot', async () => {
    const shadow = createShadowRoot();

    await act(async () => {
      handle = mountReactRoot(shadow, createElement('span', { className: 'value' }, 'first'));
    });

    expect(shadow.querySelector('.value')?.textContent).toBe('first');
  });

  it('rerenders through the same root handle', async () => {
    const shadow = createShadowRoot();

    await act(async () => {
      handle = mountReactRoot(shadow, createElement('span', null, 'first'));
    });
    await act(async () => {
      handle.render(createElement('span', null, 'second'));
    });

    expect(shadow.textContent).toBe('second');
  });

  it('unmounts cleanly and allows repeated cleanup', async () => {
    const shadow = createShadowRoot();

    await act(async () => {
      handle = mountReactRoot(shadow, createElement('span', null, 'mounted'));
    });
    await act(async () => handle.unmount());
    await act(async () => handle.unmount());

    expect(shadow.textContent).toBe('');
    handle = null;
  });

  it('rejects rerendering after cleanup', async () => {
    const shadow = createShadowRoot();

    await act(async () => {
      handle = mountReactRoot(shadow, createElement('span', null, 'mounted'));
    });
    await act(async () => handle.unmount());

    expect(() => handle.render(createElement('span', null, 'late'))).toThrow(
      'Cannot render into an unmounted React root',
    );
    handle = null;
  });
});
