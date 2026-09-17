import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure services/ai directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
