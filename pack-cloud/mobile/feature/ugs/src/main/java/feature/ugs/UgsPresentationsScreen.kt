package feature.ugs

import android.content.Intent
import android.widget.Toast
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Slideshow
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import world.empery.mobile.core.ui.LocalMobilePermissionRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import world.empery.mobile.core.network.api.EwrpCreateRequest
import world.empery.mobile.core.network.api.EwrpJobListItem
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumDividerGlow
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.PremiumStateCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UgsPresentationsScreen(
    repository: UgsHubRepository,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val permissionRequester = LocalMobilePermissionRequester.current
    val listState = rememberLazyListState()

    var topic by remember { mutableStateOf("") }
    var extraContext by remember { mutableStateOf("") }
    var numSlides by remember { mutableFloatStateOf(5f) }

    var isSubmitting by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }
    var submitSuccess by remember { mutableStateOf<String?>(null) }

    var jobs by remember { mutableStateOf<List<EwrpJobListItem>>(emptyList()) }
    var isJobsLoading by remember { mutableStateOf(true) }
    var jobsError by remember { mutableStateOf<String?>(null) }

    var downloadingJobId by remember { mutableStateOf<String?>(null) }

    fun loadJobs() {
        scope.launch {
            isJobsLoading = true
            jobsError = null
            try {
                jobs = repository.ewrpApi.getJobs(limit = 10)
            } catch (e: Exception) {
                jobsError = e.message ?: context.getString(R.string.ugs_presentations_load_error)
            } finally {
                isJobsLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadJobs()
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
                title = stringResource(R.string.ugs_presentations_screen_title),
                subtitle = stringResource(R.string.ugs_presentations_top_subtitle),
                onBack = onBack,
                isRefreshing = isJobsLoading,
                onRefresh = { loadJobs() },
                refreshContentDescription = stringResource(R.string.ugs_presentations_refresh),
            )
        },
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { Spacer(modifier = Modifier.height(8.dp)) }
            item {
                PremiumSectionCard(
                    title = stringResource(R.string.ugs_presentations_new_card_title),
                    subtitle = stringResource(R.string.ugs_presentations_extra_placeholder),
                    icon = Icons.Outlined.Slideshow,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                        OutlinedTextField(
                            value = topic,
                            onValueChange = { topic = it },
                            label = { Text(stringResource(R.string.ugs_presentations_topic_label)) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            shape = fieldShape,
                            colors = fieldColors,
                        )
                        OutlinedTextField(
                            value = extraContext,
                            onValueChange = { extraContext = it },
                            label = { Text(stringResource(R.string.ugs_presentations_extra_label)) },
                            placeholder = { Text(stringResource(R.string.ugs_presentations_extra_placeholder)) },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                            maxLines = 4,
                            shape = fieldShape,
                            colors = fieldColors,
                        )
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text =
                                    stringResource(
                                        R.string.ugs_presentations_slide_count,
                                        numSlides.toInt(),
                                    ),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Slider(
                                value = numSlides,
                                onValueChange = { numSlides = it },
                                valueRange = 3f..20f,
                                steps = 16,
                            )
                        }

                        if (submitError != null) {
                            Text(
                                text = submitError!!,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                        if (submitSuccess != null) {
                            Text(
                                text = submitSuccess!!,
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }

                        Button(
                            onClick = {
                                scope.launch {
                                    isSubmitting = true
                                    submitError = null
                                    submitSuccess = null
                                    try {
                                        val req =
                                            EwrpCreateRequest(
                                                topic = topic.trim(),
                                                num_slides = numSlides.toInt(),
                                                extra_context = extraContext.trim().takeIf { it.isNotBlank() },
                                            )
                                        repository.ewrpApi.createJob(req)
                                        submitSuccess =
                                            context.getString(R.string.ugs_presentations_started)
                                        topic = ""
                                        extraContext = ""
                                        loadJobs()
                                    } catch (e: Exception) {
                                        submitError = e.message ?: context.getString(R.string.ugs_submit_error)
                                    } finally {
                                        isSubmitting = false
                                    }
                                }
                            },
                            enabled = !isSubmitting && topic.isNotBlank(),
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
                                    stringResource(R.string.ugs_presentations_submitting)
                                } else {
                                    stringResource(R.string.ugs_presentations_generate)
                                },
                            )
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
                        text = stringResource(R.string.ugs_presentations_section_history),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (jobs.isNotEmpty()) {
                        PremiumBadge(text = jobs.size.toString())
                    }
                }
            }

            if (isJobsLoading && jobs.isEmpty()) {
                item {
                    PremiumLoadingCard(
                        message = stringResource(R.string.ugs_presentations_loading),
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 24.dp),
                    )
                }
            } else if (jobsError != null && jobs.isEmpty()) {
                item {
                    PremiumStateCard(
                        modifier = Modifier.fillMaxWidth(),
                        title = stringResource(R.string.ugs_presentations_screen_title),
                        message = jobsError.orEmpty(),
                        icon = Icons.Outlined.Slideshow,
                        isError = true,
                        action = {
                            Button(
                                onClick = { loadJobs() },
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Text(stringResource(R.string.ugs_presentations_error_retry))
                            }
                        },
                    )
                }
            } else if (jobs.isEmpty()) {
                item {
                    PremiumStateCard(
                        modifier = Modifier.fillMaxWidth(),
                        title = stringResource(R.string.ugs_presentations_empty_title),
                        message = stringResource(R.string.ugs_presentations_empty_hint),
                        icon = Icons.Outlined.Slideshow,
                    )
                }
            } else {
                items(jobs, key = { it.id }) { job ->
                    PremiumGlassCard(
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Text(
                                text = job.topic,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    text =
                                        stringResource(
                                            R.string.ugs_presentations_slides_count_label,
                                            job.num_slides,
                                        ),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                val statusColor =
                                    when (job.status) {
                                        "completed" -> MaterialTheme.colorScheme.primary
                                        "failed" -> MaterialTheme.colorScheme.error
                                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                                    }
                                Text(
                                    text = job.status.uppercase(),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = statusColor,
                                )
                            }

                            if (job.status == "processing" || job.status == "queued") {
                                LinearProgressIndicator(
                                    progress = { job.progress / 100f },
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }

                            if (job.status == "completed") {
                                Spacer(modifier = Modifier.height(4.dp))
                                Button(
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
                                            downloadingJobId = job.id
                                            try {
                                                val statusResp = repository.ewrpApi.getJobStatus(job.id)
                                                val url = statusResp.pdf_url
                                                if (!url.isNullOrBlank()) {
                                                    val finalUrl =
                                                        if (url.startsWith("http")) {
                                                            url
                                                        } else {
                                                            "https://app.eliteew.ru" +
                                                                if (url.startsWith("/")) url else "/$url"
                                                        }
                                                    val fileName = "presentation_${job.id.take(8)}.pdf"
                                                    val uri = repository.downloadPdfToDownloads(context, finalUrl, fileName)

                                                    val intent =
                                                        Intent(Intent.ACTION_VIEW).apply {
                                                            setDataAndType(uri, "application/pdf")
                                                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                                        }
                                                    context.startActivity(intent)
                                                }
                                            } catch (e: Exception) {
                                                Toast.makeText(
                                                    context,
                                                    e.message ?: context.getString(R.string.ugs_download_open_file_error),
                                                    Toast.LENGTH_SHORT,
                                                ).show()
                                            } finally {
                                                downloadingJobId = null
                                            }
                                        }
                                    },
                                    enabled = downloadingJobId != job.id,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                ) {
                                    if (downloadingJobId == job.id) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(16.dp).padding(end = 8.dp),
                                            strokeWidth = 2.dp,
                                        )
                                    }
                                    Text(stringResource(R.string.ugs_presentations_download_pdf))
                                }
                            }
                        }
                }
            }
        }
    }
}
}
