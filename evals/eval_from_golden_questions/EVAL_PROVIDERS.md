# Evaluation LLM Provider Configuration

The evaluation system now supports multiple LLM providers for running DeepEval metrics.

## Supported Providers

1. **Ollama** (local models)
2. **OpenAI** (API)
3. **Azure OpenAI** (API)

## Configuration

### 1. Ollama (Default)

Use local Ollama models for evaluation:

```bash
# .env
EVAL_LLM_PROVIDER=ollama
EVAL_OLLAMA_BASE_URL=http://localhost:11434/v1
EVAL_OLLAMA_MODEL=gpt-oss:20b  # or any local model
```

**Recommended models:**
- `akx/viking-7b:latest` - Norwegian-tuned, good for Nordic content
- `deepseek-r1:latest` (8B) - Fast, good reasoning
- `gpt-oss:20b` - More accurate, still faster than 120B

### 2. OpenAI

Use OpenAI's API models:

```bash
# .env
EVAL_LLM_PROVIDER=openai
EVAL_OLLAMA_MODEL=gpt-4o-mini  # or gpt-4o, gpt-3.5-turbo
OPENAI_API_KEY=your_openai_api_key
```

**Recommended models:**
- `gpt-4o-mini` - Fast, cheap ($0.15/1M tokens), good enough for most evals
- `gpt-4o` - More accurate but 15x more expensive

### 3. Azure OpenAI

Use Azure OpenAI deployments:

```bash
# .env
EVAL_LLM_PROVIDER=azure_openai
EVAL_OLLAMA_MODEL=gpt-4o-mini  # Reference name (not used for API calls)

# Azure-specific settings
AZURE_OPENAI_API_KEY=your_azure_api_key
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name  # Your actual deployment
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com/
AZURE_OPENAI_TEMPERATURE=0.0  # Optional, defaults to 0.0
```

**Important:** The `AZURE_OPENAI_DEPLOYMENT_NAME` is what matters - this is your actual Azure deployment name.

## Performance Comparison

| Provider | Model | Speed | Cost (per 1K evals) | Quality |
|----------|-------|-------|---------------------|---------|
| Ollama | gpt-oss:120b | ~5 min | Free | Highest |
| Ollama | gpt-oss:20b | ~1 min | Free | High |
| Ollama | deepseek-r1:8b | ~15 sec | Free | Good |
| Ollama | viking-7b | ~15 sec | Free | Good (Norwegian) |
| OpenAI | gpt-4o-mini | ~10 sec | $2 | Good |
| OpenAI | gpt-4o | ~15 sec | $30 | Highest |
| Azure | gpt-4o-mini | ~10 sec | ~$2 | Good |

## Usage

After configuring your `.env`, run evaluations normally:

```bash
uv run python -m src.main ../golden_questions/output/sample_golden_questions.jsonl -l 10
```

The system will automatically use the configured provider.

## Switching Providers

To switch providers, just update `EVAL_LLM_PROVIDER` in your `.env`:

```bash
# For local testing (free, slower)
EVAL_LLM_PROVIDER=ollama

# For production (fast, paid, parallel)
EVAL_LLM_PROVIDER=azure_openai
```

## Detailed Logging

All providers support detailed logging. Check:
- `logs/eval_from_golden_questions.log` - General logs
- `logs/deepeval.log` - Detailed DeepEval debug logs

## See Also

- `.env.azure.example` - Complete Azure OpenAI configuration example
- `.env` - Your current configuration
