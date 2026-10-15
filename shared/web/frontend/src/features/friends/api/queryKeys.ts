import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const friendsQueryKeys = {
	all: ['friends'] as const,
	overview: (): QueryKey => ['friends', 'overview'],
	list: (): QueryKey => ['friends', 'list'],
	circles: (): QueryKey => ['friends', 'circles'],
	incoming: (): QueryKey => ['friends', 'incoming'],
	sent: (): QueryKey => ['friends', 'sent'],
	search: (query: string): QueryKey => ['friends', 'search', query],
	profile: (friendId: string): QueryKey => ['friends', 'profile', friendId],
};

export async function invalidateFriendsQueries(
	queryClient: QueryClient
): Promise<void> {
	await queryClient.cancelQueries({ queryKey: friendsQueryKeys.all });
	queryClient.removeQueries({ queryKey: friendsQueryKeys.all });
	await queryClient.invalidateQueries({ queryKey: friendsQueryKeys.all });
}
