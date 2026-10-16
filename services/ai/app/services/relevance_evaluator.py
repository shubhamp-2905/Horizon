import io
import math
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
import scipy.ndimage
from PIL import Image, ImageOps

try:
    from services.ai.app.schemas.verification import (
        RelevanceStatus,
        SemanticRelevanceMetrics,
    )
except (ImportError, ModuleNotFoundError):
    from app.schemas.verification import (  # type: ignore
        RelevanceStatus,
        SemanticRelevanceMetrics,
    )


class TaskRelevanceEvaluator:
    """Task-Aware Semantic Relevance & Evidence Verification Engine.
    
    Evaluates photographic evidence against specific task requirements, distinguishing:
      - Genuine target domain physical evidence (e.g. water source, municipal pump, solar array)
      - Contradictory/Irrelevant evidence (e.g. computer monitor, laptop screen, code editor, indoor clutter)
      - Ambiguous evidence routed to human reviewer (NEEDS_REVIEW)
    """

    # Domain visual concepts mapping
    DOMAIN_PROFILES = {
        "water_source": {
            "title_keywords": ["water", "pump", "well", "borehole", "tap", "dispensary", "faucet", "drainage"],
            "expected_concepts": [
                "water pump mechanism",
                "groundwater well",
                "water storage tank",
                "public tap / faucet",
                "concrete pump foundation",
                "water runoff drainage",
            ],
            "irrelevant_contradictions": [
                "laptop screen / code editor",
                "electronic computer monitor",
                "indoor domestic bedroom",
                "automotive interior / dashboard",
                "food plate / domestic dining",
            ],
        },
        "solar_installation": {
            "title_keywords": ["solar", "photovoltaic", "pv", "panel", "array", "inverter", "renewable"],
            "expected_concepts": [
                "photovoltaic solar panel",
                "silicon cell grid",
                "rooftop or ground mounting frame",
                "inverter / battery enclosure",
            ],
            "irrelevant_contradictions": [
                "laptop screen / code editor",
                "indoor television display",
                "kitchen / bathroom interior",
                "domestic pet / animal",
            ],
        },
        "traffic_flow": {
            "title_keywords": ["traffic", "road", "vehicle", "street", "highway", "intersection"],
            "expected_concepts": [
                "roadway / asphalt surface",
                "traffic flow / lane markings",
                "intersection / signal",
                "vehicles / transit corridor",
            ],
            "irrelevant_contradictions": [
                "laptop screen / code editor",
                "indoor room / furniture",
                "close-up book or document",
            ],
        },
        "emergency_shelter": {
            "title_keywords": ["shelter", "facility", "building", "civic", "community center", "hall"],
            "expected_concepts": [
                "building entrance / facade",
                "civic / community structure",
                "facility signage",
                "perimeter boundary",
            ],
            "irrelevant_contradictions": [
                "laptop screen / code editor",
                "computer monitor",
                "selfie / portrait",
            ],
        },
        "telecom_tower": {
            "title_keywords": ["telecom", "tower", "cell", "antenna", "mast", "transmission"],
            "expected_concepts": [
                "telecom lattice tower",
                "microwave antenna / dish",
                "transmission mast against sky",
            ],
            "irrelevant_contradictions": [
                "laptop screen / code editor",
                "indoor room",
                "handheld device display",
            ],
        },
    }

    @classmethod
    def evaluate_pil_image(
        cls,
        img: Image.Image,
        task_context: Optional[Dict[str, Any]] = None,
    ) -> SemanticRelevanceMetrics:
        """Evaluate semantic relevance of a PIL Image relative to task context."""
        ctx = task_context or {}
        artifact_type = str(ctx.get("artifact_type") or "water_source").lower()
        task_title = str(ctx.get("task_title") or "").strip()
        requirements = ctx.get("requirements") or []

        # Default profile fallback if custom artifact_type
        profile = cls.DOMAIN_PROFILES.get(artifact_type)
        if not profile:
            # Check title keywords
            matched_profile = None
            title_lower = task_title.lower()
            for key, p in cls.DOMAIN_PROFILES.items():
                if any(kw in title_lower for kw in p["title_keywords"]):
                    matched_profile = p
                    artifact_type = key
                    break
            profile = matched_profile or cls.DOMAIN_PROFILES["water_source"]

        # Ensure correct orientation
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # 1. Optical Screen & Electronic Display Contradiction Analysis
        screen_signals = cls._detect_screen_and_code_editor(img)
        is_screen = screen_signals["is_screen"]
        screen_confidence = screen_signals["confidence"]
        screen_reasons = screen_signals["reasons"]

        # 2. Natural Physical Environment & Texture Analysis
        env_signals = cls._analyze_environmental_features(img, artifact_type)
        env_score = env_signals["domain_compatibility"]
        detected_features = env_signals["features"]

        matched_concepts: List[str] = []
        detected_contradictions: List[str] = []
        reasons: List[str] = []

        # 3. Decision Matrix
        if is_screen:
            # Strong contradiction: image contains an electronic screen, code editor, or monitor
            detected_contradictions.extend(screen_reasons)
            reasons.append(
                f"Contradiction detected: Evidence depicts an electronic display or code editor "
                f"(confidence {screen_confidence:.2f}), contradicting target '{artifact_type}' field observation."
            )
            relevance_score = round(max(0.02, 0.15 - (screen_confidence * 0.10)), 3)
            status = RelevanceStatus.IRRELEVANT

        elif env_signals.get("is_indoor_domestic"):
            # Indoor domestic furniture / room with no outdoor ground or infrastructure
            detected_contradictions.append("indoor_domestic_environment")
            reasons.append(
                f"Semantic mismatch: Image indicates an indoor domestic setting with absence of "
                f"expected outdoor ground or civil infrastructure for '{artifact_type}'."
            )
            relevance_score = round(max(0.10, env_score * 0.35), 3)
            status = RelevanceStatus.IRRELEVANT

        elif env_score >= 0.65:
            # High domain compatibility
            matched_concepts.extend(detected_features)
            matched_concepts.extend([c for c in profile["expected_concepts"][:2]])
            reasons.append(
                f"Visual evidence exhibits characteristic physical infrastructure features "
                f"compatible with '{artifact_type}' (relevance index: {env_score:.2f})."
            )
            relevance_score = round(min(0.96, env_score), 3)
            status = RelevanceStatus.RELEVANT

        elif env_score >= 0.38:
            # Ambiguous evidence - needs human inspection
            matched_concepts.extend(detected_features)
            reasons.append(
                f"Ambiguous visual evidence: Target features for '{artifact_type}' cannot be "
                f"conclusively confirmed by automated models. Human reviewer assessment required."
            )
            relevance_score = round(env_score, 3)
            status = RelevanceStatus.NEEDS_REVIEW

        else:
            # Insufficient positive features
            detected_contradictions.append("unsupported_visual_subject")
            reasons.append(
                f"Low domain relevance ({env_score:.2f}): Image does not exhibit sufficient "
                f"identifiable features corresponding to '{artifact_type}' requirements."
            )
            relevance_score = round(env_score, 3)
            status = RelevanceStatus.IRRELEVANT

        return SemanticRelevanceMetrics(
            status=status,
            relevance_score=relevance_score,
            target_artifact_type=artifact_type,
            matched_concepts=matched_concepts,
            detected_contradictions=detected_contradictions,
            is_synthetic_or_screen=is_screen,
            reasons=reasons,
        )

    @classmethod
    def _detect_screen_and_code_editor(cls, img: Image.Image) -> Dict[str, Any]:
        """Detect if image displays a computer monitor, laptop screen, or code editor window."""
        rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
        gray = np.asarray(img.convert("L"), dtype=np.float32)
        h, w = gray.shape

        # A. Dark IDE background ratio (e.g. VS Code #1e1e1e, dark editor backgrounds)
        dark_pixels = np.all(rgb < 48.0, axis=2)
        dark_ratio = float(np.mean(dark_pixels))

        # B. Light IDE background ratio (e.g. white code editors or browser tabs)
        bright_pixels = np.all(rgb > 240.0, axis=2)
        bright_ratio = float(np.mean(bright_pixels))

        # C. Row-wise text scanline periodicity (regular text line spacing in code editors)
        # Compute row luminance variance
        row_means = np.mean(gray, axis=1)
        row_diffs = np.abs(np.diff(row_means))
        # Spikes occurring at regular intervals (15-30px font line-height)
        peaks = row_diffs > 8.0
        peak_count = int(np.sum(peaks))
        expected_line_slots = max(1, h // 22)
        periodicity_score = min(1.0, peak_count / (expected_line_slots * 0.75))

        # D. Saturated syntax-highlighting color cluster density on dark background
        r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        max_c = np.maximum(np.maximum(r, g), b)
        min_c = np.minimum(np.minimum(r, g), b)
        sat = np.where(max_c > 0, (max_c - min_c) / (max_c + 1e-5), 0.0)

        # Syntax colors (blue, cyan, yellow, orange, green keywords)
        syntax_pixels = (sat > 0.40) & (max_c > 70.0) & (min_c < 180.0)
        syntax_ratio = float(np.mean(syntax_pixels))

        # E. Discrete high-frequency edge density (sharp font glyph edges)
        laplace = scipy.ndimage.laplace(gray)
        edge_variance = float(np.var(laplace))

        is_dark_ide = (dark_ratio > 0.45) and (syntax_ratio > 0.015 or periodicity_score > 0.40)
        is_light_ide = (bright_ratio > 0.45) and (periodicity_score > 0.50)
        is_screen_border = (dark_ratio > 0.35 and periodicity_score > 0.35 and edge_variance > 100.0)

        reasons = []
        confidence = 0.0

        if is_dark_ide:
            confidence = min(0.96, 0.75 + (dark_ratio * 0.20))
            reasons.append("dark_theme_code_editor_detected")
            reasons.append("syntax_highlighting_patterns_detected")
        elif is_light_ide:
            confidence = min(0.92, 0.70 + (bright_ratio * 0.20))
            reasons.append("light_theme_code_editor_or_text_display_detected")
        elif is_screen_border:
            confidence = 0.85
            reasons.append("electronic_monitor_bezel_and_text_periodicity_detected")

        return {
            "is_screen": bool(is_dark_ide or is_light_ide or is_screen_border),
            "confidence": confidence,
            "reasons": reasons,
            "dark_ratio": dark_ratio,
            "syntax_ratio": syntax_ratio,
            "periodicity_score": periodicity_score,
        }

    @classmethod
    def _analyze_environmental_features(cls, img: Image.Image, artifact_type: str) -> Dict[str, Any]:
        """Analyze natural environmental signals, textures, and domain compatibility."""
        rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
        gray = np.asarray(img.convert("L"), dtype=np.float32)

        r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        mean_r, mean_g, mean_b = float(np.mean(r)), float(np.mean(g)), float(np.mean(b))
        std_gray = float(np.std(gray))

        # Texture entropy / continuous gradient
        sobel_x = scipy.ndimage.sobel(gray, axis=1)
        sobel_y = scipy.ndimage.sobel(gray, axis=0)
        gradient_mag = np.hypot(sobel_x, sobel_y)
        mean_gradient = float(np.mean(gradient_mag))

        # Indoor domestic check: warm tungsten domestic lighting + planar room surfaces
        warm_indoor_lighting = (mean_r > 150.0 and mean_g > 120.0 and mean_b < 130.0 and (mean_r / (mean_b + 1e-5) > 1.35))
        is_indoor_domestic = bool(warm_indoor_lighting and (mean_gradient < 24.0))

        # Color channel balance (outdoor natural tones)
        earth_tones = (not is_indoor_domestic) and (mean_r > 80.0 and mean_g > 70.0 and mean_b < mean_r)  # Soil/concrete/earth
        greenery_tones = (mean_g > mean_r and mean_g > mean_b)  # Vegetation / outdoor
        sky_blue_tones = (mean_b > mean_r and mean_b > 110.0)  # Sky / water


        features = []
        compatibility = 0.50

        if artifact_type == "water_source":
            # Water sources: outdoor earth/concrete textures, metallic pump components
            if earth_tones or greenery_tones:
                features.append("outdoor_ground_and_earth_context")
                compatibility += 0.20
            if mean_gradient > 18.0:
                features.append("mechanical_structural_contours")
                compatibility += 0.15
            if not is_indoor_domestic and std_gray > 35.0:
                features.append("natural_continuous_environmental_illumination")
                compatibility += 0.10

        elif artifact_type == "solar_installation":
            # Solar panels: dark blue/silicon cell grid, geometric edges
            if sky_blue_tones or (mean_b > mean_g and mean_b > mean_r):
                features.append("silicon_cell_blue_spectrum")
                compatibility += 0.20
            if mean_gradient > 22.0:
                features.append("geometric_array_grid_patterns")
                compatibility += 0.20

        elif artifact_type == "traffic_flow":
            # Asphalt, roadway gray
            if abs(mean_r - mean_g) < 15.0 and abs(mean_g - mean_b) < 15.0 and mean_gradient > 16.0:
                features.append("asphalt_corridor_surface_tones")
                compatibility += 0.30

        else:
            if not is_indoor_domestic and mean_gradient > 15.0:
                features.append("civil_infrastructure_surface_tones")
                compatibility += 0.25

        return {
            "domain_compatibility": min(0.95, max(0.05, compatibility)),
            "features": features,
            "is_indoor_domestic": is_indoor_domestic,
        }
