import logging
from sqlalchemy.orm import Session
from app.database.base import Base
from app.database.session import engine, SessionLocal
from app.database.models.user import User
from app.database.models.task import Task
from app.core.security import hash_password
from app.modules.tokens.service import grant_starter_tokens_idempotent
from geoalchemy2.elements import WKTElement

logger = logging.getLogger(__name__)

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
        "title": "Solar Mini-Grid Installation Check",
        "description": "Inspect photovoltaic panel array cleanliness, battery enclosure seal integrity, and inverter display codes.",
        "artifact_type": "renewable_energy",
        "latitude": 18.5150,
        "longitude": 73.8500,
        "difficulty": 2.5,
        "scarcity": 1.8,
        "base_reward": 180,
        "commitment_stake": 20,
        "estimated_effort_minutes": 35,
        "requirements": [
            "Clear photo of inverter digital diagnostics readout",
            "Verify perimeter safety fencing is intact",
            "Note any visible panel shading or degradation",
        ],
        "status": "published",
    },
    {
        "title": "Urban Flood Drainage Channel",
        "description": "Assess monsoon drainage culvert blockages, debris accumulation, and structural concrete stability.",
        "artifact_type": "drainage_infrastructure",
        "latitude": 18.5300,
        "longitude": 73.8650,
        "difficulty": 2.0,
        "scarcity": 1.4,
        "base_reward": 140,
        "commitment_stake": 15,
        "estimated_effort_minutes": 30,
        "requirements": [
            "Measure estimated silt depth at culvert mouth",
            "Photo documenting upstream water flow clearance",
        ],
        "status": "published",
    },
]


def init_database() -> None:
    """Ensure database schema is created and default dev users/tasks exist."""
    try:
        # Create all tables if they don't exist
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema verified.")
    except Exception as exc:
        logger.warning(f"Database schema auto-creation notice: {exc}")

    db: Session = SessionLocal()
    try:
        # 1. Ensure Admin User
        admin = db.query(User).filter((User.username == "admin") | (User.email == "admin@horizon.dev")).first()
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
            logger.info("Seeded admin user: admin@horizon.dev / AdminSecure2026!")

        # 2. Ensure Contributor User (support both ScoutPass2026! and Contributor123!)
        contributor = db.query(User).filter((User.username == "scout_alex") | (User.email == "alex@horizon.dev")).first()
        if not contributor:
            contributor = User(
                email="alex@horizon.dev",
                username="scout_alex",
                display_name="Alex River",
                hashed_password=hash_password("Contributor123!"),
                role="contributor",
                status="active",
            )
            db.add(contributor)
            db.flush()
            grant_starter_tokens_idempotent(db, contributor)
            logger.info("Seeded contributor user: scout_alex / Contributor123!")

        # 3. Ensure Sample Tasks
        for data in SAMPLE_TASKS:
            existing = db.query(Task).filter(Task.title == data["title"]).first()
            if not existing:
                lng = data["longitude"]
                lat = data["latitude"]
                point_wkt = WKTElement(f"POINT({lng} {lat})", srid=4326)
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
                logger.info(f"Seeded task: {data['title']}")

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(f"Database seed notice: {exc}")
    finally:
        db.close()
