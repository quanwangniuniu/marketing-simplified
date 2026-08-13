import uuid


def resolve_task_lookup_kwargs(lookup_value, pk_field='pk', slug_field='slug'):
    """Resolve a task URL path segment to ORM filter kwargs.

    Unlike the platform-wide ``resolve_lookup_kwargs`` (slug-only for non-UUID
    values), task endpoints accept numeric primary keys in addition to slugs.
    Purely numeric slugs are prefixed at creation time (``task-<n>``) so they
    do not collide with integer IDs in the path.
    """
    lookup_value = str(lookup_value)
    try:
        uuid.UUID(lookup_value)
        return {pk_field: lookup_value}
    except ValueError:
        if lookup_value.isdigit():
            return {pk_field: int(lookup_value)}
        return {slug_field: lookup_value}
