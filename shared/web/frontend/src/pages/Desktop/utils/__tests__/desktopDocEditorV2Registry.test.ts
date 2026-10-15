/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for the visible Document Editor V2 desktop registration surface.
 *
 * Invariants:
 * - `DocEditorV2` is a distinct visible app and must not replace the legacy `DocEditor`.
 * - Legacy `DocEditor` remains the default document editor component.
 *
 * Related:
 * - src/features/documentEditorV2/DocEditorV2.tsx
 * - documentation/product/DOCUMENT-EDITOR-V2.md
 */

import { describe, expect, it } from 'vitest';

import { getDesktopAppFamily } from '../../components/DesktopAppChrome';
import { DEFAULT_APPS } from '../../constants';
import { getDesktopWindowAppContent } from '../../components/desktopWindowAppContent';
import { parseAssistantDesktopAppHref } from '../assistantDesktopLinkComponents';
import { isKnownDesktopAppComponent } from '../desktopAppRegistry';
import { preloadDesktopApp } from '../preloadDesktopApp';

describe('DocEditorV2 desktop registration', () => {
	it('keeps V2 visible without replacing the default DocEditor', () => {
		expect(
			DEFAULT_APPS.find((item) => item.appComponent === 'DocEditor')
		).toBeTruthy();
		expect(
			DEFAULT_APPS.find((item) => item.appComponent === 'DocEditorV2')
		).toMatchObject({
			id: 'app-doc-editor-v2',
			name: 'Редактор документов V2',
		});

		expect(isKnownDesktopAppComponent('DocEditorV2')).toBe(true);
		expect(getDesktopAppFamily('DocEditorV2')).toBe('docs');
		expect(getDesktopWindowAppContent('DocEditorV2')).not.toBeNull();
		expect(preloadDesktopApp('DocEditorV2')).toBeInstanceOf(Promise);
		expect(
			parseAssistantDesktopAppHref('/__eliteew-desktop-open-app__/DocEditorV2')
		).toBe('DocEditorV2');
	});
});
