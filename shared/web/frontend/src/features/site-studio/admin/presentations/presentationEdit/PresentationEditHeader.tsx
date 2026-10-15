/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Top action bar for presentation editor: view, cancel, duplicate, auto-save status, save.
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import { Button } from '@components/atoms/Button';
import type { Presentation } from '@services/api/presentations';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	BoltIcon,
	DocumentDuplicateIcon,
	EyeIcon,
} from '@heroicons/react/24/outline';
import type { AutoSaveStatus } from './usePresentationEditorAutoSave';

export type PresentationEditHeaderProps = {
	isNew: boolean;
	isSaving: boolean;
	presentationData: Presentation | undefined;
	autoSaveStatus: AutoSaveStatus;
	onNavigateList: () => void;
	onRequestDuplicate: () => void;
};

export function PresentationEditHeader({
	isNew,
	isSaving,
	presentationData,
	autoSaveStatus,
	onNavigateList,
	onRequestDuplicate,
}: PresentationEditHeaderProps) {
	return (
		<div className="flex items-center justify-between mb-6">
			<div>
				<h1 className="text-3xl font-display font-semibold text-neutral-900 dark:text-white flex items-center gap-3">
					<div className="p-2 bg-linear-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl">
						<span className="text-blue-600 dark:text-blue-400 text-xl">📊</span>
					</div>
					{isNew ? 'Создание презентации' : 'Редактирование презентации'}
				</h1>
			</div>
			<div className="flex items-center gap-2">
				{!isNew && presentationData && (
					<a
						href={`/presentations/${presentationData.slug}`}
						target="_blank"
						rel="noopener noreferrer"
					>
						<Button variant="outline" type="button">
							<EyeIcon width={16} height={16} className="mr-1" />
							Просмотр
						</Button>
					</a>
				)}
				<Button variant="ghost" type="button" onClick={onNavigateList}>
					Отмена
				</Button>
				{!isNew && presentationData && (
					<Button
						variant="outline"
						size="sm"
						type="button"
						onClick={onRequestDuplicate}
						title="Создать копию презентации"
					>
						<DocumentDuplicateIcon width={16} height={16} className="mr-1" />
						Дублировать
					</Button>
				)}
				<div className="flex items-center gap-3">
					{!isNew && (
						<div className="text-xs text-neutral-500 dark:text-slate-400 flex items-center gap-1.5">
							{autoSaveStatus === 'saving' && (
								<>
									<ArrowPathIcon
										width={12}
										height={12}
										className="animate-spin"
									/>
									<span>Сохранение...</span>
								</>
							)}
							{autoSaveStatus === 'saved' && (
								<>
									<ArrowDownTrayIcon width={12} height={12} />
									<span className="text-emerald-600 dark:text-emerald-400">
										Сохранено
									</span>
								</>
							)}
						</div>
					)}
					<div className="text-xs text-neutral-400 dark:text-slate-500 hidden lg:flex items-center gap-1">
						<BoltIcon width={12} height={12} />
						<span>
							Ctrl+S сохранить, Ctrl+D дублировать, Ctrl+Z отменить, F
							предпросмотр
						</span>
					</div>
					<Button type="submit" disabled={isSaving}>
						{isSaving ? (
							<>
								<ArrowPathIcon
									width={16}
									height={16}
									className="mr-1 animate-spin"
								/>
								Сохранение...
							</>
						) : (
							<>
								<ArrowDownTrayIcon width={16} height={16} className="mr-1" />
								Сохранить
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
