/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared authenticated UGS HTTP client for Hub task actions (cancel, result fetch).
 *
 * Related:
 * - hooks/ugsHub/useUgsHubTaskActions.ts, components/UGSHub.tsx
 */

import { createAPIClient } from '../../services/api/client';
import { API_CONFIG } from '../../services/api/config';

export const ugsHubClient = createAPIClient({ baseURL: API_CONFIG.ugsBaseURL });
