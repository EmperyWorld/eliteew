import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { Card } from '@components/atoms/Card';
import {
	fetchConfig,
	upsertConfigItems,
	fetchFeatureFlags,
	upsertFeatureFlags,
} from '@services/api/config';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import {
	AdjustmentsHorizontalIcon,
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CheckCircleIcon,
	ExclamationCircleIcon,
	FlagIcon,
	PlusIcon,
	ShieldCheckIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

const typeOptions = [
	{ label: 'string', value: 'string', color: 'bg-blue-100 text-blue-700' },
	{ label: 'int', value: 'int', color: 'bg-purple-100 text-purple-700' },
	{ label: 'bool', value: 'bool', color: 'bg-amber-100 text-amber-700' },
	{ label: 'json', value: 'json', color: 'bg-emerald-100 text-emerald-700' },
	{ label: 'url', value: 'url', color: 'bg-cyan-100 text-cyan-700' },
	{ label: 'email', value: 'email', color: 'bg-pink-100 text-pink-700' },
	{ label: 'phone', value: 'phone', color: 'bg-orange-100 text-orange-700' },
];

type ConfigRow = {
	clientRowId: string;
	key: string;
	type: string;
	value: string;
	description?: string;
};

type FlagRow = {
	clientFlagId: string;
	key: string;
	isEnabled: boolean;
	scope?: string;
	rollout?: number | null;
	description?: string;
};

export const ConfigPage: React.FC = () => {
	const { t } = useTranslation('siteStudio');
	const namespaces = useMemo(
		() => [
			{ id: 'site', label: t('workspace.config.siteTab'), icon: '🌐' },
			{ id: 'bot', label: t('workspace.config.botTab'), icon: '🤖' },
			{
				id: 'notifications',
				label: t('workspace.config.notificationsTab'),
				icon: '🔔',
			},
			{ id: 'limits', label: t('workspace.config.limitsTab'), icon: '⚡' },
		],
		[t]
	);
	const [namespace, setNamespace] = useState<string>('site');
	const [rows, setRows] = useState<ConfigRow[]>([]);
	const [flags, setFlags] = useState<FlagRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [savingFlags, setSavingFlags] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [pendingRemove, setPendingRemove] = useState<
		{ kind: 'row'; index: number } | { kind: 'flag'; index: number } | null
	>(null);

	const loadData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const items = await fetchConfig(namespace);
			const mapped: ConfigRow[] = items.map((i) => ({
				clientRowId: `${namespace}::${i.key}`,
				key: i.key,
				type: i.type,
				value:
					typeof i.valueJson === 'object'
						? JSON.stringify(i.valueJson)
						: String(i.valueJson ?? ''),
				description: i.description ?? '',
			}));
			setRows(mapped);

			if (namespace === 'site') {
				const fl = await fetchFeatureFlags();
				setFlags(
					fl.map((f) => ({
						clientFlagId: `flag::${f.key}`,
						key: f.key,
						isEnabled: f.isEnabled,
						scope: f.scope || '',
						rollout: f.rollout ?? undefined,
						description: f.description || '',
					}))
				);
			} else {
				setFlags([]);
			}
		} catch {
			setError(t('workspace.config.loadError'));
		} finally {
			setLoading(false);
		}
	}, [namespace, t]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const handleChangeRow = (
		index: number,
		field: keyof ConfigRow,
		value: string
	) => {
		setRows((prev) =>
			prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
		);
	};

	const removeRow = (index: number) => {
		setRows((prev) => prev.filter((_, i) => i !== index));
	};

	const requestRemoveRow = (index: number) => {
		setPendingRemove({ kind: 'row', index });
	};

	const addRow = () => {
		setRows((prev) => [
			...prev,
			{
				clientRowId: crypto.randomUUID(),
				key: '',
				type: 'string',
				value: '',
				description: '',
			},
		]);
	};

	const addFlag = () => {
		setFlags((prev) => [
			...prev,
			{
				clientFlagId: crypto.randomUUID(),
				key: '',
				isEnabled: false,
				scope: '',
				description: '',
			},
		]);
	};

	const removeFlag = (index: number) => {
		setFlags((prev) => prev.filter((_, i) => i !== index));
	};

	const requestRemoveFlag = (index: number) => {
		setPendingRemove({ kind: 'flag', index });
	};

	const cancelRemove = () => setPendingRemove(null);

	const executeRemove = async () => {
		if (!pendingRemove) return;
		if (pendingRemove.kind === 'row') {
			removeRow(pendingRemove.index);
		} else {
			removeFlag(pendingRemove.index);
		}
	};

	const saveConfig = async () => {
		setSaving(true);
		setError(null);
		setMessage(null);
		try {
			const items = rows
				.filter((r) => r.key.trim())
				.map((r) => ({
					key: r.key.trim(),
					type: r.type,
					value: parseValue(r.type, r.value),
					description: r.description,
				}));
			await upsertConfigItems(namespace, items);
			setMessage(t('workspace.config.savedConfig'));
		} catch {
			setError(t('workspace.config.saveError'));
		} finally {
			setSaving(false);
			setTimeout(() => setMessage(null), 3000);
		}
	};

	const saveFlags = async () => {
		setSavingFlags(true);
		setError(null);
		setMessage(null);
		try {
			const items = flags
				.filter((f) => f.key.trim())
				.map((f) => ({
					key: f.key.trim(),
					isEnabled: f.isEnabled,
					scope: f.scope || undefined,
					rollout: typeof f.rollout === 'number' ? f.rollout : null,
					description: f.description,
				}));
			await upsertFeatureFlags(items);
			setMessage(t('workspace.config.savedFlags'));
		} catch {
			setError(t('workspace.config.saveErrorFlags'));
		} finally {
			setSavingFlags(false);
			setTimeout(() => setMessage(null), 3000);
		}
	};

	const flagControls = useMemo(() => namespace === 'site', [namespace]);
	const currentNs = namespaces.find((ns) => ns.id === namespace);

	const removeModalTitle =
		pendingRemove?.kind === 'flag'
			? t('workspace.config.removeFlagModalTitle')
			: t('workspace.config.removeRowModalTitle');
	const removeModalWarning =
		pendingRemove?.kind === 'flag'
			? t('workspace.config.removeFlagModalWarning')
			: t('workspace.config.removeRowModalWarning');
	const removeModalItemName =
		pendingRemove == null
			? undefined
			: pendingRemove.kind === 'flag'
				? flags[pendingRemove.index]?.key?.trim() || undefined
				: rows[pendingRemove.index]?.key?.trim() || undefined;

	return (
		<div className="space-y-6 min-w-0 max-w-full">
			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
				<div className="min-w-0">
					<h1 className="text-2xl sm:text-3xl font-display font-semibold text-neutral-900 dark:text-slate-100 flex flex-wrap items-center gap-3">
						<AdjustmentsHorizontalIcon className="text-neutral-400 shrink-0" />
						{t('workspace.config.title')}
					</h1>
					<p className="text-neutral-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
						{t('workspace.config.subtitle')}
					</p>
				</div>
				<Button
					variant="outline"
					onClick={() => void loadData()}
					disabled={loading}
					className="shrink-0 min-h-11 w-full sm:w-auto"
				>
					{loading ? (
						<ArrowPathIcon
							width={16}
							height={16}
							className="mr-2 animate-spin"
						/>
					) : (
						<ArrowPathIcon width={16} height={16} className="mr-2" />
					)}
					{t('workspace.config.refresh')}
				</Button>
			</div>

			{/* Status messages */}
			{error && (
				<div
					role="alert"
					className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm"
				>
					<ExclamationCircleIcon width={16} height={16} className="shrink-0" />
					{error}
				</div>
			)}
			{message && (
				<div
					role="status"
					aria-live="polite"
					className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm"
				>
					<CheckCircleIcon width={16} height={16} className="shrink-0" />
					{message}
				</div>
			)}

			{/* Namespace tabs */}
			<div className="flex flex-wrap gap-2 p-1 bg-neutral-100 dark:bg-slate-800 rounded-xl w-full sm:w-fit min-w-0 motion-reduce:transition-none">
				{namespaces.map((ns) => (
					<button
						key={ns.id}
						type="button"
						onClick={() => setNamespace(ns.id)}
						className={`min-h-11 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
							namespace === ns.id
								? 'bg-white dark:bg-slate-700 shadow-sm text-neutral-900 dark:text-slate-100'
								: 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-100'
						}`}
					>
						<span>{ns.icon}</span>
						{ns.label}
					</button>
				))}
			</div>

			{/* Config Section */}
			<Card className="overflow-hidden">
				<div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-neutral-50/50">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-blue-100 rounded-lg">
							<AdjustmentsHorizontalIcon
								width={18}
								height={18}
								className="text-blue-600"
							/>
						</div>
						<div>
							<h3 className="font-semibold text-neutral-900 dark:text-slate-100">
								{t('workspace.config.title')} {currentNs?.label}
							</h3>
							<p className="text-xs text-neutral-500 dark:text-slate-400">
								{t('workspace.config.paramCount', { count: rows.length })}
							</p>
						</div>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" onClick={addRow}>
							<PlusIcon width={14} height={14} className="mr-1" />
							{t('workspace.config.add')}
						</Button>
						<Button
							size="sm"
							onClick={() => void saveConfig()}
							disabled={saving}
						>
							{saving ? (
								<ArrowPathIcon
									width={14}
									height={14}
									className="mr-1 animate-spin"
								/>
							) : (
								<ArrowDownTrayIcon width={14} height={14} className="mr-1" />
							)}
							{t('workspace.config.save')}
						</Button>
					</div>
				</div>

				<div className="p-4">
					{loading ? (
						<div className="flex justify-center py-8">
							<ArrowPathIcon className="w-6 h-6 animate-spin text-neutral-400" />
						</div>
					) : rows.length === 0 ? (
						<div className="text-center py-8 text-neutral-500 dark:text-slate-400">
							<AdjustmentsHorizontalIcon
								width={32}
								height={32}
								className="mx-auto mb-2 text-neutral-300"
							/>
							<p>{t('workspace.config.noParams')}</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-3"
								onClick={addRow}
							>
								<PlusIcon width={14} height={14} className="mr-1" />
								{t('workspace.config.addFirstParam')}
							</Button>
						</div>
					) : (
						<div className="space-y-2 min-w-0 overflow-x-auto">
							{/* Header */}
							<div className="grid grid-cols-12 gap-2 px-2 min-w-[640px] text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
								<div className="col-span-3 min-w-0">
									{t('workspace.config.keyCol')}
								</div>
								<div className="col-span-2 min-w-0">
									{t('workspace.config.typeCol')}
								</div>
								<div className="col-span-4 min-w-0">
									{t('workspace.config.valueCol')}
								</div>
								<div className="col-span-2 min-w-0">
									{t('workspace.config.descCol')}
								</div>
								<div className="col-span-1 min-w-0"></div>
							</div>
							{rows.map((row, idx) => (
								<div
									key={row.clientRowId}
									className="grid grid-cols-12 gap-2 items-center p-2 min-w-[640px] bg-neutral-50/50 dark:bg-slate-800/50 rounded-lg hover:bg-neutral-100/50 dark:hover:bg-slate-800 transition-colors motion-reduce:transition-none"
								>
									<Input
										className="col-span-3 text-sm min-w-0"
										placeholder="config_key"
										value={row.key}
										onChange={(e) =>
											handleChangeRow(idx, 'key', e.target.value)
										}
									/>
									<select
										aria-label="Тип значения конфигурации"
										title="Тип значения конфигурации"
										className="col-span-2 min-w-0 border border-neutral-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-neutral-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
										value={row.type}
										onChange={(event) =>
											handleChangeRow(idx, 'type', event.target.value)
										}
									>
										{typeOptions.map((t) => (
											<option key={t.value} value={t.value}>
												{t.label}
											</option>
										))}
									</select>
									<Input
										className="col-span-4 text-sm font-mono min-w-0"
										placeholder="value"
										value={row.value}
										onChange={(e) =>
											handleChangeRow(idx, 'value', e.target.value)
										}
									/>
									<Input
										className="col-span-2 text-sm min-w-0"
										placeholder="описание..."
										value={row.description || ''}
										onChange={(e) =>
											handleChangeRow(idx, 'description', e.target.value)
										}
									/>
									<div className="col-span-1 flex justify-end">
										<button
											type="button"
											onClick={() => requestRemoveRow(idx)}
											className="min-h-11 min-w-11 inline-flex items-center justify-center p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors motion-reduce:transition-none"
											aria-label={t('workspace.config.confirmRemoveRow')}
										>
											<TrashIcon width={14} height={14} aria-hidden />
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</Card>

			{/* Feature Flags Section */}
			{flagControls && (
				<Card className="overflow-hidden">
					<div className="flex items-center justify-between p-4 border-b border-neutral-100 bg-linear-to-r from-purple-50/50 to-indigo-50/50">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-purple-100 rounded-lg">
								<FlagIcon width={18} height={18} className="text-purple-600" />
							</div>
							<div>
								<h3 className="font-semibold text-neutral-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
									{t('workspace.config.featureFlagsTitle')}
									<span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full flex items-center gap-1">
										<ShieldCheckIcon width={10} height={10} aria-hidden />
										{t('workspace.config.siteBadge')}
									</span>
								</h3>
								<p className="text-xs text-neutral-500 dark:text-slate-400">
									{t('workspace.config.flagCount', { count: flags.length })}
								</p>
							</div>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" size="sm" onClick={addFlag}>
								<PlusIcon width={14} height={14} className="mr-1" />
								{t('workspace.config.add')}
							</Button>
							<Button
								size="sm"
								onClick={() => void saveFlags()}
								disabled={savingFlags}
								className="bg-purple-600 hover:bg-purple-500"
							>
								{savingFlags ? (
									<ArrowPathIcon
										width={14}
										height={14}
										className="mr-1 animate-spin"
									/>
								) : (
									<ArrowDownTrayIcon width={14} height={14} className="mr-1" />
								)}
								{t('workspace.config.save')}
							</Button>
						</div>
					</div>

					<div className="p-4">
						{flags.length === 0 ? (
							<div className="text-center py-8 text-neutral-500 dark:text-slate-400">
								<FlagIcon
									width={32}
									height={32}
									className="mx-auto mb-2 text-neutral-300"
								/>
								<p>{t('workspace.config.noFlags')}</p>
								<Button
									variant="outline"
									size="sm"
									className="mt-3"
									onClick={addFlag}
								>
									<PlusIcon width={14} height={14} className="mr-1" />
									{t('workspace.config.addFirstFlag')}
								</Button>
							</div>
						) : (
							<div className="space-y-2 min-w-0 overflow-x-auto">
								{/* Header */}
								<div className="grid grid-cols-12 gap-2 px-2 min-w-[720px] text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
									<div className="col-span-3 min-w-0">
										{t('workspace.config.keyCol')}
									</div>
									<div className="col-span-2 min-w-0">
										{t('workspace.config.statusCol')}
									</div>
									<div className="col-span-2 min-w-0">
										{t('workspace.config.scopeCol')}
									</div>
									<div className="col-span-2 min-w-0">
										{t('workspace.config.rolloutCol')}
									</div>
									<div className="col-span-2 min-w-0">
										{t('workspace.config.descCol')}
									</div>
									<div className="col-span-1 min-w-0"></div>
								</div>
								{flags.map((flag, idx) => (
									<div
										key={flag.clientFlagId}
										className="grid grid-cols-12 gap-2 items-center p-2 min-w-[720px] bg-neutral-50/50 dark:bg-slate-800/50 rounded-lg hover:bg-neutral-100/50 dark:hover:bg-slate-800 transition-colors motion-reduce:transition-none"
									>
										<Input
											className="col-span-3 text-sm font-mono min-w-0"
											placeholder="feature_key"
											value={flag.key}
											onChange={(e) =>
												setFlags((prev) =>
													prev.map((f, i) =>
														i === idx ? { ...f, key: e.target.value } : f
													)
												)
											}
										/>
										<div className="col-span-2">
											<button
												type="button"
												onClick={() =>
													setFlags((prev) =>
														prev.map((f, i) =>
															i === idx ? { ...f, isEnabled: !f.isEnabled } : f
														)
													)
												}
												className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-[color,background-color] duration-200 motion-reduce:transition-none ${
													flag.isEnabled
														? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
														: 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
												}`}
											>
												{flag.isEnabled
													? `✓ ${t('workspace.config.enabled')}`
													: `✗ ${t('workspace.config.disabled')}`}
											</button>
										</div>
										<Input
											className="col-span-2 text-sm min-w-0"
											placeholder="all"
											value={flag.scope || ''}
											onChange={(e) =>
												setFlags((prev) =>
													prev.map((f, i) =>
														i === idx ? { ...f, scope: e.target.value } : f
													)
												)
											}
										/>
										<Input
											className="col-span-2 text-sm min-w-0"
											placeholder="100"
											type="number"
											min={0}
											max={100}
											value={flag.rollout ?? ''}
											onChange={(e) =>
												setFlags((prev) =>
													prev.map((f, i) =>
														i === idx
															? {
																	...f,
																	rollout: e.target.value
																		? Number(e.target.value)
																		: undefined,
																}
															: f
													)
												)
											}
										/>
										<Input
											className="col-span-2 text-sm min-w-0"
											placeholder="описание..."
											value={flag.description || ''}
											onChange={(e) =>
												setFlags((prev) =>
													prev.map((f, i) =>
														i === idx
															? { ...f, description: e.target.value }
															: f
													)
												)
											}
										/>
										<div className="col-span-1 flex justify-end">
											<button
												type="button"
												onClick={() => requestRemoveFlag(idx)}
												className="min-h-11 min-w-11 inline-flex items-center justify-center p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors motion-reduce:transition-none"
												aria-label={t('workspace.config.confirmRemoveFlag')}
											>
												<TrashIcon width={14} height={14} aria-hidden />
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</Card>
			)}

			<ConfirmDeleteModal
				isOpen={pendingRemove !== null}
				onClose={cancelRemove}
				onConfirm={executeRemove}
				title={removeModalTitle}
				itemName={removeModalItemName}
				warningMessage={removeModalWarning}
				confirmButtonLabel={t('adminCatalog.common.delete')}
				confirmButtonLoadingLabel={t('adminCatalog.common.deleteModalDeleting')}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
			/>
		</div>
	);
};

function parseValue(type: string, raw: string): unknown {
	switch (type) {
		case 'int':
			return Number(raw || 0);
		case 'bool':
			return raw === 'true' || raw === '1';
		case 'json':
			try {
				return raw ? JSON.parse(raw) : {};
			} catch {
				return {};
			}
		default:
			return raw;
	}
}
