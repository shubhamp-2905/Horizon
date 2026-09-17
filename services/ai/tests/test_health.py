def test_ai_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "horizon-ai"
    assert data["version"] == "0.1.0"
    assert "environment" in data
    assert "device" in data
