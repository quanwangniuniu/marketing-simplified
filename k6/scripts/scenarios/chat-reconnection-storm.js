import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const config = JSON.parse(open(__ENV.CREDENTIALS_FILE || '/data/users.json'));
const users = new SharedArray('chat load users', () => config.users);
const vus = Number(__ENV.VUS || Math.min(users.length, 10));
const sessionSeconds = Number(__ENV.SESSION_SECONDS || 40);
const baseUrl = (__ENV.K6_BASE_URL || 'http://backend-dev:8000').replace(/\/$/, '');
const wsBaseUrl = (__ENV.K6_WS_URL || baseUrl.replace(/^http/, 'ws')).replace(/\/$/, '');
const wsOrigin = (__ENV.K6_WS_ORIGIN || __ENV.K6_FRONTEND_URL || baseUrl).replace(/\/$/, '');

const wsDuplicates = new Counter('chat_ws_duplicate_messages');

export const options = {
  scenarios: {
    reconnection_storm: {
      executor: 'per-vu-iterations',
      vus: vus,
      iterations: 1,
      maxDuration: `${sessionSeconds + 30}s`,
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
    chat_ws_duplicate_messages: ['count==0'],
  },
};

export function setup() { return { runId: `reconnect-${Date.now()}` }; }

export default function (data) {
  const credential = users[__VU - 1];
  const socketUrl = `${wsBaseUrl}/ws/chat/${credential.user_id}/?token=${encodeURIComponent(credential.token)}`;
  const messageIds = {};

  const connectOpts = { headers: { Origin: wsOrigin } };
  
  // Phase 1: Connect and disconnect
  ws.connect(socketUrl, connectOpts, (socket) => {
    socket.setTimeout(() => socket.close(), 5000);
  });

  // Phase 2: Send offline messages
  const payload = {
    chat: config.chat_id,
    content: `${data.runId}|offline_msg`,
    client_message_id: `${data.runId}-${credential.user_id}-offline`
  };
  http.post(`${baseUrl}/api/chat/messages/`, JSON.stringify(payload), {
    headers: { Authorization: `Bearer ${credential.token}`, 'Content-Type': 'application/json' }
  });

  // Phase 3: Reconnect storm and verify recovery without duplicates
  ws.connect(socketUrl, connectOpts, (socket) => {
    socket.on('message', (raw) => {
      let event;
      try { event = JSON.parse(raw); } catch (_) { return; }
      if (event.type === 'chat_message' && event.message && event.message.content.startsWith(`${data.runId}|`)) {
        if (messageIds[event.message.id]) wsDuplicates.add(1);
        messageIds[event.message.id] = true;
      }
    });
    socket.setTimeout(() => socket.close(), 10000);
  });
}
