/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hooks for legacy UGS admin entities (providers, types, workflows, settings, users).
 *
 * Invariants:
 * - Query keys and base query config are centralized in local `*QueryOptions` helpers.
 * - Mutation invalidation targets key factories from `QueryKeys`.
 *
 * Related:
 * - services/api/ugsAdmin.ts
 * - hooks/api/useUgsAdminV2.ts
 */

import {
	queryOptions,
	useQuery,
	useMutation,
	useQueryClient,
	type UseQueryResult,
	type UseMutationResult,
} from '@tanstack/react-query';
import {
	getProviders,
	createProvider,
	bootstrapRuntimeProviders,
	updateProvider,
	deleteProvider,
	getGenerationTypes,
	createGenerationType,
	updateGenerationType,
	deleteGenerationType,
	getWorkflows,
	createWorkflow,
	importWorkflowsFromDisk,
	updateWorkflow,
	deleteWorkflow,
	getSettings,
	createSetting,
	updateSetting,
	deleteSetting,
	getAdminUsers,
	getAdminUser,
	topUpUserCredits,
	updateUserLimits,
	patchUserTrusted,
	patchUserAdminBadge,
	type GenerationProviderDTO,
	type RuntimeProviderBootstrapResultDTO,
	type GenerationTypeDTO,
	type ComfyUIWorkflowDTO,
	type ComfyUIWorkflowImportResult,
	type UGSSettingsListDTO,
	type UGSSettingDTO,
	type AdminUserDTO,
	type UserLimitsUpdatePayload,
} from '../../services/api/ugsAdmin';

type QueryOptions = {
	enabled?: boolean;
};

const QueryKeys = {
	providers: ['ugs-admin', 'providers'] as const,
	types: (includeInactive: boolean) =>
		['ugs-admin', 'types', includeInactive] as const,
	workflows: (includeInactive: boolean) =>
		['ugs-admin', 'workflows', includeInactive] as const,
	settings: (params: SettingsParamsKey) =>
		[
			'ugs-admin',
			'settings',
			params.scope ?? 'all',
			params.company_id ?? '-',
			params.project_id ?? '-',
			params.user_id ?? '-',
		] as const,
	users: ['ugs-admin', 'users'] as const,
	user: (userId: string | null | undefined) =>
		['ugs-admin', 'users', userId ?? ''] as const,
};

type SettingsParamsKey = {
	scope?: string;
	company_id?: string;
	project_id?: string;
	user_id?: string;
};

function ugsAdminProvidersQueryOptions() {
	return queryOptions<GenerationProviderDTO[], Error>({
		queryKey: QueryKeys.providers,
		queryFn: getProviders,
		staleTime: 0,
	});
}

function ugsAdminGenerationTypesQueryOptions(includeInactive: boolean) {
	return queryOptions<GenerationTypeDTO[], Error>({
		queryKey: QueryKeys.types(includeInactive),
		queryFn: () => getGenerationTypes(includeInactive),
		staleTime: 0,
	});
}

function ugsAdminWorkflowsQueryOptions(includeInactive: boolean) {
	return queryOptions<ComfyUIWorkflowDTO[], Error>({
		queryKey: QueryKeys.workflows(includeInactive),
		queryFn: () => getWorkflows(includeInactive),
		staleTime: 60 * 1000,
	});
}

function ugsAdminSettingsQueryOptions(params: SettingsParamsKey) {
	return queryOptions<UGSSettingsListDTO, Error>({
		queryKey: QueryKeys.settings(params),
		queryFn: () => getSettings(params),
		staleTime: 30 * 1000,
	});
}

function ugsAdminUsersQueryOptions() {
	return queryOptions<AdminUserDTO[], Error>({
		queryKey: QueryKeys.users,
		queryFn: getAdminUsers,
		staleTime: 60 * 1000,
	});
}

function ugsAdminUserQueryOptions(userId: string | null) {
	return queryOptions<AdminUserDTO, Error>({
		queryKey: QueryKeys.user(userId),
		queryFn: () => {
			if (!userId) {
				throw new Error('useAdminUser: userId is required when query runs');
			}
			return getAdminUser(userId);
		},
		staleTime: 30 * 1000,
	});
}

// Providers -----------------------------------------------------------------

export const useProviders = (
	options: QueryOptions = {}
): UseQueryResult<GenerationProviderDTO[], Error> => {
	return useQuery<GenerationProviderDTO[]>({
		...ugsAdminProvidersQueryOptions(),
		// всегда актуальный список из БД (админ меняет провайдеры)
		enabled: options.enabled ?? true,
	});
};

export const useCreateProvider = (): UseMutationResult<
	GenerationProviderDTO,
	Error,
	Partial<GenerationProviderDTO>,
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createProvider,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.providers });
		},
	});
};

export const useUpdateProvider = (): UseMutationResult<
	GenerationProviderDTO,
	Error,
	{ providerName: string; payload: Partial<GenerationProviderDTO> },
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			providerName,
			payload,
		}: {
			providerName: string;
			payload: Partial<GenerationProviderDTO>;
		}) => updateProvider(providerName, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.providers });
		},
	});
};

export const useDeleteProvider = (): UseMutationResult<
	void,
	Error,
	string,
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteProvider,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.providers });
		},
	});
};

export const useBootstrapRuntimeProviders = (): UseMutationResult<
	RuntimeProviderBootstrapResultDTO,
	Error,
	void,
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: bootstrapRuntimeProviders,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.providers });
			queryClient.invalidateQueries({ queryKey: QueryKeys.types(true) });
		},
	});
};

// Types ----------------------------------------------------------------------

export const useGenerationTypes = (
	includeInactive = true,
	options: QueryOptions = {}
): UseQueryResult<GenerationTypeDTO[], Error> => {
	return useQuery<GenerationTypeDTO[]>({
		...ugsAdminGenerationTypesQueryOptions(includeInactive),
		enabled: options.enabled ?? true,
	});
};

export const useCreateGenerationType = (
	includeInactive = true
): UseMutationResult<
	GenerationTypeDTO,
	Error,
	Partial<GenerationTypeDTO>,
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createGenerationType,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: QueryKeys.types(includeInactive),
			});
			queryClient.invalidateQueries({ queryKey: QueryKeys.providers });
		},
	});
};

export const useUpdateGenerationType = (
	includeInactive = true
): UseMutationResult<
	GenerationTypeDTO,
	Error,
	{ typeKey: string; payload: Partial<GenerationTypeDTO> },
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			typeKey,
			payload,
		}: {
			typeKey: string;
			payload: Partial<GenerationTypeDTO>;
		}) => updateGenerationType(typeKey, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: QueryKeys.types(includeInactive),
			});
			queryClient.invalidateQueries({ queryKey: QueryKeys.providers });
		},
	});
};

export const useDeleteGenerationType = (
	includeInactive = true
): UseMutationResult<void, Error, string, unknown> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteGenerationType,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: QueryKeys.types(includeInactive),
			});
		},
	});
};

// Workflows ------------------------------------------------------------------

export const useWorkflows = (
	includeInactive = false,
	options: QueryOptions = {}
): UseQueryResult<ComfyUIWorkflowDTO[], Error> => {
	return useQuery<ComfyUIWorkflowDTO[]>({
		...ugsAdminWorkflowsQueryOptions(includeInactive),
		enabled: options.enabled ?? true,
	});
};

export const useCreateWorkflow = (
	includeInactive = false
): UseMutationResult<
	ComfyUIWorkflowDTO,
	Error,
	Partial<ComfyUIWorkflowDTO>,
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createWorkflow,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: QueryKeys.workflows(includeInactive),
			});
		},
	});
};

export const useImportWorkflows = (
	includeInactive = false
): UseMutationResult<
	ComfyUIWorkflowImportResult,
	Error,
	boolean | undefined,
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (overwriteExisting = true) =>
			importWorkflowsFromDisk(overwriteExisting),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: QueryKeys.workflows(includeInactive),
			});
		},
	});
};

export const useUpdateWorkflow = (
	includeInactive = false
): UseMutationResult<
	ComfyUIWorkflowDTO,
	Error,
	{ slug: string; payload: Partial<ComfyUIWorkflowDTO> },
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			slug,
			payload,
		}: {
			slug: string;
			payload: Partial<ComfyUIWorkflowDTO>;
		}) => updateWorkflow(slug, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: QueryKeys.workflows(includeInactive),
			});
		},
	});
};

export const useDeleteWorkflow = (
	includeInactive = false
): UseMutationResult<void, Error, string, unknown> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteWorkflow,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: QueryKeys.workflows(includeInactive),
			});
		},
	});
};

// Settings -------------------------------------------------------------------

export const useUgsSettings = (
	params: SettingsParamsKey = {},
	options: QueryOptions = {}
): UseQueryResult<UGSSettingsListDTO, Error> => {
	return useQuery<UGSSettingsListDTO>({
		...ugsAdminSettingsQueryOptions(params),
		enabled: options.enabled ?? true,
	});
};

export const useCreateSetting = (
	params: SettingsParamsKey = {}
): UseMutationResult<UGSSettingDTO, Error, Partial<UGSSettingDTO>, unknown> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createSetting,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.settings(params) });
		},
	});
};

export const useUpdateSetting = (
	params: SettingsParamsKey = {}
): UseMutationResult<
	UGSSettingDTO,
	Error,
	{ id: string; payload: Partial<UGSSettingDTO> },
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			payload,
		}: {
			id: string;
			payload: Partial<UGSSettingDTO>;
		}) => updateSetting(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.settings(params) });
		},
	});
};

export const useDeleteSetting = (
	params: SettingsParamsKey = {}
): UseMutationResult<void, Error, string, unknown> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteSetting,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.settings(params) });
		},
	});
};

// Users ----------------------------------------------------------------------

export const useAdminUsers = (
	options: QueryOptions = {}
): UseQueryResult<AdminUserDTO[], Error> => {
	return useQuery<AdminUserDTO[]>({
		...ugsAdminUsersQueryOptions(),
		enabled: options.enabled ?? true,
	});
};

export const useAdminUser = (
	userId: string | null,
	options: QueryOptions = {}
): UseQueryResult<AdminUserDTO, Error> => {
	return useQuery<AdminUserDTO>({
		...ugsAdminUserQueryOptions(userId),
		enabled: (options.enabled ?? true) && Boolean(userId),
	});
};

export const useTopUpCredits = (): UseMutationResult<
	AdminUserDTO,
	Error,
	{ userId: string; amount: number; reason?: string },
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			userId,
			amount,
			reason,
		}: {
			userId: string;
			amount: number;
			reason?: string;
		}) => topUpUserCredits(userId, amount, reason),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.users });
		},
	});
};

export const useUpdateUserLimits = (): UseMutationResult<
	AdminUserDTO,
	Error,
	{ userId: string; payload: UserLimitsUpdatePayload },
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			userId,
			payload,
		}: {
			userId: string;
			payload: UserLimitsUpdatePayload;
		}) => updateUserLimits(userId, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.users });
		},
	});
};

export const usePatchUserTrusted = (): UseMutationResult<
	AdminUserDTO,
	Error,
	{ userId: string; isTrusted: boolean },
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			userId,
			isTrusted,
		}: {
			userId: string;
			isTrusted: boolean;
		}) => patchUserTrusted(userId, isTrusted),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.users });
		},
	});
};

export const usePatchUserAdminBadge = (): UseMutationResult<
	AdminUserDTO,
	Error,
	{ userId: string; label: string | null; hint: string | null },
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			userId,
			label,
			hint,
		}: {
			userId: string;
			label: string | null;
			hint: string | null;
		}) => patchUserAdminBadge(userId, { label, hint }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QueryKeys.users });
		},
	});
};
