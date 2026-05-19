from rest_framework import serializers

from .models import ExperienceGroup


class ExperienceGroupSerializer(serializers.ModelSerializer):
    customer_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ExperienceGroup
        fields = [
            'id',
            'name',
            'description',
            'status',
            'draft_snapshot',
            'created_by',
            'created_at',
            'updated_at',
            'published_at',
            'customer_count',
        ]
        read_only_fields = [
            'id',
            'status',
            'created_by',
            'created_at',
            'updated_at',
            'published_at',
            'customer_count',
        ]

    def get_customer_count(self, obj):
        return obj.customers.count()

    def _project_id(self):
        if self.instance and self.instance.project_id:
            return self.instance.project_id
        return self.context.get('project_id')

    def validate_name(self, value):
        project_id = self._project_id()
        qs = ExperienceGroup.objects.filter(name__iexact=value)
        if project_id is not None:
            qs = qs.filter(project_id=project_id)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'A group with this name already exists in this project.'
            )
        return value


class ExperienceGroupListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExperienceGroup
        fields = [
            'id',
            'name',
            'description',
            'status',
            'created_at',
            'updated_at',
        ]
