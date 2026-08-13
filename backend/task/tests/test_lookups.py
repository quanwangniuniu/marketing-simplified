import uuid

from django.test import SimpleTestCase

from task.lookups import resolve_task_lookup_kwargs


class ResolveTaskLookupKwargsTest(SimpleTestCase):
    def test_plain_string_resolves_by_slug(self):
        self.assertEqual(resolve_task_lookup_kwargs("april-budget"), {"slug": "april-budget"})

    def test_numeric_string_resolves_by_pk(self):
        self.assertEqual(resolve_task_lookup_kwargs("123"), {"pk": 123})

    def test_uuid_resolves_by_pk(self):
        value = str(uuid.uuid4())
        self.assertEqual(resolve_task_lookup_kwargs(value), {"pk": value})

    def test_custom_pk_and_slug_fields(self):
        self.assertEqual(
            resolve_task_lookup_kwargs("42", "task_id", "task__slug"),
            {"task_id": 42},
        )
        self.assertEqual(
            resolve_task_lookup_kwargs("client-flow", "task_id", "task__slug"),
            {"task__slug": "client-flow"},
        )
