/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock overflow-clip on the desktop UI-scale wrapper (taskbar overlap regression).
 *
 * Invariants:
 * - Clip class must include overflow-clip and must not use overflow-hidden.
 *
 * Related:
 * - ../desktopUiScaleClip.ts
 * - ../../components/DesktopWorkspaceShellLayout.tsx
 */

import { describe, expect, it } from 'vitest';
import { DESKTOP_UI_SCALE_CLIP_CLASSNAME } from '../desktopUiScaleClip';

describe('desktopUiScaleClip', () => {
	it('clips without creating a scrollport (overflow-clip, not overflow-hidden)', () => {
		expect(DESKTOP_UI_SCALE_CLIP_CLASSNAME).toContain('overflow-clip');
		expect(DESKTOP_UI_SCALE_CLIP_CLASSNAME).toContain('overscroll-none');
		expect(DESKTOP_UI_SCALE_CLIP_CLASSNAME).not.toContain('overflow-hidden');
	});
});
