/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Room database for offline session-scoped caches (feed, chat, pending sends, profile, friends,
 * friend requests, circles).
 *
 * Invariants:
 * - Schema changes require version bump and registered migrations.
 *
 * Related:
 * - AppContainer, SessionCacheCleaner
 */
package world.empery.mobile.core.storage

import android.content.Context
import android.content.pm.ApplicationInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.migration.Migration
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow
import java.util.concurrent.Executor
import java.util.concurrent.Executors

@Entity(tableName = "feed_posts")
data class FeedPostEntity(
    @PrimaryKey val id: String,
    val title: String,
    val body: String,
    val pinned: Boolean = false,
    val publishedAt: String?,
    val updatedAt: String?,
    val imageUrl: String?,
    val imageContentId: String?,
    val videoContentId: String?,
    val audioContentId: String?,
)

@Entity(tableName = "notification_center_items")
data class NotificationEntity(
    @PrimaryKey val id: String,
    val source: String?,
    val type: String?,
    val title: String?,
    val message: String?,
    val createdAt: String?,
    val readAt: String?,
)

@Entity(tableName = "profile_snapshot")
data class ProfileEntity(
    @PrimaryKey val id: String,
    val email: String?,
    val username: String?,
    val fullName: String?,
    val avatarUrl: String?,
    val updatedAtEpochMs: Long,
)

@Entity(tableName = "chat_list_items")
data class ChatEntity(
    @PrimaryKey val chatId: String,
    val unreadCount: Int,
    val lastMessagePreview: String?,
    val partnerLastReadMessageId: String? = null,
    val partnerId: String? = null,
    val partnerName: String? = null,
    val partnerAvatarUrl: String? = null,
    val isSystemAccount: Boolean = false,
    val lastMessageAt: String? = null,
)

@Entity(
    tableName = "chat_messages",
    indices = [Index("chatId"), Index("createdAt")],
)
data class ChatMessageEntity(
    @PrimaryKey val id: String,
    val chatId: String,
    val senderId: String?,
    val body: String,
    val createdAt: String?,
    val attachmentContentId: String?,
    val attachmentName: String?,
    val attachmentMimeType: String?,
    val attachmentSize: Long?,
    val editedAt: String?,
    val replyToMessageId: String?,
    val deletedForSender: Boolean,
    val deletedForRecipient: Boolean,
    val metadataJson: String? = null,
)

@Entity(tableName = "friend_rows")
data class FriendEntity(
    @PrimaryKey val id: String,
    val username: String?,
    val fullName: String?,
    val avatarUrl: String?,
)

/** Cached incoming or sent friend request from friends overview (`incoming` | `sent`). */
@Entity(
    tableName = "friend_request_rows",
    indices = [Index("direction"), Index("createdAt")],
)
data class FriendRequestEntity(
    @PrimaryKey val id: String,
    val direction: String,
    val fromUserId: String?,
    val toUserId: String?,
    val username: String?,
    val fullName: String?,
    val avatarUrl: String?,
    val createdAt: String?,
) {
    companion object {
        const val DIRECTION_INCOMING = "incoming"
        const val DIRECTION_SENT = "sent"
    }
}

/** Cached Social Hub circle row from friends overview. */
@Entity(
    tableName = "friend_circle_rows",
    indices = [Index("sortOrder")],
)
data class FriendCircleEntity(
    @PrimaryKey val id: String,
    val name: String,
    val membersCount: Int = 0,
    val sortOrder: Int = 0,
    val color: String?,
    val icon: String?,
)

@Entity(
    tableName = "chat_pending_sends",
    indices = [Index("chatId"), Index("createdAtEpochMs")],
)
data class PendingSendEntity(
    @PrimaryKey val id: String,
    val chatId: String,
    val body: String,
    val attachmentContentId: String?,
    val attachmentName: String?,
    val attachmentMimeType: String?,
    val attachmentSize: Long?,
    val replyToMessageId: String?,
    val localImagePreviewUri: String?,
    val createdAtEpochMs: Long,
    val failedReason: String?,
)

@Dao
interface FeedDao {
    @Query(
        """
        SELECT * FROM feed_posts
        ORDER BY pinned DESC,
        COALESCE(
          NULLIF(TRIM(publishedAt), ''),
          NULLIF(TRIM(updatedAt), ''),
          ''
        )
        DESC
        """,
    )
    suspend fun getAll(): List<FeedPostEntity>

    @Query(
        """
        SELECT * FROM feed_posts
        ORDER BY pinned DESC,
        COALESCE(
          NULLIF(TRIM(publishedAt), ''),
          NULLIF(TRIM(updatedAt), ''),
          ''
        )
        DESC
        """
    )
    fun observeAll(): Flow<List<FeedPostEntity>>

    @Query("DELETE FROM feed_posts")
    suspend fun deleteAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<FeedPostEntity>)
}

@Dao
interface NotificationDao {
    @Query("SELECT * FROM notification_center_items ORDER BY createdAt DESC")
    suspend fun getAll(): List<NotificationEntity>

    @Query("DELETE FROM notification_center_items")
    suspend fun deleteAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<NotificationEntity>)
}

@Dao
interface ProfileDao {
    @Query("SELECT * FROM profile_snapshot LIMIT 1")
    suspend fun getCurrent(): ProfileEntity?

    @Query("DELETE FROM profile_snapshot")
    suspend fun deleteAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: ProfileEntity)
}

@Dao
interface ChatDao {
    @Query(
        """
        SELECT * FROM chat_list_items
        ORDER BY
            COALESCE(NULLIF(TRIM(lastMessageAt), ''), '') DESC,
            chatId ASC
        """
    )
    suspend fun getAll(): List<ChatEntity>

    @Query("DELETE FROM chat_list_items")
    suspend fun deleteAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<ChatEntity>)
}

@Dao
interface ChatMessageDao {
    @Query("SELECT * FROM chat_messages WHERE chatId = :chatId ORDER BY createdAt ASC, id ASC")
    suspend fun getByChat(chatId: String): List<ChatMessageEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<ChatMessageEntity>)

    @Query("DELETE FROM chat_messages WHERE chatId = :chatId")
    suspend fun deleteByChat(chatId: String)

    @Query("DELETE FROM chat_messages")
    suspend fun deleteAll()
}

@Dao
interface FriendDao {
    @Query("SELECT * FROM friend_rows")
    suspend fun getAll(): List<FriendEntity>

    @Query("DELETE FROM friend_rows WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM friend_rows")
    suspend fun deleteAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<FriendEntity>)
}

@Dao
interface FriendRequestDao {
    @Query(
        """
        SELECT * FROM friend_request_rows
        WHERE direction = 'incoming'
        ORDER BY COALESCE(NULLIF(TRIM(createdAt), ''), '') DESC, id ASC
        """,
    )
    suspend fun getIncoming(): List<FriendRequestEntity>

    @Query(
        """
        SELECT * FROM friend_request_rows
        WHERE direction = 'sent'
        ORDER BY COALESCE(NULLIF(TRIM(createdAt), ''), '') DESC, id ASC
        """,
    )
    suspend fun getSent(): List<FriendRequestEntity>

    @Query("DELETE FROM friend_request_rows")
    suspend fun deleteAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<FriendRequestEntity>)
}

@Dao
interface FriendCircleDao {
    @Query("SELECT * FROM friend_circle_rows ORDER BY sortOrder ASC, name ASC, id ASC")
    suspend fun getAll(): List<FriendCircleEntity>

    @Query("DELETE FROM friend_circle_rows")
    suspend fun deleteAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<FriendCircleEntity>)
}

@Dao
interface PendingSendDao {
    @Query("SELECT * FROM chat_pending_sends WHERE chatId = :chatId ORDER BY createdAtEpochMs ASC, id ASC")
    suspend fun getByChat(chatId: String): List<PendingSendEntity>

    @Query("DELETE FROM chat_pending_sends WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM chat_pending_sends WHERE chatId = :chatId")
    suspend fun deleteByChat(chatId: String)

    @Query("DELETE FROM chat_pending_sends")
    suspend fun deleteAll()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: PendingSendEntity)
}

/**
 * On-device Room cache (feed, notifications, profile, chat, pending sends, friends).
 *
 * All reads and writes go through the typed DAO accessors on a single [MobileDatabase]
 * instance from [create]; callers should not rely on the SQLite file path or raw SQL
 * outside Room-generated statements.
 *
 * **Migrations (production)**
 * - Raise [Database.version] whenever an entity or table shape changes.
 * - Register one [Migration] object per version step (1→2, 2→3, …) and pass them all via
 *   `RoomDatabase.Builder.addMigrations`. Gaps (e.g. bumping version without
 *   adding the new step) cause install-time failures on non-debuggable builds.
 * - Release builds must not depend on wiping the DB: missing migrations surface as
 *   startup failures until fixed.
 * - If a schema change is planned but the migration is not ready yet: do not bump the DB
 *   version in a release branch, or land the migration in the same change — comments here
 *   do not replace shipping SQL.
 *
 * **Schema export**
 * - [exportSchema] is `true`; JSON lives under `core/storage/schemas/` (kapt `room.schemaLocation`).
 * - Track schema JSON in Git so CI can verify migrations before release.
 *
 * **Destructive fallback**
 * - `RoomDatabase.Builder.fallbackToDestructiveMigration` is applied only when
 *   the hosting application is debuggable ([ApplicationInfo.FLAG_DEBUGGABLE]). Non-debuggable
 *   (typical release) installs require successful migrations; there is no destructive fallback.
 *
 * **Query threading**
 * - [RoomDatabase.Builder.setQueryExecutor] uses a single background thread named for
 *   profiling; suspend DAO methods still run off the main thread via Room’s dispatch.
 */
@Database(
    entities = [
        FeedPostEntity::class,
        NotificationEntity::class,
        ProfileEntity::class,
        ChatEntity::class,
        ChatMessageEntity::class,
        FriendEntity::class,
        FriendRequestEntity::class,
        FriendCircleEntity::class,
        PendingSendEntity::class,
    ],
    version = 9,
    exportSchema = true,
)
abstract class MobileDatabase : RoomDatabase() {
    /** Local cache for feed cards / desk posts (`feed_posts`). */
    abstract fun feedDao(): FeedDao

    /** Local cache for in-app notification center rows (`notification_center_items`). */
    abstract fun notificationDao(): NotificationDao

    /** Single-row snapshot of the signed-in profile (`profile_snapshot`). */
    abstract fun profileDao(): ProfileDao

    /** Chat list metadata: unread counts and last preview (`chat_list_items`). */
    abstract fun chatDao(): ChatDao

    /** Per-chat message history (`chat_messages`); scoped by `chatId` in queries. */
    abstract fun chatMessageDao(): ChatMessageDao

    /** Friends list rows mirrored for offline display (`friend_rows`). */
    abstract fun friendDao(): FriendDao

    /** Incoming and sent friend requests from overview (`friend_request_rows`). */
    abstract fun friendRequestDao(): FriendRequestDao

    /** Social Hub circles from overview (`friend_circle_rows`). */
    abstract fun friendCircleDao(): FriendCircleDao

    /** Durable outbox for chat sends that have not been acknowledged by the server. */
    abstract fun pendingSendDao(): PendingSendDao

    companion object {
        /** Background work for queries; explicit thread name helps systrace / ANR attribution. */
        private val queryExecutor: Executor =
            Executors.newSingleThreadExecutor { runnable ->
                Thread(runnable, "MobileRoom-query").apply { isDaemon = true }
            }

        private fun Context.isHostDebuggable(): Boolean =
            (applicationContext.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

        /** Registered in [create] and validated by JVM migration tests. */
        internal val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE `chat_list_items` ADD COLUMN `partnerLastReadMessageId` TEXT",
                )
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `chat_messages` (
                        `id` TEXT NOT NULL,
                        `chatId` TEXT NOT NULL,
                        `senderId` TEXT,
                        `body` TEXT NOT NULL,
                        `createdAt` TEXT,
                        `attachmentContentId` TEXT,
                        `attachmentName` TEXT,
                        `attachmentMimeType` TEXT,
                        `attachmentSize` INTEGER,
                        `editedAt` TEXT,
                        `replyToMessageId` TEXT,
                        `deletedForSender` INTEGER NOT NULL DEFAULT 0,
                        `deletedForRecipient` INTEGER NOT NULL DEFAULT 0,
                        PRIMARY KEY(`id`)
                    )
                    """.trimIndent(),
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_chat_messages_chatId` ON `chat_messages` (`chatId`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_chat_messages_createdAt` ON `chat_messages` (`createdAt`)")
            }
        }

        internal val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `chat_list_items` ADD COLUMN `partnerId` TEXT")
                db.execSQL("ALTER TABLE `chat_list_items` ADD COLUMN `partnerName` TEXT")
                db.execSQL("ALTER TABLE `chat_list_items` ADD COLUMN `partnerAvatarUrl` TEXT")
            }
        }

        internal val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `chat_list_items` ADD COLUMN `isSystemAccount` INTEGER NOT NULL DEFAULT 0")
            }
        }

        internal val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `feed_posts` ADD COLUMN `pinned` INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE `feed_posts` ADD COLUMN `publishedAt` TEXT")
                db.execSQL("ALTER TABLE `feed_posts` ADD COLUMN `imageUrl` TEXT")
                db.execSQL("ALTER TABLE `feed_posts` ADD COLUMN `imageContentId` TEXT")
                db.execSQL("ALTER TABLE `feed_posts` ADD COLUMN `videoContentId` TEXT")
                db.execSQL("ALTER TABLE `feed_posts` ADD COLUMN `audioContentId` TEXT")
            }
        }

        internal val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `chat_list_items` ADD COLUMN `lastMessageAt` TEXT")
            }
        }

        internal val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `chat_pending_sends` (
                        `id` TEXT NOT NULL,
                        `chatId` TEXT NOT NULL,
                        `body` TEXT NOT NULL,
                        `attachmentContentId` TEXT,
                        `attachmentName` TEXT,
                        `attachmentMimeType` TEXT,
                        `attachmentSize` INTEGER,
                        `replyToMessageId` TEXT,
                        `localImagePreviewUri` TEXT,
                        `createdAtEpochMs` INTEGER NOT NULL,
                        `failedReason` TEXT,
                        PRIMARY KEY(`id`)
                    )
                    """.trimIndent(),
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_chat_pending_sends_chatId` ON `chat_pending_sends` (`chatId`)")
                db.execSQL(
                    """
                    CREATE INDEX IF NOT EXISTS `index_chat_pending_sends_createdAtEpochMs`
                    ON `chat_pending_sends` (`createdAtEpochMs`)
                    """.trimIndent(),
                )
            }
        }

        internal val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `metadataJson` TEXT")
            }
        }

        internal val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `friend_request_rows` (
                        `id` TEXT NOT NULL,
                        `direction` TEXT NOT NULL,
                        `fromUserId` TEXT,
                        `toUserId` TEXT,
                        `username` TEXT,
                        `fullName` TEXT,
                        `avatarUrl` TEXT,
                        `createdAt` TEXT,
                        PRIMARY KEY(`id`)
                    )
                    """.trimIndent(),
                )
                db.execSQL(
                    """
                    CREATE INDEX IF NOT EXISTS `index_friend_request_rows_direction`
                    ON `friend_request_rows` (`direction`)
                    """.trimIndent(),
                )
                db.execSQL(
                    """
                    CREATE INDEX IF NOT EXISTS `index_friend_request_rows_createdAt`
                    ON `friend_request_rows` (`createdAt`)
                    """.trimIndent(),
                )
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `friend_circle_rows` (
                        `id` TEXT NOT NULL,
                        `name` TEXT NOT NULL,
                        `membersCount` INTEGER NOT NULL DEFAULT 0,
                        `sortOrder` INTEGER NOT NULL DEFAULT 0,
                        `color` TEXT,
                        `icon` TEXT,
                        PRIMARY KEY(`id`)
                    )
                    """.trimIndent(),
                )
                db.execSQL(
                    """
                    CREATE INDEX IF NOT EXISTS `index_friend_circle_rows_sortOrder`
                    ON `friend_circle_rows` (`sortOrder`)
                    """.trimIndent(),
                )
            }
        }

        internal val ALL_MIGRATIONS: Array<Migration> =
            arrayOf(
                MIGRATION_1_2,
                MIGRATION_2_3,
                MIGRATION_3_4,
                MIGRATION_4_5,
                MIGRATION_5_6,
                MIGRATION_6_7,
                MIGRATION_7_8,
                MIGRATION_8_9,
            )

        fun create(context: Context): MobileDatabase {
            val appContext = context.applicationContext
            val builder =
                Room.databaseBuilder(
                    appContext,
                    MobileDatabase::class.java,
                    "empery_mobile.db",
                )
                    .setQueryExecutor(queryExecutor)
                    .addMigrations(
                        MIGRATION_1_2,
                        MIGRATION_2_3,
                        MIGRATION_3_4,
                        MIGRATION_4_5,
                        MIGRATION_5_6,
                        MIGRATION_6_7,
                        MIGRATION_7_8,
                        MIGRATION_8_9,
                    )

            if (appContext.isHostDebuggable()) {
                builder.fallbackToDestructiveMigration()
            }

            return builder.build()
        }
    }
}
