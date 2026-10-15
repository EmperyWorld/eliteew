/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Title and format fields card for presentation editor.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - useOllentiTemplateBootstrap.ts
 */

import { Input } from '@components/atoms/Input';
import { useTranslation } from 'react-i18next';
import type { PresentationFormat } from './useOllentiTemplateBootstrap';

export type PresentationEditBasicInfoCardProps = {
	presentationFieldId: string;
	title: string;
	format: PresentationFormat;
	onTitleChange: (title: string) => void;
	onFormatChange: (format: PresentationFormat) => void;
};

export function PresentationEditBasicInfoCard({
	presentationFieldId,
	title,
	format,
	onTitleChange,
	onFormatChange,
}: PresentationEditBasicInfoCardProps) {
	const { t } = useTranslation('siteStudio');

	return (
		<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
			<h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
				Основная информация
			</h2>
			<div className="space-y-4">
				<div>
					<label
						htmlFor={`${presentationFieldId}-title`}
						className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						Название презентации
					</label>
					<Input
						id={`${presentationFieldId}-title`}
						value={title}
						onChange={(e) => onTitleChange(e.target.value)}
						placeholder="Введите название"
						required
					/>
				</div>
				<div>
					<label
						htmlFor={`${presentationFieldId}-format`}
						className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2"
					>
						Формат презентации
					</label>
					<select
						id={`${presentationFieldId}-format`}
						value={format}
						onChange={(e) =>
							onFormatChange(e.target.value as PresentationFormat)
						}
						aria-label="Формат презентации"
						className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
					>
						<option value="classic">
							{t('adminCatalog.presentations.formatClassic')}
						</option>
						<option value="modern">
							{t('adminCatalog.presentations.formatModern')}
						</option>
						<option value="minimal">
							{t('adminCatalog.presentations.formatMinimal')}
						</option>
						<option value="ollenti">
							{t('adminCatalog.presentations.formatOllenti')}
						</option>
						<option value="ollenti2">
							{t('adminCatalog.presentations.formatOllenti2')}
						</option>
					</select>
				</div>
			</div>
		</div>
	);
}
