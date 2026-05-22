from rest_framework import serializers

from .models import AdCopyVariation


class AdCopyVariationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdCopyVariation
        fields = [
            'id', 'project', 'creative', 'source_mode', 'source_ref',
            'hook', 'headline', 'description', 'cta',
            'instruction', 'model_name', 'prompt_version',
            'batch_id', 'batch_position', 'status',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'project', 'created_by', 'created_at', 'updated_at']
