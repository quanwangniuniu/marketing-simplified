from django.db import models
from core.models import TimeStampedModel


class SupportChannel(TimeStampedModel):
    """A configurable support channel instance."""

    class ChannelType(models.TextChoices):
        LIVE_CHAT = 'live_chat_widget', 'Live Chat Widget'
        CONTACT_FORM = 'contact_form', 'Contact Form'
        EMAIL = 'email', 'Email'

    project = models.ForeignKey(
        'core.Project',
        on_delete=models.CASCADE,
        related_name='support_channels',
    )
    name = models.CharField(max_length=200, help_text="Display name for this channel")
    channel_type = models.CharField(
        max_length=30,
        choices=ChannelType.choices,
        help_text="Type of support channel",
    )
    welcome_message = models.TextField(
        blank=True,
        default='',
        help_text="Message shown to customers when they open the channel",
    )
    offline_fallback_message = models.TextField(
        blank=True,
        default='',
        help_text="Message shown when channel is outside operating hours",
    )
    routing_destination = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text="Where conversations/submissions are routed (e.g. team name or queue)",
    )
    operating_hours = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Weekly operating hours schedule. "
            "Example: {\"monday\": {\"open\": true, \"start\": \"09:00\", \"end\": \"17:00\"}, ...}"
        ),
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive channels are hidden from customers but visible in admin",
    )
    experience_groups = models.ManyToManyField(
        'experience_group.ExperienceGroup',
        blank=True,
        related_name='channels',
        help_text="Experience Groups this channel is assigned to",
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_channel_type_display()})"
