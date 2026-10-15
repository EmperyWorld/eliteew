/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * U3.1-B lock: Medium body portals (Guides/Tour, Admin, Surveys, UnifiedContent,
 * EWRP) use ShellPortalMount / DesktopPortaledConfirmShell — no createPortal(..., document.body).
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FRONTEND_SRC = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../..'
);

const MEDIUM_PORTAL_FILES = [
	'components/guided-tour/SpotlightGuideModal.tsx',
	'components/guided-tour/CreativeStudioGuideTourModal.tsx',
	'pages/StudioGU/voiceCommand/components/VoiceCommandGuideModal.tsx',
	'pages/StudioGU/voiceCommand/components/CommandHistoryPanel.tsx',
	'pages/ContentManager/components/ContentManagerGuideModal.tsx',
	'pages/Admin/assistant/AssistantAdminDeleteModal.tsx',
	'pages/Admin/assistant/AssistantAdminBulkActionModal.tsx',
	'pages/Admin/EwDeskAdminSection.tsx',
	'features/surveys/desktop/SurveyRunnerExitConfirm.tsx',
	'components/UnifiedContent/picker/UnifiedContentPickerModal.tsx',
	'components/UnifiedContent/components/FileCard/FileCard.tsx',
	'components/EWRP/EwrpSlideImagePreview.tsx',
] as const;

function stripComments(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('U3.1-B Medium body portals → ShellPortalMount', () => {
	it.each(MEDIUM_PORTAL_FILES)('%s mounts via Shell portal API', (rel) => {
		const raw = readFileSync(join(FRONTEND_SRC, rel), 'utf8');
		const src = stripComments(raw);
		const usesShellMount =
			raw.includes('ShellPortalMount') ||
			raw.includes('DesktopPortaledConfirmShell') ||
			raw.includes('useShellPortal');
		expect(usesShellMount).toBe(true);
		expect(src).not.toMatch(/createPortal\s*\(/);
	});
});
