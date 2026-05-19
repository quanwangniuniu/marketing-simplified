from rest_framework import serializers
from experience_group.models import ExperienceGroup
from .models import SupportChannel


class NestedExperienceGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExperienceGroup
        fields = ['id', 'name', 'description', 'status']
        read_only_fields = ['id', 'status']


class SupportChannelSerializer(serializers.ModelSerializer):
    experience_groups = NestedExperienceGroupSerializer(many=True, read_only=True)
    experience_group_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=ExperienceGroup.objects.all(),
        write_only=True,
        required=False,
        source='experience_groups',
    )
    channel_type_display = serializers.CharField(
        source='get_channel_type_display', read_only=True
    )

    class Meta:
        model = SupportChannel
        fields = [
            'id', 'name', 'channel_type', 'channel_type_display',
            'welcome_message', 'offline_fallback_message',
            'routing_destination', 'operating_hours',
            'is_active', 'experience_groups', 'experience_group_ids',
            'project', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        experience_groups = validated_data.pop('experience_groups', [])
        channel = SupportChannel.objects.create(**validated_data)
        channel.experience_groups.set(experience_groups)
        return channel

    def update(self, instance, validated_data):
        experience_groups = validated_data.pop('experience_groups', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if experience_groups is not None:
            instance.experience_groups.set(experience_groups)
        return instance
