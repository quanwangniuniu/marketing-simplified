"""
Migration: metadata-driven schema storage (MED-157 / MED-159).

Adds four new models that replace hard-coded column assumptions with
queryable DB records:

  FieldCategory        — extensible semantic-category registry
  DataSchemaTemplate   — replaces the hard-coded SCHEMA_REGISTRY dict
  ImportedDataField    — one row per column per uploaded file
  ImportedDataRecord   — one row per data row, with JSONB cell values

System FieldCategory rows and the Meta-Ads DataSchemaTemplate are seeded
by the data migration at the end of this file so existing behaviour is
preserved without any code changes to column_registry.py.
"""

import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


# ---------------------------------------------------------------------------
# Seed data — mirrors SCHEMA_REGISTRY and the category constants in
# column_registry.py so the system works from day one.
# ---------------------------------------------------------------------------

SYSTEM_CATEGORIES = [
    ('identifier', 'Identifier', 'Columns that identify an entity: name, ID, campaign, ad set'),
    ('financial', 'Financial', 'Monetary values: spend, cost, budget, revenue, ROAS, CPM, CPC'),
    ('engagement', 'Engagement', 'User interaction counts: impressions, clicks, reach, video views'),
    ('conversion', 'Conversion', 'Goal-completion events: purchases, leads, add-to-cart, sign-ups'),
    ('performance_ratio', 'Performance Ratio', 'Derived rate metrics: CTR, CVR, CPA, frequency'),
    ('temporal', 'Temporal', 'Date and time columns: date, week, month, reporting period'),
    ('unknown', 'Unknown', 'Could not be automatically categorised — user can reassign'),
]

META_ADS_COLUMNS = [
    {"canonical_name": "campaign_name", "aliases": ["campaign name", "campaign", "campaign_name"], "category": "identifier", "value_type": "string", "description": "Campaign name"},
    {"canonical_name": "ad_set_name", "aliases": ["ad set name", "adset name", "adset_name", "ad_set_name"], "category": "identifier", "value_type": "string", "description": "Ad set name"},
    {"canonical_name": "ad_name", "aliases": ["ad name", "ad_name", "creative name", "creative_name"], "category": "identifier", "value_type": "string", "description": "Ad name / creative"},
    {"canonical_name": "campaign_id", "aliases": ["campaign id", "campaign_id"], "category": "identifier", "value_type": "string", "description": "Campaign ID"},
    {"canonical_name": "ad_set_id", "aliases": ["ad set id", "adset id", "adset_id", "ad_set_id"], "category": "identifier", "value_type": "string", "description": "Ad set ID"},
    {"canonical_name": "ad_id", "aliases": ["ad id", "ad_id"], "category": "identifier", "value_type": "string", "description": "Ad ID"},
    {"canonical_name": "amount_spent", "aliases": ["amount spent", "amount_spent", "spend", "ad spend", "ad_spend", "cost", "total spend", "total_spend"], "category": "financial", "value_type": "number", "description": "Total amount spent (currency)"},
    {"canonical_name": "cpm", "aliases": ["cpm", "cost per 1000 impressions", "cost per thousand impressions"], "category": "financial", "value_type": "number", "description": "Cost per 1,000 impressions"},
    {"canonical_name": "cpc", "aliases": ["cpc", "cost per click", "cost per link click"], "category": "financial", "value_type": "number", "description": "Cost per click"},
    {"canonical_name": "cpp", "aliases": ["cpp", "cost per purchase", "cost per result"], "category": "financial", "value_type": "number", "description": "Cost per purchase / result"},
    {"canonical_name": "impressions", "aliases": ["impressions", "impression"], "category": "engagement", "value_type": "number", "description": "Total impressions"},
    {"canonical_name": "reach", "aliases": ["reach", "unique reach"], "category": "engagement", "value_type": "number", "description": "Unique accounts reached"},
    {"canonical_name": "clicks", "aliases": ["clicks", "all clicks", "total clicks"], "category": "engagement", "value_type": "number", "description": "Total clicks (all)"},
    {"canonical_name": "link_clicks", "aliases": ["link clicks", "link_clicks", "unique link clicks"], "category": "engagement", "value_type": "number", "description": "Link clicks"},
    {"canonical_name": "frequency", "aliases": ["frequency"], "category": "engagement", "value_type": "number", "description": "Average times each person saw the ad"},
    {"canonical_name": "video_views", "aliases": ["video views", "video_views", "3-second video views", "thruplays", "thruplay", "2-second continuous video views"], "category": "engagement", "value_type": "number", "description": "Video views"},
    {"canonical_name": "purchases", "aliases": ["purchases", "purchase", "conversions", "results", "website purchases", "omni purchases"], "category": "conversion", "value_type": "number", "description": "Purchase / conversion events"},
    {"canonical_name": "purchase_roas", "aliases": ["purchase roas", "purchase_roas", "roas", "website purchase roas"], "category": "conversion", "value_type": "number", "description": "Return on ad spend (purchases)"},
    {"canonical_name": "add_to_cart", "aliases": ["add to cart", "add_to_cart", "adds to cart", "website adds to cart"], "category": "conversion", "value_type": "number", "description": "Add-to-cart events"},
    {"canonical_name": "leads", "aliases": ["leads", "lead", "on-facebook leads", "website leads"], "category": "conversion", "value_type": "number", "description": "Lead generation events"},
    {"canonical_name": "ctr", "aliases": ["ctr", "click-through rate", "click through rate", "ctr (all)", "all ctr"], "category": "performance_ratio", "value_type": "number", "description": "Click-through rate"},
    {"canonical_name": "link_ctr", "aliases": ["link ctr", "link_ctr", "ctr (link click-through rate)"], "category": "performance_ratio", "value_type": "number", "description": "Link click-through rate"},
]


def seed_categories_and_templates(apps, schema_editor):
    FieldCategory = apps.get_model('agent', 'FieldCategory')
    DataSchemaTemplate = apps.get_model('agent', 'DataSchemaTemplate')

    for name, display_name, description in SYSTEM_CATEGORIES:
        FieldCategory.objects.get_or_create(
            name=name,
            defaults={
                'display_name': display_name,
                'description': description,
                'is_system': True,
            },
        )

    DataSchemaTemplate.objects.get_or_create(
        name='Meta Ads Performance',
        defaults={
            'source_platform': 'meta_ads',
            'description': 'Meta Ads Manager export — campaigns, ad sets, and ads performance data',
            'is_system': True,
            'is_learned': False,
            'match_threshold': 0.5,
            'usage_count': 0,
            'column_definitions': META_ADS_COLUMNS,
        },
    )


def unseed_categories_and_templates(apps, schema_editor):
    FieldCategory = apps.get_model('agent', 'FieldCategory')
    DataSchemaTemplate = apps.get_model('agent', 'DataSchemaTemplate')
    FieldCategory.objects.filter(is_system=True).delete()
    DataSchemaTemplate.objects.filter(is_system=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('agent', '0008_prepend_column_detection_to_default_workflow'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('core', '0001_initial'),
    ]

    operations = [
        # FieldCategory
        migrations.CreateModel(
            name='FieldCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('name', models.CharField(help_text="Internal snake_case key, e.g. 'financial' or 'custom_brand_metric'", max_length=50, unique=True)),
                ('display_name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True, default='')),
                ('is_system', models.BooleanField(default=False, help_text='True for built-in categories; these cannot be renamed or deleted')),
                ('color', models.CharField(blank=True, default='', help_text="Optional UI badge color, e.g. '#4CAF50'", max_length=20)),
                ('project', models.ForeignKey(blank=True, help_text='Null = global category; set = private to this project', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='field_categories', to='core.project')),
            ],
            options={
                'verbose_name_plural': 'Field categories',
                'ordering': ['name'],
            },
        ),
        migrations.AddIndex(
            model_name='fieldcategory',
            index=models.Index(fields=['name', 'is_system'], name='agent_fieldcat_name_sys_idx'),
        ),

        # DataSchemaTemplate
        migrations.CreateModel(
            name='DataSchemaTemplate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('name', models.CharField(help_text="Human-readable name, e.g. 'Meta Ads Performance'", max_length=255)),
                ('source_platform', models.CharField(choices=[('meta_ads', 'Meta Ads'), ('google_ads', 'Google Ads'), ('tiktok_ads', 'TikTok Ads'), ('klaviyo', 'Klaviyo'), ('mailchimp', 'Mailchimp'), ('custom', 'Custom / Unknown Platform')], default='custom', max_length=50)),
                ('description', models.TextField(blank=True, default='')),
                ('is_system', models.BooleanField(default=False, help_text='True for templates seeded from code; protected from automatic deletion')),
                ('is_learned', models.BooleanField(default=False, help_text='True when auto-generated from a high-confidence LLM detection result')),
                ('match_threshold', models.FloatField(default=0.5)),
                ('usage_count', models.IntegerField(default=0)),
                ('column_definitions', models.JSONField(default=list)),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='schema_templates', to='core.project')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_schema_templates', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-usage_count', 'name'],
            },
        ),
        migrations.AddIndex(
            model_name='dataschematemplate',
            index=models.Index(fields=['source_platform', 'is_system'], name='agent_dst_platform_sys_idx'),
        ),
        migrations.AddIndex(
            model_name='dataschematemplate',
            index=models.Index(fields=['project', 'is_system'], name='agent_dst_project_sys_idx'),
        ),

        # ImportedDataField
        migrations.CreateModel(
            name='ImportedDataField',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(default=False)),
                ('original_name', models.CharField(help_text='Column header as it appears in the source file', max_length=255)),
                ('canonical_name', models.CharField(default='unknown', help_text="AI-detected snake_case name confirmed by the user, or 'unknown'", max_length=255)),
                ('value_type', models.CharField(choices=[('string', 'String'), ('number', 'Number'), ('boolean', 'Boolean'), ('date', 'Date')], default='string', max_length=20)),
                ('category', models.CharField(default='unknown', help_text='Semantic category key (references FieldCategory.name)', max_length=50)),
                ('confidence', models.FloatField(default=0.0, help_text='AI detection confidence 0.0-1.0')),
                ('position', models.IntegerField(default=0, help_text='0-based column index in the source file')),
                ('null_count', models.IntegerField(default=0)),
                ('unique_count', models.IntegerField(default=0)),
                ('min_value', models.TextField(blank=True, null=True)),
                ('max_value', models.TextField(blank=True, null=True)),
                ('sample_values', models.JSONField(default=list, help_text='Up to 5 representative non-null values')),
                ('file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='data_fields', to='agent.importedcsvfile')),
                ('matched_template', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='matched_fields', to='agent.dataschematemplate')),
            ],
            options={
                'ordering': ['position'],
            },
        ),
        migrations.AddConstraint(
            model_name='importeddatafield',
            constraint=models.UniqueConstraint(fields=['file', 'position'], name='unique_imported_data_field_position'),
        ),
        migrations.AddIndex(
            model_name='importeddatafield',
            index=models.Index(fields=['file', 'category'], name='agent_idf_file_cat_idx'),
        ),
        migrations.AddIndex(
            model_name='importeddatafield',
            index=models.Index(fields=['file', 'canonical_name'], name='agent_idf_file_canon_idx'),
        ),

        # ImportedDataRecord
        migrations.CreateModel(
            name='ImportedDataRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('row_index', models.IntegerField(help_text='0-based row index in the source file')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('data', models.JSONField(default=dict, help_text='Cell values keyed by canonical_name (or original header for unknown columns)')),
                ('quality_score', models.FloatField(default=1.0, help_text='Fraction of confirmed fields with non-null values; 0.0-1.0')),
                ('file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='data_records', to='agent.importedcsvfile')),
            ],
            options={
                'ordering': ['row_index'],
            },
        ),
        migrations.AddConstraint(
            model_name='importeddatarecord',
            constraint=models.UniqueConstraint(fields=['file', 'row_index'], name='unique_imported_data_record_row'),
        ),
        migrations.AddIndex(
            model_name='importeddatarecord',
            index=models.Index(fields=['file', 'row_index'], name='agent_idr_file_row_idx'),
        ),
        migrations.AddIndex(
            model_name='importeddatarecord',
            index=models.Index(fields=['file', 'quality_score'], name='agent_idr_file_quality_idx'),
        ),

        # Seed system data
        migrations.RunPython(seed_categories_and_templates, unseed_categories_and_templates),
    ]
