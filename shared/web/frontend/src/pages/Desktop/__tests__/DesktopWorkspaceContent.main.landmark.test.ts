import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard: primary desktop canvas must expose a single named landmark
 * for skip-link (#desktop-main) and screen readers (see desktop-shell UX audit).
 */
describe('DesktopWorkspaceContent', () => {
	it('uses main#desktop-main with aria-label for the workspace canvas', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const contentSrc = readFileSync(
			join(dir, '../DesktopWorkspaceContent.tsx'),
			'utf8'
		);
		const tailClusterSrc = readFileSync(
			join(dir, '../hooks/useDesktopWorkspaceContentTailCluster.ts'),
			'utf8'
		);
		const rootClusterSrc = readFileSync(
			join(dir, '../hooks/useDesktopWorkspaceShellLayoutRootCluster.ts'),
			'utf8'
		);
		const layoutSrc = readFileSync(
			join(dir, '../components/DesktopWorkspaceShellLayout.tsx'),
			'utf8'
		);
		expect(contentSrc).toContain('DesktopWorkspaceShellLayout');
		expect(tailClusterSrc).toContain(
			'useDesktopWorkspaceShellLayoutRootCluster'
		);
		expect(rootClusterSrc).toContain(
			"mainAriaLabel: p.t('workspace.mainLabel')"
		);
		expect(layoutSrc).toMatch(/<main[\s\S]*?\bid="desktop-main"/);
		expect(layoutSrc).toContain('aria-label={mainAriaLabel}');
		expect(layoutSrc).toContain('DesktopModalSuspenseFallback');
		expect(layoutSrc).toContain('DesktopShellInlineSuspenseFallback');
	});
});
