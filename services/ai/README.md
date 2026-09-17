# Horizon AI Verification Service

> Python-based machine learning and computer vision verification service.

---

## Architecture & Responsibilities

- **Isolated AI Signals:** Isolated Python service providing fast, deterministic, and ML-assisted signals (image classification, object detection, anti-spoofing, spatial consistency).
- **Authoritative Boundary:** AI outputs confidence scores and detection masks. It **never** directly approves tasks or distributes tokens; the core API evaluates signals authoritatively.
- **Inference Pipelines:** Batch and real-time processing pipelines for submission media, satellite-to-ground cross-referencing, and duplicate image detection.

---

## Directory Structure

```text
services/ai/
├── app/
│   ├── models/          # Model wrapper classes, weights loaders, ONNX/PyTorch runners
│   ├── pipelines/       # Multi-stage verification pipelines
│   ├── inference/       # Inference engines and batch predictors
│   ├── preprocessing/   # Image normalization, EXIF extraction, spatial alignment
│   ├── postprocessing/  # Confidence calibration, bounding box NMS, signal aggregation
│   ├── schemas/         # Pydantic request/response schemas
│   ├── services/        # Verification services, anti-spoofing, quality assessment
│   ├── utils/           # Image IO, spatial math, hashing, logging
│   └── config/          # Service settings and environment management
│
└── tests/               # Unit, pipeline, and benchmark tests
```
