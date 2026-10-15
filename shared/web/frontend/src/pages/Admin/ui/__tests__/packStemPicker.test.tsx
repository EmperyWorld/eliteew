/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Wave 1 PackStemPicker selection lock.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ADMIN_UI_ROOT_CLASS } from '../adminTokens';
import { PackStemPicker } from '../atoms/PackStemPicker';

describe('PackStemPicker', () => {
	it('toggles option and adds custom stem', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();

		const { rerender } = render(
			<div className={ADMIN_UI_ROOT_CLASS}>
				<PackStemPicker
					options={['notifications', 'music_forge']}
					value={[]}
					onChange={onChange}
				/>
			</div>
		);

		await user.click(screen.getByLabelText('notifications'));
		expect(onChange).toHaveBeenCalledWith(['notifications']);

		rerender(
			<div className={ADMIN_UI_ROOT_CLASS}>
				<PackStemPicker
					options={['notifications', 'music_forge']}
					value={['notifications']}
					onChange={onChange}
				/>
			</div>
		);

		await user.type(
			screen.getByLabelText('Custom stem', { selector: 'input' }),
			'custom_pack'
		);
		await user.click(screen.getByRole('button', { name: 'Add' }));
		expect(onChange).toHaveBeenCalledWith(['notifications', 'custom_pack']);
	});
});
