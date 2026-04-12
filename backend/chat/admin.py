from django.contrib import admin
from .models import Chat, ChatParticipant, ChatStar, Message, MessageStatus


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ['id', 'type', 'name', 'project', 'participant_count', 'created_at', 'updated_at']
    list_filter = ['type', 'created_at']
    search_fields = ['name', 'project__name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('project', 'type', 'name')
        }),
        ('Metadata', {
            'fields': ('is_deleted', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def participant_count(self, obj):
        """Show number of active participants"""
        return obj.participants.filter(is_active=True).count()
    participant_count.short_description = 'Participants'


@admin.register(ChatStar)
class ChatStarAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'chat', 'position', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__email', 'chat__name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ChatParticipant)
class ChatParticipantAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'chat', 'joined_at', 'is_active', 'unread_count', 'last_read_at']
    list_filter = ['is_active', 'joined_at']
    search_fields = ['user__email', 'chat__name']
    readonly_fields = ['joined_at', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Relationship', {
            'fields': ('chat', 'user')
        }),
        ('Status', {
            'fields': ('is_active', 'joined_at', 'last_read_at')
        }),
        ('Metadata', {
            'fields': ('is_deleted', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def unread_count(self, obj):
        """Show unread message count"""
        return obj.get_unread_count()
    unread_count.short_description = 'Unread'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'sender', 'chat', 'content_preview', 'status_summary', 'created_at']
    list_filter = ['created_at', 'chat__type']
    search_fields = ['content', 'sender__email', 'chat__name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Message', {
            'fields': ('chat', 'sender', 'content')
        }),
        ('Metadata', {
            'fields': ('is_deleted', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def content_preview(self, obj):
        """Show preview of message content"""
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'
    
    def status_summary(self, obj):
        """Show status summary (e.g., '3 read, 2 delivered')"""
        statuses = obj.statuses.values('status').annotate(count=models.Count('status'))
        summary = ', '.join([f"{s['count']} {s['status']}" for s in statuses])
        return summary or 'No status'
    status_summary.short_description = 'Status'


@admin.register(MessageStatus)
class MessageStatusAdmin(admin.ModelAdmin):
    list_display = ['id', 'message_preview', 'user', 'status', 'delivered_at', 'read_at', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__email', 'message__content']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Status Entry', {
            'fields': ('message', 'user', 'status')
        }),
        ('Timestamps', {
            'fields': ('delivered_at', 'read_at')
        }),
        ('Metadata', {
            'fields': ('is_deleted', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def message_preview(self, obj):
        """Show preview of message content"""
        content = obj.message.content
        return content[:30] + '...' if len(content) > 30 else content
    message_preview.short_description = 'Message'


# Import models for admin functions
from django.db import models
