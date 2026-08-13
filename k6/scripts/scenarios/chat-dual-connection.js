import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const config = JSON.parse(open(__ENV.CREDENTIALS_FILE || '/data/users.json'));
const users = new SharedArray('chat load users', () => config.users);
const vus = Number(__ENV.VUS || Math.min(users.length, 10));
const sessionSeconds = Number(__ENV.SESSION_SECONDS || 30);
const baseUrl = (__ENV.K6_BASE_URL || 'http://backend-dev:8000').replace(/\/$/, '');
const wsBaseUrl = (__ENV.K6_WS_URL || baseUrl.replace(/^http/, 'ws')).replace(/\/$/, '');
const wsOrigin = (__ENV.K6_WS_ORIGIN || __ENV.K6_FRONTEND_URL || baseUrl).replace(/\/$/, '');

const wsConnectFailed = new Rate('chat_ws_connect_failed');
const messagesPerSocket = new Counter('messages_per_socket');

export const options = {
  scenarios: {
    dual_connection: {
      executor: 'per-vu-iterations',
      vus: vus,
      iterations: 1,
      maxDuration: `${sessionSeconds + 30}s`,
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
    chat_ws_connect_failed: ['rate==0'],
  },
};

export function setup() { return { runId: `dual-${Date.now()}` }; }

export default function (data) {
  const credential = users[__VU - 1];
  const socketUrl = `${wsBaseUrl}/ws/chat/${credential.user_id}/?token=${encodeURIComponent(credential.token)}`;
  
  const connectOpts = { headers: { Origin: wsOrigin } };
  
  let conn1Ready = false;
  let conn2Ready = false;

  const onMessage = (socket) => {
    socket.on('message', (raw) => {
      let event;
      try { event = JSON.parse(raw); } catch (_) { return; }
      if (event.type === 'chat_message') messagesPerSocket.add(1);
    });
    socket.setTimeout(() => socket.close(), sessionSeconds * 1000);
  };

  const c1 = ws.connect(socketUrl, connectOpts, (s) => onMessage(s));
  const c2 = ws.connect(socketUrl, connectOpts, (s) => onMessage(s));
  
  wsConnectFailed.add(c1 && c1.status !== 101);
  wsConnectFailed.add(c2 && c2.status !== 101);

  if (c1 && c1.status === 101 && c2 && c2.status === 101) {
      // both connected
      const payload = {
        chat: config.chat_id,
        content: `${data.runId}|dual_test`,
        client_message_id: `${data.runId}-${credential.user_id}-dual`
      };
      http.post(`${baseUrl}/api/chat/messages/`, JSON.stringify(payload), {
        headers: { Authorization: `Bearer ${credential.token}`, 'Content-Type': 'application/json' }
      });
  }
}
