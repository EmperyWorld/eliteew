/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TipTap editor entry for Ultimate Doc Editor — optional-extensions loader (Core),
 * collaboration Suspense gate (TiptapEditor), and stable named exports on this path.
 *
 * Invariants:
 * - Named exports `TiptapEditor` and `TiptapEditorCore` remain on this module path.
 * - TiptapEditorCollaboration imports `TiptapEditorCore` from `./TiptapEditor`.
 *
 * Related:
 * - TiptapEditorInner.tsx, TiptapEditorCollaboration.tsx, createCoreTiptapExtensions.ts
 */
import { type AnyExtension } from '@tiptap/core';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import {
	DesktopAppEmptyState,
	DesktopAppPanel,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { log } from '../../../utils/logger';
import type { TiptapEditorProps } from '../types/editor.types';
import { TiptapEditorInner } from './TiptapEditorInner';

const EMPTY_EXTENSIONS: AnyExtension[] = [];

const CollaborativeTiptapEditor = lazy(() =>
	import('./TiptapEditorCollaboration').then((module) => ({
		default: module.CollaborativeTiptapEditor,
	}))
);

interface TiptapEditorCoreProps extends TiptapEditorProps {
	collaborationExtensions?: AnyExtension[];
}

export const TiptapEditorCore: React.FC<TiptapEditorCoreProps> = ({
	collaborationExtensions = EMPTY_EXTENSIONS,
	...props
}) => {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const [optionalExtensions, setOptionalExtensions] = useState<
		AnyExtension[] | null
	>(null);

	useEffect(() => {
		let isCancelled = false;

		void import('./createOptionalTiptapExtensions')
			.then(({ createOptionalTiptapExtensions }) => {
				if (!isCancelled) {
					setOptionalExtensions(createOptionalTiptapExtensions());
				}
			})
			.catch((error) => {
				log.error(
					'TiptapEditor',
					'Failed to load optional editor extensions',
					error instanceof Error ? error : undefined,
					error
				);
				if (!isCancelled) {
					setOptionalExtensions(EMPTY_EXTENSIONS);
				}
			});

		return () => {
			isCancelled = true;
		};
	}, []);

	if (!optionalExtensions) {
		return (
			<DesktopAppPanel className="flex h-64 items-center justify-center">
				<DesktopAppEmptyState
					title={t('loadingEditorTitle')}
					description={t('loadingEditorExtensions')}
				/>
			</DesktopAppPanel>
		);
	}

	return (
		<TiptapEditorInner
			{...props}
			collaborationExtensions={collaborationExtensions}
			optionalExtensions={optionalExtensions}
		/>
	);
};

export const TiptapEditor: React.FC<TiptapEditorProps> = (props) => {
	const { documentId, enableCollaboration = false } = props;
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);

	if (enableCollaboration && documentId) {
		return (
			<Suspense
				fallback={
					<div
						className="flex min-h-[min(640px,70vh)] w-full flex-col items-center justify-center gap-3 px-4 text-center text-slate-400"
						role="status"
						aria-live="polite"
					>
						<ArrowPathIcon
							className="h-10 w-10 shrink-0 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
							aria-hidden
						/>
						<span className="font-medium text-(--desktop-text-secondary)">
							{t('collabLoading')}
						</span>
						<span className="text-xs text-(--desktop-text-muted)">
							{t('collabStatus.connecting')}
						</span>
					</div>
				}
			>
				<CollaborativeTiptapEditor {...props} />
			</Suspense>
		);
	}

	return <TiptapEditorCore {...props} />;
};
