import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
from langfuse.openai import OpenAI
from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine

# Ollama client for LLM operations
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
# model = "akx/viking-7b"
model = "gpt-oss"


def create_multilingual_analyzer() -> AnalyzerEngine:
    """
    Create an analyzer configured for both Norwegian and English text.
    Supports multiple languages with custom recognizers for each.
    """
    # Configure NLP engine for multiple languages
    configuration = {
        "nlp_engine_name": "spacy",
        "models": [
            {"lang_code": "nb", "model_name": "nb_core_news_lg"},
            {"lang_code": "en", "model_name": "en_core_web_lg"},
        ],
    }

    provider = NlpEngineProvider(nlp_configuration=configuration)
    nlp_engine = provider.create_engine()

    # Create analyzer with the NLP engine supporting both languages
    analyzer = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["nb", "en"])

    # Add Norwegian phone pattern recognizer
    # Supports multiple formats: +47 12345678, 12345678, 12 34 56 78, etc.
    norwegian_phone_patterns = [
        Pattern(
            name="norwegian_phone_with_country_code",
            regex=r"(?:\+47|0047)\s*\d{2}\s*\d{2}\s*\d{2}\s*\d{2}",  # +47 12 34 56 78
            score=0.7,
        ),
        Pattern(
            name="norwegian_phone_with_spaces",
            regex=r"\b\d{2}\s+\d{2}\s+\d{2}\s+\d{2}\b",  # 12 34 56 78
            score=0.6,
        ),
        Pattern(
            name="norwegian_phone_compact",
            regex=r"(?:\+47|0047)?\s*\d{8}\b",  # +47 12345678 or 12345678
            score=0.5,
        ),
    ]
    norwegian_phone_recognizer = PatternRecognizer(
        supported_entity="PHONE_NUMBER",
        patterns=norwegian_phone_patterns,
        supported_language="nb",
    )

    # Add English/International phone pattern recognizer
    # Supports: +1-555-123-4567, 555-123-4567, (555) 123-4567, 555.123.4567, etc.
    english_phone_patterns = [
        Pattern(
            name="us_phone_with_country_code",
            regex=r"(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",  # +1-555-123-4567, +1 (555) 123-4567
            score=0.7,
        ),
        Pattern(
            name="international_phone",
            regex=r"\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}",  # +44 20 1234 5678, etc.
            score=0.6,
        ),
    ]
    english_phone_recognizer = PatternRecognizer(
        supported_entity="PHONE_NUMBER",
        patterns=english_phone_patterns,
        supported_language="en",
    )

    # Add recognizers to registry
    analyzer.registry.add_recognizer(norwegian_phone_recognizer)
    analyzer.registry.add_recognizer(english_phone_recognizer)

    return analyzer


def check_pii_with_ollama(text: str) -> Dict[str, Any]:
    """
    Use local Ollama to check for PIIs in text.

    Args:
        text: The text to check for PIIs
        model: Ollama model to use

    Returns:
        Dictionary with flagged PIIs and explanation
    """
    system_prompt = """Analyze the text and identify any Personal Identifiable Information (PII).

PII includes:
- Names of people
- Email addresses
- Phone numbers
- Physical addresses
- National ID numbers
- Credit card numbers
- Any other sensitive personal information

Respond in JSON format with:
{
    "has_pii": true/false,
    "pii_found": ["list of PII types found"],
    "explanation": "brief explanation"
}"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Text to analyze:\n{text}"},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if content:
            llm_response = json.loads(content)
            return llm_response
        else:
            raise Exception("No content in response")

    except Exception as e:
        return {
            "has_pii": None,
            "pii_found": [],
            "explanation": f"Error calling Ollama: {str(e)}",
        }


def process_conversations(
    jsonl_file: Path,
    pii_output_file: Path,
    max_conversations: int | None = None,
    conversation_id: str | None = None,
) -> None:
    """
    Process conversations from JSONL file, pseudonymize, and flag PIIs.

    Args:
        jsonl_file: Path to input JSONL file
        pii_output_file: Path to output JSONL file for conversations with PII
        max_conversations: Maximum number of conversations to process (None for all)
        conversation_id: Specific conversation ID to process (None for all)
    """
    result = {
        "input_file": str(jsonl_file),
        "pii_output_file": str(pii_output_file),
        "conversations_loaded": 0,
        "conversations_processed": 0,
        "conversations_with_pii": 0,
        "pii_details": [],
        "error": None,
    }

    try:
        df = pd.read_json(jsonl_file, lines=True, nrows=max_conversations)
        result["conversations_loaded"] = len(df)

        # Filter to specific conversation if requested
        if conversation_id:
            df = df[df["conversation"].apply(lambda x: x.get("id") == conversation_id)]
            if df.empty:
                result["error"] = f"No conversation found with ID: {conversation_id}"
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return
            result["filter"] = {"conversation_id": conversation_id}

        processed_conversations: List[Dict[str, Any]] = []
        conversations_with_pii: List[Dict[str, Any]] = []

        for idx, row in df.iterrows():
            conversation = row.to_dict()
            conv_id = conversation.get("conversation", {}).get("id", "unknown")

            # Collect all user messages and join them
            messages = conversation.get("messages", [])
            user_messages: List[str] = []
            for message in messages:
                if message.get("role") == "user":
                    text = message.get("text", "")
                    if text:
                        user_messages.append(text)

            if not user_messages:
                processed_conversations.append(conversation)
                continue

            # Join all user messages with newline
            combined_user_text = "\n".join(user_messages)

            # Check the entire conversation with Ollama
            ollama_result = check_pii_with_ollama(combined_user_text)

            # Store result at conversation level
            conversation["ollama_pii_check"] = ollama_result

            # Track if Ollama found PII
            has_pii = ollama_result.get("has_pii", False)
            if has_pii:
                pii_types = ollama_result.get("pii_found", [])
                conversations_with_pii.append(conversation)
                result["pii_details"].append(
                    {
                        "conversation_id": conv_id,
                        "pii_types": pii_types,
                        "explanation": ollama_result.get("explanation", "N/A"),
                    }
                )

            processed_conversations.append(conversation)

        result["conversations_processed"] = len(processed_conversations)
        result["conversations_with_pii"] = len(conversations_with_pii)

        # Save conversations with PII to file
        if conversations_with_pii:
            with open(pii_output_file, "w", encoding="utf-8") as f:
                for conv in conversations_with_pii:
                    json_line = json.dumps(conv, ensure_ascii=False)
                    f.write(json_line + "\n")
            result["pii_file_saved"] = True
        else:
            result["pii_file_saved"] = False

    except Exception as e:
        result["error"] = str(e)

    print(json.dumps(result, ensure_ascii=False, indent=2))


def main() -> None:
    """Main function to process production conversations."""
    parser = argparse.ArgumentParser(
        description="Pseudonymize PII in conversation data"
    )
    parser.add_argument(
        "input_file",
        type=Path,
        help="Path to input JSONL file with conversations",
    )
    parser.add_argument(
        "-n",
        "--num-conversations",
        type=int,
        default=None,
        help="Number of conversations to process (default: all)",
    )
    parser.add_argument(
        "-c",
        "--conversation-id",
        type=str,
        default=None,
        help="Specific conversation ID to process (overrides -n)",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run test examples instead of processing conversations",
    )
    args = parser.parse_args()

    # Run test examples if requested
    if args.test:
        test_examples()
        return

    input_file = args.input_file

    if not input_file.exists():
        print(f"File not found: {input_file}")
        return

    # Generate PII output filename based on input filename
    pii_output_file = input_file.with_name(
        f"{input_file.stem}_with_pii{input_file.suffix}"
    )

    print(f"Input file: {input_file}")
    print(f"PII output file: {pii_output_file}")

    if args.conversation_id:
        print(f"Processing single conversation: {args.conversation_id}")
    elif args.num_conversations:
        print(f"Processing {args.num_conversations} conversations")
    else:
        print("Processing all conversations")

    # Process conversations
    process_conversations(
        input_file,
        pii_output_file,
        max_conversations=args.num_conversations,
        conversation_id=args.conversation_id,
    )


def test_examples() -> None:
    """Test Norwegian and English text PII detection with Ollama."""
    # # Create one multilingual analyzer for both languages
    # analyzer = create_multilingual_analyzer()
    # anonymizer = AnonymizerEngine()

    # Define test examples
    examples = [
        {
            "language": "nb",
            "name": "NORWEGIAN TEXT EXAMPLE",
            "text": "Hei, jeg heter Ola Nordmann og eposten min er ola@nav.no. Telefonnummeret mitt er +47 12345678. Konas nr er 92 34 56 78. Jeg bor i Slottsgate 9 i Oslo.",
        },
        {
            "language": "en",
            "name": "ENGLISH TEXT EXAMPLE",
            "text": "Hello, my name is John Doe and my email is john.doe@example.com. My phone number is +1-555-123-4567 and I live at 123 Main Street, New York, NY 10001. My wives number is 555 321 4985",
        },
    ]

    # Process each example
    for example in examples:
        print("=" * 60)
        print(example["name"])
        print("=" * 60)

        text = example["text"]
        # language = example["language"]

        # # Presidio: Analyze and anonymize
        # results = analyzer.analyze(text=text, language=language)
        # anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
        #
        # print(f"Original: {text}")
        # print(f"Anonymized: {anonymized.text}")
        # print(
        #     f"Entities found: {[(r.entity_type, text[r.start : r.end]) for r in results]}"
        # )

        # Ollama: Check for PII
        print(f"Original: {text}")
        print("\nChecking with Ollama...")
        ollama_result = check_pii_with_ollama(text)

        print(f"Has PII: {ollama_result.get('has_pii')}")
        print(f"PII Types: {ollama_result.get('pii_found', [])}")
        print(f"Explanation: {ollama_result.get('explanation', 'N/A')}")
        print()


if __name__ == "__main__":
    main()


# Requirements:
# uv pip install presidio-analyzer presidio-anonymizer spacy
# uv pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_lg-3.8.0/en_core_web_lg-3.8.0-py3-none-any.whl
# For better Norwegian support, also install:
# uv pip install https://github.com/explosion/spacy-models/releases/download/nb_core_news_lg-3.8.0/nb_core_news_lg-3.8.0-py3-none-any.whl
