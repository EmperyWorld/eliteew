import { describe, expect, it } from 'vitest';
import type { PersistedWindowState } from '../../types/desktop.types';
import { assessWindowsSnapshotRestore } from '../desktopWindowsSnapshot';

const base: PersistedWindowState = {
	type: 'app',
	title: 'App',
	path: [],
	position: { x: 0, y: 0 },
	size: { width: 400, height: 300 },
	isMinimized: false,
	isMaximized: false,
	zIndex: 1,
	appComponent: 'UGS',
};

describe('assessWindowsSnapshotRestore', () => {
	it('returns empty when no windows', () => {
		expect(assessWindowsSnapshotRestore({}, [])).toEqual({ status: 'empty' });
		expect(assessWindowsSnapshotRestore({ windows: [] }, [])).toEqual({
			status: 'empty',
		});
	});

	it('returns corrupt when most app windows lack appComponent', () => {
		const windows: PersistedWindowState[] = [
			{ ...base, appComponent: 'UGS' },
			{ ...base, appComponent: '' },
			{ ...base, appComponent: '   ' },
		];
		expect(assessWindowsSnapshotRestore({ windows }, [])).toEqual({
			status: 'corrupt',
		});
	});

	it('returns ok with filtered windows', () => {
		const windows: PersistedWindowState[] = [
			{ ...base, appComponent: 'UGS' },
			{ ...base, appComponent: 'VoiceStudio' },
		];
		const r = assessWindowsSnapshotRestore({ activeDesktopId: 'd1', windows }, [
			{ appComponent: 'UGS' },
		]);
		expect(r.status).toBe('ok');
		if (r.status === 'ok') {
			expect(r.activeDesktopId).toBe('d1');
			expect(r.windows).toHaveLength(1);
			expect(r.windows[0].appComponent).toBe('UGS');
			expect(r.requestedCount).toBe(2);
			expect(r.skippedCount).toBe(1);
		}
	});
});
