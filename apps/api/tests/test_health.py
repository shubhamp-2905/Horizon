def test_root_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "horizon-api"
    assert data["version"] == "0.1.0"
    assert data["status"] in ["ok", "degraded"]
    assert "database" in data
    assert "environment" in data


def test_v1_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "horizon-api"
    assert data["version"] == "0.1.0"
    assert data["status"] in ["ok", "degraded"]
    assert "database" in data
