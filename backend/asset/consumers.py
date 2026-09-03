import json
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from core.consumers import InstrumentedAsyncWebsocketConsumer
from .models import Asset


class AssetConsumer(InstrumentedAsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time asset updates.
    Handles connections to asset-specific groups for live updates.
    """

    ws_channel = 'asset'

    async def connect(self):
        """Handle WebSocket connection"""
        self.asset_id = self.scope['url_route']['kwargs']['asset_id']
        self.room_group_name = f'asset_{self.asset_id}'
        
        # Check if user is authenticated
        if isinstance(self.scope['user'], AnonymousUser):
            await self.close()
            return
        
        # Check if asset exists
        asset = await self.get_asset()
        if not asset:
            await self.close()
            return
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'asset_id': self.asset_id,
            'user_id': self.scope['user'].id,
            'username': self.scope['user'].username,
            'message': f'Connected to asset {self.asset_id} updates'
        }))
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'message')
            
            if message_type == 'ping':
                # Handle ping for connection keep-alive
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': text_data_json.get('timestamp')
                }))
            else:
                # Echo back other messages (for testing)
                await self.send(text_data=json.dumps({
                    'type': 'echo',
                    'message': text_data_json
                }))
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
    
    @database_sync_to_async
    def get_asset(self):
        """Get asset from database"""
        try:
            return Asset.objects.get(pk=self.asset_id)
        except Asset.DoesNotExist:
            return None
    
    # Handler methods for different event types
    
    async def asset_status_changed(self, event):
        """Handle asset status change events"""
        await self.send(text_data=json.dumps({
            'type': 'statusChanged',
            'asset_id': event['asset_id'],
            'from': event['from_state'],
            'to': event['to_state'],
            'changed_by': event['changed_by'],
            'timestamp': event['timestamp'],
            'metadata': event.get('metadata', {})
        }))
    
    async def version_uploaded(self, event):
        """Handle version upload events"""
        await self.send(text_data=json.dumps({
            'type': 'versionUploaded',
            'asset_id': event['asset_id'],
            'version_number': event['version_number'],
            'uploaded_by': event['uploaded_by'],
            'file_name': event['file_name'],
            'timestamp': event['timestamp']
        }))
    
    async def version_published(self, event):
        """Handle version published events"""
        await self.send(text_data=json.dumps({
            'type': 'versionPublished',
            'asset_id': event['asset_id'],
            'version_number': event['version_number'],
            'published_by': event['published_by'],
            'file_name': event['file_name'],
            'timestamp': event['timestamp']
        }))
    
    async def comment_added(self, event):
        """Handle comment addition events"""
        await self.send(text_data=json.dumps({
            'type': 'commentAdded',
            'asset_id': event['asset_id'],
            'comment_id': event['comment_id'],
            'user_id': event['user_id'],
            'body': event['body'],
            'timestamp': event['timestamp']
        }))
    
    async def review_assigned(self, event):
        """Handle review assignment events"""
        await self.send(text_data=json.dumps({
            'type': 'reviewAssigned',
            'asset_id': event['asset_id'],
            'assigned_user_id': event['assigned_user_id'],
            'role': event['role'],
            'assigned_by': event['assigned_by'],
            'timestamp': event['timestamp']
        }))
    
    async def review_action(self, event):
        """Handle review action events"""
        await self.send(text_data=json.dumps({
            'type': 'reviewAction',
            'asset_id': event['asset_id'],
            'action': event['action'],
            'performed_by': event['performed_by'],
            'comment': event.get('comment'),
            'timestamp': event['timestamp']
        }))
    
    async def version_scan_started(self, event):
        """Handle version scan started events"""
        await self.send(text_data=json.dumps({
            'type': 'versionScanStarted',
            'asset_id': event['asset_id'],
            'version_id': event['version_id'],
            'version_number': event['version_number'],
            'timestamp': event['timestamp']
        }))
    
    async def version_scan_completed(self, event):
        """Handle version scan completed events"""
        await self.send(text_data=json.dumps({
            'type': 'versionScanCompleted',
            'asset_id': event['asset_id'],
            'version_id': event['version_id'],
            'version_number': event['version_number'],
            'scan_status': event['scan_status'],
            'scan_result': event['scan_result'],
            'timestamp': event['timestamp']
        }))
    
 