# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ComfyUI curated workflow templates, parameter injection, and preset graph builders.
# Invariants:
# - Template loads are deep-copied before mutation; model from file wins over caller param in curated graphs.
# - Turbo/lightning graphs keep KSampler steps/cfg/sampler from the template; generic graphs apply caller values.
# - Turbo/lightning (incl. 01_top / z-image) and Flux.2 Klein distilled (site_studio_photo)
#   keep distilled sampler settings; positive prompts go through `_finalize_z_image_user_prompt`
#   (ConditioningZeroOut — anti-text must live on positive).
# - Turbo graphs snap EmptySD3LatentImage to 1024×1024 (z-image native).
# - Klein distilled snaps EmptyFlux2LatentImage + Flux2Scheduler to step-16 sizes (not square).
# Related:
# - api/services/ugs/providers/comfyui_provider.py
# - api/services/ugs/providers/comfyui_observability.py
# - api/services/ugs/z_image_prompt.py
# - api/services/ugs/flux2_klein.py
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.

from __future__ import annotations

import copy
import json
import logging
import secrets
from pathlib import Path
from typing import Any

from api.services.ugs.flux2_klein import snap_flux2_klein_latent
from api.services.ugs.z_image_prompt import snap_z_image_turbo_latent

from .comfyui_observability import _finalize_z_image_user_prompt

logger = logging.getLogger(__name__)


class ComfyUIWorkflowPresetsMixin:
    """Preset workflow builders and template loading for ComfyUI."""

    def get_text_to_image_workflow(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 768,
        height: int = 768,
        steps: int = 20,
        cfg_scale: float = 6.5,
        model: str = "epicrealismXL_vxviiCrystalclear.safetensors",
        seed: int | None = None,
        workflow_template: str | None = None,
    ) -> dict[str, Any]:
        """Get a text-to-image workflow, preferring curated templates"""

        template_name = workflow_template or "01_top.json"
        workflow = None

        try:
            workflow = self._load_workflow_template(template_name)
        except (FileNotFoundError, json.JSONDecodeError, OSError) as template_error:
            logger.warning(
                "Failed to load ComfyUI workflow template '%s': %s. Falling back to basic workflow.",
                template_name,
                template_error,
            )

        if seed is None:
            max_seed_value = 2**31 - 1
            seed = secrets.randbelow(max_seed_value) + 1

        if workflow is None:
            return self._build_basic_text_to_image_workflow(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                steps=steps,
                cfg_scale=cfg_scale,
                model=model,
                seed=seed,
            )

        for node in workflow.values():
            if node.get("class_type") == "CheckpointLoaderSimple":
                workflow_model = node.get("inputs", {}).get("ckpt_name", "NOT_FOUND")
                logger.info(
                    "ComfyUI: Using model from workflow file '%s': '%s' (parameter 'model'='%s' will be IGNORED - only prompts and seed will be changed)",
                    template_name,
                    workflow_model,
                    model,
                )
                break

        self._apply_text_to_image_params(
            workflow,
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=steps,
            cfg_scale=cfg_scale,
            model=model,
            seed=seed,
            workflow_template=template_name,
        )

        return workflow

    def get_image_to_image_workflow(
        self,
        image_b64: str,
        prompt: str,
        strength: float = 0.8,
        steps: int = 20,
        model: str = "epicrealismXL_vxviiCrystalclear.safetensors",
    ) -> dict[str, Any]:
        """Get an image-to-image workflow"""
        ckpt_name = model if model.endswith(".safetensors") else f"{model}.safetensors"
        return {
            "1": {
                "class_type": "LoadBase64Image",
                "inputs": {"image": f"data:image/png;base64,{image_b64}"},
            },
            "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["5", 1]}},
            "3": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": "blurry, low quality, deformed", "clip": ["5", 1]},
            },
            "4": {"class_type": "VAEEncode", "inputs": {"pixels": ["1", 0], "vae": ["5", 2]}},
            "5": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt_name}},
            "6": {
                "class_type": "KSampler",
                "inputs": {
                    "seed": 0,
                    "steps": steps,
                    "cfg": 6.5,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": strength,
                    "model": ["5", 0],
                    "positive": ["2", 0],
                    "negative": ["3", 0],
                    "latent_image": ["4", 0],
                },
            },
            "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["5", 2]}},
            "8": {
                "class_type": "SaveImage",
                "inputs": {"filename_prefix": "comfyui_img2img", "images": ["7", 0]},
            },
        }

    def get_text_to_image_z_turbo_workflow(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        seed: int = -1,
    ) -> dict[str, Any]:
        """
        Build workflow from comfyui/text_to_image.json (z-image-turbo / Lumina2).
        Sets CLIPTextEncode (83:27), EmptySD3LatentImage (83:13), KSampler seed (83:3).
        """
        workflow = self._load_workflow_template("text_to_image.json")
        if seed == -1 or seed is None:
            seed = secrets.randbelow(2**31 - 1) + 1
        width, height = snap_z_image_turbo_latent(width, height)
        workflow["83:27"]["inputs"]["text"] = _finalize_z_image_user_prompt(prompt)
        workflow["83:13"]["inputs"]["width"] = width
        workflow["83:13"]["inputs"]["height"] = height
        workflow["83:3"]["inputs"]["seed"] = seed
        return workflow

    def get_redactor_image_edit_workflow(
        self,
        image_filename: str,
        positive_prompt: str,
        negative_prompt: str = "",
        seed: int = -1,
    ) -> dict[str, Any]:
        """
        Build workflow from comfyui/redactor_image.json (Qwen Image Edit).
        Sets LoadImage (78), TextEncodeQwenImageEditPlus positive (115:111), negative (115:110), KSampler (115:3).
        """
        workflow = self._load_workflow_template("redactor_image.json")
        if seed == -1 or seed is None:
            seed = secrets.randbelow(2**31 - 1) + 1
        workflow["78"]["inputs"]["image"] = image_filename
        workflow["115:111"]["inputs"]["prompt"] = (positive_prompt or "").strip() or "edit the image"
        workflow["115:110"]["inputs"]["prompt"] = (negative_prompt or "").strip()
        workflow["115:3"]["inputs"]["seed"] = seed
        return workflow

    def get_rotate_image_workflow(
        self,
        image_filename: str,
    ) -> dict[str, Any]:
        """
        Build workflow from comfyui/rotate_image.json (Qwen Image Edit multiple angles).
        Sets LoadImage (25) image path; camera prompts are defined inside the workflow.
        """
        workflow = self._load_workflow_template("rotate_image.json")
        if "25" in workflow and "inputs" in workflow["25"]:
            workflow["25"]["inputs"]["image"] = image_filename
        return workflow

    def get_wan_i2v_workflow(
        self,
        image_filename: str,
        positive_prompt: str,
        negative_prompt: str = "",
        run_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Load Wan 2.2 Image-to-Video workflow and set image + prompts.
        Template: comfyui/video_wan2_2_14B_image.json
        Nodes: 97 LoadImage, 129:93 positive CLIP, 129:89 negative CLIP, 108 SaveVideo.
        If run_id is set, SaveVideo filename_prefix becomes video/Wan2.2_i2v_{run_id}
        so the run produces a unique file and we can fetch it by path in fallback.
        """
        workflow = self._load_workflow_template("video_wan2_2_14B_image.json")
        if "97" in workflow and "inputs" in workflow["97"]:
            workflow["97"]["inputs"]["image"] = image_filename
        if "129:93" in workflow and "inputs" in workflow["129:93"]:
            workflow["129:93"]["inputs"]["text"] = (positive_prompt or "").strip() or "The scene moves slowly."
        if "129:89" in workflow and "inputs" in workflow["129:89"]:
            workflow["129:89"]["inputs"]["text"] = (negative_prompt or "").strip()
        if run_id and "108" in workflow and "inputs" in workflow["108"]:
            workflow["108"]["inputs"]["filename_prefix"] = f"video/Wan2.2_i2v_{run_id}"
        return workflow

    def register_workflow_template(self, template_name: str, workflow_data: dict[str, Any]) -> None:
        """Register a DB-backed workflow template for runtime use."""
        normalized = template_name.strip()
        if not normalized or not isinstance(workflow_data, dict):
            return
        self.workflows_cache[normalized] = copy.deepcopy(workflow_data)
        if not normalized.endswith(".json"):
            self.workflows_cache[f"{normalized}.json"] = copy.deepcopy(workflow_data)

    def create_workflow_from_template(
        self,
        template_name: str,
        *,
        prompt: str,
        negative_prompt: str = "",
        width: int = 768,
        height: int = 768,
        steps: int = 20,
        cfg_scale: float = 6.5,
        model: str | None = None,
        seed: int | None = None,
    ) -> dict[str, Any]:
        workflow = self._load_workflow_template(template_name)
        self._apply_text_to_image_params(
            workflow,
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            steps=steps,
            cfg_scale=cfg_scale,
            model=model or "DreamShaperXL_Lightning.safetensors",
            seed=seed,
            workflow_template=template_name,
        )
        return workflow

    def _load_workflow_template(self, filename: str) -> dict[str, Any]:
        candidate_names = [filename]
        if not filename.endswith(".json"):
            candidate_names.append(f"{filename}.json")

        for candidate_name in candidate_names:
            cached_workflow = self.workflows_cache.get(candidate_name)
            if isinstance(cached_workflow, dict):
                return copy.deepcopy(cached_workflow)

        candidate_paths: list[Path] = []
        for candidate_name in candidate_names:
            candidate_paths.append(self.workflows_dir / candidate_name)
            candidate_paths.append(self.workflows_dir / "workflow" / candidate_name)

        path = next((candidate for candidate in candidate_paths if candidate.exists()), None)
        if path is None:
            msg = (
                f"Workflow template '{filename}' not found. "
                f"Checked: {', '.join(str(candidate) for candidate in candidate_paths)}"
            )
            raise FileNotFoundError(msg)

        cache_key = str(path.resolve())
        if cache_key not in self.workflows_cache:
            with path.open("r", encoding="utf-8") as workflow_file:
                self.workflows_cache[cache_key] = json.load(workflow_file)

        return copy.deepcopy(self.workflows_cache[cache_key])

    def _build_basic_text_to_image_workflow(
        self,
        prompt: str,
        negative_prompt: str,
        width: int,
        height: int,
        steps: int,
        cfg_scale: float,
        model: str,
        seed: int = -1,
    ) -> dict[str, Any]:
        ckpt_name = model if model.endswith(".safetensors") else f"{model}.safetensors"
        safe_prompt = prompt.strip() if prompt else "detailed, high quality, beautiful"
        safe_negative = negative_prompt.strip() if negative_prompt else "blurry, low quality, deformed, watermark"

        return {
            "1": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": safe_prompt, "clip": ["4", 1]},
            },
            "2": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": safe_negative, "clip": ["4", 1]},
            },
            "3": {
                "class_type": "EmptyLatentImage",
                "inputs": {"width": width, "height": height, "batch_size": 1},
            },
            "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt_name}},
            "5": {
                "class_type": "KSampler",
                "inputs": {
                    "seed": seed,
                    "steps": steps,
                    "cfg": cfg_scale,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1.0,
                    "model": ["4", 0],
                    "positive": ["1", 0],
                    "negative": ["2", 0],
                    "latent_image": ["3", 0],
                },
            },
            "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["4", 2]}},
            "7": {
                "class_type": "SaveImage",
                "inputs": {"filename_prefix": "comfyui_generated", "images": ["6", 0]},
            },
        }

    @staticmethod
    def _workflow_unet_names(workflow: dict[str, Any]) -> list[str]:
        names: list[str] = []
        for node in workflow.values():
            if not isinstance(node, dict) or node.get("class_type") != "UNETLoader":
                continue
            unet = str(node.get("inputs", {}).get("unet_name") or "").lower()
            if unet:
                names.append(unet)
        return names

    @staticmethod
    def _workflow_template_slug(workflow_template: str | None) -> str:
        return (workflow_template or "").strip().lower().removesuffix(".json")

    @classmethod
    def _workflow_is_z_image_turbo(
        cls,
        workflow: dict[str, Any],
        workflow_template: str | None,
    ) -> bool:
        slug = cls._workflow_template_slug(workflow_template)
        if slug in {"01_top", "z_image_turbo"} or "turbo" in slug or "lightning" in slug:
            return True
        return any("turbo" in unet or "lightning" in unet for unet in cls._workflow_unet_names(workflow))

    @classmethod
    def _workflow_is_flux2_klein_distilled(
        cls,
        workflow: dict[str, Any],
        workflow_template: str | None,
    ) -> bool:
        """Site Studio stills: Flux.2 Klein 4B distilled (not Klein base, not z-image)."""
        slug = cls._workflow_template_slug(workflow_template)
        if slug in {"site_studio_photo", "flux2_klein", "flux2_klein_distilled"}:
            return True
        return any("klein" in unet and "base" not in unet for unet in cls._workflow_unet_names(workflow))

    @classmethod
    def _workflow_preserves_sampler_params(
        cls,
        workflow: dict[str, Any],
        workflow_template: str | None,
    ) -> bool:
        """Few-step curated graphs must keep template sampler settings."""
        return cls._workflow_is_z_image_turbo(workflow, workflow_template) or cls._workflow_is_flux2_klein_distilled(
            workflow, workflow_template
        )

    def _apply_text_to_image_params(
        self,
        workflow: dict[str, Any],
        prompt: str,
        negative_prompt: str,
        width: int,
        height: int,
        steps: int,
        cfg_scale: float,
        model: str,
        seed: int = -1,
        workflow_template: str | None = None,
    ) -> None:
        logger.info(
            "ComfyUI _apply_text_to_image_params: width=%s, height=%s, steps=%s, cfg_scale=%s, seed=%s, model=%s",
            width,
            height,
            steps,
            cfg_scale,
            seed,
            model,
        )

        safe_prompt = prompt.strip() if prompt else ""
        safe_negative = negative_prompt.strip() if negative_prompt else ""

        if not safe_prompt:
            logger.warning("ComfyUI: empty prompt provided, using as-is (may result in grey image)")
        if not safe_negative:
            logger.debug("ComfyUI: Empty negative prompt provided, using as-is")

        original_seed = seed
        if seed == -1 or seed is None:
            max_seed_value = 2**31 - 1
            seed = secrets.randbelow(max_seed_value) + 1
            logger.info("ComfyUI: Generated random seed: %s (was: %s)", seed, original_seed)
        else:
            logger.debug("ComfyUI: Using provided seed: %s", seed)

        is_z_image = self._workflow_is_z_image_turbo(workflow, workflow_template)
        is_klein = self._workflow_is_flux2_klein_distilled(workflow, workflow_template)
        preserve_sampler = is_z_image or is_klein
        if is_z_image:
            snapped_w, snapped_h = snap_z_image_turbo_latent(width, height)
            if snapped_w != width or snapped_h != height:
                logger.info(
                    "ComfyUI: snap turbo latent %sx%s → %sx%s (z-image native; non-native yields glitch text)",
                    width,
                    height,
                    snapped_w,
                    snapped_h,
                )
            width, height = snapped_w, snapped_h
        elif is_klein:
            snapped_w, snapped_h = snap_flux2_klein_latent(width, height)
            if snapped_w != width or snapped_h != height:
                logger.info(
                    "ComfyUI: snap Flux2 Klein latent %sx%s → %sx%s (step 16)",
                    width,
                    height,
                    snapped_w,
                    snapped_h,
                )
            width, height = snapped_w, snapped_h
        # 01_top / Klein distilled use ConditioningZeroOut for negative — anti-text must live on positive.
        # Dedicated get_text_to_image_z_turbo_workflow already finalizes; generic path must too.
        if preserve_sampler and safe_prompt:
            finalized = _finalize_z_image_user_prompt(safe_prompt)
            if finalized != safe_prompt:
                logger.info(
                    "ComfyUI: applied z-image anti-text finalize for template=%s (prompt_len %s→%s)",
                    workflow_template,
                    len(safe_prompt),
                    len(finalized),
                )
            safe_prompt = finalized

        clip_nodes = []
        for node_id, node in workflow.items():
            if node.get("class_type") == "CLIPTextEncode":
                clip_nodes.append((node_id, node))

        for node_id, node in workflow.items():
            class_type = node.get("class_type", "")
            inputs = node.setdefault("inputs", {})

            if class_type == "KSampler":
                original_steps = inputs.get("steps", "NOT_SET")
                original_cfg = inputs.get("cfg", "NOT_SET")
                original_sampler = inputs.get("sampler_name", "NOT_SET")
                original_scheduler = inputs.get("scheduler", "NOT_SET")

                inputs["seed"] = seed
                if preserve_sampler:
                    logger.info(
                        "ComfyUI: KSampler node %s - seed=%s (SET), steps=%s (PRESERVE curated), "
                        "cfg=%s (PRESERVE curated), sampler=%s, scheduler=%s",
                        node_id,
                        seed,
                        original_steps,
                        original_cfg,
                        original_sampler,
                        original_scheduler,
                    )
                else:
                    inputs["steps"] = int(steps)
                    inputs["cfg"] = float(cfg_scale)
                    logger.info(
                        "ComfyUI: KSampler node %s - seed=%s (SET), steps=%s (SET, was %s), "
                        "cfg=%s (SET, was %s), sampler=%s, scheduler=%s",
                        node_id,
                        seed,
                        steps,
                        original_steps,
                        cfg_scale,
                        original_cfg,
                        original_sampler,
                        original_scheduler,
                    )

            elif class_type == "RandomNoise":
                inputs["noise_seed"] = seed
                logger.info("ComfyUI: RandomNoise node %s - noise_seed=%s", node_id, seed)

            elif class_type == "Flux2Scheduler":
                inputs["width"] = width
                inputs["height"] = height
                if preserve_sampler:
                    logger.info(
                        "ComfyUI: Flux2Scheduler node %s - size=%sx%s (SET), steps=%s (PRESERVE)",
                        node_id,
                        width,
                        height,
                        inputs.get("steps", "NOT_SET"),
                    )
                else:
                    inputs["steps"] = int(steps)
                    logger.info(
                        "ComfyUI: Flux2Scheduler node %s - size=%sx%s steps=%s (SET)",
                        node_id,
                        width,
                        height,
                        steps,
                    )

            elif class_type == "CFGGuider":
                if not preserve_sampler:
                    inputs["cfg"] = float(cfg_scale)

            elif "save" in class_type.lower():
                inputs.setdefault("filename_prefix", "ComfyUI")

        clip_nodes_sorted = sorted(clip_nodes, key=lambda x: int(x[0]) if x[0].isdigit() else 999)

        min_clip_nodes = 2
        if len(clip_nodes_sorted) >= min_clip_nodes:
            positive_node_id = clip_nodes_sorted[0][0]
            negative_node_id = clip_nodes_sorted[1][0]

            clip_nodes_sorted[0][1]["inputs"]["text"] = safe_prompt
            clip_nodes_sorted[1][1]["inputs"]["text"] = safe_negative

            prompt_preview_len = 100
            positive_preview = (
                f"{safe_prompt[:prompt_preview_len]}..." if len(safe_prompt) > prompt_preview_len else safe_prompt
            )
            negative_preview = (
                f"{safe_negative[:prompt_preview_len]}..." if len(safe_negative) > prompt_preview_len else safe_negative
            )
            logger.info(
                "ComfyUI: Set prompts - positive in node %s: '%s', negative in node %s: '%s'",
                positive_node_id,
                positive_preview,
                negative_node_id,
                negative_preview,
            )

            actual_positive = clip_nodes_sorted[0][1]["inputs"].get("text", "MISSING")
            actual_negative = clip_nodes_sorted[1][1]["inputs"].get("text", "MISSING")

            if actual_positive == "MISSING" or actual_negative == "MISSING":
                logger.error(
                    "CRITICAL: Prompts not set! Positive=%s, Negative=%s",
                    actual_positive,
                    actual_negative,
                )
            elif actual_positive != safe_prompt or actual_negative != safe_negative:
                error_preview_len = 50
                logger.error(
                    "CRITICAL: Prompt mismatch! Expected positive='%s...', got '%s...'",
                    safe_prompt[:error_preview_len],
                    actual_positive[:error_preview_len],
                )
            else:
                verified_preview_len = 50
                logger.info(
                    "Verified: Node %s text='%s...', Node %s text='%s...'",
                    positive_node_id,
                    actual_positive[:verified_preview_len],
                    negative_node_id,
                    actual_negative[:verified_preview_len],
                )

        elif len(clip_nodes_sorted) == 1:
            clip_nodes_sorted[0][1]["inputs"]["text"] = safe_prompt
            slug = self._workflow_template_slug(workflow_template)
            if slug in {"01_top", "site_studio_photo"} or is_z_image or is_klein:
                logger.debug(
                    "ComfyUI: Single CLIP workflow %s — positive set in node %s (negative not used by design)",
                    workflow_template,
                    clip_nodes_sorted[0][0],
                )
            else:
                logger.warning(
                    "ComfyUI: Only one CLIPTextEncode node found, set positive prompt in node %s",
                    clip_nodes_sorted[0][0],
                )
        else:
            logger.error("ComfyUI: No CLIPTextEncode nodes found in workflow!")

        for node_id, node in workflow.items():
            if node.get("class_type") in ("EmptyLatentImage", "EmptySD3LatentImage", "EmptyFlux2LatentImage"):
                inputs = node.setdefault("inputs", {})
                original_width = inputs.get("width", "NOT_SET")
                original_height = inputs.get("height", "NOT_SET")
                inputs["width"] = width
                inputs["height"] = height
                logger.info(
                    "ComfyUI: LatentImage node %s - width=%s (SET, was %s), height=%s (SET, was %s)",
                    node_id,
                    width,
                    original_width,
                    height,
                    original_height,
                )

        upscale_node = workflow.get("11")
        if upscale_node and upscale_node.get("class_type") == "ImageUpscaleWithModel":
            pass
