"""Development-only seed data script for Horizon Phase 2.

NOTE: This script creates realistic sample tasks strictly for development
and local demonstration purposes. It does not represent actual Loupe production data.
"""

import sys
from pathlib import Path
from geoalchemy2.elements import WKTElement

# Add apps/api to path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.database.session import SessionLocal
from app.database.models.user import User
from app.database.models.task import Task
from app.core.security import hash_password
from app.modules.tokens.service import grant_starter_tokens_idempotent

SAMPLE_TASKS = [
    {
        "title": "Community Water Source Survey",
        "description": "Verify the functionality, water clarity, and physical condition of the municipal hand pump.",
        "artifact_type": "water_source",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "difficulty": 2.0,
        "scarcity": 1.5,
        "base_reward": 150,
        "commitment_stake": 20,
        "estimated_effort_minutes": 25,
        "requirements": [
            "Wide-angle photo of water point and surrounding runoff",
            "Close-up photo of the pump valve mechanism",
            "Record operational status (functional / broken)",
        ],
        "status": "published",
    },
    {
        "title": "Community Education Center Boundary",
        "description": "Map the perimeter fence and record current access gates for the rural learning facility.",
        "artifact_type": "education_facility",
        "latitude": 18.5230,
        "longitude": 73.8610,
        "difficulty": 1.5,
        "scarcity": 1.2,
        "base_reward": 120,
        "commitment_stake": 15,
        "estimated_effort_minutes": 20,
        "requirements": [
            "Record coordinates at primary pedestrian entrance",
            "Photo of entrance signage and road connectivity",
        ],
        "status": "published",
    },
    {
        "title": "Local Sacred Heritage Site",
        "description": "Document external boundary coordinates and access pathways without capturing restricted interior structures.",
        "artifact_type": "cultural_heritage",
        "latitude": 18.5280,
        "longitude": 73.8520,
        "difficulty": 3.0,
        "scarcity": 2.0,
        "base_reward": 200,
        "commitment_stake": 25,
        "estimated_effort_minutes": 45,
        "requirements": [
            "Confirm perimeter stone marker positions",
            "Document public trail condition leading to site",
        ],
        "status": "published",
    },
    {
        "title": "Unmapped Archaeological Feature",
        "description": "Inspect newly identified terrace wall structure exposed by seasonal erosion.",
        "artifact_type": "archaeological_terrace",
        "latitude": 18.5350,
        "longitude": 73.8480,
        "difficulty": 3.5,
        "scarcity": 2.5,
        "base_reward": 280,
        "commitment_stake": 35,
        "estimated_effort_minutes": 50,
        "requirements": [
            "High-resolution photos with physical scale reference",
            "Record GPS accuracy reading below 3 meters",
        ],
        "status": "published",
    },
    {
        "title": "Community Gathering Point Audit",
        "description": "Survey the open market pavilion ground condition and verify shaded seating capacity.",
        "artifact_type": "gathering_point",
        "latitude": 18.5170,
        "longitude": 73.8590,
        "difficulty": 1.0,
        "scarcity": 1.0,
        "base_reward": 80,
        "commitment_stake": 10,
        "estimated_effort_minutes": 15,
        "requirements": [
            "Wide panoramic photo of the pavilion",
            "Verify ground surface material (concrete / dirt)",
        ],
        "status": "published",
    },
]


def seed_database():
    db = SessionLocal()
    try:
        print("[SEED] Seeding development dataset...")

        # 1. Seed Admin User
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                email="admin@horizon.dev",
                username="admin",
                display_name="System Administrator",
                hashed_password=hash_password("AdminSecure2026!"),
                role="admin",
                status="active",
            )
            db.add(admin)
            db.flush()
            grant_starter_tokens_idempotent(db, admin)
            print("  -> Created admin user: admin@horizon.dev / AdminSecure2026!")

        # 2. Seed Contributor User
        contributor = db.query(User).filter(User.username == "scout_alex").first()
        if not contributor:
            contributor = User(
                email="alex@horizon.dev",
                username="scout_alex",
                display_name="Alex River",
                hashed_password=hash_password("ScoutPass2026!"),
                role="contributor",
                status="active",
            )
            db.add(contributor)
            db.flush()
            grant_starter_tokens_idempotent(db, contributor)
            print("  -> Created demo contributor: alex@horizon.dev / ScoutPass2026! (100 Starter Tokens)")

        # 3. Seed Sample Tasks
        for data in SAMPLE_TASKS:
            existing = db.query(Task).filter(Task.title == data["title"]).first()
            if not existing:
                point_wkt = WKTElement(f"POINT({data['longitude']} {data['latitude']})", srid=4326)
                task = Task(
                    title=data["title"],
                    description=data["description"],
                    artifact_type=data["artifact_type"],
                    difficulty=data["difficulty"],
                    scarcity=data["scarcity"],
                    base_reward=data["base_reward"],
                    commitment_stake=data["commitment_stake"],
                    estimated_effort_minutes=data["estimated_effort_minutes"],
                    requirements=data["requirements"],
                    status=data["status"],
                    location_point=point_wkt,
                )
                db.add(task)
                print(f"  -> Added sample task: {data['title']}")

        db.commit()
        print("[SEED] Successfully seeded development database.")
    except Exception as exc:
        db.rollback()
        print(f"[SEED ERROR] Failed to seed database: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
