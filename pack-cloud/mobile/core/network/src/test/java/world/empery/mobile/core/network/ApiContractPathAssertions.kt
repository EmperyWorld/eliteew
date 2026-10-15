package world.empery.mobile.core.network

import org.junit.Assert.assertEquals
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import kotlin.reflect.KClass

/** Shared Retrofit path assertions for Android API contract JVM tests. */
object ApiContractPathAssertions {
    fun getPath(api: KClass<*>, methodName: String): String =
        path(api, methodName, GET::class.java) { it.value }

    fun postPath(api: KClass<*>, methodName: String): String =
        path(api, methodName, POST::class.java) { it.value }

    fun patchPath(api: KClass<*>, methodName: String): String =
        path(api, methodName, PATCH::class.java) { it.value }

    fun putPath(api: KClass<*>, methodName: String): String =
        path(api, methodName, PUT::class.java) { it.value }

    fun deletePath(api: KClass<*>, methodName: String): String =
        path(api, methodName, DELETE::class.java) { it.value }

    private inline fun <reified A : Annotation> path(
        api: KClass<*>,
        methodName: String,
        annotationClass: Class<A>,
        valueOf: (A) -> String,
    ): String {
        val method = api.java.declaredMethods.single { it.name == methodName }
        @Suppress("UNCHECKED_CAST")
        val ann = requireNotNull(method.getAnnotation(annotationClass)) as A
        return valueOf(ann)
    }

    fun assertGet(api: KClass<*>, methodName: String, expected: String) {
        assertEquals(expected, getPath(api, methodName))
    }

    fun assertPost(api: KClass<*>, methodName: String, expected: String) {
        assertEquals(expected, postPath(api, methodName))
    }

    fun assertPatch(api: KClass<*>, methodName: String, expected: String) {
        assertEquals(expected, patchPath(api, methodName))
    }

    fun assertPut(api: KClass<*>, methodName: String, expected: String) {
        assertEquals(expected, putPath(api, methodName))
    }
}
