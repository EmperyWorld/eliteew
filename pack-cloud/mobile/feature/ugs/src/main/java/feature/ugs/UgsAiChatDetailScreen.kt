/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS solo AI chat thread: hero context, streaming replies, composer.
 *
 * Invariants:
 * - User-visible strings use `feature.ugs` string resources.
 *
 * Related:
 * - UgsAiChatListScreen.kt, UgsAiUi.kt, DesktopAiChatApi
 */
package feature.ugs

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.TravelExplore
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import world.empery.mobile.core.network.api.DesktopAiMessage
import world.empery.mobile.core.network.api.DesktopAiStreamBody
import world.empery.mobile.core.ui.PremiumComposerFieldShape
import world.empery.mobile.core.ui.PremiumComposerShell
import world.empery.mobile.core.ui.PremiumDividerGlow
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumStateCard
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@Composable
private fun TypingDots(modifier: Modifier = Modifier) {
    val base = MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        modifier = modifier.padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(3) { i ->
            Box(
                modifier =
                    Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(base.copy(alpha = 0.35f + i * 0.18f)),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UgsAiChatDetailScreen(
    repository: UgsHubRepository,
    chatId: String,
    heroName: String,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf<List<DesktopAiMessage>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var sendError by remember { mutableStateOf<String?>(null) }
    var draft by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    var useWebSearch by rememberSaveable { mutableStateOf(false) }

    val listState = rememberLazyListState()
    val hero = AI_HEROES.find { context.getString(it.nameRes) == heroName }
    val chrome = rememberMobileScaleChromePolicy()

    fun loadMessages() {
        scope.launch {
            isLoading = true
            error = null
            try {
                val resp = repository.desktopAiChatApi.getMessages(chatId)
                messages = resp.items
                sendError = null
            } catch (e: Exception) {
                error = e.message ?: context.getString(R.string.ugs_ai_load_messages_error)
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadMessages()
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.scrollToItem(messages.size - 1)
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            UgsAiSubScreenTopBar(
                title = heroName,
                subtitle = hero?.let { stringResource(it.descRes) }.orEmpty(),
                onBack = onBack,
                isRefreshing = isLoading,
                onRefresh = { loadMessages() },
                refreshContentDescription = stringResource(R.string.ugs_ai_refresh_messages),
            )
        },
        bottomBar = {
            PremiumGlassCard(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .windowInsetsPadding(WindowInsets.ime)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                tonalElevation = 6.dp,
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    PremiumDividerGlow(modifier = Modifier.padding(bottom = 8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        FilterChip(
                            selected = useWebSearch,
                            onClick = { useWebSearch = !useWebSearch },
                            label = { Text(stringResource(R.string.ugs_ai_web_search)) },
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Outlined.TravelExplore,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp),
                                )
                            },
                        )
                    }
                    if (sendError != null) {
                        PremiumRowSurface(
                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.92f),
                            borderColor = MaterialTheme.colorScheme.error.copy(alpha = 0.24f),
                        ) {
                            Text(
                                text = sendError.orEmpty(),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.weight(1f).padding(end = 8.dp),
                                maxLines = if (chrome.shouldStackChromeActions) 2 else 3,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                            )
                            if (!chrome.shouldStackChromeActions) {
                                TextButton(onClick = { sendError = null }) {
                                    Text(stringResource(R.string.ugs_ai_send_error_dismiss))
                                }
                            } else {
                                IconButton(onClick = { sendError = null }) {
                                    Icon(
                                        imageVector = Icons.Filled.Close,
                                        contentDescription = stringResource(R.string.ugs_ai_send_error_dismiss),
                                    )
                                }
                            }
                        }
                    }
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Bottom,
                    ) {
                        PremiumComposerShell(modifier = Modifier.weight(1f)) {
                            OutlinedTextField(
                                value = draft,
                                onValueChange = {
                                    draft = it
                                    if (sendError != null) sendError = null
                                },
                                placeholder = {
                                    Text(stringResource(R.string.ugs_ai_message_placeholder))
                                },
                                modifier = Modifier.fillMaxWidth(),
                                minLines = 1,
                                maxLines = 5,
                                shape = PremiumComposerFieldShape,
                                colors =
                                    OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = Color.Transparent,
                                        unfocusedBorderColor = Color.Transparent,
                                        focusedContainerColor = Color.Transparent,
                                        unfocusedContainerColor = Color.Transparent,
                                    ),
                            )
                        }
                        FilledIconButton(
                            onClick = {
                                    val text = draft.trim()
                                    if (text.isBlank() || isSending) return@FilledIconButton
                                    scope.launch {
                                        isSending = true
                                        sendError = null
                                        val tempId = "temp_${System.currentTimeMillis()}"
                                        val userMsg =
                                            DesktopAiMessage(id = tempId, role = "user", content = text)
                                        messages = messages + userMsg
                                        draft = ""

                                        val aiTempId = "temp_ai_${System.currentTimeMillis()}"
                                        var aiContent = ""
                                        var aiMsg =
                                            DesktopAiMessage(
                                                id = aiTempId,
                                                role = "assistant",
                                                content = aiContent,
                                            )
                                        messages = messages + aiMsg

                                        try {
                                            withContext(Dispatchers.IO) {
                                                val response =
                                                    repository.desktopAiChatApi.streamMessage(
                                                        chatId,
                                                        DesktopAiStreamBody(
                                                            content = text,
                                                            use_tools = useWebSearch,
                                                            use_web_search = useWebSearch,
                                                        ),
                                                    )
                                                response.byteStream().bufferedReader().useLines { lines ->
                                                    for (line in lines) {
                                                        if (line.startsWith("data: ")) {
                                                            val jsonStr = line.substring(6).trim()
                                                            if (jsonStr == "[DONE]") break
                                                            try {
                                                                val obj = org.json.JSONObject(jsonStr)
                                                                val delta = obj.optString("delta", "")
                                                                if (delta.isNotEmpty()) {
                                                                    aiContent += delta
                                                                    aiMsg = aiMsg.copy(content = aiContent)
                                                                    withContext(Dispatchers.Main) {
                                                                        messages = messages.dropLast(1) + aiMsg
                                                                    }
                                                                }
                                                            } catch (_: Exception) {
                                                            }
                                                        } else if (line.startsWith("{")) {
                                                            try {
                                                                val obj = org.json.JSONObject(line)
                                                                val delta = obj.optString("delta", "")
                                                                if (delta.isNotEmpty()) {
                                                                    aiContent += delta
                                                                    aiMsg = aiMsg.copy(content = aiContent)
                                                                    withContext(Dispatchers.Main) {
                                                                        messages = messages.dropLast(1) + aiMsg
                                                                    }
                                                                }
                                                            } catch (_: Exception) {
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            loadMessages()
                                        } catch (e: Exception) {
                                            sendError = e.message ?: context.getString(R.string.ugs_ai_send_error)
                                            messages =
                                                messages
                                                    .filterNot { m ->
                                                        m.id == tempId || m.id == aiTempId
                                                    }
                                        } finally {
                                            isSending = false
                                        }
                                    }
                                },
                                enabled = draft.isNotBlank() && !isSending,
                                modifier = Modifier.size(52.dp),
                            ) {
                                if (isSending) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        strokeWidth = 2.dp,
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.Send,
                                        contentDescription = stringResource(R.string.ugs_ai_send),
                                    )
                                }
                            }
                    }
                }
            }
        },
    ) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding),
        ) {
            when {
                isLoading && messages.isEmpty() -> {
                    PremiumLoadingCard(
                        message = stringResource(R.string.ugs_ai_detail_loading),
                        modifier =
                            Modifier
                                .align(Alignment.Center)
                                .padding(horizontal = 24.dp)
                                .fillMaxWidth(),
                    )
                }
                error != null && messages.isEmpty() -> {
                    PremiumStateCard(
                        modifier =
                            Modifier
                                .align(Alignment.Center)
                                .padding(20.dp)
                                .fillMaxWidth(),
                        title = stringResource(R.string.ugs_ai_send_error),
                        message = error ?: "",
                        isError = true,
                        action = {
                            ScaledOutlinedButton(
                                onClick = { loadMessages() },
                                enabled = true,
                                label = stringResource(R.string.ugs_ai_chat_error_retry),
                                icon = Icons.Outlined.Refresh,
                            )
                        },
                    )
                }
                !isLoading && messages.isEmpty() -> {
                    PremiumStateCard(
                        modifier =
                            Modifier
                                .align(Alignment.Center)
                                .padding(horizontal = 24.dp)
                                .fillMaxWidth(),
                        title = stringResource(R.string.ugs_ai_detail_empty_title),
                        message = stringResource(R.string.ugs_ai_detail_empty_hint),
                    )
                }
                else -> {
                    LazyColumn(
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .padding(horizontal = 12.dp),
                        state = listState,
                        contentPadding = PaddingValues(bottom = 6.dp),
                    ) {
                        item { Spacer(modifier = Modifier.height(8.dp)) }
                        itemsIndexed(messages, key = { _, item -> item.id }) { index, msg ->
                            val isMine = msg.role == "user"
                            val isStreamingShell =
                                !isMine &&
                                    msg.id.startsWith("temp_ai") &&
                                    msg.content.isBlank()
                            val prevMsg = messages.getOrNull(index - 1)
                            val prevIsMine = prevMsg?.role == "user"
                            val isGroupedWithPrev = prevMsg != null && prevIsMine == isMine
                            val showHeroAvatar = !isMine && hero != null && !isGroupedWithPrev
                            val showSenderLabel = !isGroupedWithPrev
                            Row(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(top = if (isGroupedWithPrev) 2.dp else 10.dp),
                                verticalAlignment = Alignment.Bottom,
                            ) {
                                if (isMine) {
                                    Spacer(modifier = Modifier.weight(1f))
                                } else if (showHeroAvatar) {
                                    Surface(
                                        shape = CircleShape,
                                        modifier =
                                            Modifier
                                                .padding(end = 6.dp)
                                                .size(36.dp),
                                        border =
                                            BorderStroke(
                                                1.5.dp,
                                                MaterialTheme.colorScheme.primary.copy(alpha = 0.32f),
                                            ),
                                    ) {
                                        Image(
                                            painter = painterResource(hero!!.avatarRes),
                                            contentDescription = null,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize().clip(CircleShape),
                                        )
                                    }
                                } else if (!isMine) {
                                    Spacer(modifier = Modifier.width(42.dp))
                                }
                                Column(
                                    horizontalAlignment =
                                        if (isMine) {
                                            Alignment.End
                                        } else {
                                            Alignment.Start
                                        },
                                    modifier = Modifier.widthIn(max = 340.dp),
                                ) {
                                    if (showSenderLabel) {
                                        Text(
                                            text =
                                                if (isMine) {
                                                    stringResource(R.string.ugs_ai_you)
                                                } else {
                                                    heroName
                                                },
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.82f),
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                                        )
                                    }
                                    Surface(
                                        color =
                                            if (isMine) {
                                                MaterialTheme.colorScheme.primaryContainer.copy(
                                                    alpha = 0.92f,
                                                )
                                            } else {
                                                MaterialTheme.colorScheme.surface.copy(
                                                    alpha = 0.92f,
                                                )
                                        },
                                        contentColor =
                                            if (isMine) {
                                                MaterialTheme.colorScheme.onPrimaryContainer
                                            } else {
                                                MaterialTheme.colorScheme.onSurface
                                            },
                                        shape =
                                            RoundedCornerShape(
                                                topStart = 20.dp,
                                                topEnd = 20.dp,
                                                bottomStart = if (isMine) 20.dp else 6.dp,
                                                bottomEnd = if (isMine) 6.dp else 20.dp,
                                            ),
                                        border =
                                            BorderStroke(
                                                1.dp,
                                                if (isMine) {
                                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.24f)
                                                } else {
                                                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.42f)
                                                },
                                            ),
                                        tonalElevation = if (isMine) 1.dp else 2.dp,
                                        shadowElevation = 1.dp,
                                    ) {
                                        if (isStreamingShell) {
                                            TypingDots()
                                        } else {
                                            Text(
                                                text = msg.content,
                                                style = MaterialTheme.typography.bodyLarge,
                                                modifier =
                                                    Modifier.padding(
                                                        horizontal = 14.dp,
                                                        vertical = 10.dp,
                                                    ),
                                            )
                                        }
                                    }
                                }
                                if (!isMine) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                        item { Spacer(modifier = Modifier.height(12.dp)) }
                    }
                }
            }
        }
    }
}
