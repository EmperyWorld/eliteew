package feature.ugs

import android.content.Context
import android.content.Intent
import android.widget.Toast
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import coil.compose.AsyncImage
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.outlined.ImageSearch
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.network.api.TextToImageRequest
import world.empery.mobile.core.network.api.UnifiedContentDto
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumDividerGlow
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumSectionCard
import androidx.compose.material.icons.outlined.Refresh
import world.empery.mobile.core.ui.PremiumStateCard
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import world.empery.mobile.core.ui.ScaledButton
import world.empery.mobile.core.ui.LocalMobilePermissionRequester
import world.empery.mobile.core.ui.ScaledOutlinedButton
import java.io.File
import java.io.FileOutputStream

private fun getFileName(context: Context, uri: Uri): String {
    var result: String? = null
    if (uri.scheme == "content") {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0) result = cursor.getString(idx)
            }
        }
    }
    if (result == null) {
        result = uri.path
        val cut = result?.lastIndexOf('/')
        if (cut != null && cut != -1) {
            result = result?.substring(cut + 1)
        }
    }
    return result ?: "image.png"
}

private fun copyUriToFile(context: Context, uri: Uri): File {
    val inputStream = context.contentResolver.openInputStream(uri) ?: throw IllegalStateException("Cannot open uri")
    val file = File(context.cacheDir, "upload_${System.currentTimeMillis()}.png")
    FileOutputStream(file).use { output ->
        inputStream.copyTo(output)
    }
    return file
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UgsImagesScreen(
    repository: UgsHubRepository,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val permissionRequester = LocalMobilePermissionRequester.current

    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val tabNew = stringResource(R.string.ugs_images_tab_new)
    val tabEdit = stringResource(R.string.ugs_images_tab_edit)
    val tabs = listOf(tabNew, tabEdit)

    var prompt by remember { mutableStateOf("") }
    var negativePrompt by remember { mutableStateOf("") }

    var selectedRatioIndex by remember { mutableIntStateOf(0) }
    val ratioSquare = stringResource(R.string.ugs_images_ratio_square)
    val ratioLandscape = stringResource(R.string.ugs_images_ratio_landscape)
    val ratioPortrait = stringResource(R.string.ugs_images_ratio_portrait)
    val ratios = listOf(ratioSquare, ratioLandscape, ratioPortrait)

    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }
    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        selectedImageUri = uri
    }

    var isSubmitting by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }

    var generatedPreviewFile by remember { mutableStateOf<java.io.File?>(null) }

    fun clearGeneratedPreviewFile() {
        generatedPreviewFile?.let { old -> runCatching { if (old.exists()) old.delete() } }
        generatedPreviewFile = null
    }
    var isDownloading by remember { mutableStateOf(false) }

    var images by remember { mutableStateOf<List<UnifiedContentDto>>(emptyList()) }
    var isImagesLoading by remember { mutableStateOf(true) }
    var imagesError by remember { mutableStateOf<String?>(null) }
    var downloadingImageId by remember { mutableStateOf<String?>(null) }
    var deletingImageId by remember { mutableStateOf<String?>(null) }

    fun loadImages() {
        scope.launch {
            isImagesLoading = true
            imagesError = null
            try {
                val resp = repository.contentApi.listContent(sourceService = "image_studio", limit = 10)
                images = resp.items
            } catch (e: Exception) {
                imagesError = e.message ?: context.getString(R.string.ugs_images_load_error)
            } finally {
                isImagesLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadImages()
    }

    DisposableEffect(Unit) {
        onDispose { clearGeneratedPreviewFile() }
    }

    fun handleGenerate() {
        scope.launch {
            isSubmitting = true
            submitError = null
            clearGeneratedPreviewFile()

            try {
                if (selectedTabIndex == 0) {
                    val (w, h) =
                        when (selectedRatioIndex) {
                            1 -> 1280 to 768
                            2 -> 768 to 1280
                            else -> 1024 to 1024
                        }
                    val req = TextToImageRequest(prompt = prompt.trim(), width = w, height = h)
                    val resp = repository.imageStudioApi.textToImage(req)
                    val b64 =
                        resp.images.firstOrNull()?.data
                            ?: throw IllegalStateException(context.getString(R.string.ugs_images_error_empty_server))
                    val bytes = Base64.decode(b64, Base64.DEFAULT)
                    clearGeneratedPreviewFile()
                    val preview = java.io.File(context.cacheDir, "ugs_preview_${System.currentTimeMillis()}.png")
                    preview.writeBytes(bytes)
                    generatedPreviewFile = preview
                    loadImages()
                } else {
                    val uri = selectedImageUri
                        ?: throw IllegalStateException(context.getString(R.string.ugs_images_error_pick_image))
                    val file = copyUriToFile(context, uri)
                    val reqFile = file.asRequestBody("image/*".toMediaTypeOrNull())
                    val body = MultipartBody.Part.createFormData("image", file.name, reqFile)
                    val promptBody = prompt.trim().toRequestBody("text/plain".toMediaTypeOrNull())
                    val negBody =
                        negativePrompt.trim().takeIf { it.isNotBlank() }?.toRequestBody("text/plain".toMediaTypeOrNull())

                    val resp =
                        repository.imageStudioApi.imageEdit(
                            prompt = promptBody,
                            image = body,
                            negativePrompt = negBody,
                        )
                    val b64 =
                        resp.images.firstOrNull()?.data
                            ?: throw IllegalStateException(context.getString(R.string.ugs_images_error_empty_server))
                    val bytes = Base64.decode(b64, Base64.DEFAULT)
                    clearGeneratedPreviewFile()
                    val preview = java.io.File(context.cacheDir, "ugs_preview_${System.currentTimeMillis()}.png")
                    preview.writeBytes(bytes)
                    generatedPreviewFile = preview
                    loadImages()
                }
            } catch (e: Exception) {
                submitError = e.message ?: context.getString(R.string.ugs_images_error_generation)
            } finally {
                isSubmitting = false
            }
        }
    }

    val fieldShape = RoundedCornerShape(18.dp)
    val fieldColors =
        OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
        )

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            UgsAiSubScreenTopBar(
                title = stringResource(R.string.ugs_images_screen_title),
                subtitle = stringResource(R.string.ugs_images_top_subtitle),
                onBack = onBack,
                isRefreshing = isImagesLoading,
                onRefresh = { loadImages() },
                refreshContentDescription = stringResource(R.string.ugs_images_refresh),
            )
        },
    ) { padding ->
        LazyColumn(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { Spacer(modifier = Modifier.height(8.dp)) }
            item {
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    tabs.forEachIndexed { index, label ->
                        SegmentedButton(
                            selected = selectedTabIndex == index,
                            onClick = { selectedTabIndex = index },
                            shape = SegmentedButtonDefaults.itemShape(index = index, count = tabs.size),
                        ) {
                            Text(label, style = MaterialTheme.typography.labelLarge)
                        }
                    }
                }
            }

            item {
                PremiumSectionCard(
                    title =
                        if (selectedTabIndex == 0) {
                            stringResource(R.string.ugs_images_prompt_new_label)
                        } else {
                            stringResource(R.string.ugs_images_prompt_edit_label)
                        },
                    subtitle = stringResource(R.string.ugs_images_prompt_placeholder),
                    icon = Icons.Outlined.ImageSearch,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                        if (selectedTabIndex == 1) {
                            if (selectedImageUri == null) {
                                ScaledOutlinedButton(
                                    onClick = { imagePicker.launch("image/*") },
                                    enabled = true,
                                    label = stringResource(R.string.ugs_images_pick_source),
                                    icon = Icons.Filled.Image,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            } else {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        text =
                                            context.getString(
                                                R.string.ugs_images_selected_file,
                                                getFileName(context, selectedImageUri!!),
                                            ),
                                        style = MaterialTheme.typography.bodyMedium,
                                        modifier = Modifier.weight(1f),
                                    )
                                    IconButton(onClick = { selectedImageUri = null }) {
                                        Icon(
                                            Icons.Filled.Close,
                                            contentDescription = stringResource(R.string.ugs_images_cd_remove_file),
                                        )
                                    }
                                }
                            }
                        }

                        OutlinedTextField(
                            value = prompt,
                            onValueChange = { prompt = it },
                            label = {
                                Text(
                                    if (selectedTabIndex == 0) {
                                        stringResource(R.string.ugs_images_prompt_new_label)
                                    } else {
                                        stringResource(R.string.ugs_images_prompt_edit_label)
                                    },
                                )
                            },
                            placeholder = { Text(stringResource(R.string.ugs_images_prompt_placeholder)) },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 3,
                            maxLines = 5,
                            shape = fieldShape,
                            colors = fieldColors,
                        )

                        if (selectedTabIndex == 1) {
                            OutlinedTextField(
                                value = negativePrompt,
                                onValueChange = { negativePrompt = it },
                                label = { Text(stringResource(R.string.ugs_images_negative_label)) },
                                placeholder = { Text(stringResource(R.string.ugs_images_negative_placeholder)) },
                                modifier = Modifier.fillMaxWidth(),
                                minLines = 1,
                                maxLines = 3,
                                shape = fieldShape,
                                colors = fieldColors,
                            )
                        }

                        if (selectedTabIndex == 0) {
                            Text(
                                "${stringResource(R.string.ugs_images_ratio_label)}:",
                                style = MaterialTheme.typography.labelMedium,
                            )
                            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                                ratios.forEachIndexed { index, label ->
                                    SegmentedButton(
                                        selected = selectedRatioIndex == index,
                                        onClick = { selectedRatioIndex = index },
                                        shape =
                                            SegmentedButtonDefaults.itemShape(
                                                index = index,
                                                count = ratios.size,
                                            ),
                                    ) {
                                        Text(label, style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }

                        if (submitError != null) {
                            Text(
                                text = submitError!!,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }

                        Button(
                            onClick = { handleGenerate() },
                            enabled =
                                !isSubmitting && prompt.isNotBlank() &&
                                    (selectedTabIndex == 0 || selectedImageUri != null),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp).padding(end = 8.dp),
                                    strokeWidth = 2.dp,
                                )
                            }
                            Text(
                                if (isSubmitting) {
                                    stringResource(R.string.ugs_images_generating)
                                } else {
                                    stringResource(R.string.ugs_images_generate)
                                },
                            )
                        }
                    }
            }

            val previewFile = generatedPreviewFile
            if (previewFile != null && previewFile.exists()) {
                item {
                    PremiumGlassCard(
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            modifier = Modifier.padding(18.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                text = stringResource(R.string.ugs_images_result_title),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.align(Alignment.Start),
                            )

                            AsyncImage(
                                model = previewFile,
                                contentDescription = stringResource(R.string.ugs_images_cd_generated),
                                modifier = Modifier.fillMaxWidth(),
                                contentScale = ContentScale.FillWidth,
                            )

                            Button(
                                onClick = {
                                    scope.launch {
                                        isDownloading = true
                                        try {
                                            val fileName = "image_${System.currentTimeMillis()}.png"
                                            val uri = repository.saveImageFileToDownloads(context, previewFile, fileName)
                                            val intent =
                                                Intent(Intent.ACTION_VIEW).apply {
                                                    setDataAndType(uri, "image/png")
                                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                                }
                                            context.startActivity(intent)
                                        } catch (_: Exception) {
                                            // optional: snackbar
                                        } finally {
                                            isDownloading = false
                                        }
                                    }
                                },
                                enabled = !isDownloading,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                            ) {
                                if (isDownloading) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp).padding(end = 8.dp),
                                        strokeWidth = 2.dp,
                                    )
                                }
                                Text(stringResource(R.string.ugs_images_download_open))
                            }
                        }
                    }
                }
            }

            item {
                PremiumDividerGlow(modifier = Modifier.padding(top = 4.dp, bottom = 2.dp))
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(R.string.ugs_images_section_history),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (images.isNotEmpty()) {
                        PremiumBadge(text = images.size.toString())
                    }
                }
            }

            if (isImagesLoading && images.isEmpty()) {
                item {
                    PremiumLoadingCard(
                        message = stringResource(R.string.ugs_images_loading),
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 24.dp),
                    )
                }
            } else if (imagesError != null && images.isEmpty()) {
                item {
                    PremiumStateCard(
                        modifier = Modifier.fillMaxWidth(),
                        title = stringResource(R.string.ugs_images_screen_title),
                        message = imagesError.orEmpty(),
                        icon = Icons.Outlined.ImageSearch,
                        isError = true,
                        action = {
                            Button(
                                onClick = { loadImages() },
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Text(stringResource(R.string.ugs_images_error_retry))
                            }
                        },
                    )
                }
            } else if (images.isEmpty()) {
                item {
                    PremiumStateCard(
                        modifier = Modifier.fillMaxWidth(),
                        title = stringResource(R.string.ugs_images_empty_title),
                        message = stringResource(R.string.ugs_images_empty_hint),
                        icon = Icons.Outlined.ImageSearch,
                    )
                }
            } else {
                items(images, key = { it.id }) { img ->
                    PremiumGlassCard(
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(
                                text =
                                    img.name.ifBlank {
                                        stringResource(R.string.ugs_images_untitled)
                                    },
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )

                            val imageUrl = EmperyMediaPlayerHolder.contentDownloadUrl(img.id)
                            coil.compose.AsyncImage(
                                model =
                                    coil.request.ImageRequest.Builder(context)
                                        .data(imageUrl)
                                        .crossfade(true)
                                        .build(),
                                contentDescription = stringResource(R.string.ugs_images_cd_generated),
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .heightIn(max = 300.dp)
                                        .clip(RoundedCornerShape(12.dp)),
                                contentScale = ContentScale.Crop,
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                ScaledButton(
                                    onClick = {
                                        scope.launch {
                                            if (!requestStoragePermissionsIfNeeded(context, permissionRequester)) {
                                                Toast.makeText(
                                                    context,
                                                    context.getString(R.string.ugs_download_permissions_needed),
                                                    Toast.LENGTH_LONG,
                                                ).show()
                                                return@launch
                                            }
                                            downloadingImageId = img.id
                                            try {
                                                val fileName =
                                                    "${img.name.ifBlank { "image" }}_${img.id.take(8)}.png"
                                                val uri =
                                                    repository.downloadContentToDownloads(
                                                        context,
                                                        img.id,
                                                        fileName,
                                                        "image/png",
                                                    )
                                                val intent =
                                                    Intent(Intent.ACTION_VIEW).apply {
                                                        setDataAndType(uri, "image/*")
                                                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                                    }
                                                context.startActivity(intent)
                                            } catch (e: Exception) {
                                                Toast.makeText(
                                                    context,
                                                    e.message ?: context.getString(R.string.ugs_download_open_file_error),
                                                    Toast.LENGTH_SHORT,
                                                ).show()
                                            } finally {
                                                downloadingImageId = null
                                            }
                                        }
                                    },
                                    enabled = downloadingImageId != img.id,
                                    label = stringResource(R.string.ugs_images_download),
                                    icon = Icons.Outlined.Download,
                                    loading = downloadingImageId == img.id,
                                    modifier = Modifier.weight(1f),
                                )
                                ScaledOutlinedButton(
                                    onClick = {
                                        scope.launch {
                                            deletingImageId = img.id
                                            try {
                                                repository.contentApi.deleteContent(img.id)
                                                loadImages()
                                            } catch (_: Exception) {
                                                // no-op
                                            } finally {
                                                deletingImageId = null
                                            }
                                        }
                                    },
                                    enabled = deletingImageId != img.id,
                                    label = stringResource(R.string.ugs_images_delete),
                                    icon = Icons.Outlined.Delete,
                                    loading = deletingImageId == img.id,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

