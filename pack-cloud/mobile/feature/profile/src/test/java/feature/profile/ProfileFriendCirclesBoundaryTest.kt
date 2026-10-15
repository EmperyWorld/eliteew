/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Integration lock for Profile circle loading through the core-network read boundary.
 *
 * Invariants:
 * - ProfileRepository has no FriendsRepository constructor dependency.
 *
 * Related:
 * - world.empery.mobile.core.network.FriendCirclesProvider
 * - ProfileRepository
 */
package feature.profile

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import java.lang.reflect.Proxy
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import world.empery.mobile.core.network.FriendCirclesProvider
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.ProfileApi
import world.empery.mobile.core.storage.MobileDatabase

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ProfileFriendCirclesBoundaryTest {
    @Test
    fun loadPrivacyCirclesUsesCoreBoundaryWithoutFriendsRepositoryType() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val database =
            Room.inMemoryDatabaseBuilder(context, MobileDatabase::class.java)
                .allowMainThreadQueries()
                .build()
        try {
            var providerCalls = 0
            val provider =
                FriendCirclesProvider {
                    providerCalls += 1
                    listOf(FriendCircleItemDto("circle-1", "Close"))
                }
            val api =
                Proxy.newProxyInstance(
                    ProfileApi::class.java.classLoader,
                    arrayOf(ProfileApi::class.java),
                ) { _, method, _ ->
                    error("Unexpected ProfileApi call: ${method.name}")
                } as ProfileApi
            val repository =
                ProfileRepository(
                    api = api,
                    db = database,
                    appContext = context,
                    friendCirclesProvider = provider,
                )

            val circles = repository.loadPrivacyCircles()

            assertEquals("circle-1", circles.single().id)
            assertEquals(1, providerCalls)
            assertFalse(
                ProfileRepository::class.java.declaredConstructors
                    .flatMap { it.parameterTypes.asList() }
                    .any { it.name.contains("FriendsRepository") },
            )
        } finally {
            database.close()
        }
    }
}
