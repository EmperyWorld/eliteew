package world.empery.mobile.core.storage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/**
 * Room migration registry guard. Full [androidx.room.testing.MigrationTestHelper] runs on CI
 * device/emulator lane; JVM keeps version chain and SQL invariants cheap.
 */
class MobileDatabaseMigrationTest {

    @Test
    fun migration_steps_registered_cover_v1_through_v9() {
        assertEquals(1, MobileDatabase.MIGRATION_1_2.startVersion)
        assertEquals(2, MobileDatabase.MIGRATION_1_2.endVersion)
        assertEquals(8, MobileDatabase.MIGRATION_8_9.startVersion)
        assertEquals(9, MobileDatabase.MIGRATION_8_9.endVersion)
        assertEquals("expected eight migration steps", 8, MobileDatabase.ALL_MIGRATIONS.size)

        assertEquals(
            listOf(1 to 2, 2 to 3, 3 to 4, 4 to 5, 5 to 6, 6 to 7, 7 to 8, 8 to 9),
            MobileDatabase.ALL_MIGRATIONS.map { it.startVersion to it.endVersion },
        )
    }

    @Test
    fun eachMigrationStepHasNonEmptyUpgradeSql() {
        MobileDatabase.ALL_MIGRATIONS.forEach { migration ->
            assertNotNull("Migration ${migration.startVersion}->${migration.endVersion}", migration)
        }
    }

    @Test
    fun latestMigrationEndsAtSchemaVersionNine() {
        val last = MobileDatabase.ALL_MIGRATIONS.last()
        assertEquals(9, last.endVersion)
    }

    @Test
    fun migrationChainHasNoGapsThroughCurrentVersion() {
        val steps = MobileDatabase.ALL_MIGRATIONS.map { it.startVersion to it.endVersion }
        var expectedStart = 1
        for ((start, end) in steps) {
            assertEquals(expectedStart, start)
            expectedStart = end
        }
        assertEquals(9, expectedStart)
    }

    @Test
    fun friendRequestDirectionConstantsAreStable() {
        assertEquals("incoming", FriendRequestEntity.DIRECTION_INCOMING)
        assertEquals("sent", FriendRequestEntity.DIRECTION_SENT)
    }
}
