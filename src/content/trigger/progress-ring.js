// src/content/trigger/progress-ring.js — Progress ring UI for long-press feedback

import { longPressState } from '../shared/state.js';
import { removeElement } from '../shared/dom-utils.js';
import { Z_INDEX, THEME } from '../shared/constants.js';

export function _ensureProgressRingStyles() {
  if (document.getElementById('dobby-progress-ring-styles')) return;
  const style = document.createElement('style');
  style.id = 'dobby-progress-ring-styles';
  style.textContent = `
    @keyframes dobby-ring-fill {
      from { stroke-dashoffset: 62.8; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes dobby-icon-fade {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
      to { opacity: 0.9; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes dobby-ring-appear {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

export function _showProgressRing(x, y) {
  _removeProgressRing();
  _ensureProgressRingStyles();

  const SIZE = 28;
  const HALF = SIZE / 2;
  const RADIUS = 10;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~62.8

  const container = document.createElement('div');
  container.setAttribute('data-dobby-progress-ring', '');
  Object.assign(container.style, {
    position: 'fixed',
    left: (x - HALF) + 'px',
    top: (y - HALF) + 'px',
    width: SIZE + 'px',
    height: SIZE + 'px',
    pointerEvents: 'none',
    zIndex: String(Z_INDEX.PROGRESS_RING),
    animation: 'dobby-ring-appear 0.15s ease-out forwards',
  });

  // Frosted backdrop circle
  const backdrop = document.createElement('div');
  Object.assign(backdrop.style, {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: (SIZE - 6) + 'px',
    height: (SIZE - 6) + 'px',
    borderRadius: '50%',
    background: 'rgba(250, 250, 249, 0.92)',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(28, 25, 23, 0.08), 0 0 0 1px rgba(120, 113, 108, 0.12)',
  });
  container.appendChild(backdrop);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', String(SIZE));
  svg.setAttribute('height', String(SIZE));
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.style.transform = 'rotate(-90deg)';
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';

  // Background track
  const track = document.createElementNS(svgNS, 'circle');
  track.setAttribute('cx', String(HALF));
  track.setAttribute('cy', String(HALF));
  track.setAttribute('r', String(RADIUS));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'rgba(120,113,108,0.3)');
  track.setAttribute('stroke-width', '3');
  svg.appendChild(track);

  // Animated fill circle
  const fill = document.createElementNS(svgNS, 'circle');
  fill.setAttribute('cx', String(HALF));
  fill.setAttribute('cy', String(HALF));
  fill.setAttribute('r', String(RADIUS));
  fill.setAttribute('fill', 'none');
  fill.setAttribute('stroke', '#44403c');
  fill.setAttribute('stroke-width', '3');
  fill.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
  fill.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE));
  fill.setAttribute('stroke-linecap', 'round');
  fill.style.animation = 'dobby-ring-fill 0.5s linear forwards';
  fill.style.filter = 'drop-shadow(0 0 4px rgba(68,64,60,0.4))';
  svg.appendChild(fill);

  container.appendChild(svg);

  // Camera icon (separate SVG, not rotated)
  const iconSvg = document.createElementNS(svgNS, 'svg');
  iconSvg.setAttribute('width', '10');
  iconSvg.setAttribute('height', '10');
  iconSvg.setAttribute('viewBox', '0 0 24 24');
  iconSvg.setAttribute('fill', 'none');
  iconSvg.setAttribute('stroke', '#44403c');
  iconSvg.setAttribute('stroke-width', '2');
  iconSvg.setAttribute('stroke-linecap', 'round');
  Object.assign(iconSvg.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    animation: 'dobby-icon-fade 0.3s ease forwards',
  });

  const camBody = document.createElementNS(svgNS, 'rect');
  camBody.setAttribute('x', '2');
  camBody.setAttribute('y', '5');
  camBody.setAttribute('width', '20');
  camBody.setAttribute('height', '15');
  camBody.setAttribute('rx', '2');
  iconSvg.appendChild(camBody);

  const camLens = document.createElementNS(svgNS, 'circle');
  camLens.setAttribute('cx', '12');
  camLens.setAttribute('cy', '13');
  camLens.setAttribute('r', '3');
  iconSvg.appendChild(camLens);

  const camTop = document.createElementNS(svgNS, 'path');
  camTop.setAttribute('d', 'M8 5l1-2h6l1 2');
  iconSvg.appendChild(camTop);

  container.appendChild(iconSvg);
  document.body.appendChild(container);
  longPressState.ring = container;
}

export function _removeProgressRing() {
  if (longPressState.ring) {
    removeElement(longPressState.ring);
    longPressState.ring = null;
  }
}
