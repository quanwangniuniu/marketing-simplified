from rest_framework import serializers
from .models import (
    Queue, QueueAgent, QueueTeam, CustomerUser, CsmNotification,
    Conversation, ConversationMessage, Ticket, QuickReplyTemplate, QuickReplyTemplateHistory,
    TemplateTag,
    TicketForm, TicketFormField, TicketFormAssignment,
    SupportProject, CsmWorkType, SupportChannel,
    SLAPolicy, SLAPriorityTarget, BusinessHoursCalendar,
    TicketStatus, TicketStatusTransition, TicketAutoResolveConfig,
    AutomationRule, AutomationExecutionLog,
)


class QueueSerializer(serializers.ModelSerializer):
    tier_display = serializers.CharField(source='get_tier_display', read_only=True)
    organisation_name = serializers.CharField(
        source='organisation.name', read_only=True, default=None,
    )

    class Meta:
        model = Queue
        fields = [
            'id', 'slug', 'project', 'organisation', 'organisation_name',
            'name', 'description',
            'tier', 'tier_display', 'sla_policy',
            'display_order', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at']


class QueueAgentSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = QueueAgent
        fields = [
            'id', 'queue', 'user', 'user_email', 'user_name',
            'assigned_by', 'created_at',
        ]
        read_only_fields = ['id', 'assigned_by', 'created_at']


class QueueTeamSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.name', read_only=True)

    class Meta:
        model = QueueTeam
        fields = ['id', 'queue', 'team', 'team_name', 'created_at']
        read_only_fields = ['id', 'created_at']


class CustomerUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True, required=False)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    queue_name = serializers.CharField(source='queue.name', read_only=True, default=None)
    organisation_name = serializers.CharField(source='organisation.name', read_only=True, default=None)
    user_type_display = serializers.CharField(source='get_user_type_display', read_only=True)

    class Meta:
        model = CustomerUser
        fields = [
            'id', 'user', 'email', 'user_email', 'user_name',
            'team', 'team_name',
            'queue', 'queue_name',
            'organisation', 'organisation_name',
            'user_type', 'user_type_display',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'user', 'created_at']

    def get_user_name(self, obj):
        full = obj.user.get_full_name()
        return full if full.strip() else obj.user.email

    def validate_email(self, value):
        return value.lower()

    def create(self, validated_data):
        email = validated_data.pop('email', None)
        if email:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user, _ = User.objects.get_or_create(
                email__iexact=email,
                defaults={
                    'email': email,
                    'username': email,
                },
            )
            validated_data['user'] = user
        return super().create(validated_data)



class CsmNotificationSerializer(serializers.ModelSerializer):
    sender_email = serializers.EmailField(source='sender.email', read_only=True, default=None)
    sender_name = serializers.SerializerMethodField()
    organisation_name = serializers.CharField(source='organisation.name', read_only=True, default=None)

    class Meta:
        model = CsmNotification
        fields = [
            'id', 'recipient', 'sender', 'sender_email', 'sender_name',
            'notification_type', 'title', 'message', 'metadata',
            'is_read', 'action_status',
            'organisation', 'organisation_name',
            'created_at',
        ]
        read_only_fields = ['id', 'recipient', 'sender', 'created_at']

    def get_sender_name(self, obj):
        if not obj.sender:
            return None
        full = obj.sender.get_full_name()
        return full if full.strip() else obj.sender.email


class ConversationMessageSerializer(serializers.ModelSerializer):
    sender_agent_name = serializers.SerializerMethodField()
    sender_agent_email = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ConversationMessage
        fields = [
            'id', 'conversation', 'sender_type',
            'sender_agent', 'sender_agent_name', 'sender_agent_email',
            'content', 'rich_body', 'image_url', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'conversation', 'sender_agent']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_sender_agent_name(self, obj):
        if not obj.sender_agent:
            return None
        full = obj.sender_agent.user.get_full_name()
        return full if full.strip() else obj.sender_agent.user.email

    def get_sender_agent_email(self, obj):
        if not obj.sender_agent:
            return None
        return obj.sender_agent.user.email


class ConversationSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list view."""
    customer_name = serializers.CharField(source='customer.full_name', read_only=True, default=None)
    customer_email = serializers.CharField(source='customer.email', read_only=True, default=None)
    queue_name = serializers.CharField(source='queue.name', read_only=True, default=None)
    queue_organisation_id = serializers.IntegerField(source='queue.organisation_id', read_only=True, default=None)
    assigned_to_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    elapsed_seconds = serializers.IntegerField(read_only=True)
    ticket = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'customer', 'customer_name', 'customer_email',
            'queue', 'queue_name', 'queue_organisation_id',
            'assigned_to', 'assigned_to_name',
            'status', 'status_display',
            'channel', 'channel_display',
            'tags', 'started_at', 'ended_at', 'elapsed_seconds',
            'ticket', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'started_at']

    def _validate_queue_access(self, queue):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not queue or not user or user.is_staff or user.is_superuser:
            return

        is_org_admin = CustomerUser.objects.filter(
            user=user,
            organisation_id=queue.organisation_id,
            is_active=True,
            user_type__in=('supervisor', 'admin'),
        ).exists()
        if is_org_admin:
            return

        is_queue_agent = (
            QueueAgent.objects.filter(user=user, queue=queue).exists()
            or CustomerUser.objects.filter(
                user=user,
                queue=queue,
                is_active=True,
                user_type='agent',
            ).exists()
        )
        if not is_queue_agent:
            raise serializers.ValidationError({
                'queue': 'You can only assign conversations to queues you can access.',
            })

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        full = obj.assigned_to.user.get_full_name()
        return full if full.strip() else obj.assigned_to.user.email

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if 'queue' in attrs:
            self._validate_queue_access(attrs.get('queue'))

        if 'assigned_to' not in attrs:
            return attrs

        assignee = attrs.get('assigned_to')
        if assignee is None:
            return attrs

        conversation = self.instance
        queue = attrs.get('queue') or (conversation.queue if conversation else None)
        customer = attrs.get('customer') or (conversation.customer if conversation else None)
        organisation_id = (
            queue.organisation_id if queue else
            customer.organisation_id if customer else
            None
        )

        if not assignee.is_active:
            raise serializers.ValidationError({
                'assigned_to': 'Assignee must be an active CSM user.',
            })

        if organisation_id and assignee.organisation_id != organisation_id:
            raise serializers.ValidationError({
                'assigned_to': 'Assignee must belong to the conversation organisation.',
            })

        if queue and assignee.user_type == 'agent':
            has_queue_profile = assignee.queue_id == queue.id
            has_queue_assignment = QueueAgent.objects.filter(
                user_id=assignee.user_id,
                queue=queue,
            ).exists()
            if not has_queue_profile and not has_queue_assignment:
                raise serializers.ValidationError({
                    'assigned_to': 'Agent must be assigned to the conversation queue.',
                })

        return attrs

    def get_ticket(self, obj):
        t = obj.tickets.first()
        if not t:
            return None
        return {
            'id': t.id,
            'title': t.title,
            'status': t.status,
            'status_display': t.get_status_display(),
            'priority': t.priority,
            'priority_display': t.get_priority_display(),
            'assigned_to_name': (
                t.assigned_to.get_full_name() or t.assigned_to.email
                if t.assigned_to else None
            ),
        }


class CustomerProfileSerializer(serializers.Serializer):
    """Flattened customer profile for the conversation detail panel."""
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    email = serializers.EmailField()
    company = serializers.CharField()
    phone = serializers.CharField()
    project_id = serializers.IntegerField(default=None)
    organisation_id = serializers.IntegerField(source='organisation.id', default=None)
    organisation_name = serializers.CharField(source='organisation.name', default=None)
    region_name = serializers.CharField(source='region.name', default=None)
    # Status label (MED-217): agents view/assign it on the profile panel.
    status_label = serializers.IntegerField(source='status_label_id', default=None)
    status_label_name = serializers.CharField(source='status_label.name', default=None)
    status_label_color = serializers.CharField(source='status_label.color', default=None)


class ConversationDetailSerializer(ConversationSerializer):
    """Full serializer for conversation detail view — includes messages and customer profile."""
    messages = ConversationMessageSerializer(many=True, read_only=True)
    customer_profile = serializers.SerializerMethodField()
    linked_tickets = serializers.SerializerMethodField()

    class Meta(ConversationSerializer.Meta):
        fields = ConversationSerializer.Meta.fields + ['messages', 'customer_profile', 'linked_tickets']

    def get_customer_profile(self, obj):
        if not obj.customer:
            return None
        return CustomerProfileSerializer(obj.customer).data

    def get_linked_tickets(self, obj):
        tickets = obj.tickets.all()
        return [
            {'id': t.id, 'title': t.title, 'status': t.status, 'priority': t.priority}
            for t in tickets
        ]


class TicketSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    queue_name = serializers.CharField(source='queue.name', read_only=True, default=None)
    # Plain CharField (not the model's ChoiceField) so custom status slugs are
    # accepted on write. required=False keeps the model default ('todo') on
    # create. Transition legality is enforced in the view, not here.
    status = serializers.CharField(required=False)
    # Resolved from the per-project status machine, not the model's
    # STATUS_CHOICES, so custom statuses show their configured name/color rather
    # than a raw slug.
    status_display = serializers.SerializerMethodField()
    status_color = serializers.SerializerMethodField()
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    sla = serializers.SerializerMethodField()
    available_next_statuses = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id', 'queue', 'queue_name', 'title', 'description',
            'status', 'status_display', 'status_color', 'priority', 'priority_display',
            'assigned_to', 'assigned_to_name', 'customer_email', 'tags',
            'conversation', 'created_at',
            'first_response_due', 'resolution_due', 'sla',
            'available_next_statuses',
        ]
        read_only_fields = ['id', 'created_at', 'first_response_due', 'resolution_due']

    def _resolve_status(self, obj):
        """The ticket's current TicketStatus row, cached per (project, slug) in
        the serializer context so a list response resolves each distinct status
        once instead of once per ticket (shared by status_display + color)."""
        project_id = obj.queue.project_id if obj.queue_id else None
        cache = self.context.setdefault('_ticket_status_cache', {})
        key = (project_id, obj.status)
        if key not in cache:
            from csm.services.status_machine import get_status
            cache[key] = get_status(project_id, obj.status)
        return cache[key]

    def get_status_display(self, obj):
        status = self._resolve_status(obj)
        # Fall back to the model's label (built-ins) if the machine has no row.
        return status.name if status else obj.get_status_display()

    def get_status_color(self, obj):
        status = self._resolve_status(obj)
        return status.color if status else None

    def get_available_next_statuses(self, obj):
        """The valid next statuses for the agent UI — only reachable
        statuses, not all of them."""
        project_id = obj.queue.project_id if obj.queue_id else None
        if project_id is None:
            return []
        # Cached per (project, from_status) in context: every ticket on the same
        # status shares one computation across a list response (avoids N+1).
        cache = self.context.setdefault('_next_status_cache', {})
        key = (project_id, obj.status)
        if key not in cache:
            from csm.services.status_machine import get_next_statuses
            cache[key] = [
                {'slug': s.slug, 'name': s.name, 'color': s.color}
                for s in get_next_statuses(project_id, obj.status)
            ]
        return cache[key]

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        full = obj.assigned_to.get_full_name()
        return full if full.strip() else obj.assigned_to.email

    def get_sla(self, obj):
        from csm.services.sla import get_sla_status
        return get_sla_status(obj)


class QuickReplyTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QuickReplyTemplate
        fields = [
            'id', 'slug', 'organisation', 'team', 'title', 'content', 'rich_body',
            'tags', 'is_active', 'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        full = obj.created_by.get_full_name()
        return full if full.strip() else obj.created_by.email

    def validate_tags(self, value):
        cleaned = [str(t).strip() for t in (value or []) if str(t).strip()]
        if not cleaned:
            raise serializers.ValidationError('At least one tag is required.')
        # Allowlist: every tag must exist in this organisation's admin-managed
        # vocabulary (TemplateTag names are stored lowercased).
        org_id = (
            self.initial_data.get('organisation')
            or (self.instance.organisation_id if self.instance else None)
        )
        if org_id:
            allowed = set(
                TemplateTag.objects.filter(organisation_id=org_id)
                .values_list('name', flat=True)
            )
            unknown = [t for t in cleaned if t.lower() not in allowed]
            if unknown:
                raise serializers.ValidationError(
                    'Unknown tag(s): ' + ', '.join(unknown) + '. '
                    'Only tags defined by an administrator can be used.'
                )
        return cleaned

    def validate_organisation(self, value):
        # Prevent cross-tenant writes: the user must be an active member of the
        # organisation a template is created in or moved to.
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and not CustomerUser.objects.filter(
            user=user, organisation=value, is_active=True,
        ).exists():
            raise serializers.ValidationError(
                'You are not a member of this organisation.'
            )
        return value


class QuickReplyTemplateHistorySerializer(serializers.ModelSerializer):
    edited_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QuickReplyTemplateHistory
        fields = ['id', 'edited_by', 'edited_by_name', 'edited_at', 'title', 'content', 'rich_body', 'tags']
        read_only_fields = ['id', 'edited_by', 'edited_by_name', 'edited_at', 'title', 'content', 'rich_body', 'tags']

    def get_edited_by_name(self, obj):
        if not obj.edited_by:
            return None
        full = obj.edited_by.get_full_name()
        return full if full.strip() else obj.edited_by.email


class TemplateTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemplateTag
        fields = ['id', 'organisation', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_name(self, value):
        cleaned = value.strip().lower()
        if not cleaned:
            raise serializers.ValidationError('Tag name cannot be blank.')
        return cleaned


class TicketFormFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketFormField
        fields = [
            'id', 'field_key', 'label', 'field_type', 'is_required',
            'sort_order', 'options', 'field_config', 'help_text',
            'max_files', 'max_file_size_mb',
        ]
        read_only_fields = ['id']


class TicketFormListSerializer(serializers.ModelSerializer):
    assignment_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = TicketForm
        fields = [
            'id', 'slug', 'project', 'name', 'description',
            'is_default', 'is_active', 'assignment_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at', 'assignment_count']


class TicketFormDetailSerializer(serializers.ModelSerializer):
    fields = TicketFormFieldSerializer(many=True, read_only=True)

    class Meta:
        model = TicketForm
        fields = [
            'id', 'slug', 'project', 'name', 'description',
            'is_default', 'is_active', 'fields',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'project', 'is_default', 'created_at', 'updated_at', 'fields']


class TicketFormCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketForm
        fields = ['name', 'description']


class BulkFieldsSerializer(serializers.Serializer):
    fields = serializers.ListField(child=serializers.DictField(), allow_empty=False)


class TicketFormAssignmentSerializer(serializers.ModelSerializer):
    experience_group_name = serializers.CharField(
        source='experience_group.name', read_only=True, default=None,
    )
    support_project_name = serializers.CharField(
        source='support_project.name', read_only=True, default=None,
    )

    class Meta:
        model = TicketFormAssignment
        fields = [
            'id', 'form', 'experience_group', 'experience_group_name',
            'support_project', 'support_project_name', 'created_at',
        ]
        read_only_fields = [
            'id', 'form', 'experience_group', 'experience_group_name',
            'support_project', 'support_project_name', 'created_at',
        ]


class ReplaceAssignmentsSerializer(serializers.Serializer):
    experience_group_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
    )
    support_project_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
    )


class SupportProjectSerializer(serializers.ModelSerializer):
    default_queue_name = serializers.CharField(
        source='default_queue.name', read_only=True, default=None,
    )

    class Meta:
        model = SupportProject
        fields = ['id', 'name', 'is_archived', 'default_queue', 'default_queue_name']
        read_only_fields = ['id', 'default_queue_name']


class CsmWorkTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CsmWorkType
        fields = ['id', 'name', 'sort_order', 'is_active']
        read_only_fields = ['id']


class WorkTypeReorderSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )


# ---------------------------------------------------------------------------
# SLA Policy (MED-218)
# ---------------------------------------------------------------------------

class BusinessHoursCalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessHoursCalendar
        fields = ['id', 'project', 'name', 'timezone', 'schedule', 'created_at', 'updated_at']
        read_only_fields = ['id', 'project', 'created_at', 'updated_at']


class SLAPriorityTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLAPriorityTarget
        fields = ['id', 'priority', 'first_response_minutes', 'resolution_minutes']
        read_only_fields = ['id']


class SLAPolicySerializer(serializers.ModelSerializer):
    priority_targets = SLAPriorityTargetSerializer(many=True, required=False)

    class Meta:
        model = SLAPolicy
        fields = [
            'id', 'project', 'name', 'is_active', 'is_default',
            'calendar', 'pause_on_pending',
            'priority_targets', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'project', 'created_at', 'updated_at']

    def update(self, instance, validated_data):
        targets_data = validated_data.pop('priority_targets', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if targets_data is not None:
            instance.priority_targets.all().delete()
            for td in targets_data:
                SLAPriorityTarget.objects.create(policy=instance, **td)

        instance.refresh_from_db()
        return instance


class SupportChannelExperienceGroupSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class SupportChannelListSerializer(serializers.ModelSerializer):
    assignment_count = serializers.IntegerField(read_only=True)
    default_queue_name = serializers.CharField(
        source='default_queue.name', read_only=True, default=None,
    )
    experience_groups = serializers.SerializerMethodField()

    class Meta:
        model = SupportChannel
        fields = [
            'id', 'display_name', 'channel_type', 'is_active',
            'assignment_count', 'default_queue_name', 'experience_groups',
            'sort_order',
        ]
        read_only_fields = fields

    def get_experience_groups(self, obj):
        return [
            {'id': link.experience_group_id, 'name': link.experience_group.name}
            for link in obj.experience_group_links.all()
        ]


class SupportChannelDetailSerializer(serializers.ModelSerializer):
    assignment_count = serializers.IntegerField(read_only=True)
    default_queue_name = serializers.CharField(
        source='default_queue.name', read_only=True, default=None,
    )
    ticket_form_name = serializers.CharField(
        source='ticket_form.name', read_only=True, default=None,
    )
    experience_groups = serializers.SerializerMethodField()

    class Meta:
        model = SupportChannel
        fields = [
            'id', 'project', 'channel_type', 'display_name', 'welcome_message',
            'ticket_confirmation_message',
            'operating_hours', 'timezone', 'offline_fallback_message',
            'offline_alternative', 'offline_alternative_target_id',
            'default_queue', 'default_queue_name',
            'ticket_form', 'ticket_form_name',
            'email_address', 'embed_key', 'is_active', 'sort_order',
            'assignment_count', 'experience_groups',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'project', 'embed_key', 'assignment_count',
            'default_queue_name', 'ticket_form_name', 'experience_groups',
            'created_at', 'updated_at',
        ]

    def get_experience_groups(self, obj):
        return [
            {'id': link.experience_group_id, 'name': link.experience_group.name}
            for link in obj.experience_group_links.all()
        ]


class SupportChannelCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportChannel
        fields = [
            'channel_type', 'display_name', 'welcome_message',
            'ticket_confirmation_message', 'operating_hours',
            'timezone', 'offline_fallback_message', 'offline_alternative',
            'offline_alternative_target_id', 'default_queue', 'ticket_form',
            'email_address', 'sort_order', 'is_active',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance is not None:
            self.fields['channel_type'].read_only = True


class ReplaceChannelAssignmentsSerializer(serializers.Serializer):
    experience_group_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        default=list,
    )


# --- Status machine config ------------------------------------------------

class TicketStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketStatus
        fields = ['id', 'slug', 'name', 'color', 'order', 'is_builtin', 'is_active']
        # order is managed by insert_custom_status (position shifting); editing it
        # directly would desync the sequence, so it is read-only here.
        read_only_fields = ['id', 'slug', 'order', 'is_builtin']


class TicketStatusCreateSerializer(serializers.Serializer):
    """Create a custom status and place it at `position` in the sequence."""
    name = serializers.CharField(max_length=100)
    color = serializers.CharField(max_length=20, required=False, default='#94a3b8')
    position = serializers.IntegerField(min_value=0, required=False, default=0)


class TicketStatusTransitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketStatusTransition
        fields = ['from_status', 'to_status']


class TicketAutoResolveConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketAutoResolveConfig
        fields = ['enabled', 'days_until_resolve', 'notification_message']


class StatusMachineSerializer(serializers.Serializer):
    """Read-only bundle of a project's whole status machine for the admin UI."""
    statuses = TicketStatusSerializer(many=True, read_only=True)
    transitions = TicketStatusTransitionSerializer(many=True, read_only=True)
    auto_resolve = TicketAutoResolveConfigSerializer(read_only=True)


class ReplaceTransitionsSerializer(serializers.Serializer):
    """Bulk-replace the permitted transition set (the matrix the admin edits)."""
    transitions = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()),
        default=list,
    )


def _rule_value_blank(v):
    """A condition/action value counts as missing when it's None, an empty or
    whitespace-only string, or an empty list."""
    return v is None or (isinstance(v, str) and not v.strip()) or (isinstance(v, (list, tuple)) and not v)


class AutomationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationRule
        fields = [
            'id', 'project', 'name', 'trigger_event', 'conditions', 'actions',
            'is_active', 'order', 'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'project', 'created_by', 'created_at', 'updated_at']

    def validate_conditions(self, value):
        # Validate on write against the shared allowlist so a typo'd field can't
        # silently make a rule never match.
        from csm.services.rule_conditions import (
            CONDITION_FIELD_CHOICES, OPERATOR_CHOICES, VALUELESS_OPERATORS, operator_valid_for_field,
        )
        if not isinstance(value, list):
            raise serializers.ValidationError('conditions must be a list.')
        for cond in value:
            if not isinstance(cond, dict):
                raise serializers.ValidationError('each condition must be an object.')
            field, operator = cond.get('field'), cond.get('operator')
            if field not in CONDITION_FIELD_CHOICES:
                raise serializers.ValidationError(f"unknown condition field: {field}")
            if operator not in OPERATOR_CHOICES:
                raise serializers.ValidationError(f"unknown operator: {operator}")
            if not operator_valid_for_field(field, operator):
                raise serializers.ValidationError(
                    f"'contains' can't be used with the '{field}' field."
                )
            # Every operator except is_set/is_empty needs a value, matching the builder.
            if operator not in VALUELESS_OPERATORS and _rule_value_blank(cond.get('value')):
                raise serializers.ValidationError(f"the '{field}' condition needs a value.")
        return value

    def validate_actions(self, value):
        from csm.services.automation import ACTIONS
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError('at least one action is required.')
        value_actions = {'add_tag', 'set_priority', 'set_status', 'assign_queue', 'assign_agent'}
        for act in value:
            if not isinstance(act, dict):
                raise serializers.ValidationError('each action must be an object.')
            atype = act.get('type')
            if atype not in ACTIONS:
                raise serializers.ValidationError(f"unknown action type: {atype}")
            # Reject actions missing the value/message they need, matching the builder.
            if atype in value_actions and _rule_value_blank(act.get('value')):
                raise serializers.ValidationError(f"the '{atype}' action needs a value.")
            if atype == 'notify' and _rule_value_blank(act.get('text')):
                raise serializers.ValidationError("the 'notify' action needs a message.")
            if atype in ('customer_notify', 'add_note') and _rule_value_blank(act.get('text')) and not act.get('template_id'):
                raise serializers.ValidationError(f"the '{atype}' action needs a message.")
        return value

    def _project_id(self):
        if self.instance is not None:
            return self.instance.project_id
        request = self.context.get('request')
        raw = request.query_params.get('project') if request else None
        return int(raw) if raw and str(raw).isdigit() else None

    def validate(self, attrs):
        project_id = self._project_id()

        # Names are unique per project so two rules can't be confused for each other.
        name = attrs.get('name', getattr(self.instance, 'name', None))
        if name and project_id:
            dupes = AutomationRule.objects.filter(project_id=project_id, name__iexact=name.strip())
            if self.instance is not None:
                dupes = dupes.exclude(pk=self.instance.pk)
            if dupes.exists():
                raise serializers.ValidationError(
                    {'name': 'A rule with this name already exists in this project.'}
                )

        # When a rule pins the ticket's status with a `status eq X` condition and
        # also sets the status, the from→to move is knowable at save time — reject
        # it up front if the workflow forbids it, instead of saving a rule that can
        # only ever no-op at run time. Unpinned rules can't be judged here; the
        # engine's guardrail handles those at run time.
        conditions = attrs.get('conditions')
        if conditions is None:
            conditions = getattr(self.instance, 'conditions', None) or []
        actions = attrs.get('actions')
        if actions is None:
            actions = getattr(self.instance, 'actions', None) or []

        pinned = next(
            (c.get('value') for c in conditions
             if c.get('field') == 'status' and c.get('operator') == 'eq'),
            None,
        )
        if pinned and project_id:
            from csm.services.status_machine import is_transition_allowed
            for act in actions:
                if act.get('type') != 'set_status':
                    continue
                target = act.get('value')
                if target and target != pinned and not is_transition_allowed(project_id, pinned, target):
                    raise serializers.ValidationError(
                        f'This rule moves status {pinned} → {target}, which your workflow does not allow.'
                    )
        return attrs


class AutomationExecutionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationExecutionLog
        fields = [
            'id', 'rule', 'rule_name', 'trigger_event', 'ticket', 'ticket_ref',
            'actions_performed', 'created_at',
        ]
        read_only_fields = fields
