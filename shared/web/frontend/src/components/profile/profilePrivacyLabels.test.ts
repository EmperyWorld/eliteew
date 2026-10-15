import { describe, expect, it } from 'vitest';

import {
	PROFILE_FIELD_VISIBILITY_LABELS,
	profileFieldVisibilityLabel,
} from './profilePrivacyLabels';

describe('profileFieldVisibilityLabel', () => {
	it('maps known visibility keys', () => {
		expect(profileFieldVisibilityLabel('everyone')).toBe('Все');
		expect(profileFieldVisibilityLabel('friends_only')).toBe('Только друзья');
		expect(profileFieldVisibilityLabel('none')).toBe('Никто');
		expect(profileFieldVisibilityLabel('circle')).toBe('Только круг');
	});

	it('has four entries aligned with API', () => {
		expect(Object.keys(PROFILE_FIELD_VISIBILITY_LABELS).sort()).toEqual(
			['circle', 'everyone', 'friends_only', 'none'].sort()
		);
	});
});
