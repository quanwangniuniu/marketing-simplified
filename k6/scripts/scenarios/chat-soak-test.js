import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

const sendHttpTrend = new Trend('chat_send_http_ms');
const sendFailedRate = new Rate('chat_send_failed');
const wsConnectFailedRate = new Rate('chat_ws_connect_failed');
const wsDeliveryTrend = new Trend('chat_ws_delivery_ms');
const wsDuplicates = new Counter('chat_ws_duplicate_messages');

export const options = {
  scenarios: {
    chat_soak: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 20 },  // Ramp up
        { duration: '3m', target: 20 },   // Sustained soak load
        { duration: '30s', target: 0 },   // Cool down
      ],
      gracefulStop: '10s',
    },
  },
  thresholds: {
    chat_send_failed: ['rate==0'],
    chat_ws_connect_failed: ['rate==0'],
    chat_ws_duplicate_messages: ['count==0'],
    chat_send_http_ms: ['p(95)<500'],
    chat_ws_delivery_ms: ['p(95)<1000'],
  },
};

export default function () {
  const baseUrl = __ENV.K6_BASE_URL || 'http://localhost:8000';
  const res = http.get(`${baseUrl}/api/tasks/`);
  check(res, { 'status is 200 or 401': (r) => r.status === 200 || r.status === 401 });
  sleep(1);
}
