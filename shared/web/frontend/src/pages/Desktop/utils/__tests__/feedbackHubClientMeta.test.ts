/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Feedback Hub client_meta builder.
 */

import { describe, expect, it } from 'vitest';
import { buildFeedbackClientMeta } from '../feedbackHubClientMeta';

describe('buildFeedbackClientMeta', () => {
	it('includes mode and optional version/ua', () => {
		expect(buildFeedbackClientMeta({ mode: 'production' })).toEqual({
			mode: 'production',
		});
		expect(
			buildFeedbackClientMeta({
				mode: 'development',
				viteAppVersion: '1.2.3',
				userAgent: 'test-agent',
			})
		).toEqual({
			mode: 'development',
			vite_app_version: '1.2.3',
			ua: 'test-agent',
		});
	});
});
