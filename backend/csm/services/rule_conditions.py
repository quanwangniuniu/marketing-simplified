"""Reusable condition matching for CSM rule engines.

A condition is ``{"field": ..., "operator": ..., "value": ...}``. A rule's
conditions are ANDed: the ticket matches only when every condition holds. This
module is deliberately standalone so both the workflow automation engine and the
future conversation routing engine can share one condition vocabulary.
"""


# field name -> how to read that value off a ticket. Add a field here and it is
# instantly available to the rule builder, the validator, and the evaluator.
CONDITION_FIELDS = {
    'status': lambda t: t.status,
    'priority': lambda t: t.priority,
    'queue': lambda t: t.queue_id,
    'assignee': lambda t: t.assigned_to_id,
    'work_type': lambda t: t.work_type_id,
    'support_project': lambda t: t.support_project_id,
    'tags': lambda t: t.tags or [],
    'customer_email': lambda t: t.customer_email,
    # Channel lives on the linked conversation, which a ticket may not have.
    'channel': lambda t: t.conversation.channel if t.conversation_id else None,
}

_EMPTY = (None, '', [])


def _op_eq(actual, expected):
    return actual == expected


def _op_ne(actual, expected):
    return actual != expected


def _op_in(actual, expected):
    return actual in (expected or [])


def _op_contains(actual, expected):
    # List field (e.g. tags): membership. String field: substring.
    if isinstance(actual, (list, tuple)):
        return expected in actual
    return bool(actual) and expected in actual


def _op_is_set(actual, expected):
    return actual not in _EMPTY


def _op_is_empty(actual, expected):
    return actual in _EMPTY


OPERATORS = {
    'eq': _op_eq,
    'ne': _op_ne,
    'in': _op_in,
    'contains': _op_contains,
    'is_set': _op_is_set,
    'is_empty': _op_is_empty,
}

# Exposed for the write-time validator and the frontend form.
CONDITION_FIELD_CHOICES = tuple(CONDITION_FIELDS)
OPERATOR_CHOICES = tuple(OPERATORS)

# `contains` reads the field as a collection or string, so it only makes sense
# for the list/text fields. Choosing it for a single-value field (a queue, an id)
# is meaningless and can even raise at run time, so it is rejected on write.
CONTAINS_FIELDS = ('tags', 'customer_email')


def operator_valid_for_field(field, operator):
    """Whether an operator is meaningful for a field. Keeps nonsensical combos
    like 'queue contains X' out of a rule at configuration time."""
    if operator == 'contains':
        return field in CONTAINS_FIELDS
    return True


def conditions_match(ticket, conditions):
    """Whether ``ticket`` satisfies every condition (logical AND).

    No conditions => always matches. An unknown field or operator makes the whole
    rule fail closed (returns False) so a malformed rule never fires by accident.
    """
    for cond in conditions or []:
        extractor = CONDITION_FIELDS.get(cond.get('field'))
        operator = OPERATORS.get(cond.get('operator'))
        if extractor is None or operator is None:
            return False
        try:
            if not operator(extractor(ticket), cond.get('value')):
                return False
        except Exception:
            # A malformed condition (e.g. 'contains' on a non-list field) can
            # raise; treat it as not-matching so one bad rule can't crash the run
            # and stop the other rules from firing.
            return False
    return True
