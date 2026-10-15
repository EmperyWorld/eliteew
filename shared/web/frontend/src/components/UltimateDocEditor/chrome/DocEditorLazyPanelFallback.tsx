/**
 * Suspense fallback для ленивых панелей редактора (z-index как у стека порталов окна).
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export function DocEditorLazyPanelFallback(): React.JSX.Element {
	const docSidePanelZ = useDocEditorSidePanelZIndex();
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	return (
		<div
			className={cn(
				'fixed inset-0 flex items-center justify-center',
				DESKTOP_OVERLAY.backdrop
			)}
			style={{
				zIndex: docSidePanelZ,
			}}
			role="status"
			aria-live="polite"
			aria-label={t('lazyPanel.loadingAria')}
		>
			<div className="flex flex-col items-center gap-3 rounded-2xl border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) px-8 py-6 shadow-(--desktop-shadow-panel)">
				<ArrowPathIcon className="h-8 w-8 shrink-0 animate-spin text-[rgb(var(--desktop-accent-rgb))]" />
				<span className="text-sm text-(--desktop-text-muted)">
					{t('lazyPanel.loadingLabel')}
				</span>
			</div>
		</div>
	);
}
