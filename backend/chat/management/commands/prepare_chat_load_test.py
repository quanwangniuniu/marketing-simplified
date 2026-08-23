"""Prepare isolated local users and a group channel for chat load testing."""

import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from chat.models import Chat, ChatParticipant, ChatType
from core.models import Organization, Project, ProjectMember
from core.services.auth_tokens import build_user_refresh_token
from core.services.tenant import slug_to_schema_name
from core.tenant_context import tenant_schema_context
from stripe_meta.permissions import generate_organization_access_token


User = get_user_model()
DEFAULT_CHAT_NAME = 'MED-278 Chat Load Test'
DEFAULT_EMAIL_PREFIX = 'med278-chat-load'


class Command(BaseCommand):
    help = 'Create deterministic local chat load-test users and write K6 credentials.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--organization-slug',
            required=True,
            help='Organization whose tenant schema contains the project.',
        )
        parser.add_argument('--project-id', type=int, required=True)
        parser.add_argument('--users', type=int, default=100)
        parser.add_argument('--chat-id', type=int)
        parser.add_argument('--email-prefix', default=DEFAULT_EMAIL_PREFIX)
        parser.add_argument(
            '--output',
            default='/load-test-output/users.json',
            help='Credential JSON path shared with the K6 container.',
        )
        parser.add_argument(
            '--allow-outside-debug',
            action='store_true',
            help=(
                'Required to run when DEBUG is off. This command mints real '
                'verified accounts and valid JWTs, so it must never run against '
                'production by accident.'
            ),
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options['allow_outside_debug']:
            raise CommandError(
                'Refusing to run with DEBUG=False: this command creates real '
                'verified accounts and writes valid access tokens to disk. '
                'Pass --allow-outside-debug only on a disposable environment.'
            )

        try:
            organization = Organization.objects.get(
                slug=options['organization_slug'],
                is_active=True,
            )
        except Organization.DoesNotExist as exc:
            raise CommandError('Active organization not found') from exc

        tenant_schema = slug_to_schema_name(organization.slug)
        with tenant_schema_context(tenant_schema):
            return self._handle_tenant(*args, **options)

    def _handle_tenant(self, *args, **options):
        # This command creates verified user accounts, signs valid access tokens
        # for them and writes those tokens to disk in plain text. That is fine on
        # a disposable local stack and unacceptable anywhere real, so refuse to
        # run outside DEBUG unless the operator opts in explicitly.
        if not settings.DEBUG and not options['allow_outside_debug']:
            raise CommandError(
                'Refusing to run with DEBUG=False: this command creates real '
                'verified accounts and writes valid access tokens to disk. '
                'Pass --allow-outside-debug only on a disposable environment.'
            )

        user_count = options['users']
        if user_count < 2 or user_count > 500:
            raise CommandError('--users must be between 2 and 500')

        try:
            project = Project.objects.select_related('organization').get(
                id=options['project_id']
            )
        except Project.DoesNotExist as exc:
            raise CommandError(f"Project {options['project_id']} does not exist") from exc

        if not project.organization_id:
            raise CommandError('The selected project must belong to an organization')
        if project.organization.slug != options['organization_slug']:
            raise CommandError('The selected project belongs to a different organization')

        chat_id = options.get('chat_id')
        if chat_id:
            try:
                chat = Chat.objects.get(
                    id=chat_id,
                    project=project,
                    type=ChatType.GROUP,
                )
            except Chat.DoesNotExist as exc:
                raise CommandError(
                    f"Group chat {chat_id} does not belong to project {project.id}"
                ) from exc
        else:
            chat, _ = Chat.objects.get_or_create(
                project=project,
                type=ChatType.GROUP,
                name=DEFAULT_CHAT_NAME,
            )

        credentials = []
        for index in range(1, user_count + 1):
            email = (
                f"{options['email_prefix']}-p{project.id}-{index:03d}@example.test"
            )
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email,
                    'organization': project.organization,
                    'current_organization': project.organization,
                    'is_verified': True,
                },
            )
            changed_fields = []
            if user.organization_id != project.organization_id:
                user.organization = project.organization
                changed_fields.append('organization')
            if user.current_organization_id != project.organization_id:
                user.current_organization = project.organization
                changed_fields.append('current_organization')
            if not user.is_verified:
                user.is_verified = True
                changed_fields.append('is_verified')
            if changed_fields:
                user.save(update_fields=changed_fields)

            ProjectMember.objects.update_or_create(
                user=user,
                project=project,
                defaults={'role': 'member', 'is_active': True},
            )
            ChatParticipant.objects.update_or_create(
                user=user,
                chat=chat,
                defaults={'is_active': True, 'notification_level': 'none'},
            )

            credentials.append({
                'user_id': user.id,
                'token': str(build_user_refresh_token(user).access_token),
                'organization_token': generate_organization_access_token(user),
            })

        if chat.created_by_id is None and credentials:
            chat.created_by_id = credentials[0]['user_id']
            chat.save(update_fields=['created_by', 'updated_at'])
            ChatParticipant.objects.filter(
                chat=chat,
                user_id=chat.created_by_id,
            ).update(is_manager=True)

        output_path = Path(options['output'])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(
                {
                    'project_id': project.id,
                    'chat_id': chat.id,
                    'chat_slug': chat.slug,
                    'users': credentials,
                },
                indent=2,
            ),
            encoding='utf-8',
        )

        self.stdout.write(self.style.SUCCESS(
            f"Prepared {len(credentials)} users in chat {chat.id}; "
            f"credentials written to {output_path}"
        ))
