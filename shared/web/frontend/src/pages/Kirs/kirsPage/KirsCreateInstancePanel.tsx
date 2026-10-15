/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Create-project-site-instance form when no instance exists yet.
 *
 * Invariants:
 * - Template selection and capabilities preview match pre-split KirsPage.
 *
 * Related:
 * - KirsDetailPanel.tsx
 * - kirsPageConstants.ts
 */

import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import {
	getKirsTemplateOption,
	KIRS_TEMPLATE_OPTIONS,
} from './kirsPageConstants';
import type { KirsPageController } from './useKirsPage';

type Props = {
	k: KirsPageController;
};

export function KirsCreateInstancePanel({ k }: Props) {
	return (
		<div className="space-y-3">
			<DesktopAppSectionLabel>Создать инстанс</DesktopAppSectionLabel>
			<label
				htmlFor="kirs-create-site-title"
				className="block text-xs text-(--desktop-text-muted)"
			>
				Название сайта
				<DesktopAppInput
					id="kirs-create-site-title"
					className="mt-1"
					value={k.title}
					onChange={(e) => k.setTitle(e.target.value)}
					placeholder="Например, витрина компании"
				/>
			</label>
			<div className="block text-xs text-(--desktop-text-muted)">
				<div>Шаблон</div>
				<div className="mt-2 grid gap-2">
					<p className="text-xs text-(--desktop-text-muted)">
						Выберите основу сайта. В любой карточке есть краткое объяснение, для
						каких задач она подходит.
					</p>
					<div className="grid gap-2 md:grid-cols-2">
						{KIRS_TEMPLATE_OPTIONS.map((option) => {
							const selected = k.templateKey === option.key;
							return (
								<button
									key={option.key}
									type="button"
									onClick={() => k.setTemplateKey(option.key)}
									aria-pressed={selected}
									title={option.description}
									className={cn(
										'rounded-lg border p-3 text-left transition-colors',
										selected
											? 'border-violet-300/60 bg-violet-500/20 text-violet-50'
											: 'border-(--desktop-border) bg-(--desktop-surface) text-(--desktop-text-primary) hover:bg-slate-700/40'
									)}
								>
									<div className="flex items-center justify-between gap-2">
										<span className="text-sm font-semibold">
											{option.title}
										</span>
										{selected ? (
											<span className="rounded-full border border-violet-200/60 bg-violet-500/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-100">
												Выбрано
											</span>
										) : null}
									</div>
									<div className="mt-1 text-xs text-(--desktop-text-muted)">
										{option.subtitle}
									</div>
									<div className="mt-2 text-xs leading-relaxed text-(--desktop-text-secondary)">
										{option.description}
									</div>
								</button>
							);
						})}
					</div>
					<DesktopAppSurface variant="soft" padding="sm" className="space-y-2">
						<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
							Что вы получите с шаблоном{' '}
							{getKirsTemplateOption(k.templateKey).title}
						</div>
						<div className="space-y-1 text-xs leading-relaxed text-(--desktop-text-secondary)">
							{getKirsTemplateOption(k.templateKey).capabilities.map((item) => (
								<div key={item}>• {item}</div>
							))}
						</div>
					</DesktopAppSurface>
				</div>
			</div>
			<DesktopAppButton
				type="button"
				variant="accent"
				disabled={k.busy || !k.title.trim()}
				onClick={() => k.createMut.mutate()}
			>
				{k.createMut.isPending ? (
					<ArrowPathIcon className="size-4 animate-spin" />
				) : null}
				Создать
			</DesktopAppButton>
		</div>
	);
}
