package world.empery.mobile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SsoExchangeAcceptanceTest {
    @Test
    fun acceptsOnlySuccessfulExchangeWithPersistedSession() {
        assertTrue(shouldAcceptSsoExchange(exchangeSucceeded = true, hasSession = true))
        assertFalse(shouldAcceptSsoExchange(exchangeSucceeded = false, hasSession = true))
        assertFalse(shouldAcceptSsoExchange(exchangeSucceeded = true, hasSession = false))
    }
}
