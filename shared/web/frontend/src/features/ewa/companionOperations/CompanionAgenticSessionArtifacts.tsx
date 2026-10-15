/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Open-document links for files created during an agentic mission (HITL file_create).
 *
 * Invariants:
 * - Prefers mirrored plan_payload.created_documents; trace fallback lives in useAgenticSessionDocuments.
 *
 * Related:
 * - api/ewa_platform/agentic/adapters/task_run_mirror.py
 * - CompanionOperationRunCard.tsx
 */

import { DocumentTextIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import type { AgenticCreatedDocument } from '@/features/ewa/companionOperations/companionOperationsUi';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionAgenticSessionArtifactsProps = {
	documents: AgenticCreatedDocument[];
	onOpenDocEditor: (unifiedContentId: string) => void;
	onOpenContentManager: () => void;
};

export function CompanionAgenticSessionArtifacts({
	documents,
	onOpenDocEditor,
	onOpenContentManager,
}: CompanionAgenticSessionArtifactsProps) {
	const { t } = useTranslation('marketing');
	if (documents.length === 0) return null;

	return (
		<div className="mt-1.5 space-y-1 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-2 py-1.5">
			<p className="text-[10px] font-medium uppercase tracking-wide text-emerald-100/80">
				{t('ewaCompanion.agenticCreatedDocumentsTitle', 'Созданные документы')}
			</p>
			<ul className="flex flex-col gap-1">
				{documents.map((doc) => (
					<li
						key={doc.unifiedContentId}
						className="flex min-w-0 items-center gap-1"
					>
						<button
							type="button"
							className={cn(
								'inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-(--companion-divider) px-2 py-0.5',
								'text-[10px] text-(--desktop-text-primary) hover:bg-(--companion-bg)',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => onOpenDocEditor(doc.unifiedContentId)}
						>
							<DocumentTextIcon className="size-3 shrink-0" aria-hidden />
							<span className="truncate">{doc.name}</span>
						</button>
					</li>
				))}
			</ul>
			<button
				type="button"
				className={cn(
					'inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5',
					'text-[10px] text-(--companion-text-soft) hover:bg-white/5',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={onOpenContentManager}
			>
				<FolderOpenIcon className="size-3" aria-hidden />
				{t('ewaCompanion.agenticOpenContentManager', 'Все файлы в каталоге')}
			</button>
		</div>
	);
}
