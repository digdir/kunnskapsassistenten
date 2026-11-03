import logging

from deepeval.models.base_model import DeepEvalBaseLLM
from langfuse.openai import OpenAI

logger = logging.getLogger(__name__)


class CustomOllamaModel(DeepEvalBaseLLM):
    """Custom DeepEval model wrapper for Ollama."""

    def __init__(self, base_url: str, model_name: str):
        self.base_url = base_url
        self.model_name = model_name
        self.client = OpenAI(
            base_url=base_url,
            api_key="ollama",  # Dummy key for ollama
        )

    def load_model(self) -> "CustomOllamaModel":
        """Load and return the model instance."""
        return self

    def generate(self, prompt: str) -> str:
        """
        Generate text from a prompt.

        Args:
            prompt: Input prompt.

        Returns:
            Generated text.
        """
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.choices[0].message.content
        if content is None:
            raise ValueError("Model returned None response")
        return content

    async def a_generate(self, prompt: str) -> str:
        """
        Async generate text from a prompt.

        Args:
            prompt: Input prompt.

        Returns:
            Generated text.
        """
        # DeepEval requires this method but we'll use sync version
        return self.generate(prompt)

    def get_model_name(self) -> str:
        """Return the model name."""
        return self.model_name


def create_llm_client(ollama_base_url: str, model_name: str) -> CustomOllamaModel:
    """
    Create custom DeepEval model pointing to Ollama.

    Args:
        ollama_base_url: Ollama server URL.
        model_name: Model name to use (e.g., gpt-oss:120b-cloud).

    Returns:
        Custom model configured for Ollama.
    """
    client = CustomOllamaModel(ollama_base_url, model_name)
    logger.info(f"Created LLM client for {ollama_base_url} with model {model_name}")
    return client
