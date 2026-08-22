import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend, Rate } from 'k6/metrics';

const jitterTrend = new Trend('network_jitter_simulated_ms');
const sendFailedRate = new Rate('chat_send_failed');

export const options = {
  scenarios: {
    network_jitter: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
  thresholds: {
    chat_send_failed: ['rate<0.01'],
  },
};

export default function () {
  const baseUrl = __ENV.K6_BASE_URL || 'http://localhost:8000';
  
  // Simulate randomized network jitter delay (10ms to 200ms)
  const jitterMs = Math.floor(Math.random() * 190) + 10;
  jitterTrend.add(jitterMs);
  sleep(jitterMs / 1000);

  const res = http.get(`${baseUrl}/api/tasks/`);
  const success = res.status === 200 || res.status === 401;
  sendFailedRate.add(!success);
  check(res, { 'request succeeded despite jitter': () => success });
}
