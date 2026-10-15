package world.empery.mobile.observability

import org.junit.Assert.assertEquals
import org.junit.Test

class MobileTelemetrySchemaTest {
    @Test
    fun schemaOpenScreenConstant() {
        assertEquals("open_screen", MobileTelemetryEventSchema.OPEN_SCREEN)
    }

    @Test
    fun friendReportEventName() {
        assertEquals("friend_report", MobileTelemetryEventSchema.FRIEND_REPORT)
    }
}
