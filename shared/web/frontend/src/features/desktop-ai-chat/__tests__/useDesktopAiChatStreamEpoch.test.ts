import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDesktopAiChatStreamEpoch } from '../useDesktopAiChatStreamEpoch';

describe('useDesktopAiChatStreamEpoch', () => {
	it('streamStale tracks active chat and epoch', () => {
		const { result, rerender } = renderHook(
			({ id }: { id: string | null }) => useDesktopAiChatStreamEpoch(id),
			{ initialProps: { id: 'a' as string | null } }
		);
		const epoch0 = result.current.streamEpochRef.current;
		expect(result.current.streamStale('a', epoch0), 'same chat and epoch').toBe(
			false
		);
		expect(result.current.streamStale('b', epoch0), 'other chat').toBe(true);
		act(() => {
			result.current.streamEpochRef.current += 1;
		});
		expect(result.current.streamStale('a', epoch0), 'bumped epoch').toBe(true);
		rerender({ id: 'b' });
		const epoch1 = result.current.streamEpochRef.current;
		expect(result.current.streamStale('a', epoch1), 'switched chat').toBe(true);
		expect(result.current.streamStale('b', epoch1), 'new active').toBe(false);
	});
});
