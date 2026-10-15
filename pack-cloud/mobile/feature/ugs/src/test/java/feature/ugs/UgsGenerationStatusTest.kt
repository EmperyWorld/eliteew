package feature.ugs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UgsGenerationStatusTest {
    @Test
    fun parsesRunningAndReadyStatuses() {
        assertEquals(UgsGenerationStatus.RUNNING, parseUgsGenerationStatus("running"))
        assertEquals(UgsGenerationStatus.READY, parseUgsGenerationStatus("completed"))
    }

    @Test
    fun historyFiltersMatchTypeAndStatus() {
        assertTrue(
            matchesUgsHistoryFilters(
                type = UgsGenerationType.SONG,
                status = UgsGenerationStatus.READY,
                typeFilter = UgsGenerationType.SONG,
                statusFilter = UgsGenerationStatus.READY,
            ),
        )
    }
}
