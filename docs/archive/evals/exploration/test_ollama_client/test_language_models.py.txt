from typing import Dict, List

from openai import OpenAI

# 👇 Point the client at your local Ollama server
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)


def chat_with_continuation(
    model: str,
    messages: List[Dict[str, str]],
    max_tokens: int = 64,
    temperature: float = 0.2,
    max_continuations: int = 5,
) -> tuple[str | None, str | None]:
    """
    Chat with auto-continuation if hitting token limit.
    Returns: (content, reasoning)
    """
    current_messages: List[Dict[str, str]] = messages.copy()
    all_reasoning: str = ""
    final_content: str | None = None

    for i in range(max_continuations):
        print(f"\n--- Request {i + 1} ---")
        response = client.chat.completions.create(
            model=model,
            messages=current_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        message = response.choices[0].message
        reasoning: str | None = getattr(message, "reasoning", None)
        content: str | None = message.content
        finish_reason: str = response.choices[0].finish_reason

        # Accumulate reasoning
        if reasoning:
            all_reasoning += reasoning

        # If we got content, we're done
        if content:
            final_content = content
            print(f"✓ Completed with finish_reason: {finish_reason}")
            break

        # If hit length limit, continue the conversation
        if finish_reason == "length":
            print(
                f"⚠️  Hit token limit, continuing... (accumulated {len(all_reasoning)} chars of reasoning)"
            )
            # Add the assistant's partial response to message history
            current_messages.append(
                {"role": "assistant", "content": reasoning or content or ""}
            )
        else:
            print(f"✓ Stopped with finish_reason: {finish_reason}")
            break

    return final_content, all_reasoning if all_reasoning else None


# Test it
print("Starting chat...")
content, reasoning = chat_with_continuation(
    model="gpt-oss:120b-cloud",
    messages=[
        {"role": "system", "content": "You are a concise assistant."},
        {"role": "user", "content": "Explain MXFP4 quantisation in one sentence."},
    ],
    max_tokens=64,
    max_continuations=10,
)

if reasoning:
    print("\n=== Reasoning (chain-of-thought) ===")
    print(reasoning)
if content:
    print("\n=== Final Answer ===")
    print(content)
else:
    print("\n⚠️  No content returned after all continuations")
