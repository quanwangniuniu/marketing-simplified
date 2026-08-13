import json
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError

from chat.models import Chat, ChatParticipant, ChatType
from core.models import Organization, Project, ProjectMember
from core.services.tenant import slug_to_schema_name
from core.tenant_context import tenant_schema_context


pytestmark = pytest.mark.django_db
User = get_user_model()


def test_prepare_chat_load_test_writes_distinct_user_credentials(tmp_path, settings):
    # Django forces DEBUG off under test; the command is a local-only tool.
    settings.DEBUG = True
    organization = Organization.objects.create(name='Load Test Org')
    tenant_schema = slug_to_schema_name(organization.slug)
    with tenant_schema_context(tenant_schema):
        project = Project.objects.create(
            name='Load Test Project',
            organization=organization,
        )
    output = tmp_path / 'users.json'

    with patch(
        'chat.management.commands.prepare_chat_load_test.generate_organization_access_token',
        return_value='organization-token',
    ):
        call_command(
            'prepare_chat_load_test',
            organization_slug=organization.slug,
            project_id=project.id,
            users=2,
            output=str(output),
        )

    config = json.loads(output.read_text(encoding='utf-8'))
    assert config['project_id'] == project.id
    assert len(config['users']) == 2
    assert len({row['user_id'] for row in config['users']}) == 2
    assert all(row['token'] for row in config['users'])
    assert all(row['organization_token'] == 'organization-token' for row in config['users'])

    with tenant_schema_context(tenant_schema):
        chat = Chat.objects.get(id=config['chat_id'], type=ChatType.GROUP)
        assert ChatParticipant.objects.filter(chat=chat, is_active=True).count() == 2
        assert ProjectMember.objects.filter(
            project=project,
            is_active=True,
            user__email__startswith='med278-chat-load-',
        ).count() == 2


def test_prepare_chat_load_test_refuses_to_run_with_debug_off(tmp_path, settings):
    """The command mints verified accounts and valid tokens, so it must not run
    against a real environment unless the operator says so explicitly."""
    settings.DEBUG = False
    organization = Organization.objects.create(name='Guarded Load Test Org')
    project = Project.objects.create(
        name='Guarded Load Test Project',
        organization=organization,
    )

    with pytest.raises(CommandError, match='DEBUG=False'):
        call_command(
            'prepare_chat_load_test',
            '--organization-slug', organization.slug,
            '--project-id', str(project.id),
            '--users', '2',
            '--output', str(tmp_path / 'users.json'),
        )

    assert not (tmp_path / 'users.json').exists()
    assert not User.objects.filter(email__startswith='med278-chat-load').exists()
