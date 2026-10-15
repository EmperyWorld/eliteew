/**
 * Formats FastAPI/axios validation errors for operator-facing alerts.
 */
export function formatAdminApiError(
	error: unknown,
	baseMessage: string
): string {
	const err = error as {
		response?: { data?: { detail?: unknown }; status?: number };
		message?: string;
	};
	const detail = err.response?.data?.detail;
	if (typeof detail === 'string' && detail.trim()) {
		return `${baseMessage}\n\n${detail}`;
	}
	if (Array.isArray(detail)) {
		const lines = detail
			.map((item) => {
				if (typeof item === 'string') return item;
				if (item && typeof item === 'object' && 'msg' in item) {
					const m = (item as { msg?: string }).msg;
					const loc = (item as { loc?: unknown[] }).loc;
					const path = Array.isArray(loc)
						? loc.filter((x) => typeof x === 'string' && x !== 'body').join('.')
						: '';
					if (m && path) return `${path}: ${m}`;
					return m ?? '';
				}
				return '';
			})
			.filter(Boolean);
		if (lines.length) {
			return `${baseMessage}\n\n${lines.join('\n')}`;
		}
	}
	if (err.response?.status === 422) {
		return `${baseMessage}\n\nПроверьте поля формы — сервер отклонил запрос (код 422).`;
	}
	if (err.message && typeof err.message === 'string') {
		return `${baseMessage}\n\n${err.message}`;
	}
	return baseMessage;
}
