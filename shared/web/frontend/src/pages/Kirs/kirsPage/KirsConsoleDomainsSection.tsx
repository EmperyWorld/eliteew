/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KIRS console tab domain bindings section: add, verify, route, activate, disable.
 *
 * Invariants:
 * - data-kirs-curation-guide="domains" anchor preserved for guided tour.
 *
 * Related:
 * - KirsDetailPanel.tsx
 * - kirsPageConstants.ts (getKirsDomainToken)
 */

import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { getKirsDomainToken } from './kirsPageConstants';
import type { KirsPageController } from './useKirsPage';

type Props = {
	k: KirsPageController;
};

export function KirsConsoleDomainsSection({ k }: Props) {
	return (
		<div
			data-kirs-curation-guide="domains"
			className="space-y-2 border-t border-(--desktop-border) pt-4"
		>
			<DesktopAppSectionLabel>Внутренний домен</DesktopAppSectionLabel>
			<p className="text-xs leading-relaxed text-(--desktop-text-secondary)">
				Привяжите уже купленный домен для LAN/VPN доступа: добавьте TXT запись,
				проверьте владение, затем запросите внутренний DNS/TLS у оператора.
			</p>
			<div className="flex flex-col gap-2 sm:flex-row">
				<DesktopAppInput
					value={k.domainInput}
					onChange={(event) => k.setDomainInput(event.target.value)}
					placeholder="site.example.com"
				/>
				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					disabled={k.createDomainMut.isPending || !k.domainInput.trim()}
					onClick={() => k.createDomainMut.mutate()}
				>
					Добавить домен
				</DesktopAppButton>
			</div>
			{k.domainsQuery.isLoading ? (
				<div className="text-xs text-(--desktop-text-muted)">
					Загружаем домены…
				</div>
			) : k.domainRows.length === 0 ? (
				<div className="text-xs text-(--desktop-text-muted)">
					Дополнительные домены ещё не привязаны.
				</div>
			) : (
				<div className="space-y-2">
					{k.domainRows.map((binding) => (
						<div
							key={binding.id}
							className="rounded-md border border-(--desktop-border) bg-(--desktop-surface) p-3"
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<div className="break-all text-sm font-medium text-(--desktop-text-primary)">
										{binding.hostname}
									</div>
									<div className="mt-1 text-xs text-(--desktop-text-muted)">
										{binding.status} · tls {binding.tls_status}
									</div>
								</div>
								<div className="flex flex-wrap gap-1">
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										disabled={k.domainActionMut.isPending}
										onClick={() =>
											k.domainActionMut.mutate({
												bindingId: binding.id,
												action: 'verify',
											})
										}
									>
										Проверить TXT
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										disabled={k.domainActionMut.isPending}
										onClick={() =>
											k.domainActionMut.mutate({
												bindingId: binding.id,
												action: 'route',
											})
										}
									>
										Запросить маршрут
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										disabled={k.domainActionMut.isPending}
										onClick={() =>
											k.domainActionMut.mutate({
												bindingId: binding.id,
												action: 'activate',
											})
										}
									>
										Активировать
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										disabled={k.domainActionMut.isPending}
										onClick={() =>
											k.domainActionMut.mutate({
												bindingId: binding.id,
												action: 'disable',
											})
										}
									>
										Отключить
									</DesktopAppButton>
								</div>
							</div>
							<div className="mt-3 grid gap-2 text-xs text-(--desktop-text-secondary) md:grid-cols-2">
								<div>
									<div className="text-(--desktop-text-dim)">TXT имя</div>
									<div className="mt-1 break-all text-(--desktop-text-primary)">
										{binding.verification_name}
									</div>
								</div>
								<div>
									<div className="text-(--desktop-text-dim)">TXT значение</div>
									<div className="mt-1 break-all text-(--desktop-text-primary)">
										{getKirsDomainToken(binding)}
									</div>
								</div>
							</div>
							{binding.last_error ? (
								<div className="mt-2 text-xs text-red-200">
									{binding.last_error}
								</div>
							) : null}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
