/**
 * Template picker + app links for EWDesk admin (Markdown, same as Assistant).
 * App list comes from the desktop store catalog (DB).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopNativeSelect,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from '../Desktop/components/DesktopAppChrome';
import { getStore } from '../Desktop/services/desktopApi';
import {
	EW_DESK_NEWS_TEMPLATE_IDS,
	type EwDeskNewsTemplateId,
	markdownDesktopAppLink,
} from './ewDeskNewsTemplates';

const EW_DESK_STORE_QUERY_KEY = [
	'desktop',
	'store',
	'ewdesk-app-links',
] as const;

type Props = {
	title: string;
	body: string;
	setTitle: (v: string) => void;
	setBody: React.Dispatch<React.SetStateAction<string>>;
};

function sortStoreAppsForPicker(
	apps: Awaited<ReturnType<typeof getStore>>['apps']
): {
	app_id: string;
	name: string;
	app_component: string;
	sort_order: number;
	category?: string | null;
}[] {
	const sorted = [...apps].sort((a, b) => {
		const o = (a.sort_order ?? 0) - (b.sort_order ?? 0);
		if (o !== 0) return o;
		return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	});
	const seen = new Set<string>();
	return sorted
		.filter((row) => {
			const c = row.app_component?.trim();
			if (!c) return false;
			if (seen.has(c)) return false;
			seen.add(c);
			return true;
		})
		.map((row) => ({
			app_id: row.app_id,
			name: row.name,
			app_component: row.app_component ?? '',
			sort_order: row.sort_order ?? 0,
			category: row.category,
		}));
}

export function EwDeskNewsTemplateAndLinks({
	title,
	body,
	setTitle,
	setBody,
}: Props): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'ewDeskAdmin' });
	const queryClient = useQueryClient();

	const storeQuery = useQuery({
		queryKey: EW_DESK_STORE_QUERY_KEY,
		queryFn: getStore,
		staleTime: 5 * 60 * 1000,
	});

	const catalogApps = React.useMemo(
		() =>
			storeQuery.data?.apps ? sortStoreAppsForPicker(storeQuery.data.apps) : [],
		[storeQuery.data?.apps]
	);

	const applyTemplate = React.useCallback(
		(id: EwDeskNewsTemplateId) => {
			if (id === 'blank') {
				const has = title.trim() || body.trim();
				if (has && !window.confirm(t('templates.replaceConfirm'))) {
					return;
				}
				setTitle('');
				setBody('');
				return;
			}
			const has = title.trim() || body.trim();
			if (has && !window.confirm(t('templates.replaceConfirm'))) {
				return;
			}
			setTitle(t(`templates.content.${id}.title`));
			setBody(t(`templates.content.${id}.body`));
		},
		[body, setBody, setTitle, t, title]
	);

	const appendAppLink = React.useCallback(
		(appComponent: string, displayName: string) => {
			const line = markdownDesktopAppLink(appComponent, displayName);
			setBody((prev) => {
				const p = prev.trimEnd();
				return p ? `${p}\n\n${line}\n` : `${line}\n`;
			});
		},
		[setBody]
	);

	return (
		<div className="flex flex-col gap-3">
			<label className="flex flex-col gap-1">
				<span className="text-xs text-(--desktop-text-muted)">
					{t('templates.pickerLabel')}
				</span>
				<DesktopNativeSelect
					className="text-sm"
					aria-label={t('templates.pickerLabel')}
					defaultValue=""
					onChange={(e) => {
						const v = e.target.value as EwDeskNewsTemplateId | '';
						e.target.value = '';
						if (!v) return;
						applyTemplate(v);
					}}
				>
					<option
						className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						value=""
						disabled
					>
						{t('templates.pickPlaceholder')}
					</option>
					{EW_DESK_NEWS_TEMPLATE_IDS.map((id) => (
						<option
							key={id}
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							value={id}
						>
							{t(`templates.option.${id}`)}
						</option>
					))}
				</DesktopNativeSelect>
			</label>
			<div className="flex flex-col gap-1.5">
				<span className="text-xs text-(--desktop-text-muted)">
					{t('templates.insertAppLinksLabel')}
				</span>
				<p className="text-[0.6875rem] leading-snug text-(--desktop-text-dim)">
					{t('templates.insertAppLinksHint')}
				</p>
				{storeQuery.isLoading ? (
					<p className="text-[0.6875rem] text-(--desktop-text-muted)">
						{t('templates.appLinkCatalogLoading')}
					</p>
				) : storeQuery.isError ? (
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-[0.6875rem] text-(--desktop-text-muted)">
							{t('templates.appLinkCatalogError')}
						</p>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="text-[0.6875rem]"
							onClick={() =>
								queryClient.invalidateQueries({
									queryKey: [...EW_DESK_STORE_QUERY_KEY],
								})
							}
						>
							{t('templates.appLinkCatalogRetry')}
						</DesktopAppButton>
					</div>
				) : catalogApps.length === 0 ? (
					<p className="text-[0.6875rem] text-(--desktop-text-muted)">
						{t('templates.appLinkCatalogEmpty')}
					</p>
				) : (
					<DesktopNativeSelect
						className="text-sm"
						aria-label={t('templates.appLinkPickAria')}
						defaultValue=""
						onChange={(e) => {
							const id = e.target.value;
							e.target.value = '';
							if (!id) return;
							const row = catalogApps.find((a) => a.app_id === id);
							if (!row?.app_component?.trim()) return;
							appendAppLink(
								row.app_component.trim(),
								row.name.trim() || row.app_component
							);
						}}
					>
						<option
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							value=""
							disabled
						>
							{t('templates.appLinkPickPlaceholder')}
						</option>
						{catalogApps.map((app) => (
							<option
								key={app.app_id}
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								value={app.app_id}
							>
								{app.name}
								{app.category ? ` — ${app.category}` : ''}
							</option>
						))}
					</DesktopNativeSelect>
				)}
			</div>
		</div>
	);
}
