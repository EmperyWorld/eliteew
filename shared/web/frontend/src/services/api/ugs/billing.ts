import { createAPIClient } from '../../api/client';
import { API_CONFIG } from '../../api/config';
import type { UGSBillingStats } from './types';
import { log } from '../../../utils/logger';

const ugsClient = createAPIClient({ baseURL: API_CONFIG.ugsBaseURL });

/** After first 404 we skip further requests to avoid console spam (e.g. proxy not routing /api/v1/ugs). */
let billingEndpointUnavailable = false;

export async function fetchUgsBillingStats(): Promise<UGSBillingStats | null> {
	if (billingEndpointUnavailable) return null;
	try {
		const { data } = await ugsClient.get<UGSBillingStats>('/billing/stats');
		return data;
	} catch (error: unknown) {
		if (error && typeof error === 'object' && 'response' in error) {
			const axiosError = error as { response?: { status?: number } };
			if (axiosError.response?.status === 404) {
				billingEndpointUnavailable = true;
				log.warn(
					'ugs/billing',
					'UGS billing stats endpoint not available (404), skipping further requests'
				);
				return null;
			}
		}
		throw error;
	}
}
