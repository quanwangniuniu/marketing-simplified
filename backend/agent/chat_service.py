import logging

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = (
    "You are an AI assistant embedded in a campaign management platform. "
    "You can help users with:\n"
    "- Analyzing campaign data and generating insights\n"
    "- Creating and assigning tasks\n"
    "- Sending messages to team members\n"
    "- Generating Miro boards for visual planning\n\n"
    "Current page context: {page_context}\n"
    "Respond concisely and actionably."
)


class AgentChatService:
    """Service for generating AI agent replies in the chat widget.

    Currently returns placeholder text. Will be replaced with real LLM
    integration once Dify API keys are available.
    """

    @staticmethod
    def generate_reply(message: str, page_context: str = "", user_id=None) -> str:
        """Generate a reply for the given user message.

        Args:
            message: The user's chat message.
            page_context: Optional description of the page the user is on.
            user_id: The ID of the user who sent the message.

        Returns:
            A string reply to send back to the user.
        """
        logger.info(
            "AgentChatService.generate_reply called user_id=%s message_len=%d page_context=%s",
            user_id,
            len(message),
            page_context or "(none)",
        )
        return (
            "This is a placeholder response — LLM integration coming soon. "
            "I received your message and will be able to help once the AI backend is connected."
        )
