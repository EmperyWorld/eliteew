/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * cmdk theme stylesheet for Command Palette (desktop tokens only).
 *
 * Invariants:
 * - Uses DESKTOP_CMDK_INJECTED font sizes; no hardcoded palette colors.
 *
 * Related:
 * - components/CommandPalette.tsx
 */

import { DESKTOP_CMDK_INJECTED } from '../../constants';

/** cmdk stylesheet — desktop theme tokens only (light / dark). */
export const commandPaletteStyles = `
  [cmdk-root] {
    max-width: 640px;
    width: 100%;
    background: transparent;
    border-radius: 0;
    overflow: hidden;
    border: none;
    box-shadow: none;
  }

  [cmdk-input] {
    width: 100%;
    padding: 16px 20px;
    font-size: ${DESKTOP_CMDK_INJECTED.fontSizeInput};
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--desktop-border-subtle);
    color: var(--desktop-text-primary);
    outline: none;
  }

  [cmdk-input]::placeholder {
    color: var(--desktop-text-muted);
  }

  [cmdk-list] {
    max-height: 400px;
    overflow-y: auto;
    padding: 8px;
  }

  [cmdk-empty] {
    padding: 32px;
    text-align: center;
    color: var(--desktop-text-muted);
    font-size: ${DESKTOP_CMDK_INJECTED.fontSizeEmpty};
  }

  [cmdk-group-heading] {
    padding: 8px 12px;
    font-size: ${DESKTOP_CMDK_INJECTED.fontSizeGroupHeading};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--desktop-text-dim);
  }

  [cmdk-item] {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    color: var(--desktop-text-secondary);
    font-size: ${DESKTOP_CMDK_INJECTED.fontSizeItem};
    transition: background 0.1s;
  }

  [cmdk-item][data-selected="true"] {
    background: rgb(var(--desktop-accent-rgb) / 0.2);
    color: var(--desktop-text-primary);
  }

  [cmdk-item]:hover {
    background: var(--desktop-surface-soft-hover);
  }

  [cmdk-item] svg {
    width: 18px;
    height: 18px;
    color: var(--desktop-text-muted);
  }

  [cmdk-item][data-selected="true"] svg {
    color: rgb(var(--desktop-accent-rgb));
  }

  [cmdk-item]:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px rgb(var(--desktop-accent-rgb) / 0.45);
  }

  [cmdk-item][data-info-row="true"] {
    cursor: default;
  }

  [cmdk-item][data-info-row="true"]:hover {
    background: var(--desktop-surface-soft);
  }

  @media (prefers-reduced-motion: reduce) {
    [cmdk-item] {
      transition: none;
    }
  }

  [cmdk-separator] {
    height: 1px;
    background: var(--desktop-border-subtle);
    margin: 4px 0;
  }
`;
