/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS AI chat list: hero picker, solo chat creation, search.
 *
 * Invariants:
 * - Hero names/descriptions use string resources for locale support.
 *
 * Related:
 * - UgsAiChatDetailScreen.kt, UgsHubRepository
 */
package feature.ugs

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.launch
import world.empery.mobile.core.network.api.DesktopAiChatCreateBody
import world.empery.mobile.core.network.api.DesktopAiChatItem
import world.empery.mobile.core.network.api.DesktopAiChatSettings
import world.empery.mobile.core.network.api.SoloSlotPurchaseBody
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumStateCard
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.ui.usesScaleAwareIconControls

data class AiHero(
    val id: String,
    @androidx.annotation.StringRes val nameRes: Int,
    @androidx.annotation.StringRes val descRes: Int,
    val avatarRes: Int,
)

val AI_HEROES =
    listOf(
        AiHero("likiy_sorrento", R.string.ugs_hero_likiy_sorrento_name, R.string.ugs_hero_likiy_sorrento_desc, R.drawable.likiy_sorrento),
        AiHero("arlyqueen", R.string.ugs_hero_arlyqueen_name, R.string.ugs_hero_arlyqueen_desc, R.drawable.arlyqueen),
        AiHero("akimbo", R.string.ugs_hero_akimbo_name, R.string.ugs_hero_akimbo_desc, R.drawable.akimbo),
        AiHero("arlekino_pravoz", R.string.ugs_hero_arlekino_pravoz_name, R.string.ugs_hero_arlekino_pravoz_desc, R.drawable.arlekino_pravoz),
        AiHero("max_safin", R.string.ugs_hero_max_safin_name, R.string.ugs_hero_max_safin_desc, R.drawable.max_safin),
        AiHero("suno_songwriter", R.string.ugs_hero_suno_songwriter_name, R.string.ugs_hero_suno_songwriter_desc, R.drawable.suno_songwriter),
        AiHero("dr_vereskov", R.string.ugs_hero_dr_vereskov_name, R.string.ugs_hero_dr_vereskov_desc, R.drawable.dr_vereskov),
        AiHero("viktor_engineer", R.string.ugs_hero_viktor_engineer_name, R.string.ugs_hero_viktor_engineer_desc, R.drawable.viktor_engineer),
    )

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UgsAiChatListScreen(
    repository: UgsHubRepository,
    onBack: () -> Unit,
    onOpenChat: (String, String) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var chats by remember { mutableStateOf<List<DesktopAiChatItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    var showHeroPicker by remember { mutableStateOf(false) }
    var pendingHeroForConfirm by remember { mutableStateOf<AiHero?>(null) }
    var isCreating by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }

    val durations = listOf(1, 2, 12)
    var selectedDurationIndex by remember { mutableIntStateOf(2) }

    val heroSheetState =
        rememberModalBottomSheetState(
            skipPartiallyExpanded = true,
        )

    val filteredChats =
        remember(chats, searchQuery) {
            val q = searchQuery.trim()
            if (q.isEmpty()) {
                chats
            } else {
                chats.filter { chat ->
                    val heroId = chat.settings?.desktop_hero_id
                    val hero = AI_HEROES.find { it.id == heroId }
                    val heroName = hero?.let { context.getString(it.nameRes) }.orEmpty()
                    chat.title.contains(q, ignoreCase = true) ||
                        heroName.contains(q, ignoreCase = true)
                }
            }
        }

    fun loadChats() {
        scope.launch {
            isLoading = true
            error = null
            try {
                val allChats = repository.desktopAiChatApi.getChats()
                chats = allChats.items.filter { it.settings?.desktop_chat_mode == "solo" }
            } catch (e: Exception) {
                error = e.message ?: context.getString(R.string.ugs_ai_load_chats_error)
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadChats()
    }

    val heroToConfirm = pendingHeroForConfirm
    if (heroToConfirm != null) {
        val heroForDialog = heroToConfirm
        val confirmScroll = rememberScrollState()
        AlertDialog(
            onDismissRequest = { if (!isCreating) pendingHeroForConfirm = null },
            title = {
                Text(
                    stringResource(R.string.ugs_ai_create_confirm_title),
                    style = MaterialTheme.typography.titleLarge,
                )
            },
            text = {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .verticalScroll(confirmScroll),
                ) {
                    Text(
                        stringResource(R.string.ugs_ai_create_confirm_body),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (isCreating) return@Button
                        pendingHeroForConfirm = null
                        scope.launch {
                            isCreating = true
                            try {
                                val newChat =
                                    repository.desktopAiChatApi.createChat(
                                        DesktopAiChatCreateBody(
                                            title = context.getString(R.string.ugs_ai_chat_title_prefix, context.getString(heroForDialog.nameRes)),
                                            settings =
                                                DesktopAiChatSettings(
                                                    desktop_hero_id = heroForDialog.id,
                                                    desktop_chat_mode = "solo",
                                                ),
                                        ),
                                    )
                                repository.desktopAiChatApi.purchaseSoloSlot(
                                    newChat.id,
                                    SoloSlotPurchaseBody(
                                        duration_hours = durations[selectedDurationIndex],
                                        hero_id = heroForDialog.id,
                                    ),
                                )
                                showHeroPicker = false
                                onOpenChat(newChat.id, context.getString(heroForDialog.nameRes))
                            } catch (e: Exception) {
                                error = e.message ?: context.getString(R.string.ugs_ai_create_chat_error)
                                showHeroPicker = false
                            } finally {
                                isCreating = false
                            }
                        }
                    },
                    enabled = !isCreating,
                ) {
                    Text(stringResource(R.string.ugs_ai_create_confirm_ok))
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { if (!isCreating) pendingHeroForConfirm = null },
                    enabled = !isCreating,
                ) {
                    Text(stringResource(R.string.ugs_ai_create_confirm_cancel))
                }
            },
        )
    }

    if (showHeroPicker) {
        ModalBottomSheet(
            onDismissRequest = { if (!isCreating) showHeroPicker = false },
            sheetState = heroSheetState,
            shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.78f),
            dragHandle = { BottomSheetDefaults.DragHandle() },
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(bottom = 28.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            stringResource(R.string.ugs_ai_hero_picker_title),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            stringResource(R.string.ugs_ai_hero_picker_subtitle),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    TextButton(
                        onClick = { if (!isCreating) showHeroPicker = false },
                        enabled = !isCreating,
                    ) {
                        Text(stringResource(R.string.ugs_ai_sheet_close))
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        stringResource(R.string.ugs_ai_rent_duration),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = MaterialTheme.colorScheme.surfaceContainer,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        SingleChoiceSegmentedButtonRow(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(6.dp),
                        ) {
                            durations.forEachIndexed { index, hours ->
                                SegmentedButton(
                                    selected = selectedDurationIndex == index,
                                    onClick = { if (!isCreating) selectedDurationIndex = index },
                                    enabled = !isCreating,
                                    shape =
                                        SegmentedButtonDefaults.itemShape(
                                            index = index,
                                            count = durations.size,
                                        ),
                                ) {
                                    Text(
                                        stringResource(R.string.ugs_ai_hours_short, hours),
                                        style = MaterialTheme.typography.labelMedium,
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f))
                Spacer(modifier = Modifier.height(12.dp))

                if (isCreating) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 24.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(28.dp),
                            strokeWidth = 2.dp,
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = stringResource(R.string.ugs_ai_creating_chat),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(AI_HEROES, key = { it.id }) { hero ->
                            UgsAiHeroPickerCard(
                                heroName = stringResource(hero.nameRes),
                                heroDescription = stringResource(hero.descRes),
                                avatarRes = hero.avatarRes,
                                enabled = !isCreating,
                                onClick = {
                                    if (isCreating) return@UgsAiHeroPickerCard
                                    pendingHeroForConfirm = hero
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            UgsAiSubScreenTopBar(
                title = stringResource(R.string.ugs_ai_chat_list_title),
                subtitle = stringResource(R.string.ugs_ai_chat_top_subtitle),
                onBack = onBack,
                isRefreshing = isLoading,
                onRefresh = { loadChats() },
                refreshContentDescription = stringResource(R.string.ugs_ai_refresh),
            )
        },
        floatingActionButton = {
            val newChatLabel = stringResource(R.string.ugs_ai_chat_new)
            if (usesScaleAwareIconControls()) {
                FloatingActionButton(
                    onClick = { showHeroPicker = true },
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                    shape = RoundedCornerShape(18.dp),
                ) {
                    Icon(Icons.Filled.Add, contentDescription = newChatLabel)
                }
            } else {
                ExtendedFloatingActionButton(
                    onClick = { showHeroPicker = true },
                    icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                    text = { Text(newChatLabel) },
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                    shape = RoundedCornerShape(18.dp),
                )
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                isLoading -> {
                    PremiumLoadingCard(
                        message = stringResource(R.string.ugs_ai_chat_loading_list),
                        modifier =
                            Modifier
                                .align(Alignment.Center)
                                .padding(horizontal = 24.dp)
                                .fillMaxWidth(),
                    )
                }
                error != null && chats.isEmpty() -> {
                    PremiumStateCard(
                        modifier =
                            Modifier
                                .align(Alignment.Center)
                                .padding(20.dp)
                                .fillMaxWidth(),
                        title = stringResource(R.string.ugs_ai_chat_list_title),
                        message = error ?: "",
                        icon = Icons.Outlined.ChatBubbleOutline,
                        isError = true,
                        action = {
                            ScaledOutlinedButton(
                                onClick = { loadChats() },
                                enabled = true,
                                label = stringResource(R.string.ugs_ai_chat_error_retry),
                                icon = Icons.Outlined.Refresh,
                            )
                        },
                    )
                }
                chats.isEmpty() -> {
                    PremiumStateCard(
                        modifier =
                            Modifier
                                .align(Alignment.Center)
                                .padding(horizontal = 24.dp)
                                .fillMaxWidth(),
                        title = stringResource(R.string.ugs_ai_chat_empty_title),
                        message = stringResource(R.string.ugs_ai_chat_empty_hint),
                        icon = Icons.Outlined.ChatBubbleOutline,
                        action = {
                            FilledTonalButton(
                                onClick = { showHeroPicker = true },
                                shape = RoundedCornerShape(14.dp),
                            ) {
                                Text(stringResource(R.string.ugs_ai_chat_start_cta))
                            }
                        },
                    )
                }
                else -> {
                    LazyColumn(
                        modifier =
                            Modifier
                                .fillMaxSize()
                                .padding(horizontal = 16.dp),
                        contentPadding = PaddingValues(top = 8.dp, bottom = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        item {
                            UgsAiSearchField(
                                value = searchQuery,
                                onValueChange = { searchQuery = it },
                                placeholder = stringResource(R.string.ugs_ai_chat_search_placeholder),
                            )
                        }
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    stringResource(R.string.ugs_ai_chat_section_title),
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
                                ) {
                                    Text(
                                        text =
                                            stringResource(
                                                R.string.ugs_ai_chat_section_count,
                                                chats.size,
                                            ),
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    )
                                }
                            }
                        }
                        if (filteredChats.isEmpty()) {
                            item {
                                Text(
                                    stringResource(R.string.ugs_ai_chat_no_results),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(vertical = 24.dp),
                                )
                            }
                        } else {
                            items(filteredChats, key = { it.id }) { chat ->
                                val heroId = chat.settings?.desktop_hero_id
                                val hero = AI_HEROES.find { it.id == heroId }
                                val heroName = hero?.let { stringResource(it.nameRes) } ?: stringResource(R.string.ugs_ai_default_hero)
                                val slotActive = chat.solo_slot_active != false
                                PremiumRowSurface(
                                    modifier =
                                        Modifier
                                            .fillMaxWidth()
                                            .clickable { onOpenChat(chat.id, heroName) },
                                    containerColor = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.88f),
                                    borderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.34f),
                                    tonalElevation = 2.dp,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                        if (hero != null) {
                                            Surface(
                                                shape = CircleShape,
                                                modifier = Modifier.size(48.dp),
                                                border =
                                                    BorderStroke(
                                                        1.5.dp,
                                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.28f),
                                                    ),
                                            ) {
                                                Image(
                                                    painter = painterResource(hero.avatarRes),
                                                    contentDescription = null,
                                                    contentScale = ContentScale.Crop,
                                                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                                                )
                                            }
                                        } else {
                                            Surface(
                                                shape = CircleShape,
                                                modifier = Modifier.size(48.dp),
                                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                                                border =
                                                    BorderStroke(
                                                        1.5.dp,
                                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.24f),
                                                    ),
                                            ) {
                                                Box(
                                                    modifier = Modifier.fillMaxSize(),
                                                    contentAlignment = Alignment.Center,
                                                ) {
                                                    Icon(
                                                        Icons.Filled.Person,
                                                        contentDescription = null,
                                                        tint = MaterialTheme.colorScheme.primary,
                                                        modifier = Modifier.size(24.dp),
                                                    )
                                                }
                                            }
                                        }
                                        Column(
                                            modifier = Modifier.weight(1f),
                                            verticalArrangement = Arrangement.spacedBy(2.dp),
                                        ) {
                                            Text(
                                                text = chat.title.ifBlank { stringResource(R.string.ugs_ai_chat_default_title) },
                                                style = MaterialTheme.typography.titleSmall,
                                                fontWeight = FontWeight.SemiBold,
                                                maxLines = 2,
                                                overflow = TextOverflow.Ellipsis,
                                            )
                                            Text(
                                                text = heroName,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis,
                                            )
                                            if (!slotActive) {
                                                Text(
                                                    text = stringResource(R.string.ugs_ai_slot_inactive),
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = MaterialTheme.colorScheme.error,
                                                    fontWeight = FontWeight.Medium,
                                                )
                                            }
                                        }
                                        Icon(
                                            Icons.Outlined.ChatBubbleOutline,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.72f),
                                            modifier = Modifier.size(18.dp),
                                        )
                                }
                            }
                        }
                        item { Spacer(modifier = Modifier.height(88.dp)) }
                    }
                }
            }
        }
    }
}
