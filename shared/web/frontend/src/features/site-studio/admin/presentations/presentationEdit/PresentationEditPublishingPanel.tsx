/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Publish toggle card for presentation editor sidebar.
 *
 * Related:
 * - PresentationEditPage.tsx
 */

export type PresentationEditPublishingPanelProps = {
	presentationFieldId: string;
	isPublished: boolean;
	onIsPublishedChange: (published: boolean) => void;
};

export function PresentationEditPublishingPanel({
	presentationFieldId,
	isPublished,
	onIsPublishedChange,
}: PresentationEditPublishingPanelProps) {
	return (
		<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
			<h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
				Публикация
			</h2>
			<div className="space-y-4">
				<label
					htmlFor={`${presentationFieldId}-published`}
					className="flex items-center gap-3 cursor-pointer"
				>
					<input
						id={`${presentationFieldId}-published`}
						type="checkbox"
						checked={isPublished}
						onChange={(e) => onIsPublishedChange(e.target.checked)}
						className="w-5 h-5 rounded border-neutral-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
					/>
					<span className="text-sm font-medium text-neutral-700 dark:text-slate-300">
						Опубликовать презентацию
					</span>
				</label>
			</div>
		</div>
	);
}
