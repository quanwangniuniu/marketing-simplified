from django.contrib import admin

from .models import GoogleCalendarConnection


@admin.register(GoogleCalendarConnection)
class GoogleCalendarConnectionAdmin(admin.ModelAdmin):
    list_display = ("user", "google_email", "is_active", "needs_reconnect", "last_import_at")
    raw_id_fields = ("user", "import_calendar")
