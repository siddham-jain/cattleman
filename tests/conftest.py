"""Shared test fixtures.

The API talks to MongoDB at import time, so without a stand-in the suite only
passes on a machine that happens to have mongod running — six of nine tests
failed that way. Swapping in an in-memory mock keeps the tests hermetic and lets
them run in CI.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend import server  # noqa: E402



@pytest.fixture
def client():
    """A TestClient backed by an in-memory database, with startup run.

    Entering the context manager fires the startup event, so the breed
    catalogue is seeded exactly as it would be against a real database.
    """
    server.db = AsyncMongoMockClient()["cattleman_test"]
    with TestClient(server.app) as test_client:
        yield test_client


@pytest.fixture
def sample_image_bytes():
    with open(os.path.join(os.path.dirname(__file__), "fixtures", "sample.jpg"), "rb") as handle:
        return handle.read()
