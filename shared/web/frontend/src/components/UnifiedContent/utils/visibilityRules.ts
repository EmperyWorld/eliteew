/**
 * Visibility rules and validation logic
 */

export interface VisibilityOption {
	value: string;
	label: string;
	disabled?: boolean;
	hint?: string;
}

/**
 * Get available visibility options based on company/project classification
 */
export const getAvailableVisibilityOptions = (
	hasCompany: boolean,
	hasProject: boolean
): VisibilityOption[] => {
	const options: VisibilityOption[] = [
		{ value: 'private', label: 'Приватный', hint: 'Только у вас' },
	];

	// Общий (shared) - только если НЕТ компании и проекта
	if (!hasCompany && !hasProject) {
		options.push({
			value: 'shared',
			label: 'Общий',
			hint: 'Виден по явной шарингу',
		});
	} else {
		options.push({
			value: 'shared',
			label: 'Общий',
			disabled: true,
			hint: 'Доступно только для файлов без компании/проекта',
		});
	}

	// Друзья — видно только друзьям (добавленным в разделе «Друзья»)
	options.push({
		value: 'friends',
		label: 'Друзья',
		hint: 'Видно только вашим друзьям',
	});

	return options;
};

/**
 * Validate visibility change
 */
export const validateVisibilityChange = (
	visibility: string,
	hasCompany: boolean,
	hasProject: boolean
): { valid: boolean; error?: string } => {
	// Validate: shared requires no company/project
	if (visibility === 'shared' && (hasCompany || hasProject)) {
		return {
			valid: false,
			error: 'Общий доступ доступен только для файлов без компании/проекта',
		};
	}

	return { valid: true };
};
