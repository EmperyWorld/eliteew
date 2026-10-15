import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { AnyExtension } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { defaultSelectionBuilder } from '@tiptap/y-tiptap';
import { useTranslation } from 'react-i18next';

import type { TiptapEditorProps } from '../types/editor.types';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration';
import {
	resolveDocEditorYjsConnectionStatus,
	type YjsProviderConnectionStatus,
} from '../utils/docEditorYjsConnectionStatus';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserDisplayName } from '../../../utils/userDisplayName';
import { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import { log } from '../../../utils/logger';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { TiptapEditorCore } from './TiptapEditor';
import {
	ArrowPathIcon,
	ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

const COLLAB_USER_COLORS = [
	'#3b82f6',
	'#22c55e',
	'#a855f7',
	'#f97316',
	'#ec4899',
	'#6366f1',
	'#14b8a6',
	'#eab308',
	'#ef4444',
	'#8b5cf6',
];

function stableColorForUser(name: string): string {
	let n = 0;
	for (let i = 0; i < name.length; i++) {
		n = (n * 31 + name.charCodeAt(i)) >>> 0;
	}

	return COLLAB_USER_COLORS[n % COLLAB_USER_COLORS.length] ?? '#3b82f6';
}

const RX_HEX6 = /^#[0-9a-fA-F]{6}$/;

function sanitizeCollabColor(color: unknown, fallback: string): string {
	return typeof color === 'string' && RX_HEX6.test(color) ? color : fallback;
}

type CollabAwarenessUser = { name?: string | null; color?: string | null };

/** Каретка и подпись для чужого курсора (yCursorPlugin). */
function renderRemoteCaret(
	user: CollabAwarenessUser,
	anonymousLabel: string
): HTMLElement {
	const color = sanitizeCollabColor(user.color, '#6366f1');
	const raw = user.name?.trim();
	const name = raw && raw.length > 0 ? raw.slice(0, 80) : anonymousLabel;

	const cursor = document.createElement('span');
	cursor.className = 'collaboration-carets__caret doc-collab-remote-caret';
	cursor.style.borderLeft = `3px solid ${color}`;
	cursor.style.borderColor = color;
	cursor.setAttribute('data-doc-collab-user', name);

	const label = document.createElement('span');
	label.className = 'collaboration-carets__label doc-collab-remote-label';
	label.textContent = name;
	label.style.backgroundColor = color;
	cursor.appendChild(label);

	return cursor;
}

function renderRemoteSelection(user: CollabAwarenessUser): {
	style: string;
	class: string;
} {
	const color = sanitizeCollabColor(user.color, '#6366f1');
	const name = user.name?.trim() || 'User';
	const base = defaultSelectionBuilder({ name, color });
	return {
		...base,
		class: `${base.class} doc-collab-remote-selection`.trim(),
		style: `${base.style}; box-shadow: inset 0 0 0 1px ${color}99;`,
	};
}

export const CollaborativeTiptapEditor: React.FC<TiptapEditorProps> = (
	props
) => {
	const {
		documentId = '',
		enableCollaboration = false,
		initialContent = '',
		onCollaborationYjsFailed,
		onYjsConnectionStatusChange,
	} = props;
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const remoteUserFallback = t('collabRemoteUserFallback');
	const { user } = useAuth();
	const collaborationUserName =
		getUserDisplayName(user) || user?.email || 'User';

	const [yjsRetryNonce, setYjsRetryNonce] = useState(0);
	const [providerStatus, setProviderStatus] =
		useState<YjsProviderConnectionStatus | null>(null);
	const { ydoc, provider, yjsEditorReady, error } = useYjsCollaboration({
		documentId,
		enabled: enableCollaboration && !!documentId,
		seedHtml: initialContent,
		retryNonce: yjsRetryNonce,
		onStatusChange: (status) => {
			setProviderStatus(status);
			log.info('TiptapEditorCollaboration', `Yjs status: ${status}`);
		},
	});

	const fatalYjsError = Boolean(error && !(ydoc && provider));

	useEffect(() => {
		if (!onYjsConnectionStatusChange) {
			return;
		}
		if (!enableCollaboration || !documentId) {
			onYjsConnectionStatusChange('idle');
			return;
		}
		onYjsConnectionStatusChange(
			resolveDocEditorYjsConnectionStatus({
				enabled: true,
				providerStatus,
				yjsEditorReady,
				hasFatalError: fatalYjsError,
			})
		);
	}, [
		documentId,
		enableCollaboration,
		fatalYjsError,
		onYjsConnectionStatusChange,
		providerStatus,
		yjsEditorReady,
	]);

	const collaborationExtensions = useMemo<AnyExtension[]>(() => {
		if (!(ydoc && provider)) {
			return [];
		}

		return [
			Collaboration.configure({
				document: ydoc,
			}),
			CollaborationCaret.configure({
				provider,
				user: {
					name: collaborationUserName,
					color: stableColorForUser(collaborationUserName),
				},
				render: (u) => renderRemoteCaret(u, remoteUserFallback),
				selectionRender: renderRemoteSelection,
			}),
		];
	}, [collaborationUserName, provider, remoteUserFallback, ydoc]);

	if (enableCollaboration && fatalYjsError) {
		return (
			<DesktopAppEmptyState
				className="min-h-[min(640px,70vh)] w-full justify-center rounded-xl border border-red-500/25 bg-[color-mix(in_srgb,var(--desktop-surface-panel)_70%,transparent)] px-6 py-10"
				icon={
					<ExclamationCircleIcon
						className="h-10 w-10 shrink-0 text-red-400"
						aria-hidden
					/>
				}
				title={t('collabYjsErrorTitle')}
				description={
					<span className="max-w-md text-sm text-[var(--desktop-text-secondary)]">
						{t('collabYjsErrorBody')}
					</span>
				}
				role="alert"
			>
				<div className="mt-4 flex flex-wrap items-center justify-center gap-2">
					<DesktopAppButton
						type="button"
						variant="accent"
						size="sm"
						onClick={() => setYjsRetryNonce((n) => n + 1)}
					>
						{t('collabYjsRetry')}
					</DesktopAppButton>
					{onCollaborationYjsFailed ? (
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							onClick={() => onCollaborationYjsFailed()}
						>
							{t('collabYjsEditWithoutCollab')}
						</DesktopAppButton>
					) : null}
				</div>
			</DesktopAppEmptyState>
		);
	}

	if (enableCollaboration && !(ydoc && provider && yjsEditorReady)) {
		return (
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
					{ydoc && provider && !yjsEditorReady
						? t('collabStatus.syncingDoc')
						: t('collabStatus.connecting')}
				</span>
			</div>
		);
	}

	return (
		<TiptapEditorCore
			{...props}
			collaborationExtensions={collaborationExtensions}
		/>
	);
};
