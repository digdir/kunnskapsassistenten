from deepeval import assert_test
from deepeval.metrics import ConversationalGEval, GEval
from deepeval.models import OllamaModel
from deepeval.test_case import (
    ConversationalTestCase,
    LLMTestCase,
    LLMTestCaseParams,
    Turn,
)

# base_url: str = "http://localhost:11434/v1",
# api_key: str = "ollama",
# model: str = "gpt-oss:120b-cloud"
# client = OpenAI(base_url=base_url, api_key=api_key)
model = OllamaModel(
    model="gpt-oss:120b-cloud", base_url="http://localhost:11434", temperature=0
)


def test_correctness():
    correctness_metric = GEval(
        name="Correctness",
        criteria="Determine if the 'actual output' is correct based on the 'expected output'.",
        evaluation_params=[
            LLMTestCaseParams.ACTUAL_OUTPUT,
            LLMTestCaseParams.EXPECTED_OUTPUT,
        ],
        evaluation_steps=[
            "Compare the main medical advice and recommendations in both outputs",
            "Check if the actual output conveys similar health guidance (when to see a doctor, symptom awareness)",
            "Assess whether key medical concepts are present even if wording differs",
            "Determine if the actual output provides adequate and accurate information to answer the health question",
        ],
        threshold=0.5,
        model=model,
    )
    test_case = LLMTestCase(
        input="I have a persistent cough and fever. Should I be worried?",
        # Replace this with the actual output from your LLM application
        actual_output="A persistent cough and fever could be a viral infection or something more serious. See a doctor if symptoms worsen or don't improve in a few days.",
        expected_output="A persistent cough and fever could indicate a range of illnesses, from a mild viral infection to more serious conditions like pneumonia or COVID-19. You should seek medical attention if your symptoms worsen, persist for more than a few days, or are accompanied by difficulty breathing, chest pain, or other concerning signs.",
    )
    assert_test(test_case, [correctness_metric])


def test_professionalism():
    professionalism_metric = ConversationalGEval(
        name="Professionalism",
        criteria="Determine whether the assistant has acted professionally based on the content.",
        threshold=0.5,
        model=model,
    )
    test_case = ConversationalTestCase(
        turns=[
            Turn(role="user", content="What is DeepEval?"),
            Turn(
                role="assistant", content="DeepEval is an open-source LLM eval package."
            ),
        ]
    )
    assert_test(test_case, [professionalism_metric])
