/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Per-file success/error result cards after DocumentImportPanel batch import.
 *
 * Invariants:
 * - Renders nothing when results are empty.
 *
 * Related:
 * - useDocumentImportBatch.ts, DocumentImportPanel.tsx
 */

import type { TFunction } from 'i18next';
import { motion } from 'framer-motion';
import {
	CheckCircleIcon,
	ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

import type { DocumentImportResult } from '@/components/UltimateDocEditor/types/editor.types';

type DocumentImportResultsProps = {
	t: TFunction<'docEditorPanels'>;
	importResults: DocumentImportResult[];
};

export function DocumentImportResults({
	t,
	importResults,
}: DocumentImportResultsProps) {
	if (importResults.length === 0) {
		return null;
	}

	return (
		<div className="p-5">
			<h4 className="mb-4 text-sm font-semibold text-(--desktop-text-secondary)">
				{t('panels.import.resultsHeading')}
			</h4>

			<div className="space-y-3">
				{importResults.map((result) => (
					<motion.div
						key={`${result.fileName}-${result.success ? 'ok' : 'err'}-${result.error ?? ''}`}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className={`rounded-lg border p-4 ${
							result.success
								? 'bg-green-500/10 border-green-400/30'
								: 'bg-red-500/10 border-red-400/30'
						}`}
					>
						<div className="flex items-start gap-3">
							{result.success ? (
								<CheckCircleIcon
									width={16}
									height={16}
									className="text-green-300 mt-0.5 shrink-0"
								/>
							) : (
								<ExclamationCircleIcon
									width={16}
									height={16}
									className="text-red-300 mt-0.5 shrink-0"
								/>
							)}
							<div className="flex-1 min-w-0">
								<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
									{result.fileName}
								</div>
								{result.success ? (
									<div className="text-xs text-green-200 mt-1">
										{t('panels.import.resultSuccess', {
											words: result.metadata?.wordCount ?? 0,
										})}
									</div>
								) : (
									<div className="text-xs text-red-200 mt-1">
										{result.error}
									</div>
								)}
							</div>
						</div>
					</motion.div>
				))}
			</div>
		</div>
	);
}
