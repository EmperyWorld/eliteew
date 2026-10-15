/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline edit form for a single assistant KB document in admin.
 *
 * Invariants:
 * - Title and body must be non-empty before save is enabled.
 *
 * Related:
 * - pages/Admin/assistant/AssistantKbPanel.tsx
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { AssistantKbDocumentDetail } from '../../Desktop/services/productDesktopApi';
import { ADMIN_FIELD } from './assistantAdminStyles';

export function EditKbDocument({
	entry,
	onCancel,
	onSave,
	saving,
}: {
	entry: AssistantKbDocumentDetail;
	onCancel: () => void;
	onSave: (patch: { title: string; body: string }) => void;
	saving: boolean;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });
	const [title, setTitle] = React.useState(entry.title);
	const [body, setBody] = React.useState(entry.body);

	React.useEffect(() => {
		setTitle(entry.title);
		setBody(entry.body);
	}, [entry.title, entry.body]);

	return (
		<div className="space-y-2 w-full">
			<input
				type="text"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder={t('kbTitlePlaceholder')}
				className={cn('w-full', ADMIN_FIELD)}
			/>
			<textarea
				value={body}
				onChange={(e) => setBody(e.target.value)}
				placeholder={t('kbBodyPlaceholder')}
				rows={8}
				className={cn('w-full', ADMIN_FIELD)}
			/>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={saving || !title.trim() || !body.trim()}
					onClick={() =>
						onSave({
							title: title.trim(),
							body: body.trim(),
						})
					}
					className="px-3 py-1.5 text-sm bg-emerald-700/80 rounded-lg text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45"
				>
					{t('saveKb')}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="text-sm text-white/70 rounded-md px-2 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
				>
					{t('cancel')}
				</button>
			</div>
		</div>
	);
}
