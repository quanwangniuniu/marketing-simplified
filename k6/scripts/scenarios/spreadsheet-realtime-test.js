/**
 * Local realtime-collaboration benchmark for spreadsheet sheet rooms.
 *
 * Each VU holds one authenticated sheet WebSocket for the full session. The
 * scenario can keep sockets idle (heartbeat only), broadcast cursor updates,
 * or commit cells over REST while peers measure WebSocket propagation delay.
 *
 * Required env:
 *   K6_TEST_USER_EMAIL, K6_TEST_USER_PASSWORD
 *   SPREADSHEET_SLUG, SHEET_ID
 * Optional env:
 *   SCENARIO=idle|cursor|edit, VUS=10, SESSION_SECONDS=30
 *   CURSOR_INTERVAL_MS=1000, EDIT_INTERVAL_MS=2000
 *   START_STAGGER_MS=0 (delay each VU by this increment before connecting)
 *   CELL_MODE=distributed|same
 */
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const scenario = __ENV.SCENARIO || 'idle';
const vus = Number(__ENV.VUS || 1);
const sessionSeconds = Number(__ENV.SESSION_SECONDS || 30);
const cursorIntervalMs = Number(__ENV.CURSOR_INTERVAL_MS || 1000);
const editIntervalMs = Number(__ENV.EDIT_INTERVAL_MS || 2000);
const startStaggerMs = Number(__ENV.START_STAGGER_MS || 0);
const baseUrl = (__ENV.K6_BASE_URL || 'http://backend-dev:8000').replace(/\/$/, '');
const wsBaseUrl = (__ENV.K6_WS_URL || 'ws://backend-dev:8000').replace(/\/$/, '');
const wsOrigin = (__ENV.K6_WS_ORIGIN || __ENV.K6_FRONTEND_URL || baseUrl).replace(/\/$/, '');
const spreadsheetSlug = __ENV.SPREADSHEET_SLUG || '';
const sheetId = Number(__ENV.SHEET_ID || 0);
const cellMode = __ENV.CELL_MODE || 'distributed';

const wsConnectMs = new Trend('ws_connect_ms', true);
const wsConnectFailed = new Rate('ws_connect_failed');
const wsErrors = new Counter('ws_errors');
const wsMessages = new Counter('ws_messages_received');
const presenceSnapshots = new Counter('presence_snapshots_received');
const presenceSize = new Trend('presence_snapshot_size');
const pongs = new Counter('pongs_received');
const cursorSent = new Counter('cursor_updates_sent');
const cursorReceived = new Counter('cursor_updates_received');
const cursorRoundtripMs = new Trend('cursor_roundtrip_ms', true);
const cellWrites = new Counter('cell_writes');
const cellWriteFailed = new Rate('cell_write_failed');
const cellWriteHttpMs = new Trend('cell_write_http_ms', true);
const cellUpdatesReceived = new Counter('cell_updates_received');
const cellPropagationMs = new Trend('cell_propagation_ms', true);

const thresholds = {
  ws_connect_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
};
if (scenario === 'cursor') {
  thresholds.cursor_roundtrip_ms = ['p(95)<300'];
}
if (scenario === 'edit') {
  thresholds.cell_write_failed = ['rate<0.01'];
  thresholds.cell_write_http_ms = ['p(95)<500'];
  thresholds.cell_propagation_ms = ['p(95)<300'];
}

export const options = {
  scenarios: {
    spreadsheet_realtime: {
      executor: 'per-vu-iterations',
      vus: vus,
      iterations: 1,
      maxDuration: `${sessionSeconds + Math.ceil(vus * startStaggerMs / 1000) + 20}s`,
    },
  },
  thresholds: thresholds,
  tags: {
    feature: 'spreadsheet_realtime',
    scenario: scenario,
    configured_vus: String(vus),
    cell_mode: cellMode,
  },
};

export function setup() {
  if (!spreadsheetSlug || !sheetId) {
    throw new Error('SPREADSHEET_SLUG and SHEET_ID are required');
  }

  const health = http.get(`${baseUrl}/health/`, { tags: { name: 'setup_health' } });
  if (!check(health, { 'setup health is 200': (r) => r.status === 200 })) {
    throw new Error(`Backend health check failed: ${health.status}`);
  }

  const login = http.post(
    `${baseUrl}/auth/login/`,
    JSON.stringify({
      email: __ENV.K6_TEST_USER_EMAIL,
      password: __ENV.K6_TEST_USER_PASSWORD,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'setup_login' },
    },
  );
  const loginOk = check(login, {
    'setup login is 200': (r) => r.status === 200,
    'setup login returns token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body.token && body.organization_access_token);
      } catch (_) {
        return false;
      }
    },
  });
  if (!loginOk) {
    throw new Error(`Login failed: ${login.status} ${String(login.body).slice(0, 200)}`);
  }
  const auth = JSON.parse(login.body);
  return {
    token: auth.token,
    organizationToken: auth.organization_access_token,
  };
}

export default function (data) {
  if (startStaggerMs > 0) {
    sleep(((__VU - 1) * startStaggerMs) / 1000);
  }

  const clientId = `sheet-rt-${scenario}-${cellMode}-${__VU}-${Date.now()}`;
  const ticketResponse = http.post(
    `${baseUrl}/api/spreadsheet/sheets/${sheetId}/ws-ticket/`,
    JSON.stringify({ client_id: clientId }),
    {
      headers: {
        Authorization: `Bearer ${data.token}`,
        'X-Organization-Token': data.organizationToken,
        'Content-Type': 'application/json',
        'X-Sheet-Client-Id': clientId,
      },
      tags: { name: 'sheet_ws_ticket' },
      timeout: '10s',
    },
  );
  const ticketOk = check(ticketResponse, {
    'websocket ticket is 200': (r) => r.status === 200,
    'websocket ticket is present': (r) => {
      try {
        return Boolean(JSON.parse(r.body).ticket);
      } catch (_) {
        return false;
      }
    },
  });
  if (!ticketOk) {
    wsConnectFailed.add(true);
    return;
  }
  const ticket = JSON.parse(ticketResponse.body).ticket;
  const socketUrl = `${wsBaseUrl}/ws/spreadsheets/sheets/${sheetId}/?ticket=${encodeURIComponent(ticket)}&client_id=${encodeURIComponent(clientId)}`;
  const cursorSentAtByCell = {};
  let cursorSequence = 0;
  let editSequence = 0;

  const response = ws.connect(socketUrl, {
    headers: { Origin: wsOrigin },
    tags: { name: `sheet_ws_${scenario}` },
  }, (socket) => {
    socket.on('open', () => {
      socket.setInterval(() => {
        socket.send(JSON.stringify({ type: 'ping' }));
      }, 10000);

      if (scenario === 'cursor') {
        socket.setInterval(() => {
          cursorSequence += 1;
          const row = (__VU * 7 + cursorSequence) % 100;
          const col = (__VU + cursorSequence) % 20;
          cursorSentAtByCell[`${row}:${col}`] = Date.now();
          cursorSent.add(1);
          socket.send(JSON.stringify({
            type: 'cursor_update',
            client_id: clientId,
            row: row,
            col: col,
            start_row: row,
            end_row: row,
            start_col: col,
            end_col: col,
            is_active: true,
          }));
        }, cursorIntervalMs);
      }

      if (scenario === 'edit') {
        socket.setInterval(() => {
          editSequence += 1;
          const sentAt = Date.now();
          const row = cellMode === 'same' ? 2 : 10 + __VU;
          const column = cellMode === 'same' ? 2 : editSequence % 10;
          const marker = `sheet-rt-perf|${sentAt}|${__VU}|${editSequence}`;
          const result = http.post(
            `${baseUrl}/api/spreadsheet/spreadsheets/${spreadsheetSlug}/sheets/${sheetId}/cells/batch/`,
            JSON.stringify({
              operations: [{ operation: 'set', row: row, column: column, raw_input: marker }],
              auto_expand: true,
              client_id: clientId,
            }),
            {
              headers: {
                Authorization: `Bearer ${data.token}`,
                'X-Organization-Token': data.organizationToken,
                'Content-Type': 'application/json',
                'X-Sheet-Client-Id': clientId,
              },
              tags: { name: `cell_batch_${cellMode}` },
              timeout: '10s',
            },
          );
          cellWrites.add(1);
          cellWriteHttpMs.add(result.timings.duration);
          cellWriteFailed.add(result.status !== 200);
          check(result, { 'cell write is 200': (r) => r.status === 200 });
        }, editIntervalMs);
      }

      socket.setTimeout(() => socket.close(), sessionSeconds * 1000);
    });

    socket.on('message', (raw) => {
      wsMessages.add(1);
      let message;
      try {
        message = JSON.parse(raw);
      } catch (_) {
        wsErrors.add(1);
        return;
      }

      if (message.type === 'presence_snapshot') {
        presenceSnapshots.add(1);
        presenceSize.add(Array.isArray(message.users) ? message.users.length : 0);
        return;
      }
      if (message.type === 'pong') {
        pongs.add(1);
        return;
      }
      if (message.type === 'cursor_updated') {
        cursorReceived.add(1);
        if (message.client_id === clientId) {
          const key = `${message.row}:${message.col}`;
          const sentAt = cursorSentAtByCell[key];
          if (sentAt > 0) {
            cursorRoundtripMs.add(Date.now() - sentAt);
            delete cursorSentAtByCell[key];
          }
        }
        return;
      }
      if (message.type === 'cells_updated') {
        // Propagation is a peer-to-peer metric. Never count an origin echo,
        // even if the deployment under test has not enabled server suppression.
        if (message.origin_client_id === clientId) return;
        const cells = Array.isArray(message.cells) ? message.cells : [];
        cellUpdatesReceived.add(cells.length);
        for (let i = 0; i < cells.length; i += 1) {
          const marker = cells[i] && cells[i].raw_input;
          if (typeof marker !== 'string' || marker.indexOf('sheet-rt-perf|') !== 0) continue;
          const parts = marker.split('|');
          const sentAt = Number(parts[1]);
          if (sentAt > 0) cellPropagationMs.add(Math.max(0, Date.now() - sentAt));
        }
      }
    });

    socket.on('error', () => {
      wsErrors.add(1);
    });
  });

  const connected = response && response.status === 101;
  wsConnectFailed.add(!connected);
  if (response && response.timings) wsConnectMs.add(response.timings.duration);
  check(response, { 'websocket upgraded': (r) => r && r.status === 101 });
}
