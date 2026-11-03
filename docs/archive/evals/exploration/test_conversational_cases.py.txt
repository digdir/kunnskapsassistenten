from deepeval import assert_test
from deepeval.metrics import ConversationalGEval
from deepeval.models import OllamaModel
from deepeval.test_case import ConversationalTestCase, Turn

model = OllamaModel(
    model="gpt-oss:120b-cloud", base_url="http://localhost:11434", temperature=0
)


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
