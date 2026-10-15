package world.empery.mobile.core.network.api

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

data class TextToImageRequest(
    val prompt: String,
    val width: Int = 1024,
    val height: Int = 1024,
    val seed: Int? = null,
)

data class ImageStudioImageDto(
    val data: String, // base64
    val filename: String,
)

data class ImageStudioResponse(
    val images: List<ImageStudioImageDto>,
    val history_saved: Boolean? = null,
)

interface ImageStudioApi {
    @POST("image-studio/text-to-image")
    suspend fun textToImage(@Body request: TextToImageRequest): ImageStudioResponse

    @Multipart
    @POST("image-studio/image-edit")
    suspend fun imageEdit(
        @Part("prompt") prompt: RequestBody,
        @Part image: MultipartBody.Part,
        @Part("negative_prompt") negativePrompt: RequestBody? = null,
        @Part("seed") seed: RequestBody? = null,
    ): ImageStudioResponse
}
