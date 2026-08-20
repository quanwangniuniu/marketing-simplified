from rest_framework.exceptions import APIException


class SheetRevisionConflict(APIException):
    """A coordinate mutation was based on an obsolete sheet structure."""

    status_code = 409
    default_code = 'sheet_revision_conflict'

    def __init__(self, base_revision: int, current_revision: int):
        self.detail = {
            'code': 'SHEET_REVISION_CONFLICT',
            'detail': 'The sheet structure changed. Reload before retrying this edit.',
            'base_revision': base_revision,
            'current_revision': current_revision,
        }
        Exception.__init__(self, self.detail['detail'])
