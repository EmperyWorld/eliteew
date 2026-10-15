/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KIRS console tab client access toggles and instance delete actions.
 *
 * Invariants:
 * - Delete confirm flow uses pendingKirsDelete state from useKirsPage.
 *
 * Related:
 * - KirsDetailPanel.tsx
 * - KirsPage.tsx (ConfirmDeleteModal)
 */

import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type { KirsPageController } from './useKirsPage';

type Props = {
	k: KirsPageController;
};

export function KirsConsoleAccessDeleteSection({ k }: Props) {
	return (
		<>
			<div className="space-y-2 border-t border-(--desktop-border) pt-4">
				<DesktopAppSectionLabel>Доступ клиента</DesktopAppSectionLabel>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={k.allowPublic}
						onChange={(e) => k.setAllowPublic(e.target.checked)}
					/>
					Публичный сайт (витрина)
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={k.allowAdmin}
						onChange={(e) => k.setAllowAdmin(e.target.checked)}
					/>
					Админка в «Мой сайт» (вкладка при разрешении)
				</label>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					disabled={k.accessMut.isPending}
					onClick={() => k.accessMut.mutate()}
				>
					Сохранить доступ
				</DesktopAppButton>
			</div>

			<div className="border-t border-(--desktop-border) pt-4">
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className="text-rose-300"
					disabled={k.busy}
					onClick={() => k.setPendingKirsDelete('wipe_disk')}
				>
					Удалить инстанс (с данными на диске)
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					className="mt-2 text-amber-200"
					disabled={k.busy}
					onClick={() => k.setPendingKirsDelete('keep_runtime_dir')}
				>
					Удалить запись, сохранить данные на диске
				</DesktopAppButton>
			</div>
		</>
	);
}
