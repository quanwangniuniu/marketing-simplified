import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

const sendHttpTrend = new Trend('chat_send_http_ms');
const sendFailedRate = new Rate('chat_send_failed');

export const options = {
  scenarios: {
    chat_spike: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 1 },    // Baseline
        { duration: '5s', target: 50 },    // Sudden spike to 50 VUs
        { duration: '30s', target: 50 },   // Hold spike
        { duration: '10s', target: 1 },    // Recovery
      ],
      gracefulStop: '5s',
    },
  },
  thresholds: {
    chat_send_failed: ['rate<0.01'],
    chat_send_http_ms: ['p(95)<1000'],
  },
};

export default function () {
  const baseUrl = __ENV.K6_BASE_URL || 'http://localhost:8000';
  const start = Date.now();
  const res = http.get(`${baseUrl}/api/tasks/`);
  sendHttpTrend.add(Date.now() - start);
  const success = res.status === 200 || res.status === 401;
  sendFailedRate.add(!success);
  check(res, { 'status is expected': () => success });
  sleep(0.5);
}
