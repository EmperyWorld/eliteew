/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local chat settings backed by SharedPreferences (flags, drafts, lite list partner meta).
 *
 * Invariants:
 * - Writes use commit() for known durability; corrupt JSON blobs are removed on read.
 *
 * Related:
 * - ChatRepository, GafChatListPartnerPresentation.kt
 */
package feature.chat

import android.content.Context
import android.util.Log
import org.json.JSONObject

/**
 * Local chat settings backed by [SharedPreferences].
 *
 * **Threading:** all public APIs are synchronized on an internal lock; safe for concurrent use from
 * any thread. Construct the instance before sharing across threads (constructor is not guarded).
 *
 * **Durability:** writes use [android.content.SharedPreferences.Editor.commit] (not `apply`) so
 * callers get a known outcome and data is flushed synchronously when the call returns.
 *
 * **Namespaced keys** (v1) avoid collisions with other features sharing the same prefs file name.
 *
 * **Legacy migration:** one-shot copy from pre-namespace keys only when the payload is valid JSON
 * object text; corrupt legacy values are removed without copying.
 *
 * **Corruption:** invalid JSON for a v1 key is removed and reads return an empty map for that blob.
 */
class ChatLocalSettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val lock = Any()

    init {
        migrateLegacyDataIfNeeded()
    }

    /** Returns flags per chat id; empty if missing, corrupt (v1 key is then removed), or `{}`. */
    fun load(): Map<String, ChatLocalFlags> = synchronized(lock) {
        parseFlags(prefs.getString(KEY_FLAGS_JSON, null))
    }

    /**
     * Persists the full flags map (replaces stored JSON). Returns whether [commit] succeeded;
     * on `false` the previous snapshot remains (or empty if there was none).
     */
    fun save(flagsByChatId: Map<String, ChatLocalFlags>): Boolean = synchronized(lock) {
        val root = JSONObject()
        flagsByChatId.forEach { (chatId, flags) ->
            val node =
                JSONObject()
                    .put("pinned", flags.pinned)
                    .put("muted", flags.muted)
                    .put("archived", flags.archived)
            root.put(chatId, node)
        }
        val payload = root.toString()
        val ok = prefs.edit().putString(KEY_FLAGS_JSON, payload).commit()
        if (!ok) {
            Log.e(TAG, "Failed to commit flags (disk full or commit rejected)")
        }
        ok
    }

    /** Returns drafts per chat id; empty if missing, corrupt (v1 key is then removed), or `{}`. */
    fun loadDrafts(): Map<String, String> = synchronized(lock) {
        parseDrafts(prefs.getString(KEY_DRAFTS_JSON, null))
    }

    /**
     * Upserts or removes (when [draft] is blank after trim) one draft. Returns whether [commit]
     * succeeded; on `false` persisted drafts are unchanged.
     */
    fun saveDraft(chatId: String, draft: String): Boolean = synchronized(lock) {
        val current = parseDrafts(prefs.getString(KEY_DRAFTS_JSON, null)).toMutableMap()
        val normalized = draft.trimEnd()
        if (normalized.isBlank()) {
            current.remove(chatId)
        } else {
            current[chatId] = normalized
        }
        val root = JSONObject()
        current.forEach { (id, value) -> root.put(id, value) }
        val payload = root.toString()
        val ok = prefs.edit().putString(KEY_DRAFTS_JSON, payload).commit()
        if (!ok) {
            Log.e(TAG, "Failed to commit drafts (disk full or commit rejected)")
        }
        ok
    }

    /** Lite list partner metadata keyed by chat id (username, relationship flags, optional badges). */
    fun loadPartnerMeta(): Map<String, GafChatListPartnerMeta> = synchronized(lock) {
        gafChatListPartnerMetaMapFromJson(prefs.getString(KEY_PARTNER_META_JSON, null))
    }

    /**
     * Replaces stored partner meta map. Returns whether [commit] succeeded.
     */
    fun savePartnerMeta(metaByChatId: Map<String, GafChatListPartnerMeta>): Boolean = synchronized(lock) {
        val payload = gafChatListPartnerMetaMapToJson(metaByChatId)
        val ok = prefs.edit().putString(KEY_PARTNER_META_JSON, payload).commit()
        if (!ok) {
            Log.e(TAG, "Failed to commit partner_meta_json (disk full or commit rejected)")
        }
        ok
    }

    private fun migrateLegacyDataIfNeeded() {
        synchronized(lock) {
            val editor = prefs.edit()
            var changed = false
            if (!prefs.contains(KEY_FLAGS_JSON)) {
                val legacy = prefs.getString(LEGACY_KEY_FLAGS_JSON, null)
                if (!legacy.isNullOrBlank()) {
                    if (isValidJsonObject(legacy)) {
                        editor.putString(KEY_FLAGS_JSON, legacy)
                        editor.remove(LEGACY_KEY_FLAGS_JSON)
                    } else {
                        editor.remove(LEGACY_KEY_FLAGS_JSON)
                        Log.w(TAG, "Dropped corrupt legacy flags_json (not a JSON object)")
                    }
                    changed = true
                }
            }
            if (!prefs.contains(KEY_DRAFTS_JSON)) {
                val legacy = prefs.getString(LEGACY_KEY_DRAFTS_JSON, null)
                if (!legacy.isNullOrBlank()) {
                    if (isValidJsonObject(legacy)) {
                        editor.putString(KEY_DRAFTS_JSON, legacy)
                        editor.remove(LEGACY_KEY_DRAFTS_JSON)
                    } else {
                        editor.remove(LEGACY_KEY_DRAFTS_JSON)
                        Log.w(TAG, "Dropped corrupt legacy drafts_json (not a JSON object)")
                    }
                    changed = true
                }
            }
            if (changed && !editor.commit()) {
                Log.e(TAG, "Legacy migration commit failed")
            }
        }
    }

    private fun parseFlags(raw: String?): Map<String, ChatLocalFlags> {
        if (raw.isNullOrBlank()) return emptyMap()
        val root =
            runCatching { JSONObject(raw) }.getOrNull()
                ?: run {
                    removeCorruptKey(KEY_FLAGS_JSON)
                    return emptyMap()
                }
        val result = mutableMapOf<String, ChatLocalFlags>()
        val keys = root.keys()
        while (keys.hasNext()) {
            val chatId = keys.next().toString()
            val node = root.optJSONObject(chatId) ?: continue
            result[chatId] =
                ChatLocalFlags(
                    pinned = node.optBoolean("pinned", false),
                    muted = node.optBoolean("muted", false),
                    archived = node.optBoolean("archived", false),
                )
        }
        return result
    }

    private fun parseDrafts(raw: String?): Map<String, String> {
        if (raw.isNullOrBlank()) return emptyMap()
        val root =
            runCatching { JSONObject(raw) }.getOrNull()
                ?: run {
                    removeCorruptKey(KEY_DRAFTS_JSON)
                    return emptyMap()
                }
        val result = mutableMapOf<String, String>()
        val keys = root.keys()
        while (keys.hasNext()) {
            val chatId = keys.next().toString()
            val draft = root.optString(chatId)
            if (draft.isNotBlank()) {
                result[chatId] = draft
            }
        }
        return result
    }

    /** Must run under [lock]; clears a v1 blob that failed to parse. */
    private fun removeCorruptKey(key: String) {
        val ok = prefs.edit().remove(key).commit()
        if (ok) {
            Log.w(TAG, "Removed corrupt JSON for key=$key")
        } else {
            Log.e(TAG, "Failed to remove corrupt key=$key")
        }
    }

    private fun isValidJsonObject(raw: String): Boolean =
        runCatching { JSONObject(raw) }.isSuccess

    companion object {
        private const val TAG = "ChatLocalSettingsStore"

        private const val PREFS_NAME = "chat_local_settings"

        /** v1 namespaced keys (production). */
        private const val KEY_FLAGS_JSON = "feature.chat.v1.flags_json"
        private const val KEY_DRAFTS_JSON = "feature.chat.v1.drafts_json"
        private const val KEY_PARTNER_META_JSON = "feature.chat.v1.partner_meta_json"

        /** Pre-namespace keys; migrated once then removed. */
        private const val LEGACY_KEY_FLAGS_JSON = "flags_json"
        private const val LEGACY_KEY_DRAFTS_JSON = "drafts_json"
    }
}
