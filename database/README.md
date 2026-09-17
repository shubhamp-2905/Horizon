# Horizon Database Management

> PostgreSQL + PostGIS spatial database migrations, seed datasets, and management scripts.

---

## Directory Structure

```text
database/
├── migrations/    # SQL / ORM migration files (tables, PostGIS extensions, spatial indices)
├── seeds/         # Test fixtures, initial admin accounts, sample spatial campaigns
└── scripts/       # Backup, restore, replication, and spatial maintenance scripts
```

---

## Database Architecture Guidelines

- **Spatial Data:** All geographic coordinates and geometries are stored in native PostGIS columns (`geometry(Point, 4326)`, `geometry(Polygon, 4326)`) with `GIST` spatial indexing.
- **Media References:** Only object storage URLs/keys and cryptographic hashes (SHA-256) are stored in the database.
- **Ledger Invariance:** The token transaction ledger is strictly append-only.
