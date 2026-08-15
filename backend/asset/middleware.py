from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
import re
from asgiref.sync import sync_to_async

from spreadsheet.ws_tickets import consume_websocket_ticket
from core.services.tenant import slug_to_schema_name

User = get_user_model()

class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware to authenticate WebSocket connections using JWT tokens.
    """
    
    async def __call__(self, scope, receive, send):
        scope['jwt_exp'] = None
        scope['auth_source'] = None
        try:
            query_string = scope.get('query_string', b'').decode('utf-8')
        except Exception:
            query_string = ''
        try:
            from urllib.parse import parse_qs
            qs = parse_qs(query_string)
        except Exception:
            qs = {}

        spreadsheet_sheet_id = self.get_spreadsheet_sheet_id(scope.get('path', ''))
        ticket_values = qs.get('ticket') or []
        if ticket_values:
            ticket = ticket_values[0]
            client_id = ((qs.get('client_id') or [''])[0] or '').strip()
            consumed = None
            if spreadsheet_sheet_id is not None and client_id:
                consumed = await sync_to_async(
                    consume_websocket_ticket,
                    thread_sensitive=False,
                )(
                    ticket,
                    expected_sheet_id=spreadsheet_sheet_id,
                    expected_client_id=client_id,
                )
            if consumed is not None:
                scope['user'] = await self.get_user_by_id(consumed.user_id)
                scope['jwt_exp'] = consumed.connection_expires_at
                scope['auth_source'] = 'ticket'
                scope['tenant_schema'] = consumed.tenant_schema
            else:
                scope['user'] = AnonymousUser()
            return await super().__call__(scope, receive, send)

        # Spreadsheet rooms are tenant-scoped and require a one-time ticket.
        # Legacy JWT header/query authentication cannot identify the tenant
        # schema safely and must fail loudly instead of joining the public room.
        if spreadsheet_sheet_id is not None:
            scope['user'] = AnonymousUser()
            scope['auth_source'] = 'spreadsheet_ticket_required'
            return await super().__call__(scope, receive, send)

        # Get the token from headers
        headers = dict(scope['headers'])
        auth_header = headers.get(b'authorization', b'').decode('utf-8')
        
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            scope['user'] = await self.get_user_from_token(token)
            scope['tenant_schema'] = await self.get_tenant_schema(scope['user'])
            scope['jwt_exp'] = self.get_token_exp(token)
            scope['auth_source'] = 'jwt_header'
        else:
            # Fallback: accept token from query string (?token=...)
            token_from_query = None
            if query_string:
                try:
                    # Support common param names
                    for key in ('token', 'access_token', 'auth', 'Authorization'):
                        values = qs.get(key)
                        if values and len(values) > 0 and values[0]:
                            token_from_query = values[0]
                            break
                except Exception:
                    token_from_query = None

            if token_from_query:
                scope['user'] = await self.get_user_from_token(token_from_query)
                scope['tenant_schema'] = await self.get_tenant_schema(scope['user'])
                scope['jwt_exp'] = self.get_token_exp(token_from_query)
                scope['auth_source'] = 'jwt_query'
            else:
                scope['user'] = AnonymousUser()
                scope['tenant_schema'] = 'public'
        
        return await super().__call__(scope, receive, send)
    
    @database_sync_to_async
    def get_user_from_token(self, token):
        """Get user from JWT token"""
        try:
            # Decode the token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            
            # Get the user
            user = User.objects.get(id=user_id)
            return user
            
        except (InvalidToken, TokenError, ObjectDoesNotExist, KeyError):
            return AnonymousUser()
        except Exception:
            return AnonymousUser()

    @database_sync_to_async
    def get_user_by_id(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except ObjectDoesNotExist:
            return AnonymousUser()

    @database_sync_to_async
    def get_tenant_schema(self, user):
        """Resolve the same active organization used by HTTP tenant middleware."""
        if not user or not user.is_authenticated:
            return 'public'

        organization_id = (
            getattr(user, 'current_organization_id', None)
            or getattr(user, 'organization_id', None)
        )
        if not organization_id:
            return 'public'

        from core.models import Organization

        slug = (
            Organization.objects
            .filter(id=organization_id, is_active=True)
            .values_list('slug', flat=True)
            .first()
        )
        return slug_to_schema_name(slug) if slug else 'public'

    @staticmethod
    def get_spreadsheet_sheet_id(path):
        match = re.fullmatch(r'/ws/spreadsheets/sheets/(\d+)/?', path or '')
        return int(match.group(1)) if match else None

    @staticmethod
    def get_token_exp(token):
        """Return the validated access-token expiry for connection lifecycle checks."""
        try:
            value = AccessToken(token).get('exp')
            return int(value) if value is not None else None
        except (InvalidToken, TokenError, TypeError, ValueError):
            return None
        except Exception:
            return None
