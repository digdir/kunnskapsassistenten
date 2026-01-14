"""Pytest configuration and shared fixtures.

LLM Test Caching with pytest-recording
=======================================

Tests marked with @pytest.mark.vcr automatically cache LLM API responses.

How it works:
- First run: Makes real API calls and saves responses to cassettes/
- Subsequent runs: Replays cached responses (no API calls, no cost)
- Cache key includes: model, temperature, messages, and all other parameters

Usage:
    @pytest.mark.vcr
    def test_my_llm_function():
        result = call_llm_api(...)
        assert result == expected

Commands:
    pytest                           # Run tests using cached responses
    pytest --record-mode=rewrite     # Re-record all cassettes (use when prompts change)
    pytest --record-mode=none        # Block all HTTP requests (cassettes must exist)
    pytest --block-network           # Same as above
    pytest -k test_name --record-mode=rewrite  # Re-record specific test

Tips:
- Use temperature=0 in tests for deterministic responses
- Commit cassettes/ to git so CI can use cached responses
- Re-record cassettes after changing prompts or LLM parameters
- Each unique request gets its own cassette entry
"""

import pytest


@pytest.fixture(scope="module")
def vcr_config() -> dict[str, any]:
    """Configure pytest-recording (VCR.py) for LLM response caching.

    This fixture caches HTTP requests/responses to cassette files, so:
    - First test run: Makes real API calls and records responses
    - Subsequent runs: Replays cached responses (no API calls, no cost)
    - Re-record with: pytest --record-mode=rewrite
    """
    return {
        # Match requests on method, URI, and full body (includes model, temp, messages)
        "match_on": ["method", "uri", "body"],
        # Filter out authorization headers from cassettes (security)
        "filter_headers": [("authorization", "REDACTED")],
        # Filter out sensitive query parameters
        "filter_query_parameters": [("api_key", "REDACTED")],
        # Decode compressed responses for readable cassettes
        "decode_compressed_response": True,
        # "ignore_localhost": False,
        # # Allow redirects
        # "allow_playback_repeats": True,
        # "before_record_request": lambda request: print(f"⚠️  HTTP REQUEST: {request.uri}")
        # or request,
    }


@pytest.fixture(scope="module")
def vcr_cassette_dir(request: pytest.FixtureRequest) -> str:
    """Directory where cassettes (cached responses) are stored."""
    # Store cassettes next to test files in a 'cassettes' subdirectory
    return str(request.path.parent / "cassettes")
