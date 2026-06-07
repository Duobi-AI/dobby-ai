// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { applyColorVariables, COLOR_PALETTE, getColorPalette } from '../src/shared/color-palette.js';

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('color palette', () => {
  it('keeps light and dark semantic token contracts aligned', () => {
    expect(Object.keys(COLOR_PALETTE.dark).sort()).toEqual(Object.keys(COLOR_PALETTE.light).sort());
  });

  it('preserves the current Dobby palette values', () => {
    expect(COLOR_PALETTE.light.accent).toBe('#7c3aed');
    expect(COLOR_PALETTE.light.backgroundPage).toBe('#fff');
    expect(COLOR_PALETTE.light.textPrimary).toBe('#18181b');
    expect(COLOR_PALETTE.dark.backgroundPage).toBe('#1e1e28');
    expect(COLOR_PALETTE.dark.textPrimary).toBe('#e4e4e7');
    expect(COLOR_PALETTE.dark.accentInteractive).toBe('#a78bfa');
  });

  it('falls back to light for unknown resolved themes', () => {
    expect(getColorPalette('unknown')).toBe(COLOR_PALETTE.light);
  });

  it('applies semantic tokens as CSS custom properties', () => {
    applyColorVariables(document.documentElement, 'dark');

    expect(document.documentElement.style.getPropertyValue('--color-background-page')).toBe('#1e1e28');
    expect(document.documentElement.style.getPropertyValue('--color-accent-interactive')).toBe('#a78bfa');
  });

  it('keeps UI color literals centralized', () => {
    const files = [
      ...walk(join(process.cwd(), 'src')).filter((path) => path.endsWith('.js')),
      join(process.cwd(), 'popup.html'),
      join(process.cwd(), 'options.html'),
    ].filter((path) => !path.endsWith('src/shared/color-palette.js') && !path.endsWith('src/content/detection.js'));
    const colorLiteral = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/;
    const offenders = files.filter((path) => colorLiteral.test(readFileSync(path, 'utf8')));

    expect(offenders).toEqual([]);
  });
});
