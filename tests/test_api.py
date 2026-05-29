"""Test suite for Cattleman API endpoints."""
from backend.server import BREED_CATALOG


class TestBreedsEndpoint:
    def test_get_breeds_returns_200(self, client):
        assert client.get("/api/breeds").status_code == 200

    def test_get_breeds_has_data(self, client):
        data = client.get("/api/breeds").json()
        assert "breeds" in data
        assert isinstance(data["breeds"], list)

    def test_catalogue_is_seeded_on_startup(self, client):
        breeds = client.get("/api/breeds").json()["breeds"]
        assert {b["name"] for b in breeds} == set(BREED_CATALOG)

    def test_breed_entries_carry_metadata(self, client):
        breeds = client.get("/api/breeds").json()["breeds"]
        for breed in breeds:
            assert breed["type"] in {"cattle", "buffalo"}
            assert breed["traits"] and breed["origin"]


class TestRecognizeEndpoint:
    def test_no_file_returns_422(self, client):
        assert client.post("/api/recognize").status_code == 422

    def test_with_image_returns_200(self, client, sample_image_bytes):
        response = client.post("/api/recognize",
                               files={"file": ("cow.jpg", sample_image_bytes, "image/jpeg")})
        assert response.status_code == 200

    def test_response_has_top_match(self, client, sample_image_bytes):
        data = client.post("/api/recognize",
                           files={"file": ("cow.jpg", sample_image_bytes, "image/jpeg")}).json()
        assert "top_match" in data
        assert "breed" in data["top_match"]
        assert 0 <= data["top_match"]["confidence"] <= 1

    def test_results_are_ranked_by_confidence(self, client, sample_image_bytes):
        data = client.post("/api/recognize",
                           files={"file": ("cow.jpg", sample_image_bytes, "image/jpeg")}).json()
        confidences = [r["confidence"] for r in data["results"]]
        assert confidences == sorted(confidences, reverse=True)
        assert data["top_match"]["breed"] == data["results"][0]["breed"]

    def test_predicted_breeds_are_in_catalogue(self, client, sample_image_bytes):
        data = client.post("/api/recognize",
                           files={"file": ("cow.jpg", sample_image_bytes, "image/jpeg")}).json()
        for result in data["results"]:
            assert result["breed"] in BREED_CATALOG


class TestHistoryEndpoint:
    def test_history_returns_200(self, client):
        assert client.get("/api/history").status_code == 200

    def test_history_structure(self, client):
        data = client.get("/api/history").json()
        assert "entries" in data
        assert "total" in data

    def test_recognition_is_recorded(self, client, sample_image_bytes):
        assert client.get("/api/history").json()["total"] == 0
        client.post("/api/recognize",
                    files={"file": ("cow.jpg", sample_image_bytes, "image/jpeg")})
        history = client.get("/api/history").json()
        assert history["total"] == 1
        assert history["entries"][0]["filename"] == "cow.jpg"

    def test_pagination_limits_results(self, client, sample_image_bytes):
        for _ in range(3):
            client.post("/api/recognize",
                        files={"file": ("cow.jpg", sample_image_bytes, "image/jpeg")})
        data = client.get("/api/history", params={"limit": 2}).json()
        assert data["total"] == 3
        assert len(data["entries"]) == 2


class TestErrorHandling:
    def test_non_image_file_returns_400(self, client):
        response = client.post("/api/recognize",
                               files={"file": ("test.txt", b"not an image", "text/plain")})
        assert response.status_code == 400

    def test_empty_file_returns_400(self, client):
        response = client.post("/api/recognize",
                               files={"file": ("empty.jpg", b"", "image/jpeg")})
        assert response.status_code == 400

    def test_big_file_returns_400(self, client):
        response = client.post("/api/recognize",
                               files={"file": ("big.jpg", b"x" * 6 * 1024 * 1024, "image/jpeg")})
        assert response.status_code == 400
