/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Settings screen (P-900): org profile, experience balance threshold, 1C stub, JSON backup/import.
 *
 * Invariants:
 * - Data access only via getPoemmaRepository (no direct localStorage).
 * - Import rejects backups from another userId.
 * - Owner edits org and threshold; backup available to all roles on this screen.
 *
 * Related:
 * - poemma/docs/implementation/API-LOCAL.md
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §17
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type FormEvent,
} from 'react';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	POEMMA_DEFAULT_EXPERIENCE_BALANCE_THRESHOLD_PERCENT,
	type PoemmaOrganization,
	type PoemmaOrgSettings,
	type PoemmaUserRole,
} from '../poemmaDomain';
import {
	POEMMA_SECTION_EYEBROW,
	POEMMA_SETTINGS_COPY,
} from '../poemmaUserChromeCopy';
import { getPoemmaRepository } from '../poemmaRepository';
import {
	PoemmaFieldError,
	PoemmaFormField,
	PoemmaNavRail,
	PoemmaPageError,
	PoemmaPageHeader,
	PoemmaPageLoading,
	PoemmaPagePanel,
	PoemmaPageSection,
	PoemmaPageShell,
	PoemmaSectionTitle,
} from '../ui';
import {
	buildPoemmaBackupDownloadName,
	parsePoemmaExperienceThresholdInput,
	triggerPoemmaJsonDownload,
	validatePoemmaExperienceThreshold,
} from './poemmaSettingsForm';

export type PoemmaSettingsPageProps = {
	ownerUserId: string;
	userRole: PoemmaUserRole;
	onNavigate: (path: string) => void;
};

type SettingsDraft = {
	displayName: string;
	niche: string;
	geo: string;
	thresholdInput: string;
};

function buildSettingsDraft(
	org: PoemmaOrganization,
	settings: PoemmaOrgSettings
): SettingsDraft {
	return {
		displayName: org.displayName,
		niche: org.niche,
		geo: org.geo,
		thresholdInput: String(settings.experienceBalanceThresholdPercent),
	};
}

function PoemmaSettingsNoWorkspace({
	onNavigate,
}: {
	onNavigate: (path: string) => void;
}) {
	return (
		<PoemmaPageShell>
			<PoemmaPagePanel>
				<PoemmaSectionTitle>Нет бизнеса</PoemmaSectionTitle>
				<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
					Сначала создайте карту на онбординге — затем настройки и бэкап.
				</p>
				<DesktopAppButton
					type="button"
					variant="accent"
					className="mt-4"
					onClick={() => onNavigate('/onboarding')}
				>
					Онбординг
				</DesktopAppButton>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}

export function PoemmaSettingsPage({
	ownerUserId,
	userRole,
	onNavigate,
}: PoemmaSettingsPageProps) {
	const repository = useMemo(
		() => getPoemmaRepository(ownerUserId.trim()),
		[ownerUserId]
	);
	const importInputRef = useRef<HTMLInputElement>(null);
	const [org, setOrg] = useState<PoemmaOrganization | null>(null);
	const [settings, setSettings] = useState<PoemmaOrgSettings | null>(null);
	const [draft, setDraft] = useState<SettingsDraft | null>(null);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [syncMessage, setSyncMessage] = useState<string | null>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	const canEdit = userRole === 'owner';

	const loadSettingsPage = useCallback(async (): Promise<void> => {
		try {
			const [loadedOrg, loadedSettings] = await Promise.all([
				repository.getOrg(),
				repository.getOrgSettings(),
			]);
			setOrg(loadedOrg);
			setSettings(loadedSettings);
			setDraft(
				loadedOrg && loadedSettings
					? buildSettingsDraft(loadedOrg, loadedSettings)
					: null
			);
			setLoadError(null);
		} catch (error) {
			setOrg(null);
			setSettings(null);
			setDraft(null);
			setLoadError(
				error instanceof Error
					? error.message
					: 'Не удалось загрузить настройки.'
			);
		} finally {
			setIsLoaded(true);
		}
	}, [repository]);

	useEffect(() => {
		setIsLoaded(false);
		setLoadError(null);
		void loadSettingsPage();
	}, [loadSettingsPage]);

	if (!isLoaded) {
		return (
			<PoemmaPageLoading
				title="Загружаем настройки бизнеса"
				description="Проверяем профиль, порог опыта и доступные операции с данными."
			/>
		);
	}

	if (loadError) {
		return (
			<PoemmaPageError
				title="Не удалось открыть настройки"
				description={loadError}
				actions={
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={() => {
							setIsLoaded(false);
							setLoadError(null);
							void loadSettingsPage();
						}}
					>
						Повторить
					</DesktopAppButton>
				}
			/>
		);
	}

	if (!org || !settings || !draft) {
		return <PoemmaSettingsNoWorkspace onNavigate={onNavigate} />;
	}

	const currentOrg = org;
	const _currentSettings = settings;
	const currentDraft = draft;

	async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (!canEdit) {
			return;
		}

		setStatusMessage(null);
		const displayName = currentDraft.displayName.trim();
		if (!displayName) {
			setValidationError('Укажите название бизнеса');
			return;
		}

		const threshold = parsePoemmaExperienceThresholdInput(
			currentDraft.thresholdInput
		);
		if (threshold == null) {
			setValidationError('Укажите порог опыта');
			return;
		}
		const thresholdError = validatePoemmaExperienceThreshold(threshold);
		if (thresholdError) {
			setValidationError(thresholdError);
			return;
		}

		setValidationError(null);
		setIsSaving(true);
		try {
			const nextOrg: PoemmaOrganization = {
				...currentOrg,
				displayName,
				niche: currentDraft.niche.trim(),
				geo: currentDraft.geo.trim(),
			};
			const nextSettings: PoemmaOrgSettings = {
				orgId: currentOrg.id,
				experienceBalanceThresholdPercent: threshold,
				orgDisplayName: displayName,
			};
			await repository.saveOrg(nextOrg);
			await repository.saveOrgSettings(nextSettings);
			setOrg(nextOrg);
			setSettings(nextSettings);
			setDraft(buildSettingsDraft(nextOrg, nextSettings));
			setStatusMessage('Настройки сохранены');
		} catch (error) {
			setValidationError(
				error instanceof Error ? error.message : 'Не удалось сохранить'
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function handleExportBackup(): Promise<void> {
		setStatusMessage(null);
		setValidationError(null);
		setIsExporting(true);
		try {
			const backup = await repository.exportStorageBackup();
			triggerPoemmaJsonDownload(backup, buildPoemmaBackupDownloadName(backup));
			setStatusMessage(POEMMA_SETTINGS_COPY.backupDownloaded);
		} catch (error) {
			setValidationError(
				error instanceof Error
					? error.message
					: POEMMA_SETTINGS_COPY.backupDownloadFailed
			);
		} finally {
			setIsExporting(false);
		}
	}

	async function handleImportFile(
		event: ChangeEvent<HTMLInputElement>
	): Promise<void> {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) {
			return;
		}

		setStatusMessage(null);
		setValidationError(null);
		setIsImporting(true);
		try {
			const text = await file.text();
			const parsed = JSON.parse(text) as unknown;
			const result = await repository.importStorageBackup(parsed);
			if (!result.ok) {
				setValidationError(result.message);
				return;
			}
			await loadSettingsPage();
			setStatusMessage(POEMMA_SETTINGS_COPY.backupRestored);
		} catch {
			setValidationError('Не удалось прочитать файл');
		} finally {
			setIsImporting(false);
		}
	}

	async function handleSync1C(): Promise<void> {
		setSyncMessage(null);
		const result = await repository.syncFrom1C();
		setSyncMessage(result.message);
	}

	return (
		<PoemmaPageShell>
			<PoemmaNavRail backLabel="← Карта" onBack={() => onNavigate('/')} />

			<PoemmaPagePanel>
				<PoemmaPageHeader
					eyebrow={POEMMA_SECTION_EYEBROW.settings}
					title="Настройки"
					description="Название бизнеса, порог баланса опыта и резервная копия ваших данных."
					meta={canEdit ? 'Можно редактировать' : 'Только просмотр'}
				/>

				<PoemmaFieldError message={validationError} className="mt-4" />
				{statusMessage ? (
					<DesktopProductStatusBanner
						tone="neutral"
						title="Настройки"
						description={statusMessage}
						className="mt-4"
					/>
				) : null}

				{!canEdit ? (
					<p className="mt-6 text-sm text-(--desktop-text-secondary)">
						{POEMMA_SETTINGS_COPY.teamReadOnlyHint}
					</p>
				) : null}
			</PoemmaPagePanel>

			<form className="grid gap-4" onSubmit={handleSave}>
				<PoemmaPagePanel>
					<PoemmaPageSection label="Мой бизнес" variant="framed">
						<PoemmaFormField label="Название">
							<DesktopAppInput
								value={draft.displayName}
								disabled={!canEdit}
								onChange={(event) =>
									setDraft((prev) =>
										prev ? { ...prev, displayName: event.target.value } : prev
									)
								}
							/>
						</PoemmaFormField>
						<PoemmaFormField label="Ниша">
							<DesktopAppInput
								value={draft.niche}
								disabled={!canEdit}
								onChange={(event) =>
									setDraft((prev) =>
										prev ? { ...prev, niche: event.target.value } : prev
									)
								}
							/>
						</PoemmaFormField>
						<PoemmaFormField label="Гео">
							<DesktopAppInput
								value={draft.geo}
								disabled={!canEdit}
								onChange={(event) =>
									setDraft((prev) =>
										prev ? { ...prev, geo: event.target.value } : prev
									)
								}
							/>
						</PoemmaFormField>
					</PoemmaPageSection>
				</PoemmaPagePanel>

				<PoemmaPagePanel className="grid gap-3">
					<PoemmaSectionTitle>Период</PoemmaSectionTitle>
					<p className="text-base text-(--desktop-text-primary)">
						{POEMMA_SETTINGS_COPY.periodFixed}
					</p>
				</PoemmaPagePanel>

				<PoemmaPagePanel className="grid gap-4">
					<PoemmaSectionTitle>Порог опыта</PoemmaSectionTitle>
					<p className="text-sm leading-6 text-(--desktop-text-secondary)">
						«В балансе», если разница опыта сотрудника и клиента не больше
						порога.
					</p>
					<PoemmaFormField label="Разница ≤">
						<div className="flex flex-wrap items-center gap-2">
							<DesktopAppInput
								className="w-20"
								inputMode="decimal"
								aria-label="Порог опыта в процентах"
								value={draft.thresholdInput}
								disabled={!canEdit}
								onChange={(event) =>
									setDraft((prev) =>
										prev
											? { ...prev, thresholdInput: event.target.value }
											: prev
									)
								}
							/>
							<span className="text-sm font-medium text-(--desktop-text-secondary)">
								%
							</span>
						</div>
					</PoemmaFormField>
					<p className="text-xs text-(--desktop-text-dim)">
						По умолчанию {POEMMA_DEFAULT_EXPERIENCE_BALANCE_THRESHOLD_PERCENT}%
					</p>
				</PoemmaPagePanel>

				{canEdit ? (
					<div className="flex flex-wrap items-center gap-3">
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={isSaving}
						>
							{isSaving ? 'Сохраняем…' : 'Сохранить'}
						</DesktopAppButton>
					</div>
				) : null}
			</form>

			<PoemmaPagePanel className="grid gap-4">
				<PoemmaSectionTitle>Интеграции</PoemmaSectionTitle>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-base font-medium text-(--desktop-text-primary)">
							1С
						</p>
						<p className="text-sm text-(--desktop-text-secondary)">
							{POEMMA_SETTINGS_COPY.integration1cStatus}
						</p>
					</div>
					{canEdit ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => void handleSync1C()}
						>
							{POEMMA_SETTINGS_COPY.integration1cAction}
						</DesktopAppButton>
					) : null}
				</div>
				{syncMessage ? (
					<DesktopProductStatusBanner
						tone="neutral"
						title="1С"
						description={syncMessage}
					/>
				) : null}
			</PoemmaPagePanel>

			<PoemmaPagePanel className="grid gap-4">
				<PoemmaSectionTitle>Данные</PoemmaSectionTitle>
				<p className="text-sm leading-6 text-(--desktop-text-secondary)">
					{POEMMA_SETTINGS_COPY.backupIntro}
				</p>
				<div className="flex flex-wrap gap-3">
					<DesktopAppButton
						type="button"
						variant="accent"
						disabled={isExporting}
						onClick={() => void handleExportBackup()}
					>
						{isExporting
							? POEMMA_SETTINGS_COPY.backupDownloading
							: POEMMA_SETTINGS_COPY.backupDownload}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						disabled={isImporting}
						onClick={() => importInputRef.current?.click()}
					>
						{isImporting
							? POEMMA_SETTINGS_COPY.backupImporting
							: POEMMA_SETTINGS_COPY.backupImport}
					</DesktopAppButton>
					<input
						ref={importInputRef}
						type="file"
						accept="application/json,.json"
						className="hidden"
						onChange={(event) => void handleImportFile(event)}
					/>
				</div>
			</PoemmaPagePanel>
		</PoemmaPageShell>
	);
}
