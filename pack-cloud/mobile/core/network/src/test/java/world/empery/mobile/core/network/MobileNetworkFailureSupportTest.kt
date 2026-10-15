package world.empery.mobile.core.network

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.InterruptedIOException
import java.net.SocketException
import java.net.UnknownHostException

class MobileNetworkFailureSupportTest {
    @Test
    fun detectsInterruptedIoTimeout() {
        assertTrue(
            MobileNetworkFailureSupport.isTransientNetworkFailure(
                InterruptedIOException("timeout"),
            ),
        )
    }

    @Test
    fun detectsSocketClosedCause() {
        val err =
            InterruptedIOException("timeout").apply {
                initCause(SocketException("Socket closed"))
            }
        assertTrue(MobileNetworkFailureSupport.isTransientNetworkFailure(err))
    }

    @Test
    fun detectsUnknownHostAsTransient() {
        assertTrue(
            MobileNetworkFailureSupport.isTransientNetworkFailure(
                UnknownHostException("Unable to resolve host \"app.eliteew.ru\""),
            ),
        )
    }
}
