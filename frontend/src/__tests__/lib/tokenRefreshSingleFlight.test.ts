import axios from 'axios';
import type { AxiosAdapter, AxiosError, InternalAxiosRequestConfig } from 'axios';
import api, { persistAuthTokens, clearPersistedAuthState } from '@/lib/api';
import { api as preferencesApiClient } from '@/lib/api/preferencesApi';

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };


function reject401(config: RetriableRequestConfig) {
  return Promise.reject({
    response: { status: 401, data: {} },
    config,
  } as AxiosError);
}


function resolve200(config: RetriableRequestConfig) {
  return Promise.resolve({
    data: { ok: true },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
}

describe('single-flight token refresh', () => {
  const originalApiAdapter = api.defaults.adapter;
  const originalPreferencesAdapter = preferencesApiClient.defaults.adapter;

  beforeEach(() => {
    persistAuthTokens({
      token: 'old-access-token',
      refreshToken: 'valid-refresh-token',
      user: { id: 1, roles: [] } as any,
    });
  });

  afterEach(() => {
    api.defaults.adapter = originalApiAdapter;
    preferencesApiClient.defaults.adapter = originalPreferencesAdapter;
    clearPersistedAuthState();
    jest.restoreAllMocks();
  });

  // Scenario: three requests receive 401 at (effectively) the same time.
  // Without single-flight, each would independently call the refresh
  // endpoint (three calls). This proves they now share one in-flight
  // refresh instead, and all three still get retried successfully.
  it('three concurrent 401s trigger exactly one refresh call, and all requests retry successfully', async () => {
    const mockAdapter = jest
      .fn()
      .mockImplementationOnce(reject401)
      .mockImplementationOnce(reject401)
      .mockImplementationOnce(reject401)
      .mockImplementationOnce(resolve200)
      .mockImplementationOnce(resolve200)
      .mockImplementationOnce(resolve200);
    api.defaults.adapter = mockAdapter as unknown as AxiosAdapter;

    const refreshSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: { access: 'new-access-token', refresh: 'new-refresh-token' },
    } as any);

    const results = await Promise.all([
      api.get('/protected/one/'),
      api.get('/protected/two/'),
      api.get('/protected/three/'),
    ]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    results.forEach((res) => expect(res.status).toBe(200));
  });

  // Scenario: the refresh call itself fails (e.g. refresh token expired).
  // All three requests should still only trigger ONE refresh attempt
  // (not three), and all three should end up rejected rather than hanging
  // or silently retrying forever.
  it('when refresh fails, refresh is still only attempted once and all requests reject', async () => {
    const mockAdapter = jest
      .fn()
      .mockImplementationOnce(reject401)
      .mockImplementationOnce(reject401)
      .mockImplementationOnce(reject401);
    api.defaults.adapter = mockAdapter as unknown as AxiosAdapter;

    const refreshSpy = jest.spyOn(axios, 'post').mockRejectedValue({
      response: { status: 401, data: { detail: 'Refresh token invalid' } },
    });

    const results = await Promise.allSettled([
      api.get('/protected/one/'),
      api.get('/protected/two/'),
      api.get('/protected/three/'),
    ]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    results.forEach((res) => expect(res.status).toBe('rejected'));
  });

  // Scenario: two DIFFERENT axios instances — api.ts's own instance, and
  // preferencesApi.ts's separate instance — both get a 401 around the same
  // time. Proves the shared refresh promise lives in one place (api.ts) and
  // is genuinely reused across files, not just within a single instance.
  it('a 401 from preferencesApi and a 401 from api share the same single refresh call', async () => {
    const mockApiAdapter = jest
      .fn()
      .mockImplementationOnce(reject401)
      .mockImplementationOnce(resolve200);
    api.defaults.adapter = mockApiAdapter as unknown as AxiosAdapter;

    const mockPreferencesAdapter = jest
      .fn()
      .mockImplementationOnce(reject401)
      .mockImplementationOnce(resolve200);
    preferencesApiClient.defaults.adapter = mockPreferencesAdapter as unknown as AxiosAdapter;

    const refreshSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: { access: 'new-access-token', refresh: 'new-refresh-token' },
    } as any);

    const results = await Promise.all([
      api.get('/protected/one/'),
      preferencesApiClient.get('/users/me/preferences/'),
    ]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    results.forEach((res) => expect(res.status).toBe(200));
  });
});
