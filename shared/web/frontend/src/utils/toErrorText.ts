import { normalizeApiError } from '@/services/api';

/** Сообщение для toast / UI из произвольной ошибки API/сети */
export function toErrorText(error: unknown): string {
	const n = normalizeApiError(error);
	return typeof n === 'string' ? n : n.message;
}
