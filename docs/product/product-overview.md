# Horizon — Product Overview

> **Product:** Horizon  
> **Ecosystem:** EarthLens / Loupe Community Contribution Layer  
> **Status:** Phase 1 Foundation Specification  

---

## 1. Problem Statement

High-value geospatial intelligence systems require reliable, georeferenced, ground-truth observations. Satellite imagery and remote sensing provide macro-level views but frequently suffer from:
- Resolution limits (inability to inspect structural conditions, culvert blockages, or ground-level signage).
- Latency (infrequent revisit rates for specific micro-geographies).
- Ground ambiguity (uncertainty regarding physical access, surface material, or localized barrier status).

Traditional crowdsourcing efforts fail because they lack offline-first support in austere environments, lack cryptographic commitment mechanisms to prevent duplicate effort or spam, and lack rigorous multi-stage verification before data enters production analytics pipelines.

---

## 2. The Horizon Solution

**Horizon** is a task-driven geospatial community contribution platform. It converts geographic intelligence gaps into targeted, bounded tasks that local contributors claim, document on the ground, and submit through an offline-resilient mobile client.

Crucially:
- **Horizon is the community contribution layer.**
- **EarthLens is NOT a contributor reward/access destination.**
- Horizon produces verified, structured, audit-ready data feeds specifically for **Loupe's downstream geospatial intelligence systems**.

---

## 3. Core Product Workflow

```text
JOIN
  └──> STARTER TOKENS
        └──> DISCOVER TASK
              └──> COMMIT TO TASK (STAKE)
                    └──> DOCUMENT (OFFLINE GPS + FORM + MEDIA)
                          └──> SUBMIT (BATCH SYNC)
                                └──> VALIDATE (SCHEMA & BOUNDS)
                                      └──> VERIFY (AI + HUMAN CONSENSUS)
                                            └──> REWARD (STAKE RETURN + BOUNTY)
                                                  └──> VERIFIED GEOSPATIAL DATA
                                                        └──> LOUPE INGESTION
```

---

## 4. Contributor Role & Lifecycle

1. **Onboarding & Starter Grant:**  
   Every verified contributor receives an initial allocation of **Starter Tokens** (e.g., 100 tokens). This allowance enables them to begin participating immediately without financial friction while maintaining accountability.

2. **Task Discovery & Commitment:**  
   Contributors browse active tasks geographically. To reserve an exclusive work window and prevent redundant effort across contributors, the contributor commits a **Task Stake** (e.g., 10–15 tokens) locked in escrow.

3. **Ground-Truth Documentation:**  
   In the field, often outside cellular coverage, the contributor captures high-accuracy GPS coordinates, photos from specified angles, and structured form fields conforming to the task's dynamic schema.

4. **Submission & Settlement:**  
   When the contributor reconnects to a network, their local submission queue securely transmits the bundle to the authoritative backend.

---

## 5. Verification Concept

Raw contributor submissions are never treated as trusted data until they pass multi-stage verification:

1. **Deterministic Validation:**  
   - Schema conformance checks.
   - PostGIS spatial boundary containment (the submission coordinate must lie within the task's defined polygon).
   - EXIF temporal and sensor telemetry validation.

2. **AI-Assisted Verification Signals:**  
   - Anti-spoofing and duplicate detection (pHash against existing media catalog).
   - Semantic classification and quality scoring (e.g. MobileNetV3 / MobileCLIP / DINOv2).
   - Anomaly detection against localized contributor history.

3. **Peer / Expert Review:**  
   - Ambiguous or high-stake tasks are surfaced to the Reviewer Dashboard for human-in-the-loop sign-off.

---

## 6. Internal Token Economy & Reputation

- **Closed Product Economy:** Tokens are an internal utility and staking mechanism, not an external cryptocurrency or speculative asset.
- **Commitment Staking:** Staking ensures contributors have "skin in the game" and discourages frivolous claims or abandoned tasks.
- **Reward Formula:**  
  $$\text{Reward} = \text{Base Value} \times \text{Difficulty} \times \text{Scarcity} \times \text{Quality} + \text{Returned Stake}$$
- **Server Authoritative Ledger:** Balances and transactions are calculated and signed exclusively on the backend in an immutable, append-only ledger (`TokenTransaction`).
- **Reputation Score:** Persistent metric that tracks historical verification accuracy, unlocking higher-tier tasks and higher base allowances over time.
