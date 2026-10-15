/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props contract for DesktopAiChatApp desktop window mount.
 *
 * Invariants:
 * - Stable shape for lazyImports and desktopWindowAppContent mounts.
 *
 * Related:
 * - DesktopAiChatApp.tsx (facade), app/DesktopAiChatApp.tsx
 */

export interface DesktopAiChatAppProps {
	initialChatId?: string;
	initialAttachUnifiedContentId?: string;
	initialAttachSourceLabel?: string | null;
	initialComposerSeed?: string;
}
