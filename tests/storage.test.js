import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const set = vi.fn();
const remove = vi.fn();

global.chrome = {
  storage: {
    local: { get, set, remove },
  },
};

const {
  getLocalStorage,
  removeLocalStorage,
  setLocalStorage,
} = await import('../src/shared/storage.js');

describe('typed local storage boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves callback-style reads', () => {
    const callback = vi.fn();
    get.mockImplementation((keys, done) => done({ theme: 'dark' }));

    getLocalStorage('theme', callback);

    expect(get).toHaveBeenCalledWith('theme', callback);
    expect(callback).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('preserves promise-style reads', async () => {
    get.mockResolvedValue({ userApiKey: 'sk-test' });

    await expect(getLocalStorage('userApiKey')).resolves.toEqual({
      userApiKey: 'sk-test',
    });
  });

  it('preserves callback-style writes', () => {
    const callback = vi.fn();

    setLocalStorage({ dobbyEnabled: true }, callback);

    expect(set).toHaveBeenCalledWith({ dobbyEnabled: true }, callback);
  });

  it('preserves promise-style writes', async () => {
    set.mockResolvedValue(undefined);

    await expect(setLocalStorage({ theme: 'auto' })).resolves.toBeUndefined();
  });

  it('preserves callback-style removals', () => {
    const callback = vi.fn();

    removeLocalStorage('userApiKey', callback);

    expect(remove).toHaveBeenCalledWith('userApiKey', callback);
  });
});
