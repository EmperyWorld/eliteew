/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Hub widget sections: notes, todos, and favorites CRUD cards.
 *
 * Invariants:
 * - Same package as DesktopHubFeature; DesktopHubScreen public API unchanged.
 * - LazyColumn item order must stay aligned with DesktopHubLazyColumnIndices / DesktopHubSectionId.
 *
 * Related:
 * - DesktopHubFeature.kt, DesktopHubLogic.kt, DesktopHubDeepLinkSupport.kt
 */
package feature.desktop

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Notes
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import world.empery.mobile.core.network.api.DesktopFavoriteDto
import world.empery.mobile.core.network.api.DesktopWidgetNoteDto
import world.empery.mobile.core.network.api.DesktopWidgetTodoDto
import world.empery.mobile.core.ui.PremiumRowSurface

@Composable
internal fun DesktopHubNotesSection(
    notes: List<DesktopWidgetNoteDto>,
    isLoading: Boolean,
    noteDraft: MutableState<String>,
    gridGap: Dp,
    context: Context,
    onCreateNote: (String) -> Unit,
    onDeleteNote: (String) -> Unit,
) {
    DesktopSectionCard(
        title = stringResource(R.string.desktop_notes_section_title),
        subtitle = null,
        icon = Icons.AutoMirrored.Outlined.Notes,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(gridGap),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            OutlinedTextField(
                value = noteDraft.value,
                onValueChange = { noteDraft.value = it },
                label = { Text(stringResource(R.string.desktop_notes_new_label)) },
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = {
                    val text = noteDraft.value.trim()
                    if (text.isNotBlank()) {
                        onCreateNote(text)
                        noteDraft.value = ""
                    }
                },
                enabled = noteDraft.value.isNotBlank(),
                modifier = Modifier.semantics {
                    contentDescription = context.getString(R.string.desktop_notes_add_cd)
                },
            ) {
                Text(stringResource(R.string.desktop_action_add))
            }
        }
        if (notes.isEmpty()) {
            Text(
                text = if (isLoading) {
                    stringResource(R.string.desktop_notes_loading)
                } else {
                    stringResource(R.string.desktop_notes_empty)
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            notes.take(8).forEach { note ->
                PremiumRowSurface(
                    modifier = Modifier
                        .semantics { isTraversalGroup = true },
                ) {
                    Text(
                        note.content,
                        modifier = Modifier
                            .weight(1f)
                            .semantics {
                                contentDescription =
                                    context.getString(R.string.desktop_note_a11y, hubA11ySnippet(note.content))
                            },
                    )
                    OutlinedButton(
                        onClick = { onDeleteNote(note.id) },
                        modifier = Modifier.semantics {
                            contentDescription =
                                context.getString(R.string.desktop_note_delete_a11y, hubA11ySnippet(note.content))
                        },
                    ) {
                        Text(stringResource(R.string.desktop_action_delete))
                    }
                }
            }
        }
    }
}

@Composable
internal fun DesktopHubTodosSection(
    todos: List<DesktopWidgetTodoDto>,
    isLoading: Boolean,
    todoDraft: MutableState<String>,
    gridGap: Dp,
    context: Context,
    onCreateTodo: (String) -> Unit,
    onToggleTodo: (DesktopWidgetTodoDto) -> Unit,
    onDeleteTodo: (String) -> Unit,
) {
    DesktopSectionCard(
        title = stringResource(R.string.desktop_todos_section_title),
        subtitle = null,
        icon = Icons.Outlined.Checklist,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(gridGap),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            OutlinedTextField(
                value = todoDraft.value,
                onValueChange = { todoDraft.value = it },
                label = { Text(stringResource(R.string.desktop_todos_new_label)) },
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = {
                    val text = todoDraft.value.trim()
                    if (text.isNotBlank()) {
                        onCreateTodo(text)
                        todoDraft.value = ""
                    }
                },
                enabled = todoDraft.value.isNotBlank(),
                modifier = Modifier.semantics {
                    contentDescription = context.getString(R.string.desktop_todos_add_cd)
                },
            ) {
                Text(stringResource(R.string.desktop_action_add))
            }
        }
        if (todos.isEmpty()) {
            Text(
                text = if (isLoading) {
                    stringResource(R.string.desktop_todos_loading)
                } else {
                    stringResource(R.string.desktop_todos_empty)
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            todos.take(8).forEach { todo ->
                val snippet = hubA11ySnippet(todo.text)
                PremiumRowSurface(
                    modifier = Modifier
                        .semantics { isTraversalGroup = true },
                ) {
                    Text(
                        text = if (todo.completed) {
                            "\u2713 ${todo.text}"
                        } else {
                            todo.text
                        },
                        modifier = Modifier
                            .weight(1f)
                            .semantics {
                                contentDescription = if (todo.completed) {
                                    context.getString(R.string.desktop_todo_done_a11y, snippet)
                                } else {
                                    context.getString(R.string.desktop_todo_pending_a11y, snippet)
                                }
                            },
                    )
                    OutlinedButton(
                        onClick = { onToggleTodo(todo) },
                        modifier = Modifier.semantics {
                            contentDescription = if (todo.completed) {
                                context.getString(R.string.desktop_todo_mark_undone_cd, snippet)
                            } else {
                                context.getString(R.string.desktop_todo_mark_done_cd, snippet)
                            }
                        },
                    ) {
                        Text(
                            if (todo.completed) {
                                stringResource(R.string.desktop_todo_undo)
                            } else {
                                stringResource(R.string.desktop_todo_done)
                            },
                        )
                    }
                    OutlinedButton(
                        onClick = { onDeleteTodo(todo.id) },
                        modifier = Modifier.semantics {
                            contentDescription = context.getString(R.string.desktop_todo_delete_cd, snippet)
                        },
                    ) {
                        Text(stringResource(R.string.desktop_action_delete))
                    }
                }
            }
        }
    }
}

@Composable
internal fun DesktopHubFavoritesSection(
    favorites: List<DesktopFavoriteDto>,
    isLoading: Boolean,
    favoriteTitleDraft: MutableState<String>,
    favoriteUrlDraft: MutableState<String>,
    context: Context,
    onCreateFavorite: (title: String, url: String) -> Unit,
    onDeleteFavorite: (String) -> Unit,
    onOpenFavoriteUrl: (String) -> Unit,
) {
    DesktopSectionCard(
        title = stringResource(R.string.desktop_favorites_section_title),
        subtitle = null,
        icon = Icons.Outlined.StarBorder,
    ) {
        OutlinedTextField(
            value = favoriteTitleDraft.value,
            onValueChange = { favoriteTitleDraft.value = it },
            label = { Text(stringResource(R.string.desktop_favorites_title_label)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        OutlinedTextField(
            value = favoriteUrlDraft.value,
            onValueChange = { favoriteUrlDraft.value = it },
            label = { Text(stringResource(R.string.desktop_favorites_url_label)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Button(
            onClick = {
                val title = favoriteTitleDraft.value.trim()
                val url = favoriteUrlDraft.value.trim()
                if (title.isNotBlank() && url.isNotBlank()) {
                    onCreateFavorite(title, url)
                    favoriteTitleDraft.value = ""
                    favoriteUrlDraft.value = ""
                }
            },
            enabled = favoriteTitleDraft.value.isNotBlank() && favoriteUrlDraft.value.isNotBlank(),
            modifier = Modifier.semantics {
                contentDescription = context.getString(R.string.desktop_favorites_add_cd)
            },
        ) {
            Text(stringResource(R.string.desktop_favorites_add))
        }
        if (favorites.isEmpty()) {
            Text(
                text = if (isLoading) {
                    stringResource(R.string.desktop_favorites_loading)
                } else {
                    stringResource(R.string.desktop_favorites_empty)
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            favorites.take(8).forEach { favorite ->
                val favSnippet = hubA11ySnippet("${favorite.title}. ${favorite.url}")
                PremiumRowSurface(
                    modifier = Modifier
                        .semantics { isTraversalGroup = true },
                ) {
                    Text(
                        "${favorite.title}: ${favorite.url}",
                        modifier = Modifier
                            .weight(1f)
                            .semantics {
                                contentDescription = context.getString(R.string.desktop_favorite_a11y, favSnippet)
                            },
                        maxLines = 3,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    OutlinedButton(
                        onClick = { onOpenFavoriteUrl(favorite.url) },
                        modifier = Modifier.semantics {
                            contentDescription =
                                context.getString(R.string.desktop_favorite_open_a11y, hubA11ySnippet(favorite.title))
                        },
                    ) {
                        Text(stringResource(R.string.desktop_action_open))
                    }
                    OutlinedButton(
                        onClick = { onDeleteFavorite(favorite.id) },
                        modifier = Modifier.semantics {
                            contentDescription =
                                context.getString(R.string.desktop_favorite_delete_a11y, hubA11ySnippet(favorite.title))
                        },
                    ) {
                        Text(stringResource(R.string.desktop_action_delete))
                    }
                }
            }
        }
    }
}
