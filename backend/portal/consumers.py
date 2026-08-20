import json
import logging
from channels.db import database_sync_to_async

from core.consumers import InstrumentedAsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class PortalConversationConsumer(InstrumentedAsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time updates in the customer portal.

    Connection URL: ws://host/ws/portal/conversations/{conversation_id}/?token=<access_token>

    Server → Client events:
    - new_message: An agent or system has sent a message in this conversation
    """

    ws_channel = 'portal'

    async def connect(self):
        self.conversation_id = int(self.scope['url_route']['kwargs']['conversation_id'])
        self.user = self.scope.get('user')

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        if not await self.can_access_conversation(self.conversation_id):
            await self.close(code=4003)
            return

        self.group_name = f'portal_conversation_{self.conversation_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f'[Portal WS] User {self.user.id} connected to conversation {self.conversation_id}')

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f'[Portal WS] User {getattr(self, "user", {}).id if hasattr(self, "user") else "?"} disconnected')

    async def receive(self, text_data):
        # Customers send messages via REST; nothing to do here
        pass

    async def conversation_message(self, event):
        """Forward an agent/system message to the portal client."""
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message': event['message'],
        }))

    @database_sync_to_async
    def can_access_conversation(self, conversation_id: int) -> bool:
        from csm.models import Conversation
        from customer.models import Customer
        try:
            conv = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return False
        try:
            customer = self.user.customer_profile
        except Customer.DoesNotExist:
            return False
        return conv.customer_id == customer.id
