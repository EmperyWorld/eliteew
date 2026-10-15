/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import path for Desktop AI Chat app; thin re-export facade.
 *
 * Invariants:
 * - Named export DesktopAiChatApp, default export, and DesktopAiChatAppProps preserved for lazyImports.
 * - Implementation lives under ./app/ (≤800 LOC per child).
 *
 * Related:
 * - app/DesktopAiChatApp.tsx, app/useDesktopAiChatAppCompose.ts
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 */

export type { DesktopAiChatAppProps } from './app/desktopAiChatAppTypes';
export { DesktopAiChatApp, default } from './app/DesktopAiChatApp';
