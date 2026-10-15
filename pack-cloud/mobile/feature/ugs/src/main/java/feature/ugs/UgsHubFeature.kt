/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS AI hub: tool list, compact overview metrics, stable nested routes.
 *
 * Invariants:
 * - Keep UGS navigation routes stable, especially the nested Desktop Hub entry.
 * - User-visible strings use `feature.ugs` string resources.
 *
 * Related:
 * - UgsHubRepository, UgsAiChatListScreen, DesktopHubFeature, UgsHubLayoutPolicy.kt
 */
package feature.ugs

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Slideshow
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import world.empery.mobile.core.network.api.BillingStatsResponse
import world.empery.mobile.core.network.api.DesktopAiChatApi
import world.empery.mobile.core.network.api.EwrpApi
import world.empery.mobile.core.network.api.ImageStudioApi
import world.empery.mobile.core.network.api.MusicApi
import world.empery.mobile.core.network.api.MusicForgeApi
import world.empery.mobile.core.network.api.UgsApi
import world.empery.mobile.core.network.api.UgsStatsResponse
import world.empery.mobile.core.network.api.UnifiedContentApi
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileErrorState
import world.empery.mobile.core.ui.MobileWindowWidthClass
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumMetricPill
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.MobileDownloadStorage

data class UgsHubUiState(
    val stats: UgsStatsResponse? = null,
    val billingStats: BillingStatsResponse? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

class UgsHubRepository(
    private val api: UgsApi,
    val ewrpApi: EwrpApi,
    val imageStudioApi: ImageStudioApi,
    val musicApi: MusicApi,
    val musicForgeApi: MusicForgeApi,
    val contentApi: UnifiedContentApi,
    val desktopAiChatApi: DesktopAiChatApi,
) {
    suspend fun refreshSnapshot(): UgsHubUiState {
        val stats = api.getStats()
        val billingStats =
            try {
                api.getBillingStats()
            } catch (_: Exception) {
                null
            }
        return UgsHubUiState(
            stats = stats,
            billingStats = billingStats,
            isLoading = false,
            error = null,
        )
    }

    suspend fun downloadPdfToDownloads(context: Context, url: String, fileName: String): android.net.Uri {
        return withContext(Dispatchers.IO) {
            val response = ewrpApi.downloadPdf(url)
            saveStreamToDownloads(context, response.byteStream(), fileName, "application/pdf")
        }
    }

    suspend fun downloadSongToDownloads(context: Context, contentId: String, fileName: String): android.net.Uri {
        return withContext(Dispatchers.IO) {
            val response = contentApi.downloadContent(contentId)
            saveStreamToDownloads(context, response.byteStream(), fileName, "audio/mpeg")
        }
    }


    suspend fun saveImageFileToDownloads(context: Context, sourceFile: java.io.File, fileName: String): android.net.Uri {
        return withContext(Dispatchers.IO) {
            sourceFile.inputStream().use { input ->
                saveStreamToDownloads(context, input, fileName, "image/png")
            }
        }
    }

    suspend fun saveImageToDownloads(context: Context, base64Data: String, fileName: String): android.net.Uri {
        return withContext(Dispatchers.IO) {
            val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
            saveStreamToDownloads(context, java.io.ByteArrayInputStream(bytes), fileName, "image/png")
        }
    }

    private fun saveStreamToDownloads(
        context: Context,
        input: java.io.InputStream,
        fileName: String,
        mimeType: String,
    ): android.net.Uri {
        val errors =
            MobileDownloadStorage.ErrorMessages(
                createFailed = context.getString(R.string.ugs_download_create_file_error),
                openFailed = context.getString(R.string.ugs_download_open_file_error),
                writeFailed = context.getString(R.string.ugs_download_open_file_error),
                accessDenied = context.getString(R.string.ugs_download_access_error),
                folderUnavailable = context.getString(R.string.ugs_download_access_error),
            )
        return MobileDownloadStorage.saveStreamToDownloads(
            context = context,
            input = input,
            fileName = fileName,
            mimeType = mimeType,
            errors = errors,
        )
    }

    suspend fun downloadContentToDownloads(
        context: Context,
        contentId: String,
        fileName: String,
        mimeType: String,
    ): android.net.Uri {
        return withContext(Dispatchers.IO) {
            val response = contentApi.downloadContent(contentId)
            saveStreamToDownloads(context, response.byteStream(), fileName, mimeType)
        }
    }

    /** First chunk of file bytes for in-app text preview (UTF-8, best effort). */
    suspend fun fetchContentTextPreview(
        contentId: String,
        maxBytes: Int = 48_000,
    ): String? =
        withContext(Dispatchers.IO) {
            runCatching {
                val response = contentApi.downloadContent(contentId)
                response.byteStream().use { stream ->
                    val buffer = ByteArray(maxBytes.coerceAtLeast(512))
                    val read = stream.read(buffer)
                    if (read <= 0) return@withContext null
                    String(buffer, 0, read, Charsets.UTF_8)
                        .replace('\u0000', ' ')
                        .trim()
                        .takeIf { it.isNotBlank() }
                }
            }.getOrNull()
        }

    suspend fun uploadContentFromUri(
        context: Context,
        uri: android.net.Uri,
    ): world.empery.mobile.core.network.api.UnifiedContentUploadResponseDto =
        contentApi.uploadFromDeviceUri(context, uri)
}

@Composable
private fun UgsSectionCard(
    title: String,
    subtitle: String?,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    PremiumSectionCard(
        title = title,
        subtitle = subtitle,
        icon = icon,
        modifier = modifier.fillMaxWidth(),
    ) {
        content()
    }
}

@Composable
private fun UgsMetricLine(
    label: String,
    value: String,
    icon: ImageVector? = null,
    modifier: Modifier = Modifier,
) {
    PremiumMetricPill(
        label = label,
        value = value,
        icon = icon,
        modifier =
            modifier
                .fillMaxWidth()
                .semantics(mergeDescendants = true) {
                    contentDescription = "$label: $value"
                },
    )
}

/** Billing API returns credits as JSON number (often non-integer Double). */
internal fun formatUgsEnergyCredits(credits: Double): String =
    if (credits % 1.0 == 0.0) {
        credits.toLong().toString()
    } else {
        credits.toBigDecimal().stripTrailingZeros().toPlainString()
    }

@Composable
private fun UgsHubOverviewCard(
    billing: BillingStatsResponse?,
    stats: UgsStatsResponse?,
) {
    if (billing == null && stats == null) return
    UgsSectionCard(
        title = stringResource(R.string.ugs_overview_section_title),
        subtitle = stringResource(R.string.ugs_overview_section_hint),
        icon = Icons.Outlined.BarChart,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (billing != null) {
                    UgsMetricLine(
                        label = stringResource(R.string.ugs_energy_available),
                        value = "${formatUgsEnergyCredits(billing.available_credits)} ⚡",
                        icon = Icons.Outlined.Bolt,
                        modifier = Modifier.weight(1f),
                    )
                }
                if (stats != null) {
                    UgsMetricLine(
                        label = stringResource(R.string.ugs_stats_total_generations),
                        value = "${stats.total_generations}",
                        icon = Icons.Outlined.BarChart,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (billing != null) {
                    UgsMetricLine(
                        label = stringResource(R.string.ugs_energy_today),
                        value =
                            "${formatUgsEnergyCredits(billing.daily_used)} / " +
                                formatUgsEnergyCredits(billing.daily_limit),
                        modifier = Modifier.weight(1f),
                    )
                }
                if (stats != null) {
                    UgsMetricLine(
                        label = stringResource(R.string.ugs_stats_active_tasks),
                        value = "${stats.active_tasks}",
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
fun UgsHubScreen(
    state: UgsHubUiState,
    onRefresh: () -> Unit,
    onOpenAiChat: () -> Unit,
    onOpenImages: () -> Unit,
    onOpenSongs: () -> Unit,
    onOpenPresentations: () -> Unit,
    onOpenDesktop: () -> Unit,
    onOpenContentLibrary: () -> Unit,
) {
    val hasSnapshotData = state.stats != null || state.billingStats != null
    val hubError = state.error
    val loadingLabel = stringResource(R.string.ugs_loading)
    val retryCd = stringResource(R.string.ugs_hub_retry_cd)
    val windowLayout = LocalMobileWindowLayout.current
    val useWideMetricsRow =
        windowLayout.widthClass >= MobileWindowWidthClass.Large &&
            state.billingStats != null &&
            state.stats != null

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Spacer(modifier = Modifier.height(4.dp)) }

        if (hubError != null) {
            item {
                val errDesc = stringResource(R.string.ugs_hub_error_cd, hubError)
                MobileErrorState(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 180.dp)
                            .semantics(mergeDescendants = true) {
                                contentDescription = errDesc
                            },
                    title = stringResource(R.string.ugs_error_title),
                    message = hubError,
                    retryLabel = retryCd,
                    onRetry = onRefresh,
                    retryEnabled = !state.isLoading,
                    icon = Icons.Outlined.Bolt,
                    contentDescription = errDesc,
                )
            }
        }

        if (state.isLoading && !hasSnapshotData && hubError == null) {
            item {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 160.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    PremiumLoadingCard(
                        message = loadingLabel,
                        modifier =
                            Modifier.fillMaxWidth().semantics {
                                contentDescription = loadingLabel
                            },
                    )
                }
            }
        }

        item {
            UgsSectionCard(
                title = stringResource(R.string.ugs_tools_section_title),
                subtitle = stringResource(R.string.ugs_tools_section_hint),
                icon = Icons.Outlined.Category,
            ) {
                UgsAiHubToolsGrid(
                    onOpenAiChat = onOpenAiChat,
                    onOpenImages = onOpenImages,
                    onOpenSongs = onOpenSongs,
                    onOpenPresentations = onOpenPresentations,
                    onOpenDesktop = onOpenDesktop,
                    onOpenContentLibrary = onOpenContentLibrary,
                )
            }
        }

        if (!useWideMetricsRow && (state.billingStats != null || state.stats != null)) {
            item {
                UgsHubOverviewCard(
                    billing = state.billingStats,
                    stats = state.stats,
                )
            }
        }

        if (useWideMetricsRow) {
            val b = state.billingStats!!
            val s = state.stats!!
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    UgsSectionCard(
                        title = stringResource(R.string.ugs_energy_section_title),
                        subtitle = stringResource(R.string.ugs_energy_section_hint),
                        icon = Icons.Outlined.Bolt,
                        modifier = Modifier.weight(1f),
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            UgsMetricLine(
                                label = stringResource(R.string.ugs_energy_available),
                                value = "${formatUgsEnergyCredits(b.available_credits)} ⚡",
                                icon = Icons.Outlined.Bolt,
                            )
                            HorizontalDivider(
                                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f),
                            )
                            UgsMetricLine(
                                label = stringResource(R.string.ugs_energy_today),
                                value =
                                    "${formatUgsEnergyCredits(b.daily_used)} / " +
                                        formatUgsEnergyCredits(b.daily_limit),
                            )
                            UgsMetricLine(
                                label = stringResource(R.string.ugs_energy_month),
                                value =
                                    "${formatUgsEnergyCredits(b.monthly_used)} / " +
                                        formatUgsEnergyCredits(b.monthly_limit),
                            )
                            UgsMetricLine(
                                label = stringResource(R.string.ugs_energy_total_used),
                                value = formatUgsEnergyCredits(b.total_used),
                            )
                        }
                    }
                    UgsSectionCard(
                        title = stringResource(R.string.ugs_stats_section_title),
                        subtitle = stringResource(R.string.ugs_stats_section_hint),
                        icon = Icons.Outlined.BarChart,
                        modifier = Modifier.weight(1f),
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            UgsMetricLine(
                                label = stringResource(R.string.ugs_stats_total_generations),
                                value = "${s.total_generations}",
                                icon = Icons.Outlined.BarChart,
                            )
                            HorizontalDivider(
                                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f),
                            )
                            UgsMetricLine(
                                label = stringResource(R.string.ugs_stats_active_tasks),
                                value = "${s.active_tasks}",
                            )
                            UgsMetricLine(
                                label = stringResource(R.string.ugs_stats_completed_today),
                                value = "${s.completed_today}",
                            )
                            UgsMetricLine(
                                label = stringResource(R.string.ugs_stats_failed_today),
                                value = "${s.failed_today}",
                            )
                        }
                    }
                }
            }
        }
    }
}
