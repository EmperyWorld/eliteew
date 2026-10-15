import { describe, expect, it } from 'vitest';
import { DEFAULT_APPS } from '@/pages/Desktop/constants';
import { KNOWN_DESKTOP_APP_COMPONENTS } from '@/pages/Desktop/utils/desktopAppRegistry';

describe('SurveyHub desktop registry', () => {
	it('registers SurveyHubApp in defaults and known components', () => {
		const app = DEFAULT_APPS.find(
			(item) => item.appComponent === 'SurveyHubApp'
		);
		expect(app?.id).toBe('app-survey-hub');
		expect(KNOWN_DESKTOP_APP_COMPONENTS.has('SurveyHubApp')).toBe(true);
	});
});
