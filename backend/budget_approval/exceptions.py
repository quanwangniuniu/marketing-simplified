"""Domain errors for budget approval (mapped to HTTP in views)."""


class ApprovalConflict(Exception):
    """Another actor already decided this step.

    Views should return HTTP 409 so the client refreshes, matching
    TaskAPI.make_approval. Distinct from ValidationError (HTTP 400).
    """

    default_message = (
        "This budget request has already been decided by another approver."
    )

    def __init__(self, message=None):
        super().__init__(message or self.default_message)
