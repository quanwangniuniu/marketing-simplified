import logging
from copy import deepcopy
from typing import Dict, List

from core.utils.project import initialize_project_dashboards, validate_project_config

logger = logging.getLogger(__name__)

# Default advertising channels per project (matches legacy budget UI options; stored as real AdChannel rows).
DEFAULT_AD_CHANNEL_NAMES: tuple[str, ...] = ('TikTok', 'Facebook')

DEFAULT_BUDGET_STRUCTURES: Dict[str, List[Dict]] = {
    'single_consolidated': [
        {
            'name': 'Master Budget',
            'allocation': 1.0,
            'notes': 'Single consolidated pacing bucket for the entire project.',
        }
    ],
    'platform_specific': [
        {
            'name': 'Meta',
            'allocation': 0.4,
            'notes': 'Initial placeholder allocation per platform.',
        },
        {
            'name': 'Google Ads',
            'allocation': 0.35,
            'notes': 'Adjust after first sync with Spend data.',
        },
        {
            'name': 'Other',
            'allocation': 0.25,
            'notes': 'Catch-all for remaining platforms.',
        },
    ],
    'campaign_level': [
        {
            'name': 'Prospecting',
            'allocation': 0.5,
            'notes': 'Prospecting / upper-funnel initiatives.',
        },
        {
            'name': 'Retargeting',
            'allocation': 0.3,
            'notes': 'Retargeting / lower-funnel initiatives.',
        },
        {
            'name': 'Testing',
            'allocation': 0.2,
            'notes': 'Creative or bid testing allocation.',
        },
    ],
    'client_mandated': [
        {
            'name': 'Client Provided Structure',
            'allocation': 1.0,
            'notes': 'Replicate client mandated budget splits once available.',
        }
    ],
}


class ProjectInitializationService:
    """
    Service responsible for initializing new projects using the SMP-323 plan.
    """

    DASHBOARD_CONFIG_VERSION = 1

    @classmethod
    def ensure_default_ad_channels(cls, project):
        """Create baseline AdChannel rows for budget forms (idempotent)."""
        from core.models import AdChannel

        for name in DEFAULT_AD_CHANNEL_NAMES:
            AdChannel.objects.get_or_create(project=project, name=name)

    @classmethod
    def initialize_project(cls, project):
        """
        Initialize dashboards, report templates, and budget scaffolding.
        """

        is_valid, errors = validate_project_config(project)
        if not is_valid:
            logger.info(
                "Project %s has configuration issues prior to initialization: %s",
                project.id,
                errors,
            )

        try:
            cls.ensure_default_ad_channels(project)
            cls._initialize_dashboards(project)
            if project.budget_management_type:
                cls._initialize_budget_structures(project)
        except Exception:  # pragma: no cover - safeguard
            logger.exception("Project initialization encountered an error.")

    @classmethod
    def _initialize_dashboards(cls, project) -> List[Dict]:
        """
        Build dashboard definitions and store them on the project budget config.
        """

        dashboard_definitions = initialize_project_dashboards(project)
        if not dashboard_definitions:
            return []

        config = deepcopy(project.budget_config) if project.budget_config else {}
        existing_slugs = {item.get('slug') for item in config.get('dashboards', [])}
        updates_required = any(d['slug'] not in existing_slugs for d in dashboard_definitions)

        if updates_required:
            merged_dashboards = config.get('dashboards', [])
            # Replace dashboards with same slug, append new ones otherwise.
            slug_to_dashboard = {item['slug']: item for item in merged_dashboards if 'slug' in item}
            for definition in dashboard_definitions:
                slug_to_dashboard[definition['slug']] = definition
            config['dashboards'] = list(slug_to_dashboard.values())
            config['dashboard_version'] = cls.DASHBOARD_CONFIG_VERSION

            project.budget_config = config
            project.save(update_fields=['budget_config'])

        return dashboard_definitions

    @classmethod
    def _initialize_budget_structures(cls, project):
        """
        Seed baseline budget pool structures so pacing dashboards have context.
        """

        config = deepcopy(project.budget_config) if project.budget_config else {}
        if config.get('budget_structures'):
            return

        template = DEFAULT_BUDGET_STRUCTURES.get(
            project.budget_management_type, DEFAULT_BUDGET_STRUCTURES['single_consolidated']
        )
        config['budget_structures'] = template
        project.budget_config = config
        project.save(update_fields=['budget_config'])

