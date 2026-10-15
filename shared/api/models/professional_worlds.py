# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ORM models for Professional Worlds: admin registry, specialist profiles, learning, CRM-lite, realtor assets.
# Invariants:
# - Every mutable user-owned row carries user_id and must be filtered by the authenticated user.
# - Domain data lives in dedicated tables, not desktop_configs.shell_state.
# Related:
# - api/routers/professional_worlds.py
# - documentation/product/PROFESSIONAL-WORLDS.md
# ---

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from api.models.database_models import Base
from api.utils.datetime_helpers import utc_now_naive


class ProfessionVertical(Base):
    """Profession package available inside Professional Worlds."""

    __tablename__ = "profession_verticals"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    slug = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    icon_key = Column(String(80), nullable=False, default="briefcase")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    profile_schema = Column(JSONB, nullable=False, default=dict, server_default="{}")
    workspace_template = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class SpecialistProfile(Base):
    """Per-user professional profile for a selected vertical."""

    __tablename__ = "specialist_profiles"
    __table_args__ = (UniqueConstraint("user_id", "vertical_slug", name="uq_specialist_profiles_user_vertical"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="RESTRICT"), nullable=False)
    display_name = Column(String(180), nullable=True)
    headline = Column(String(240), nullable=True)
    city = Column(String(120), nullable=True)
    agency_name = Column(String(180), nullable=True)
    specialization = Column(JSONB, nullable=False, default=list, server_default="[]")
    profile_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    is_public_ready = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalGenerationRecipe(Base):
    """AI generation recipe exposed by a profession vertical."""

    __tablename__ = "professional_generation_recipes"
    __table_args__ = (
        UniqueConstraint("vertical_slug", "recipe_key", name="uq_professional_generation_recipes_vertical_key"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    recipe_key = Column(String(120), nullable=False)
    display_name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    ugs_type_key = Column(String(120), nullable=False, default="text_chat")
    input_schema = Column(JSONB, nullable=False, default=dict, server_default="{}")
    prompt_template = Column(Text, nullable=False)
    safety_rules = Column(JSONB, nullable=False, default=list, server_default="[]")
    output_kind = Column(String(80), nullable=False, default="text")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalArtifact(Base):
    """Generated or manually saved professional artifact."""

    __tablename__ = "professional_artifacts"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vertical_slug = Column(String(80), nullable=False, index=True)
    source_type = Column(String(80), nullable=False)
    source_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    recipe_key = Column(String(120), nullable=True)
    title = Column(String(240), nullable=False)
    content = Column(Text, nullable=True)
    artifact_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    unified_content_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    ugs_request_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalLearningCourse(Base):
    """Profession-specific course."""

    __tablename__ = "professional_learning_courses"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    course_key = Column(String(120), nullable=False)
    title = Column(String(220), nullable=False)
    description = Column(Text, nullable=True)
    level = Column(String(80), nullable=False, default="starter")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalLearningLesson(Base):
    """Lesson inside a profession course."""

    __tablename__ = "professional_learning_lessons"
    __table_args__ = (UniqueConstraint("course_id", "lesson_key", name="uq_professional_lessons_course_key"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    course_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_learning_courses.id", ondelete="CASCADE"), nullable=False
    )
    lesson_key = Column(String(120), nullable=False)
    title = Column(String(220), nullable=False)
    summary = Column(Text, nullable=True)
    content_md = Column(Text, nullable=False)
    exercise = Column(JSONB, nullable=False, default=dict, server_default="{}")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalLearningProgress(Base):
    """Per-user lesson completion state."""

    __tablename__ = "professional_learning_progress"
    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_professional_learning_progress_user_lesson"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lesson_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_learning_lessons.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(String(40), nullable=False, default="completed")
    score = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalClient(Base):
    """CRM-lite client scoped to a specialist."""

    __tablename__ = "professional_clients"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vertical_slug = Column(String(80), nullable=False, index=True)
    name = Column(String(180), nullable=False)
    contact = Column(String(240), nullable=True)
    need_summary = Column(Text, nullable=True)
    budget_from = Column(Numeric(14, 2), nullable=True)
    budget_to = Column(Numeric(14, 2), nullable=True)
    preferred_areas = Column(JSONB, nullable=False, default=list, server_default="[]")
    emotional_motive = Column(Text, nullable=True)
    next_action = Column(Text, nullable=True)
    status = Column(String(80), nullable=False, default="lead")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalDeal(Base):
    """Deal pipeline row scoped to a specialist."""

    __tablename__ = "professional_deals"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vertical_slug = Column(String(80), nullable=False, index=True)
    client_id = Column(PGUUID(as_uuid=True), ForeignKey("professional_clients.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(220), nullable=False)
    stage = Column(String(80), nullable=False, default="new")
    amount = Column(Numeric(14, 2), nullable=True)
    next_action = Column(Text, nullable=True)
    deal_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalTask(Base):
    """Task or next action for a specialist workflow."""

    __tablename__ = "professional_tasks"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vertical_slug = Column(String(80), nullable=False, index=True)
    title = Column(String(220), nullable=False)
    status = Column(String(60), nullable=False, default="open")
    due_at = Column(DateTime, nullable=True)
    reminder_at = Column(DateTime, nullable=True)
    related_type = Column(String(80), nullable=True)
    related_id = Column(PGUUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorProperty(Base):
    """Real-estate object managed by a realtor specialist."""

    __tablename__ = "realtor_properties"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(220), nullable=False)
    property_type = Column(String(80), nullable=False, default="apartment")
    deal_type = Column(String(80), nullable=False, default="sale")
    city = Column(String(120), nullable=False, default="Владивосток")
    district = Column(String(160), nullable=True)
    address = Column(String(240), nullable=True)
    price = Column(Numeric(14, 2), nullable=True)
    area_m2 = Column(Numeric(10, 2), nullable=True)
    rooms = Column(Integer, nullable=True)
    floor = Column(Integer, nullable=True)
    total_floors = Column(Integer, nullable=True)
    view = Column(String(220), nullable=True)
    infrastructure = Column(JSONB, nullable=False, default=list, server_default="[]")
    jtbd_context = Column(JSONB, nullable=False, default=dict, server_default="{}")
    facts = Column(JSONB, nullable=False, default=dict, server_default="{}")
    status = Column(String(80), nullable=False, default="draft")
    is_deleted = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorPropertyMedia(Base):
    """Media attached to a realtor property through Unified Content."""

    __tablename__ = "realtor_property_media"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    property_id = Column(
        PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    unified_content_id = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    caption = Column(String(240), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class RealtorPropertyShowing(Base):
    """Scheduled property showing for Realtor Pro (CRM scheduling surface)."""

    __tablename__ = "realtor_property_showings"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    property_id = Column(
        PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id = Column(PGUUID(as_uuid=True), ForeignKey("professional_clients.id", ondelete="SET NULL"), nullable=True)
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String(80), nullable=False, default="planned")
    notes = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    location_notes = Column(Text, nullable=True)
    deal_id = Column(PGUUID(as_uuid=True), ForeignKey("professional_deals.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorTask(Base):
    """Realtor-specific task / next-action row with optional links to deal, showing, or property."""

    __tablename__ = "realtor_tasks"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(220), nullable=False)
    status = Column(String(60), nullable=False, default="open")
    priority = Column(String(40), nullable=False, default="normal")
    due_at = Column(DateTime, nullable=True)
    reminder_at = Column(DateTime, nullable=True)
    next_action = Column(String(280), nullable=True)
    notes = Column(Text, nullable=True)
    property_id = Column(PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="SET NULL"), nullable=True)
    client_id = Column(PGUUID(as_uuid=True), ForeignKey("professional_clients.id", ondelete="SET NULL"), nullable=True)
    showing_id = Column(
        PGUUID(as_uuid=True), ForeignKey("realtor_property_showings.id", ondelete="SET NULL"), nullable=True
    )
    deal_id = Column(PGUUID(as_uuid=True), ForeignKey("professional_deals.id", ondelete="SET NULL"), nullable=True)
    task_meta = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


# Back-compat alias for imports expecting the legacy ORM name.
RealtorShowing = RealtorPropertyShowing


class ProfessionalModule(Base):
    """Reusable product module that can be enabled for profession verticals."""

    __tablename__ = "professional_modules"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    module_key = Column(String(120), nullable=False, unique=True, index=True)
    name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(80), nullable=False, default="workspace")
    icon_key = Column(String(80), nullable=False, default="squares")
    default_config = Column(JSONB, nullable=False, default=dict, server_default="{}")
    depends_on = Column(JSONB, nullable=False, default=list, server_default="[]")
    capability_scopes = Column(JSONB, nullable=False, default=dict, server_default="{}")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalVerticalModule(Base):
    """Module assignment and ordering for one profession vertical."""

    __tablename__ = "professional_vertical_modules"
    __table_args__ = (
        UniqueConstraint("vertical_slug", "module_key", name="uq_professional_vertical_modules_vertical_module"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    module_key = Column(String(120), ForeignKey("professional_modules.module_key", ondelete="CASCADE"), nullable=False)
    config = Column(JSONB, nullable=False, default=dict, server_default="{}")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    is_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalVerticalSchema(Base):
    """Versioned JSON schema for vertical profile/object/client fields."""

    __tablename__ = "professional_vertical_schemas"
    __table_args__ = (
        UniqueConstraint(
            "vertical_slug",
            "schema_key",
            "version",
            name="uq_professional_vertical_schemas_vertical_key_version",
        ),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    schema_key = Column(String(120), nullable=False)
    version = Column(Integer, nullable=False, default=1, server_default="1")
    title = Column(String(180), nullable=False)
    schema_json = Column(JSONB, nullable=False, default=dict, server_default="{}")
    ui_schema = Column(JSONB, nullable=False, default=dict, server_default="{}")
    is_active = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalAiAction(Base):
    """Admin-configured AI action bound to a vertical/module and UGS type."""

    __tablename__ = "professional_ai_actions"
    __table_args__ = (
        UniqueConstraint("vertical_slug", "action_key", name="uq_professional_ai_actions_vertical_action"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    module_key = Column(String(120), nullable=False)
    action_key = Column(String(160), nullable=False)
    display_name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    ugs_type_key = Column(String(120), nullable=False, default="text_chat")
    workflow_slug = Column(String(160), nullable=True)
    prompt_template = Column(Text, nullable=False)
    input_schema = Column(JSONB, nullable=False, default=dict, server_default="{}")
    output_schema = Column(JSONB, nullable=False, default=dict, server_default="{}")
    safety_rules = Column(JSONB, nullable=False, default=list, server_default="[]")
    artifact_kind = Column(String(80), nullable=False, default="text")
    billing_hint = Column(JSONB, nullable=False, default=dict, server_default="{}")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalAiActionRun(Base):
    """Per-user run history for admin-configured Professional Worlds AI actions."""

    __tablename__ = "professional_ai_action_runs"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    vertical_slug = Column(String(80), nullable=False, index=True)
    action_key = Column(String(160), nullable=False)
    source_type = Column(String(80), nullable=True)
    source_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    status = Column(String(60), nullable=False, default="queued")
    idempotency_key = Column(String(160), nullable=True, index=True)
    input_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    output_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    error = Column(Text, nullable=True)
    ugs_request_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    artifact_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalPhotoPreset(Base):
    """Admin-configured high-level media action for specialist photos."""

    __tablename__ = "professional_photo_presets"
    __table_args__ = (
        UniqueConstraint("vertical_slug", "preset_key", name="uq_professional_photo_presets_vertical_key"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    preset_key = Column(String(140), nullable=False)
    display_name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(80), nullable=False, default="enhance")
    action_type = Column(String(80), nullable=False, default="image_edit")
    ugs_type_key = Column(String(120), nullable=False, default="image_studio_image_edit")
    prompt_template = Column(Text, nullable=False)
    parameters = Column(JSONB, nullable=False, default=dict, server_default="{}")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalIntegrationBinding(Base):
    """Feature flag and mapping for cross-app integrations."""

    __tablename__ = "professional_integration_bindings"
    __table_args__ = (
        UniqueConstraint(
            "vertical_slug",
            "integration_key",
            name="uq_professional_integration_bindings_vertical_key",
        ),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    integration_key = Column(String(120), nullable=False)
    display_name = Column(String(180), nullable=False)
    config = Column(JSONB, nullable=False, default=dict, server_default="{}")
    is_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalAdminAuditLog(Base):
    """Audit log for Professional Worlds admin mutations."""

    __tablename__ = "professional_admin_audit_log"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    admin_user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(120), nullable=False)
    entity_type = Column(String(120), nullable=False)
    entity_key = Column(String(240), nullable=False)
    before_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    after_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    risk_level = Column(String(40), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class RealtorObjectIntakeJob(Base):
    """User-scoped raw text to structured realtor property extraction job."""

    __tablename__ = "realtor_object_intake_jobs"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    property_id = Column(PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(60), nullable=False, default="preview")
    source_text = Column(Text, nullable=False)
    extracted_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    confidence = Column(JSONB, nullable=False, default=dict, server_default="{}")
    warnings = Column(JSONB, nullable=False, default=list, server_default="[]")
    idempotency_key = Column(String(160), nullable=True, index=True)
    ugs_request_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorMediaEnhancementJob(Base):
    """User-scoped image enhancement job for realtor property media."""

    __tablename__ = "realtor_media_enhancement_jobs"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    property_id = Column(
        PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_content_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    output_content_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    preset_key = Column(String(140), nullable=False)
    status = Column(String(60), nullable=False, default="queued")
    instruction = Column(Text, nullable=True)
    provider_result = Column(JSONB, nullable=False, default=dict, server_default="{}")
    idempotency_key = Column(String(160), nullable=True, index=True)
    ugs_request_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    accepted_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)
    batch_job_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalVerticalPackVersion(Base):
    """Versioned manifest snapshot for a profession vertical (export/import checkpoint)."""

    __tablename__ = "professional_vertical_pack_versions"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    version_label = Column(String(80), nullable=False)
    changelog_md = Column(Text, nullable=True)
    manifest = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_by_admin_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalVerticalPackRelease(Base):
    """Published or draft release pointing at a pack version and frozen manifest snapshot."""

    __tablename__ = "professional_vertical_pack_releases"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    pack_version_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_vertical_pack_versions.id", ondelete="SET NULL"), nullable=True
    )
    status = Column(String(40), nullable=False, default="draft")
    manifest_snapshot = Column(JSONB, nullable=False, default=dict, server_default="{}")
    snapshot_hash = Column(String(128), nullable=True)
    approved_by_admin_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalVerticalRollout(Base):
    """Staged rollout of a published release."""

    __tablename__ = "professional_vertical_rollouts"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    release_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_vertical_pack_releases.id", ondelete="CASCADE"), nullable=False
    )
    mode = Column(String(40), nullable=False, default="all")
    percentage = Column(Integer, nullable=False, default=100)
    is_paused = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalVerticalRolloutAllowlist(Base):
    """User allowlist rows for a rollout."""

    __tablename__ = "professional_vertical_rollout_allowlist"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    rollout_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_vertical_rollouts.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalPackImportJob(Base):
    """Dry-run or confirmed vertical pack import job."""

    __tablename__ = "professional_pack_import_jobs"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    admin_user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    status = Column(String(40), nullable=False, default="pending")
    dry_run = Column(Boolean, nullable=False, default=True, server_default="true")
    manifest = Column(JSONB, nullable=False, default=dict, server_default="{}")
    validation_messages = Column(JSONB, nullable=False, default=list, server_default="[]")
    diff_summary = Column(JSONB, nullable=False, default=dict, server_default="{}")
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalPackRollbackSnapshot(Base):
    """Operator snapshot before risky imports (restore point metadata)."""

    __tablename__ = "professional_pack_rollback_snapshots"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    label = Column(String(160), nullable=False)
    manifest_snapshot = Column(JSONB, nullable=False, default=dict, server_default="{}")
    admin_user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalUserVerticalActivation(Base):
    """Per-user enabled verticals and onboarding blob."""

    __tablename__ = "professional_user_vertical_activations"
    __table_args__ = (UniqueConstraint("user_id", "vertical_slug", name="uq_prof_user_vertical_activation"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    onboarding = Column(JSONB, nullable=False, default=dict, server_default="{}")
    entitlements = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalVerticalRuntimeEpoch(Base):
    """Monotonic epoch for runtime config cache invalidation per vertical."""

    __tablename__ = "professional_vertical_runtime_epoch"

    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), primary_key=True)
    epoch = Column(Integer, nullable=False, default=1, server_default="1")
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive)


class RealtorLead(Base):
    """Realtor lead row prior to client conversion."""

    __tablename__ = "realtor_leads"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vertical_slug = Column(String(80), nullable=False, default="realtor")
    name = Column(String(180), nullable=False)
    contact = Column(String(240), nullable=True)
    source = Column(String(120), nullable=True)
    status = Column(String(80), nullable=False, default="new")
    notes = Column(Text, nullable=True)
    converted_client_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_clients.id", ondelete="SET NULL"), nullable=True
    )
    lead_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorBuyerRequirement(Base):
    """Structured buyer requirements linked optionally to a CRM client."""

    __tablename__ = "realtor_buyer_requirements"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(PGUUID(as_uuid=True), ForeignKey("professional_clients.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(220), nullable=False)
    requirements = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorSellerProfile(Base):
    """Seller-specific context (listing story, constraints)."""

    __tablename__ = "realtor_seller_profiles"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(PGUUID(as_uuid=True), ForeignKey("professional_clients.id", ondelete="SET NULL"), nullable=True)
    seller_context = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorDealEvent(Base):
    """Append-only deal stage history."""

    __tablename__ = "realtor_deal_events"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    deal_id = Column(PGUUID(as_uuid=True), ForeignKey("professional_deals.id", ondelete="CASCADE"), nullable=False)
    stage_from = Column(String(80), nullable=True)
    stage_to = Column(String(80), nullable=False)
    note = Column(Text, nullable=True)
    event_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class RealtorProDocument(Base):
    """Document checklist row for a deal or property."""

    __tablename__ = "realtor_documents"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    deal_id = Column(PGUUID(as_uuid=True), ForeignKey("professional_deals.id", ondelete="SET NULL"), nullable=True)
    property_id = Column(PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(220), nullable=False)
    doc_type = Column(String(120), nullable=False, default="other")
    checklist_state = Column(JSONB, nullable=False, default=dict, server_default="{}")
    unified_content_id = Column(PGUUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorPriceAnalysisSnapshot(Base):
    """Stored price analysis / comps snapshot for a listing."""

    __tablename__ = "realtor_price_analysis_snapshots"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="CASCADE"), nullable=False)
    snapshot = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class RealtorMarketingCampaign(Base):
    """Marketing plan for a listing."""

    __tablename__ = "realtor_marketing_campaigns"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(220), nullable=False)
    channels = Column(JSONB, nullable=False, default=list, server_default="[]")
    status = Column(String(80), nullable=False, default="draft")
    campaign_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorCommunicationLog(Base):
    """Communication timeline entries."""

    __tablename__ = "realtor_communication_logs"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    related_type = Column(String(80), nullable=False)
    related_id = Column(PGUUID(as_uuid=True), nullable=True)
    channel = Column(String(80), nullable=False)
    body = Column(Text, nullable=False)
    meta = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class RealtorObjectionReply(Base):
    """Personal objection handling snippets."""

    __tablename__ = "realtor_objection_replies"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    objection_key = Column(String(160), nullable=False)
    reply_text = Column(Text, nullable=False)
    tags = Column(JSONB, nullable=False, default=list, server_default="[]")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorPublicationChannel(Base):
    """Per-listing publication channel status."""

    __tablename__ = "realtor_publication_channels"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="CASCADE"), nullable=False)
    channel_key = Column(String(120), nullable=False)
    status = Column(String(80), nullable=False, default="pending")
    meta = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorListingQualityScore(Base):
    """Listing quality scoring history."""

    __tablename__ = "realtor_listing_quality_scores"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="CASCADE"), nullable=False)
    score = Column(Numeric(5, 2), nullable=False)
    breakdown = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalAiPlaybook(Base):
    """Multi-step AI workflow definition."""

    __tablename__ = "professional_ai_playbooks"
    __table_args__ = (UniqueConstraint("vertical_slug", "playbook_key", name="uq_prof_ai_playbooks_vertical_key"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    playbook_key = Column(String(160), nullable=False)
    display_name = Column(String(180), nullable=False)
    description = Column(Text, nullable=True)
    config = Column(JSONB, nullable=False, default=dict, server_default="{}")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalAiPlaybookStep(Base):
    """Ordered step referencing an AI action key."""

    __tablename__ = "professional_ai_playbook_steps"
    __table_args__ = (UniqueConstraint("playbook_id", "step_order", name="uq_prof_playbook_step_order"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    playbook_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_ai_playbooks.id", ondelete="CASCADE"), nullable=False
    )
    step_order = Column(Integer, nullable=False)
    action_key = Column(String(160), nullable=False)
    input_mapping = Column(JSONB, nullable=False, default=dict, server_default="{}")
    stop_on_error = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalAiPlaybookRun(Base):
    """User-scoped playbook execution record."""

    __tablename__ = "professional_ai_playbook_runs"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vertical_slug = Column(String(80), nullable=False)
    playbook_key = Column(String(160), nullable=False)
    status = Column(String(60), nullable=False, default="queued")
    idempotency_key = Column(String(160), nullable=True, index=True)
    step_logs = Column(JSONB, nullable=False, default=list, server_default="[]")
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalAiPlaybookRunArtifact(Base):
    """Artifact produced at a specific playbook step."""

    __tablename__ = "professional_ai_playbook_run_artifacts"
    __table_args__ = (UniqueConstraint("run_id", "step_order", name="uq_prof_playbook_run_step"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    run_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_ai_playbook_runs.id", ondelete="CASCADE"), nullable=False
    )
    step_order = Column(Integer, nullable=False)
    artifact_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_artifacts.id", ondelete="SET NULL"), nullable=True
    )
    artifact_kind = Column(String(120), nullable=True)
    meta = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalAiEvalDataset(Base):
    """Evaluation dataset for Professional Worlds AI."""

    __tablename__ = "professional_ai_eval_datasets"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    vertical_slug = Column(String(80), ForeignKey("profession_verticals.slug", ondelete="CASCADE"), nullable=False)
    name = Column(String(180), nullable=False)
    cases = Column(JSONB, nullable=False, default=list, server_default="[]")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalAiEvalRun(Base):
    """Single evaluation run against an action or playbook."""

    __tablename__ = "professional_ai_eval_runs"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    dataset_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_ai_eval_datasets.id", ondelete="CASCADE"), nullable=False
    )
    target_type = Column(String(40), nullable=False)
    target_key = Column(String(160), nullable=False)
    status = Column(String(40), nullable=False, default="pending")
    scores = Column(JSONB, nullable=False, default=dict, server_default="{}")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalMediaAlbum(Base):
    """User-authored album of Unified Content ids."""

    __tablename__ = "professional_media_albums"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vertical_slug = Column(String(80), nullable=False)
    title = Column(String(220), nullable=False)
    property_id = Column(PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="SET NULL"), nullable=True)
    campaign_id = Column(
        PGUUID(as_uuid=True), ForeignKey("realtor_marketing_campaigns.id", ondelete="SET NULL"), nullable=True
    )
    artifact_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_artifacts.id", ondelete="SET NULL"), nullable=True
    )
    unified_content_ids = Column(JSONB, nullable=False, default=list, server_default="[]")
    album_data = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorMediaBatchJob(Base):
    """Batch wrapper for multiple media enhancements."""

    __tablename__ = "realtor_media_batch_jobs"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(PGUUID(as_uuid=True), ForeignKey("realtor_properties.id", ondelete="CASCADE"), nullable=False)
    preset_key = Column(String(140), nullable=False)
    status = Column(String(60), nullable=False, default="queued")
    instruction = Column(Text, nullable=True)
    idempotency_key = Column(String(160), nullable=True, index=True)
    batch_meta = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class RealtorMediaBatchItem(Base):
    """Per-image item in a batch job."""

    __tablename__ = "realtor_media_batch_items"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    batch_job_id = Column(
        PGUUID(as_uuid=True), ForeignKey("realtor_media_batch_jobs.id", ondelete="CASCADE"), nullable=False
    )
    source_content_id = Column(PGUUID(as_uuid=True), nullable=False)
    enhancement_job_id = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    status = Column(String(60), nullable=False, default="pending")
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalBrandVisualKit(Base):
    """Brand colors / logo notes for media exports."""

    __tablename__ = "professional_brand_visual_kits"
    __table_args__ = (UniqueConstraint("user_id", "vertical_slug", name="uq_prof_brand_kit_user_vertical"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vertical_slug = Column(String(80), nullable=False)
    kit = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalCrossAppDraftLink(Base):
    """Tracks draft handoffs to EWRP, Site Studio, GAF, EWDesk, etc."""

    __tablename__ = "professional_cross_app_draft_links"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vertical_slug = Column(String(80), nullable=False)
    draft_kind = Column(String(80), nullable=False)
    artifact_id = Column(
        PGUUID(as_uuid=True), ForeignKey("professional_artifacts.id", ondelete="SET NULL"), nullable=True
    )
    external_ref = Column(JSONB, nullable=False, default=dict, server_default="{}")
    lifecycle_state = Column(String(40), nullable=False, default="created")
    stale_reason = Column(Text, nullable=True)
    source_digest = Column(String(128), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)


class ProfessionalOperatorNote(Base):
    """Internal operator note on a config entity."""

    __tablename__ = "professional_operator_notes"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    entity_type = Column(String(120), nullable=False)
    entity_key = Column(String(240), nullable=False)
    note = Column(Text, nullable=False)
    admin_user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalUserNotificationPreferences(Base):
    """Optional Professional Worlds notification prefs per user."""

    __tablename__ = "professional_user_notification_preferences"

    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    professional_prefs = Column(JSONB, nullable=False, default=dict, server_default="{}")
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalAnalyticsEvent(Base):
    """Lightweight analytics events from Professional Worlds clients."""

    __tablename__ = "professional_analytics_events"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vertical_slug = Column(String(80), nullable=False)
    event_type = Column(String(120), nullable=False)
    payload = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)


class ProfessionalBillingRollup(Base):
    """Aggregated billing hints per user and vertical (product reporting)."""

    __tablename__ = "professional_billing_rollups"
    __table_args__ = (
        UniqueConstraint("user_id", "vertical_slug", "period_start", "period_end", name="uq_prof_billing_rollup"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vertical_slug = Column(String(80), nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    rollup = Column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
