/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends ViewModel transition locks for session denial, cache fallback, and in-flight conflicts.
 *
 * Invariants:
 * - Tests control Dispatchers.Main and never rely on wall-clock scheduling.
 *
 * Related:
 * - presentation/FriendsTabViewModel.kt
 */
package feature.friends

import feature.friends.domain.model.FriendLiteItem
import feature.friends.domain.usecase.FriendsUseCases
import feature.friends.presentation.FriendsErrorReporter
import feature.friends.presentation.FriendsSessionAccess
import feature.friends.presentation.FriendsTabViewModel
import feature.friends.presentation.FriendsUiPreferences
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class FriendsTabViewModelTest {
    private val dispatcher: TestDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun sessionDeniedMutationsNeverReachUseCases() = runTest(dispatcher) {
        val repository = FakeFriendsRepository()
        val viewModel = createViewModel(repository, hasSession = false)
        val friend = FriendLiteItem("friend-1", "alice", "Alice", null)

        viewModel.sendFriendRequest("alice")
        viewModel.acceptFriendRequest("request-1")
        viewModel.toggleFavorite(friend)
        viewModel.createCircle("Close")
        advanceUntilIdle()

        assertTrue(repository.calls.isEmpty())
        assertEquals(null, viewModel.uiState.value.inFlightRequestId)
    }

    @Test
    fun secondMutationIsRejectedWhileFirstIsInFlight() = runTest(dispatcher) {
        val gate = CompletableDeferred<Unit>()
        val repository =
            FakeFriendsRepository().apply {
                mutationGate = { gate.await() }
            }
        val viewModel = createViewModel(repository, hasSession = true)

        viewModel.acceptFriendRequest("request-1")
        runCurrent()
        assertEquals("request-1", viewModel.uiState.value.inFlightRequestId)

        viewModel.rejectFriendRequest("request-2")
        runCurrent()
        assertFalse(repository.calls.any { it == "reject:request-2" })

        gate.complete(Unit)
        advanceUntilIdle()
        assertEquals(null, viewModel.uiState.value.inFlightRequestId)
        assertTrue(repository.calls.contains("accept:request-1"))
    }

    @Test
    fun refreshFailureHydratesCacheAndExposesError() = runTest(dispatcher) {
        val repository =
            FakeFriendsRepository().apply {
                refreshError = IllegalStateException("network down")
                cachedOverview =
                    emptyOverview.copy(
                        friends = listOf(FriendLiteItem("cached", "cached", "Cached", null)),
                    )
            }
        val errors = mutableListOf<String>()
        val viewModel = createViewModel(repository, hasSession = true, errors = errors)

        viewModel.refresh()
        advanceUntilIdle()

        assertEquals("cached", viewModel.uiState.value.friends.single().id)
        assertEquals("network down", viewModel.uiState.value.error)
        assertFalse(viewModel.uiState.value.isLoading)
        assertTrue(errors.any { it.contains("refreshFriends failed") })
    }

    @Test
    fun refreshPaintsCachedOverviewWhileNetworkPending() = runTest(dispatcher) {
        val gate = CompletableDeferred<Unit>()
        val repository =
            FakeFriendsRepository().apply {
                cachedOverview =
                    emptyOverview.copy(
                        friends = listOf(FriendLiteItem("cached", "cached", "Cached", null)),
                    )
                refreshedOverview =
                    emptyOverview.copy(
                        friends = listOf(FriendLiteItem("fresh", "fresh", "Fresh", null)),
                    )
                refreshGate = { gate.await() }
            }
        val viewModel = createViewModel(repository, hasSession = true)

        viewModel.refresh()
        runCurrent()

        assertEquals("cached", viewModel.uiState.value.friends.single().id)
        assertTrue(viewModel.uiState.value.isLoading)

        gate.complete(Unit)
        advanceUntilIdle()

        assertEquals("fresh", viewModel.uiState.value.friends.single().id)
        assertFalse(viewModel.uiState.value.isLoading)
    }

    @Test
    fun successfulRefreshPublishesOverviewAndSocialHubState() = runTest(dispatcher) {
        val repository =
            FakeFriendsRepository().apply {
                refreshedOverview =
                    emptyOverview.copy(
                        friends = listOf(FriendLiteItem("friend-1", "alice", "Alice", null)),
                    )
            }
        val preferences = FakeFriendsUiPreferences(expanded = false)
        val viewModel = createViewModel(repository, hasSession = true, preferences = preferences)

        viewModel.refresh()
        advanceUntilIdle()

        assertEquals("friend-1", viewModel.uiState.value.friends.single().id)
        assertEquals("friends", viewModel.uiState.value.privacyPreview?.discoverability)
        assertEquals("code", viewModel.uiState.value.referralInvite?.referral_code)
        assertFalse(viewModel.uiState.value.socialHubInboxExpanded)
        assertFalse(viewModel.uiState.value.isLoading)
    }

    @Test
    fun deepLinkConflictFocusesRequestWithoutOpeningFriendDetail() = runTest(dispatcher) {
        val repository =
            FakeFriendsRepository().apply {
                refreshedOverview =
                    emptyOverview.copy(
                        friends = listOf(FriendLiteItem("friend-1", "alice", "Alice", null)),
                    )
            }
        val viewModel = createViewModel(repository, hasSession = true)

        viewModel.handleDeepLink(
            friendRequestId = "request-1",
            friendUserId = "friend-1",
            focus = null,
        )
        advanceUntilIdle()

        assertEquals("request-1", viewModel.uiState.value.focusedRequestId)
        assertEquals(null, viewModel.uiState.value.focusedFriendUserId)
        assertEquals(null, viewModel.uiState.value.selectedFriendProfile)
    }

    private fun createViewModel(
        repository: FakeFriendsRepository,
        hasSession: Boolean,
        errors: MutableList<String> = mutableListOf(),
        preferences: FakeFriendsUiPreferences = FakeFriendsUiPreferences(),
    ): FriendsTabViewModel =
        FriendsTabViewModel(
            useCases = FriendsUseCases.create(repository),
            sessionAccess = FriendsSessionAccess { hasSession },
            errorReporter =
                FriendsErrorReporter { error, context ->
                    errors += "$context:${error.message}"
                },
            uiPreferences = preferences,
        )
}

private class FakeFriendsUiPreferences(
    private var expanded: Boolean = true,
) : FriendsUiPreferences {
    override fun isSocialHubInboxExpanded(): Boolean = expanded

    override fun setSocialHubInboxExpanded(expanded: Boolean) {
        this.expanded = expanded
    }
}
