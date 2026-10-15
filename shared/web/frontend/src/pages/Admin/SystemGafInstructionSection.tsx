/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin «GAF: instructions» — onboarding template editor, test send, bulk/broadcast outreach.
 *
 * Invariants:
 * - `BROADCAST_CONFIRM_PHRASE` must match API `system_gaf_admin.BROADCAST_CONFIRM_PHRASE`.
 * - Template locale follows app UI language (`ru` / `en` Postgres rows).
 *
 * Related:
 * - `pages/Admin/SystemGafInstructionToolbar.tsx`
 * - `documentation/platform/UNIFIED-ADMIN-SHELL.md`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi } from '../../services/admin/api';
import { APIError } from '../../services/api/client';
import { log } from '../../utils/logger';
import { DESKTOP_SURFACE, DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import { SystemGafInstructionEditorBody } from './SystemGafInstructionEditorBody';
import { SystemGafInstructionOutreachPanel } from './SystemGafInstructionOutreachPanel';
import { SystemGafInstructionPreviewPanel } from './SystemGafInstructionPreviewPanel';
import { SystemGafInstructionToolbar } from './SystemGafInstructionToolbar';
import {
	BULK_SEND_CHUNK_SIZE,
	buildInstructionPlaintextPreview,
	parseBulkUserIdsDetailed,
} from './systemGafInstructionPreview';
import {
	BROADCAST_CONFIRM_PHRASE,
	EMPTY_STEP,
	MAX_STEP_BODY,
	MAX_STEPS,
	MAX_STEP_TITLE,
	MAX_WELCOME_THANKS,
	QK,
	type InstructionStep,
	stepsToPayload,
	toPreviewSteps,
} from './systemGafInstructionShared';
import {
	parseGafInstructionLocaleFromJson,
	resolveGafInstructionLocale,
} from './systemGafInstructionLocale';

export function SystemGafInstructionSection(): React.ReactElement {
	const { t, i18n } = useTranslation('desktopUi', {
		keyPrefix: 'adminGafInstruction',
	});
	const templateLocale = resolveGafInstructionLocale(i18n.language);
	const qc = useQueryClient();
	const [welcome, setWelcome] = React.useState('');
	const [thanks, setThanks] = React.useState('');
	const [steps, setSteps] = React.useState<InstructionStep[]>([EMPTY_STEP()]);
	const [broadcastTaskId, setBroadcastTaskId] = React.useState<string | null>(
		null
	);
	const importInputRef = React.useRef<HTMLInputElement>(null);

	const [sendUserId, setSendUserId] = React.useState('');
	const [bulkUserIdsText, setBulkUserIdsText] = React.useState('');
	const [dryRunBulk, setDryRunBulk] = React.useState(false);
	const [bulkProgress, setBulkProgress] = React.useState<{
		chunk: number;
		chunks: number;
		sent: number;
		skipped: number;
	} | null>(null);

	const [broadcastConfirm, setBroadcastConfirm] = React.useState('');

	const instructionQuery = useQuery({
		queryKey: QK.instruction(templateLocale),
		queryFn: async () => {
			try {
				return await adminApi.getSystemGafInstruction(templateLocale);
			} catch (e: unknown) {
				if (e instanceof APIError && e.statusCode === 404) {
					return {
						locale: templateLocale,
						welcome_text: '',
						thanks_text: '',
						steps: [] as unknown[],
						updated_at: null,
						updated_by: null,
					};
				}
				throw e;
			}
		},
		staleTime: 60_000,
		refetchOnWindowFocus: false,
	});

	const previewQuery = useQuery({
		queryKey: QK.broadcastPreview,
		queryFn: () => adminApi.getSystemGafBroadcastPreview(),
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	});

	React.useEffect(() => {
		const d = instructionQuery.data;
		if (!d) {
			return;
		}
		setWelcome(d.welcome_text ?? '');
		setThanks(d.thanks_text ?? '');
		const raw = (d.steps ?? []) as Array<Record<string, unknown>>;
		if (raw.length === 0) {
			setSteps([EMPTY_STEP()]);
		} else {
			setSteps(
				raw.map((s) => ({
					id: crypto.randomUUID(),
					title: String(s.title ?? ''),
					body: String(s.body ?? ''),
					open_app_component:
						typeof s.open_app_component === 'string'
							? s.open_app_component
							: null,
					button_label: String(s.button_label ?? ''),
				}))
			);
		}
	}, [instructionQuery.data]);

	const previewText = React.useMemo(
		() =>
			buildInstructionPlaintextPreview(welcome, thanks, toPreviewSteps(steps)),
		[welcome, thanks, steps]
	);

	const deferredPreviewText = React.useDeferredValue(previewText);
	const previewIsStale = deferredPreviewText !== previewText;

	const bulkParsed = React.useMemo(
		() => parseBulkUserIdsDetailed(bulkUserIdsText),
		[bulkUserIdsText]
	);

	const saveMutation = useMutation({
		mutationFn: () =>
			adminApi.putSystemGafInstruction({
				locale: templateLocale,
				welcome_text: welcome,
				thanks_text: thanks,
				steps: stepsToPayload(steps),
			}),
		onSuccess: async () => {
			toast.success(t('toast.saved'));
			await qc.invalidateQueries({
				queryKey: QK.instruction(templateLocale),
			});
		},
		onError: (e: unknown) => {
			toast.error(e instanceof Error ? e.message : t('toast.saveError'));
		},
	});

	const sendTestMutation = useMutation({
		mutationFn: () => adminApi.postSystemGafSendTest(templateLocale),
		onSuccess: () => {
			toast.success(t('toast.sendTestOk'));
		},
		onError: (e: unknown) => {
			toast.error(e instanceof Error ? e.message : t('toast.sendError'));
		},
	});

	const sendSingleMutation = useMutation({
		mutationFn: (userId: string) =>
			adminApi.postSystemGafSend({
				user_id: userId,
				use_template: true,
				locale: templateLocale,
			}),
		onSuccess: (r) => {
			toast.success(
				t('toast.sendSingleOk', {
					sent: r.sent.length,
					skipped: r.skipped.length,
				})
			);
		},
		onError: (e: unknown) => {
			toast.error(e instanceof Error ? e.message : t('toast.sendError'));
		},
	});

	const sendBulkMutation = useMutation({
		mutationFn: async (params: {
			userIds: string[];
			dryRun: boolean;
		}): Promise<{ sent: number; skipped: number; dry_run: boolean }> => {
			const { userIds, dryRun } = params;
			const chunks: string[][] = [];
			for (let i = 0; i < userIds.length; i += BULK_SEND_CHUNK_SIZE) {
				chunks.push(userIds.slice(i, i + BULK_SEND_CHUNK_SIZE));
			}
			let sent = 0;
			let skipped = 0;
			for (let c = 0; c < chunks.length; c++) {
				setBulkProgress({
					chunk: c + 1,
					chunks: chunks.length,
					sent,
					skipped,
				});
				const r = await adminApi.postSystemGafSend({
					user_ids: chunks[c],
					use_template: true,
					dry_run: dryRun,
					locale: templateLocale,
				});
				sent += r.sent.length;
				skipped += r.skipped.length;
			}
			setBulkProgress({
				chunk: chunks.length,
				chunks: chunks.length,
				sent,
				skipped,
			});
			return { sent, skipped, dry_run: dryRun };
		},
		onSuccess: (r) => {
			setBulkProgress(null);
			const label = r.dry_run
				? t('toast.bulkLabelDryRun')
				: t('toast.bulkLabelDone');
			toast.success(
				t('toast.bulkOk', {
					label,
					sent: r.sent,
					skipped: r.skipped,
					dryNote: r.dry_run ? t('toast.bulkDryNote') : '',
				})
			);
		},
		onError: (e: unknown) => {
			toast.error(e instanceof Error ? e.message : t('toast.bulkError'));
			setBulkProgress(null);
		},
	});

	const broadcastMutation = useMutation({
		mutationFn: () =>
			adminApi.postSystemGafSendBroadcast({
				confirm: BROADCAST_CONFIRM_PHRASE,
				locale: templateLocale,
			}),
		onSuccess: (r) => {
			setBroadcastTaskId(r.task_id);
			toast.success(t('toast.broadcastQueued'), {
				description: t('toast.broadcastQueuedDesc', { taskId: r.task_id }),
			});
			setBroadcastConfirm('');
		},
		onError: (e: unknown) => {
			toast.error(
				e instanceof Error ? e.message : t('toast.broadcastQueueError')
			);
		},
	});

	const loading = instructionQuery.isPending;
	const refetchAll = React.useCallback(async () => {
		try {
			await Promise.all([
				qc.refetchQueries({ queryKey: QK.instruction(templateLocale) }),
				qc.refetchQueries({ queryKey: QK.broadcastPreview }),
			]);
			toast.success(t('toast.refreshed'));
		} catch (e) {
			log.error(
				'SystemGafInstruction',
				'refetch failed',
				e instanceof Error ? e : undefined
			);
			toast.error(e instanceof Error ? e.message : t('toast.loadError'));
		}
	}, [qc, t, templateLocale]);

	const save = React.useCallback(() => {
		if (
			welcome.length > MAX_WELCOME_THANKS ||
			thanks.length > MAX_WELCOME_THANKS
		) {
			toast.warning(t('toast.welcomeThanksMax', { max: MAX_WELCOME_THANKS }));
			return;
		}
		if (steps.length > MAX_STEPS) {
			toast.warning(t('toast.maxSteps', { max: MAX_STEPS }));
			return;
		}
		for (let i = 0; i < steps.length; i++) {
			const s = steps[i];
			if (s.title.length > MAX_STEP_TITLE || s.body.length > MAX_STEP_BODY) {
				toast.warning(t('toast.stepTooLong', { n: i + 1 }));
				return;
			}
		}
		saveMutation.mutate();
	}, [welcome, thanks, steps, saveMutation, t]);

	const sendToUser = () => {
		const id = sendUserId.trim();
		if (!id) {
			toast.warning(t('toast.needUserUuid'));
			return;
		}
		sendSingleMutation.mutate(id);
	};

	const sendBulk = () => {
		const ids = bulkParsed.valid;
		if (ids.length === 0) {
			toast.warning(t('toast.needBulkUuid'));
			return;
		}
		setBulkProgress(null);
		sendBulkMutation.mutate({ userIds: ids, dryRun: dryRunBulk });
	};

	const queueBroadcast = () => {
		if (broadcastConfirm.trim() !== BROADCAST_CONFIRM_PHRASE) {
			toast.warning(
				t('toast.confirmPhrase', { phrase: BROADCAST_CONFIRM_PHRASE })
			);
			return;
		}
		broadcastMutation.mutate();
	};

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey) || e.key !== 's') {
				return;
			}
			e.preventDefault();
			if (saveMutation.isPending || loading) {
				return;
			}
			save();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [save, saveMutation.isPending, loading]);

	const copyPreviewToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(previewText);
			toast.success(t('toast.previewCopied'));
		} catch {
			toast.error(t('toast.copyFailed'));
		}
	};

	const copyTaskId = async (id: string) => {
		try {
			await navigator.clipboard.writeText(id);
			toast.success(t('toast.taskIdCopied'));
		} catch {
			toast.error(t('toast.copyFailed'));
		}
	};

	const exportTemplateJson = () => {
		const payload = {
			locale: templateLocale,
			welcome_text: welcome,
			thanks_text: thanks,
			steps: stepsToPayload(steps),
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], {
			type: 'application/json;charset=utf-8',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `system-gaf-instruction-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success(t('toast.jsonDownloaded'));
	};

	const importTemplateFromJson = (raw: string) => {
		let data: unknown;
		try {
			data = JSON.parse(raw);
		} catch {
			toast.error(t('toast.invalidJson'));
			return;
		}
		if (!data || typeof data !== 'object') {
			toast.error(t('toast.jsonRootObject'));
			return;
		}
		const o = data as Record<string, unknown>;
		const importedLocale = parseGafInstructionLocaleFromJson(o.locale);
		if (importedLocale && importedLocale !== templateLocale) {
			toast.warning(
				t('toast.importLocaleMismatch', {
					fileLocale: importedLocale,
					editingLocale: templateLocale,
				})
			);
		}
		const w = typeof o.welcome_text === 'string' ? o.welcome_text : '';
		const th = typeof o.thanks_text === 'string' ? o.thanks_text : '';
		const st = o.steps;
		if (!Array.isArray(st)) {
			toast.error(t('toast.jsonNoSteps'));
			return;
		}
		if (st.length > MAX_STEPS) {
			toast.error(t('toast.jsonTooManySteps', { max: MAX_STEPS }));
			return;
		}
		const next: InstructionStep[] =
			st.length === 0
				? [EMPTY_STEP()]
				: st.map((item) => {
						const row = item as Record<string, unknown>;
						return {
							id: crypto.randomUUID(),
							title: typeof row.title === 'string' ? row.title : '',
							body: typeof row.body === 'string' ? row.body : '',
							open_app_component:
								typeof row.open_app_component === 'string'
									? row.open_app_component
									: null,
							button_label:
								typeof row.button_label === 'string' ? row.button_label : '',
						};
					});
		setWelcome(w);
		setThanks(th);
		setSteps(next);
		toast.success(t('toast.importedToForm'));
	};

	const onImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		e.target.value = '';
		if (!f) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			importTemplateFromJson(String(reader.result ?? ''));
		};
		reader.onerror = () => toast.error(t('toast.fileReadError'));
		reader.readAsText(f);
	};

	const duplicateStep = (idx: number) => {
		setSteps((s) => {
			if (s.length >= MAX_STEPS) {
				toast.warning(t('toast.maxSteps', { max: MAX_STEPS }));
				return s;
			}
			const cur = s[idx];
			const copy: InstructionStep = {
				...cur,
				id: crypto.randomUUID(),
			};
			return [...s.slice(0, idx + 1), copy, ...s.slice(idx + 1)];
		});
	};

	const meta = instructionQuery.data;
	const recipientCount =
		typeof previewQuery.data?.recipient_count === 'number'
			? previewQuery.data.recipient_count
			: null;

	return (
		<section
			className={`p-6 ${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} border-white/10 bg-slate-900/40`}
			aria-labelledby="admin-gaf-section-title"
		>
			<input
				ref={importInputRef}
				type="file"
				accept="application/json,.json"
				className="hidden"
				aria-label={t('importFileAria')}
				onChange={onImportFileChange}
			/>
			<SystemGafInstructionToolbar
				loading={loading}
				instructionFetching={instructionQuery.isFetching}
				previewFetching={previewQuery.isFetching}
				savePending={saveMutation.isPending}
				sendTestPending={sendTestMutation.isPending}
				onRefresh={refetchAll}
				onSave={save}
				onSendTest={() => sendTestMutation.mutate()}
				onExportJson={exportTemplateJson}
				onImportClick={() => importInputRef.current?.click()}
			/>

			<p className={`${DESKTOP_TYPOGRAPHY.meta} mb-3 text-slate-500`}>
				{t('meta.templateLocale', { locale: templateLocale })}
				<span className="text-slate-600">
					{' '}
					— {t('meta.templateLocaleHint')}
				</span>
			</p>

			{meta?.updated_at ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} mb-3 text-slate-500`}>
					{t('meta.lastSaved')}{' '}
					<time dateTime={meta.updated_at}>
						{new Date(meta.updated_at).toLocaleString()}
					</time>
					{meta.updated_by ? (
						<>
							{' '}
							· {t('meta.editor')}{' '}
							<code className="rounded bg-black/30 px-1 py-0.5 font-mono text-xs">
								{meta.updated_by}
							</code>
						</>
					) : null}
				</p>
			) : null}

			<SystemGafInstructionEditorBody
				loading={loading}
				loadError={instructionQuery.isError ? instructionQuery.error : null}
				welcome={welcome}
				setWelcome={setWelcome}
				thanks={thanks}
				setThanks={setThanks}
				steps={steps}
				setSteps={setSteps}
				duplicateStep={duplicateStep}
			/>

			{!loading ? (
				<SystemGafInstructionPreviewPanel
					previewText={previewText}
					deferredPreviewText={deferredPreviewText}
					previewIsStale={previewIsStale}
					onCopy={copyPreviewToClipboard}
				/>
			) : null}

			<SystemGafInstructionOutreachPanel
				templateLocale={templateLocale}
				broadcastConfirmPhrase={BROADCAST_CONFIRM_PHRASE}
				sendUserId={sendUserId}
				setSendUserId={setSendUserId}
				onSendOne={sendToUser}
				sendSinglePending={sendSingleMutation.isPending}
				bulkUserIdsText={bulkUserIdsText}
				setBulkUserIdsText={setBulkUserIdsText}
				bulkParsed={bulkParsed}
				dryRunBulk={dryRunBulk}
				setDryRunBulk={setDryRunBulk}
				onSendBulk={sendBulk}
				sendBulkPending={sendBulkMutation.isPending}
				bulkProgress={bulkProgress}
				recipientCount={recipientCount}
				previewLoading={previewQuery.isLoading}
				broadcastConfirm={broadcastConfirm}
				setBroadcastConfirm={setBroadcastConfirm}
				onQueueBroadcast={queueBroadcast}
				broadcastPending={broadcastMutation.isPending}
				broadcastTaskId={broadcastTaskId}
				onCopyTaskId={copyTaskId}
			/>
		</section>
	);
}
