#!/usr/bin/env python
"""Test Azure OpenAI connection."""

import logging
import os

from dotenv import load_dotenv
from openai import AzureOpenAI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get configuration from environment
api_key = os.getenv("AZURE_OPENAI_API_KEY")
deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
api_version = os.getenv("OPENAI_API_VERSION")
endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
temperature = float(os.getenv("AZURE_OPENAI_TEMPERATURE", "0.0"))

# Validate required environment variables
if not all([api_key, deployment_name, api_version, endpoint]):
    raise ValueError(
        "Missing required environment variables. Please ensure the following are set:\n"
        "- AZURE_OPENAI_API_KEY\n"
        "- AZURE_OPENAI_DEPLOYMENT_NAME\n"
        "- OPENAI_API_VERSION\n"
        "- AZURE_OPENAI_ENDPOINT"
    )

logger.info("=== Azure OpenAI Configuration ===")
logger.info(f"Endpoint: {endpoint}")
logger.info(f"Deployment: {deployment_name}")
logger.info(f"API Version: {api_version}")
logger.info(f"Temperature: {temperature}")
logger.info("=================================\n")

# Create Azure OpenAI client
client = AzureOpenAI(
    api_key=api_key,
    api_version=api_version,
    azure_endpoint=endpoint,
    azure_deployment=deployment_name,
)

logger.info("Testing connection with a simple completion...")

try:
    # Make a test call
    # https://t-dss-open-ai-4.openai.azure.com/openai/deployments/gpt-4.1/chat/completions?api-version=2025-01-01-preview
    response = client.chat.completions.create(
        model=deployment_name,  # Use deployment name, not model name
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant that responds concisely.",
            },
            {
                "role": "user",
                "content": "Say 'Hello, Azure OpenAI is working!' in one sentence.",
            },
        ],
        temperature=temperature,
        max_tokens=50,
    )

    # Log response
    message = response.choices[0].message.content
    logger.info("✅ SUCCESS!")
    logger.info(f"Response: {message}")
    logger.info(f"Model used: {response.model}")

    # Log token usage if available
    if response.usage:
        logger.info(
            f"Tokens used: {response.usage.total_tokens} "
            f"(prompt: {response.usage.prompt_tokens}, completion: {response.usage.completion_tokens})"
        )

    logger.info("🎉 Azure OpenAI connection is working correctly!")

except Exception as e:
    logger.error(f"❌ ERROR: {e}")
    logger.error("Please check:")
    logger.error("  1. API key is correct")
    logger.error("  2. Endpoint URL is correct (should end with .openai.azure.com)")
    logger.error("  3. Deployment name matches your Azure deployment")
    logger.error("  4. API version is supported")
    raise
