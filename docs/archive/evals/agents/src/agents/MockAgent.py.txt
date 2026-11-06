from agents.agent import Agent, AgentRequest, AgentResponse, logger


class MockAgent(Agent):
    """Mock agent for testing that returns predefined responses."""

    def __init__(self) -> None:
        self.responses: dict[str, AgentResponse] = {}

    def add_mock_response(self, query: str, response: AgentResponse) -> None:
        """Add a mock response for a specific query."""
        self.responses[query] = response

    def query(self, request: AgentRequest) -> AgentResponse:
        """Return mock response based on query text."""
        logger.debug(f"MockAgent received query: {request.query}")

        if request.query in self.responses:
            response = self.responses[request.query]
            logger.debug(f"MockAgent returning response for query: {request.query}")
            return response

        logger.error(f"No mock response found for query: {request.query}")
        raise ValueError(f"No mock response found for query: {request.query}")