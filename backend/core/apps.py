from django.apps import AppConfig
import os


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)))

    def ready(self):
        import core.signals  # noqa: F401
        import core.messaging.signals  # noqa: F401
