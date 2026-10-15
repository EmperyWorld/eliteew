/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KIRS curation page controller: queries, mutations, local UI state, and derived runtime flags.
 *
 * Invariants:
 * - Runtime actions only via kirsApi; adminShellReady gates admin embed tab.
 * - Public behavior matches pre-atomization KirsPage monolith.
 *
 * Related:
 * - kirsPage/KirsPage.tsx
 * - ../kirsRuntimeGuards.ts
 * - features/kirs/kirsApi.ts
 */

import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import {
	activateKirsDomainBinding,
	createKirsDomainBinding,
	createKirsProjectInstance,
	deleteKirsProjectInstance,
	disableKirsDomainBinding,
	getKirsCollaborationState,
	getKirsInstanceHealth,
	getKirsProjectInstance,
	listKirsDomainBindings,
	listKirsOperatorProjects,
	provisionKirsInstance,
	redeployKirsInstance,
	requestKirsDomainRoute,
	startKirsInstance,
	stopKirsInstance,
	updateKirsClientAccess,
	updateKirsCollaborationState,
	verifyKirsDomainBinding,
} from '@/features/kirs/kirsApi';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { telemetryRuntimeDisabledReasonsToggle } from '@/pages/Desktop/utils/desktopTelemetry';
import {
	computeKirsRuntimeUi,
	isKirsPendingStatus,
} from '../kirsRuntimeGuards';
import { KIRS_CURATION_GUIDE_STEP_DEFS } from '../kirsCurationGuideConstants';
import { formatKirsLifecycleJob, KIRS_KEY } from './kirsPageConstants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

export function useKirsPage() {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'kirsCuration' });
	const guideLabels = React.useMemo(
		() => guideTourLabelsFromI18n(t, 'guide'),
		[t]
	);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		KIRS_CURATION_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = React.useState(false);
	const openGuideTour = React.useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);
	const qc = useQueryClient();
	const projectsQuery = useQuery({
		queryKey: [...KIRS_KEY, 'operator-projects'],
		queryFn: () => listKirsOperatorProjects(),
	});
	const [selectedId, setSelectedId] = React.useState<string | null>(null);

	const instanceQuery = useQuery({
		queryKey: [...KIRS_KEY, 'instance', selectedId],
		queryFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return getKirsProjectInstance(selectedId);
		},
		enabled: Boolean(selectedId),
		refetchInterval: (q) => {
			const s = String(q.state.data?.status ?? '').toLowerCase();
			if (isKirsPendingStatus(s)) {
				return 4000;
			}
			return false;
		},
	});

	const healthQuery = useQuery({
		queryKey: [...KIRS_KEY, 'health', selectedId],
		queryFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return getKirsInstanceHealth(selectedId);
		},
		enabled: Boolean(selectedId) && Boolean(instanceQuery.data),
		refetchInterval: (q) => {
			const s = String(q.state.data?.status ?? '').toLowerCase();
			if (isKirsPendingStatus(s)) {
				return 4000;
			}
			return false;
		},
	});
	const domainsQuery = useQuery({
		queryKey: [...KIRS_KEY, 'domains', selectedId],
		queryFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return listKirsDomainBindings(selectedId);
		},
		enabled: Boolean(selectedId) && Boolean(instanceQuery.data),
	});
	const collaborationQuery = useQuery({
		queryKey: [...KIRS_KEY, 'collaboration', selectedId],
		queryFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return getKirsCollaborationState(selectedId);
		},
		enabled: Boolean(selectedId) && Boolean(instanceQuery.data),
	});

	const [title, setTitle] = React.useState('');
	const [templateKey, setTemplateKey] = React.useState('olenti');
	const [domainInput, setDomainInput] = React.useState('');
	const [allowPublic, setAllowPublic] = React.useState(true);
	const [allowAdmin, setAllowAdmin] = React.useState(false);
	const [readinessStatus, setReadinessStatus] = React.useState('preparing');
	const [approvalStatus, setApprovalStatus] = React.useState('not_requested');
	const [operatorNotes, setOperatorNotes] = React.useState('');
	const [panelTab, setPanelTab] = React.useState<'console' | 'admin'>(
		'console'
	);
	const [pendingKirsDelete, setPendingKirsDelete] = React.useState<
		'wipe_disk' | 'keep_runtime_dir' | null
	>(null);

	React.useEffect(() => {
		setPanelTab('console');
	}, []);

	React.useEffect(() => {
		const inst = instanceQuery.data;
		if (inst) {
			setTitle(inst.site_title);
			setTemplateKey(inst.template_key);
		}
	}, [instanceQuery.data]);

	React.useEffect(() => {
		const state = collaborationQuery.data;
		if (!state) return;
		setReadinessStatus(state.readiness_status);
		setApprovalStatus(state.approval_status);
		setOperatorNotes(state.operator_notes ?? '');
	}, [collaborationQuery.data]);

	const createMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return createKirsProjectInstance(selectedId, {
				site_title: title.trim() || 'Сайт проекта',
				template_key: templateKey,
			});
		},
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'instance', selectedId],
			});
		},
	});

	const provisionMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return provisionKirsInstance(selectedId);
		},
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'instance', selectedId],
			});
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'health', selectedId],
			});
		},
	});

	const startMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return startKirsInstance(selectedId);
		},
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'instance', selectedId],
			});
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'health', selectedId],
			});
		},
	});
	const stopMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return stopKirsInstance(selectedId);
		},
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'instance', selectedId],
			});
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'health', selectedId],
			});
		},
	});
	const redeployMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return redeployKirsInstance(selectedId);
		},
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'instance', selectedId],
			});
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'health', selectedId],
			});
		},
	});

	const accessMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return updateKirsClientAccess(selectedId, {
				allow_public_site: allowPublic,
				allow_admin_embed: allowAdmin,
			});
		},
		onSuccess: () =>
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'instance', selectedId],
			}),
	});

	const collaborationMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return updateKirsCollaborationState(selectedId, {
				readiness_status: readinessStatus as
					| 'preparing'
					| 'ready_for_review'
					| 'published'
					| 'paused',
				approval_status: approvalStatus as
					| 'not_requested'
					| 'requested'
					| 'approved'
					| 'changes_requested',
				operator_notes: operatorNotes,
				handoff_checklist: {
					public_access_confirmed: allowPublic,
					admin_embed_confirmed: allowAdmin,
				},
			});
		},
		onSuccess: () =>
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'collaboration', selectedId],
			}),
	});

	const deleteMut = useMutation({
		mutationFn: (preserve: boolean) => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return deleteKirsProjectInstance(selectedId, preserve);
		},
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'instance', selectedId],
			});
			setSelectedId(null);
		},
	});
	const createDomainMut = useMutation({
		mutationFn: () => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			return createKirsDomainBinding(selectedId, domainInput.trim());
		},
		onSuccess: () => {
			setDomainInput('');
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'domains', selectedId],
			});
		},
	});
	const domainActionMut = useMutation({
		mutationFn: (payload: {
			bindingId: string;
			action: 'verify' | 'route' | 'activate' | 'disable';
		}) => {
			if (!selectedId) throw new Error('Kirs: instance id required');
			if (payload.action === 'verify') {
				return verifyKirsDomainBinding(selectedId, payload.bindingId);
			}
			if (payload.action === 'route') {
				return requestKirsDomainRoute(selectedId, payload.bindingId);
			}
			if (payload.action === 'activate') {
				return activateKirsDomainBinding(selectedId, payload.bindingId);
			}
			return disableKirsDomainBinding(selectedId, payload.bindingId);
		},
		onSuccess: () =>
			void qc.invalidateQueries({
				queryKey: [...KIRS_KEY, 'domains', selectedId],
			}),
	});

	const confirmKirsDelete = React.useCallback(async () => {
		if (!pendingKirsDelete) return;
		const preserveRuntimeOnDisk = pendingKirsDelete === 'keep_runtime_dir';
		try {
			await deleteMut.mutateAsync(preserveRuntimeOnDisk);
		} finally {
			setPendingKirsDelete(null);
		}
	}, [pendingKirsDelete, deleteMut]);

	const projects = projectsQuery.data ?? [];
	const prepareGuideStep = React.useCallback(
		(stepId: string) => {
			if (
				stepId === 'intro' ||
				stepId === 'header' ||
				stepId === 'project-list' ||
				stepId === 'outro'
			) {
				return;
			}
			if (!selectedId && projects.length > 0) {
				setSelectedId(projects[0].project_id);
			}
			if (stepId !== 'panel-tabs') {
				setPanelTab('console');
			}
		},
		[projects, selectedId]
	);
	const inst = instanceQuery.data;
	const busy =
		createMut.isPending ||
		provisionMut.isPending ||
		startMut.isPending ||
		stopMut.isPending ||
		redeployMut.isPending ||
		deleteMut.isPending;

	React.useEffect(() => {
		if (
			!inst?.client_access_json ||
			typeof inst.client_access_json !== 'object'
		)
			return;
		const j = inst.client_access_json as {
			allow_public_site?: boolean;
			allow_admin_embed?: boolean;
		};
		setAllowPublic(Boolean(j.allow_public_site ?? true));
		setAllowAdmin(Boolean(j.allow_admin_embed));
	}, [inst]);

	const adminShellReady = React.useMemo(() => {
		if (!inst || !healthQuery.data) return false;
		if (isKirsPendingStatus(inst.status)) return false;
		return (
			healthQuery.data.status === 'running' && healthQuery.data.api_ok === true
		);
	}, [inst, healthQuery.data]);

	const runtimeUi = React.useMemo(() => {
		return computeKirsRuntimeUi({
			status: inst?.status,
			healthStatus: healthQuery.data?.status,
			apiOk: healthQuery.data?.api_ok === true,
			publicOk: healthQuery.data?.public_ok === true,
			publicationState: inst?.publication_state,
			hasInstance: Boolean(inst),
			busy,
		});
	}, [inst, healthQuery.data, busy]);
	const kirsPendingJobSummary = formatKirsLifecycleJob(
		healthQuery.data?.pending_job ?? null
	);
	const kirsLastJobSummary = formatKirsLifecycleJob(
		healthQuery.data?.last_job ?? null
	);
	const domainRows = domainsQuery.data ?? [];
	const handleRuntimeHintsToggle = React.useCallback(
		(payload: {
			isExpanded: boolean;
			rawCount: number;
			collapsedCount: number;
			hiddenCount: number;
		}) => {
			telemetryRuntimeDisabledReasonsToggle({
				surface: 'kirs',
				expanded: payload.isExpanded,
				rawCount: payload.rawCount,
				collapsedCount: payload.collapsedCount,
				hiddenCount: payload.hiddenCount,
			});
		},
		[]
	);

	return {
		guideLabels,
		guideSteps,
		guideOpen,
		setGuideOpen,
		prepareGuideStep,
		projectsQuery,
		selectedId,
		setSelectedId,
		instanceQuery,
		healthQuery,
		domainsQuery,
		collaborationQuery,
		title,
		setTitle,
		templateKey,
		setTemplateKey,
		domainInput,
		setDomainInput,
		allowPublic,
		setAllowPublic,
		allowAdmin,
		setAllowAdmin,
		readinessStatus,
		setReadinessStatus,
		approvalStatus,
		setApprovalStatus,
		operatorNotes,
		setOperatorNotes,
		panelTab,
		setPanelTab,
		pendingKirsDelete,
		setPendingKirsDelete,
		createMut,
		provisionMut,
		startMut,
		stopMut,
		redeployMut,
		accessMut,
		collaborationMut,
		deleteMut,
		createDomainMut,
		domainActionMut,
		confirmKirsDelete,
		projects,
		inst,
		busy,
		adminShellReady,
		runtimeUi,
		kirsPendingJobSummary,
		kirsLastJobSummary,
		domainRows,
		handleRuntimeHintsToggle,
	};
}

export type KirsPageController = ReturnType<typeof useKirsPage>;
