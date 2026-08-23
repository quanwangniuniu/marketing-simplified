/**
 * End-to-end chat burst benchmark: authenticated HTTP sends plus WebSocket
 * delivery timing for distinct users in one prepared group channel.
 *
 * Prepare local data first:
 *   docker exec backend-dev python manage.py prepare_chat_load_test \
 *     --organization-slug <slug> --project-id <tenant-project-id> --users 100
 *
 * Run a safe smoke test before increasing VUS:
 *   docker compose -f docker-compose.dev.yml run --rm \
 *     -e VUS=2 -e SESSION_SECONDS=10 k6 \
 *     run /scripts/scenarios/chat-realtime-load-test.js
 */
import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const config = JSON.parse(open(__ENV.CREDENTIALS_FILE || '/data/users.json'));
const users = new SharedArray('chat load users', () => config.users);
const vus = Number(__ENV.VUS || Math.min(users.length, 10));
const sessionSeconds = Number(__ENV.SESSION_SECONDS || 20);
// Every VU must have finished connecting and joined its groups before any
// of them writes, or the run measures arrival order rather than delivery.
// Verified by chat_ready_after_barrier, which has to stay at 0.
const warmupSeconds = Number(__ENV.WARMUP_SECONDS || 15);
const httpTimeoutSeconds = Number(__ENV.HTTP_TIMEOUT_SECONDS || 15);
const baseUrl = (__ENV.K6_BASE_URL || 'http://backend-dev:8000').replace(/\/$/, '');
const wsBaseUrl = (__ENV.K6_WS_URL || baseUrl.replace(/^http/, 'ws')).replace(/\/$/, '');
const wsOrigin = (__ENV.K6_WS_ORIGIN || __ENV.K6_FRONTEND_URL || baseUrl).replace(/\/$/, '');

const sendHttpMs = new Trend('chat_send_http_ms', true);
const sendFailed = new Rate('chat_send_failed');
const wsConnectFailed = new Rate('chat_ws_connect_failed');
const wsDeliveryMs = new Trend('chat_ws_delivery_ms', true);
const wsMessages = new Counter('chat_ws_messages_received');
const wsDuplicates = new Counter('chat_ws_duplicate_messages');
const wsErrors = new Counter('chat_ws_errors');
// A VU that only becomes ready after the write barrier has opened was not
// part of the burst: peers were already publishing while it was still
// connecting, so any message it missed says nothing about delivery.
// This must be 0 for a run's delivery count to mean anything.
const readyAfterBarrier = new Counter('chat_ready_after_barrier');

export const options = {
  scenarios: {
    chat_burst: {
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
    chat_send_http_ms: [`p(95)<${Number(__ENV.HTTP_P95_MS || 500)}`],
    chat_ws_delivery_ms: [`p(95)<${Number(__ENV.WS_P95_MS || 1000)}`],
    chat_ws_duplicate_messages: ['count==0'],
  },
  tags: {
    feature: 'chat_realtime',
    configured_vus: String(vus),
  },
};

export function setup() {
  if (!config.chat_id || users.length < vus) {
    throw new Error(`users.json must contain chat_id and at least ${vus} users`);
  }
  const health = http.get(`${baseUrl}/health/`, { tags: { name: 'chat_setup_health' } });
  if (!check(health, { 'backend health is 200': (response) => response.status === 200 })) {
    throw new Error(`Backend health check failed: ${health.status}`);
  }
  return {
    runId: `chat-load-${Date.now()}`,
    // Give every WebSocket time to finish group membership before opening the
    // write barrier. Without this, the first ready VUs send while the remaining
    // VUs are still recovering and the test is not a simultaneous burst.
    sendAt: Date.now() + warmupSeconds * 1000,
  };
}

export default function (data) {
  const credential = users[__VU - 1];
  const runPrefix = `${data.runId}|`;
  const messageIds = {};
  let sent = false;
  let received = 0;

  const socketUrl = `${wsBaseUrl}/ws/chat/${credential.user_id}/?token=${encodeURIComponent(credential.token)}`;
  const response = ws.connect(
    socketUrl,
    {
      headers: { Origin: wsOrigin },
      tags: { name: 'chat_user_websocket' },
    },
    (socket) => {
      socket.on('message', (raw) => {
        let event;
        try {
          event = JSON.parse(raw);
        } catch (_) {
          wsErrors.add(1);
          return;
        }

        if (event.type === 'presence_snapshot' && !sent) {
          sent = true;
          readyAfterBarrier.add(Date.now() > data.sendAt ? 1 : 0);
          socket.setTimeout(() => {
            const clientMessageId = `${data.runId}-${credential.user_id}-${__VU}`;
            const headers = {
              Authorization: `Bearer ${credential.token}`,
              'Content-Type': 'application/json',
            };
            if (credential.organization_token) {
              headers['X-Organization-Token'] = credential.organization_token;
            }
            const sendResponse = http.post(
              `${baseUrl}/api/chat/messages/`,
              JSON.stringify({
                chat: config.chat_id,
                content: `${runPrefix}sender=${credential.user_id};vu=${__VU}`,
                client_message_id: clientMessageId,
              }),
              {
                headers: headers,
                timeout: `${httpTimeoutSeconds}s`,
                tags: { name: 'chat_send_message' },
              },
            );
            sendHttpMs.add(sendResponse.timings.duration);
            const accepted = sendResponse.status === 200 || sendResponse.status === 201;
            sendFailed.add(!accepted);
            check(sendResponse, { 'message send is accepted': () => accepted });
          }, Math.max(1, data.sendAt - Date.now()));
          return;
        }

        if (event.type !== 'chat_message' || !event.message) {
          return;
        }
        const message = event.message;
        if (typeof message.content !== 'string' || !message.content.startsWith(runPrefix)) {
          return;
        }

        if (messageIds[message.id]) {
          wsDuplicates.add(1);
          return;
        }
        messageIds[message.id] = true;
        received += 1;
        wsMessages.add(1);
        const createdAt = Date.parse(message.created_at);
        if (!Number.isNaN(createdAt)) {
          wsDeliveryMs.add(Math.max(0, Date.now() - createdAt));
        }
      });

      socket.on('error', () => wsErrors.add(1));
      socket.setTimeout(() => socket.close(), sessionSeconds * 1000);
    },
  );

  const connected = response && response.status === 101;
  wsConnectFailed.add(!connected);
  check(response, { 'websocket upgraded': () => connected });
  check(received, {
    'received every peer message': (count) => count === vus - 1,
  });
}
