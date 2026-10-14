import axios from 'axios';
import { API_BASE } from '../config/api.js';

let nextSessionId = 0;

// Each login owns a permanent lifetime. Ending it does not depend on React's
// effect cleanup, so pending work is invalid before another account can render.
export function createAuthSession(user, token) {
  const controller = new AbortController();
  const pendingSignals = new Map();
  const api = axios.create({ baseURL: API_BASE });
  const backend = new URL(API_BASE);

  const assertActive = () => {
    if (controller.signal.aborted) throw new axios.CanceledError('Authentication session ended');
  };

  const releaseSignal = (request) => {
    pendingSignals.get(request)?.();
    pendingSignals.delete(request);
  };

  api.interceptors.request.use((request) => {
    assertActive();
    const target = new URL(api.getUri(request));
    if (target.origin !== backend.origin ||
        !(target.pathname === backend.pathname || target.pathname.startsWith(`${backend.pathname}/`))) {
      throw new axios.CanceledError('Request is outside the authenticated API');
    }
    // Never read a later account's token, including after hashing/encryption or
    // when an old callback tries to start a second request in a sequence.
    request.headers.set('Authorization', `Bearer ${token}`);
    const callerSignal = request.signal;
    if (!callerSignal || callerSignal === controller.signal) {
      request.signal = controller.signal;
    } else if (typeof AbortSignal.any === 'function') {
      request.signal = AbortSignal.any([controller.signal, callerSignal]);
    } else {
      const combined = new AbortController();
      const release = () => {
        controller.signal.removeEventListener('abort', abort);
        callerSignal.removeEventListener('abort', abort);
        pendingSignals.delete(request);
      };
      const abort = () => {
        combined.abort();
        release();
      };
      pendingSignals.set(request, release);
      controller.signal.addEventListener('abort', abort, { once: true });
      callerSignal.addEventListener('abort', abort, { once: true });
      if (controller.signal.aborted || callerSignal.aborted) abort();
      request.signal = combined.signal;
    }
    return request;
  });

  api.interceptors.response.use((response) => {
    releaseSignal(response.config);
    // Aborting the network is only an optimization. This check also protects
    // against responses already queued or adapters that ignore cancellation.
    assertActive();
    return response;
  }, (error) => {
    releaseSignal(error?.config);
    assertActive();
    return Promise.reject(error);
  });

  return {
    id: ++nextSessionId,
    user,
    token,
    api,
    isActive: () => !controller.signal.aborted,
    assertActive,
    invalidate() {
      controller.abort();
      for (const release of pendingSignals.values()) release();
      pendingSignals.clear();
    },
    guard(callback) {
      return (...args) => {
        if (!controller.signal.aborted) return callback(...args);
      };
    },
  };
}
