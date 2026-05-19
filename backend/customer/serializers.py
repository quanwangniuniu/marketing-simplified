from rest_framework import serializers

from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    experience_group_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id',
            'email',
            'full_name',
            'company',
            'phone',
            'experience_group',
            'experience_group_name',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'experience_group_name']

    def get_experience_group_name(self, obj):
        if obj.experience_group_id:
            return obj.experience_group.name
        return None

    def _project_id(self):
        if self.instance and self.instance.project_id:
            return self.instance.project_id
        return self.context.get('project_id')

    def validate_email(self, value):
        project_id = self._project_id()
        qs = Customer.objects.filter(email__iexact=value)
        if project_id is not None:
            qs = qs.filter(project_id=project_id)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'A customer with this email already exists in this project.'
            )
        return value.lower()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        experience_group = attrs.get('experience_group')
        if experience_group is None and self.instance:
            experience_group = self.instance.experience_group
        project_id = self._project_id()
        if experience_group is not None and project_id is not None:
            if experience_group.project_id != project_id:
                raise serializers.ValidationError(
                    {'experience_group': 'Group must belong to the same project.'}
                )
        return attrs
