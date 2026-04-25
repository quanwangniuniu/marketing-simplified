from django.contrib import admin

from core.models import ProjectInvitation


@admin.register(ProjectInvitation)
class ProjectInvitationAdmin(admin.ModelAdmin):
    """Admin interface for ProjectInvitation model"""
    list_display = ['email', 'project', 'role', 'invited_by', 'approved', 'accepted', 'expires_at', 'created_at']
    list_filter = ['approved', 'accepted', 'role', 'created_at', 'expires_at']
    search_fields = ['email', 'project__name', 'invited_by__email']
    readonly_fields = ['token', 'created_at', 'updated_at', 'accepted_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Invitation Details', {
            'fields': ('email', 'project', 'role', 'invited_by', 'token')
        }),
        ('Status', {
            'fields': ('approved', 'approved_by', 'approved_at', 'accepted', 'accepted_at', 'expires_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
