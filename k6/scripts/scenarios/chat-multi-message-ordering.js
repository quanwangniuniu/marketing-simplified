import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const config = JSON.parse(open(__ENV.CREDENTIALS_FILE || '/data/users.json'));
const users = new SharedArray('chat load users', () => config.users);
const vus = Number(__ENV.VUS || Math.min(users.length, 10));
const sessionSeconds = Number(__ENV.SESSION_SECONDS || 30);
const baseUrl = (__ENV.K6_BASE_URL || 'http://backend-dev:8000').replace(/\/$/, '');
const wsBaseUrl = (__ENV.K6_WS_URL || baseUrl.replace(/^http/, 'ws')).replace(/\/$/, '');
const wsOrigin = (__ENV.K6_WS_ORIGIN || __ENV.K6_FRONTEND_URL || baseUrl).replace(/\/$/, '');

const sendFailed = new Rate('chat_send_failed');
const wsConnectFailed = new Rate('chat_ws_connect_failed');
const orderBrokenSockets = new Counter('order_broken_sockets');

export const options = {
  scenarios: {
    multi_message_ordering: {
      executor: 'per-vu-iterations',
      vus: vus,
      iterations: 1,
      maxDuration: `${sessionSeconds + 30}s`,
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
    chat_send_failed: ['rate==0'],
    chat_ws_connect_failed: ['rate==0'],
    order_broken_sockets: ['count==0'],
  },
};

export function setup() {
  if (!config.chat_id || users.length < vus) {
    throw new Error(`users.json must contain chat_id and at least ${vus} users`);
  }
  return { runId: `ordering-${Date.now()}` };
}

export default function (data) {
  const credential = users[__VU - 1];
  const socketUrl = `${wsBaseUrl}/ws/chat/${credential.user_id}/?token=${encodeURIComponent(credential.token)}`;
  let lastMsgIndex = -1;
  let orderBroken = false;
  let receivedCount = 0;
  const numMessages = 5;

  const response = ws.connect(socketUrl, { headers: { Origin: wsOrigin } }, (socket) => {
    socket.on('message', (raw) => {
      let event;
      try { event = JSON.parse(raw); } catch (_) { return; }
      
      if (event.type === 'presence_snapshot') {
        for (let i = 0; i < numMessages; i++) {
          const payload = {
            chat: config.chat_id,
            content: `${data.runId}|sender=${credential.user_id};vu=${__VU};msg=${i}`,
            client_message_id: `${data.runId}-${credential.user_id}-${__VU}-${i}`
          };
          const headers = {
            Authorization: `Bearer ${credential.token}`,
            'Content-Type': 'application/json',
          };
          const res = http.post(`${baseUrl}/api/chat/messages/`, JSON.stringify(payload), { headers });
          sendFailed.add(res.status !== 200 && res.status !== 201);
        }
        return;
      }

      if (event.type === 'chat_message' && event.message && event.message.content.startsWith(`${data.runId}|sender=${credential.user_id}`)) {
        const parts = event.message.content.split('msg=');
        if (parts.length > 1) {
          const msgIndex = parseInt(parts[1], 10);
          if (msgIndex <= lastMsgIndex) {
            orderBroken = true;
          }
          lastMsgIndex = msgIndex;
          receivedCount++;
        }
      }
    });

    socket.setTimeout(() => socket.close(), sessionSeconds * 1000);
  });

  wsConnectFailed.add(response && response.status !== 101);
  if (orderBroken) orderBrokenSockets.add(1);
  
  check(orderBroken, { 'order is perfectly maintained': (val) => val === false });
}
