"""Test suite for Cattleman API endpoints."""
import pytest
from fastapi.testclient import TestClient
from backend.server import app

client = TestClient(app)


class TestBreedsEndpoint:
    def test_get_breeds_returns_200(self):
        assert client.get("/api/breeds").status_code == 200
    def test_get_breeds_has_data(self):
        data = client.get("/api/breeds").json()
        assert "breeds" in data
        assert isinstance(data["breeds"], list)


class TestRecognizeEndpoint:
    def test_no_file_returns_422(self):
        assert client.post("/api/recognize").status_code == 422
    def test_with_image_returns_200(self):
        with open("tests/fixtures/sample.jpg","rb") as f:
            r = client.post("/api/recognize", files={"file":("cow.jpg",f,"image/jpeg")})
        assert r.status_code == 200
    def test_response_has_top_match(self):
        with open("tests/fixtures/sample.jpg","rb") as f:
            r = client.post("/api/recognize", files={"file":("cow.jpg",f,"image/jpeg")})
        data = r.json()
        assert "top_match" in data
        assert "breed" in data["top_match"]
        assert 0 <= data["top_match"]["confidence"] <= 1


class TestHistoryEndpoint:
    def test_history_returns_200(self):
        assert client.get("/api/history").status_code == 200
    def test_history_structure(self):
        data = client.get("/api/history").json()
        assert "entries" in data
        assert "total" in data


class TestErrorHandling:
    def test_non_image_file_returns_400(self):
        with open("tests/fixtures/sample.jpg","rb") as f:
            r = client.post("/api/recognize", files={"file":("test.txt",b"not an image","text/plain")})
        assert r.status_code == 400

    def test_big_file_returns_422(self):
        r = client.post("/api/recognize", files={"file":("big.jpg",b"x"*6*1024*1024,"image/jpeg")})
        assert r.status_code in (422,400)
