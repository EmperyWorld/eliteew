package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.ImageStudioApi
import world.empery.mobile.core.network.api.ImageStudioResponse

class ImageStudioApiContractsTest {
    private val gson = Gson()

    @Test
    fun imageStudioRoutesMatchBackend() {
        ApiContractPathAssertions.assertPost(ImageStudioApi::class, "textToImage", "image-studio/text-to-image")
        ApiContractPathAssertions.assertPost(ImageStudioApi::class, "imageEdit", "image-studio/image-edit")
    }

    @Test
    fun parsesImageStudioResponse() {
        val json = """{"images": [{"data": "base64data", "filename": "out.png"}], "history_saved": true}"""
        val resp = gson.fromJson(json, ImageStudioResponse::class.java)
        assertEquals(1, resp.images.size)
        assertEquals("out.png", resp.images.first().filename)
    }
}
