import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import axios from 'axios';
import { API_BASE } from '../src/config/api.js';
import {
  dispatchMediaUrl, downloadMedia, loadMediaImage, mediaDownloadFailure, publicMediaUrl,
} from '../src/utils/mediaAccess.js';

const mediaUrl = '/api/media/files/attachment-7-example.png';

function mockStorage(t, token = null) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => token },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });
}

function mockUrls(t) {
  return {
    create: t.mock.method(URL, 'createObjectURL', () => 'blob:test-image'),
    revoke: t.mock.method(URL, 'revokeObjectURL', () => {}),
  };
}

test('current and legacy media URLs resolve only to the configured Dispatch backend', () => {
  const origin = API_BASE.replace(/\/api$/, '');
  assert.equal(dispatchMediaUrl(mediaUrl), `${origin}${mediaUrl}`);
  assert.equal(dispatchMediaUrl(`${API_BASE}/media/files/new.png`), `${API_BASE}/media/files/new.png`);
  assert.equal(dispatchMediaUrl('/uploads/old.png'), `${origin}/uploads/old.png`);
  assert.equal(dispatchMediaUrl('http://localhost:8080/uploads/old.png'), `${origin}/uploads/old.png`);
  assert.equal(dispatchMediaUrl('https://untrusted.example/uploads/file.png'), null);
  assert.equal(dispatchMediaUrl(`${origin}.untrusted.example/uploads/file.png`), null);
  const publicUrl = 'https://example.supabase.co/storage/v1/object/public/images/new.png';
  assert.equal(publicMediaUrl(publicUrl), publicUrl);
});

test('a valid protected image loads its Blob and cleanup aborts and revokes exactly once', async (t) => {
  mockStorage(t);
  const blob = new Blob(['image bytes'], { type: 'image/png' });
  const request = t.mock.method(axios, 'get', async () => ({ data: blob }));
  const urls = mockUrls(t);
  const states = [];
  const cleanup = loadMediaImage(mediaUrl, (value) => states.push(value));
  await setImmediate();
  assert.deepEqual(states, [{ status: 'ready', url: 'blob:test-image' }]);
  assert.equal(urls.create.mock.calls[0].arguments[0], blob);
  assert.equal(request.mock.calls[0].arguments[1].responseType, 'blob');
  assert.equal(request.mock.calls[0].arguments[1].signal.aborted, false);
  cleanup();
  cleanup();
  assert.equal(request.mock.calls[0].arguments[1].signal.aborted, true);
  assert.equal(urls.revoke.mock.callCount(), 1);
  assert.equal(urls.revoke.mock.calls[0].arguments[0], 'blob:test-image');
});

for (const url of [mediaUrl, '/uploads/legacy.png', 'http://localhost:8080/uploads/legacy.png']) {
  test(`authenticated media request retains Authorization for ${url}`, async (t) => {
    mockStorage(t, 'test-token');
    const request = t.mock.method(axios, 'get', async () => ({ data: new Blob() }));
    mockUrls(t);
    const cleanup = loadMediaImage(url, () => {});
    t.after(cleanup);
    await setImmediate();
    assert.deepEqual(request.mock.calls[0].arguments[1].headers, { Authorization: 'Bearer test-token' });
  });
}

test('external URLs are never fetched with Dispatch credentials', async (t) => {
  mockStorage(t, 'test-token');
  const request = t.mock.method(axios, 'get', async () => ({ data: new Blob() }));
  await assert.rejects(downloadMedia('https://untrusted.example/uploads/file.png'), /URL tệp không hợp lệ/);
  assert.equal(request.mock.callCount(), 0);
});

for (const [status, expected, message, retryable] of [
  [404, 'missing', 'Ảnh không còn tồn tại', false],
  [401, 'unauthenticated', 'Vui lòng đăng nhập lại để xem ảnh.', false],
  [403, 'forbidden', 'Bạn không có quyền xem ảnh này.', false],
  [500, 'service-error', 'Dịch vụ ảnh đang gặp sự cố. Vui lòng thử lại.', true],
  [503, 'service-error', 'Dịch vụ ảnh đang gặp sự cố. Vui lòng thử lại.', true],
]) {
  test(`HTTP ${status} has distinct visible state and no automatic retry or raw error logs`, async (t) => {
    mockStorage(t);
    const request = t.mock.method(axios, 'get', async () => {
      throw { response: { status }, config: { headers: { Authorization: 'sensitive-test-token' } } };
    });
    const errors = t.mock.method(console, 'error', () => {});
    const urls = mockUrls(t);
    const states = [];
    const cleanup = loadMediaImage(mediaUrl, (value) => states.push(value));
    t.after(cleanup);
    await setImmediate();
    await setImmediate();
    assert.deepEqual(states, [{ status: expected, message, retryable }]);
    assert.equal(request.mock.callCount(), 1);
    assert.equal(urls.create.mock.callCount(), 0);
    assert.equal(errors.mock.callCount(), 0);
  });
}

test('service failure is recoverable by an explicit new request', async (t) => {
  mockStorage(t);
  let attempts = 0;
  const request = t.mock.method(axios, 'get', async () => {
    if (++attempts === 1) throw { response: { status: 503 } };
    return { data: new Blob() };
  });
  mockUrls(t);
  const states = [];
  const firstCleanup = loadMediaImage(mediaUrl, (value) => states.push(value));
  await setImmediate();
  assert.equal(states[0].retryable, true);
  assert.equal(request.mock.callCount(), 1);
  firstCleanup();
  const retryCleanup = loadMediaImage(mediaUrl, (value) => states.push(value));
  t.after(retryCleanup);
  await setImmediate();
  assert.equal(request.mock.callCount(), 2);
  assert.equal(states[1].status, 'ready');
});

test('unmount before a late successful response creates no Blob URL and never updates state', async (t) => {
  mockStorage(t);
  let resolve;
  const request = t.mock.method(axios, 'get', () => new Promise((done) => { resolve = done; }));
  const urls = mockUrls(t);
  const states = [];
  const cleanup = loadMediaImage(mediaUrl, (value) => states.push(value));
  cleanup();
  resolve({ data: new Blob() });
  await setImmediate();
  assert.equal(request.mock.calls[0].arguments[1].signal.aborted, true);
  assert.equal(urls.create.mock.callCount(), 0);
  assert.equal(urls.revoke.mock.callCount(), 0);
  assert.deepEqual(states, []);
});

test('unmount before a late error never updates state or logs an error', async (t) => {
  mockStorage(t);
  let reject;
  t.mock.method(axios, 'get', () => new Promise((_, fail) => { reject = fail; }));
  const errors = t.mock.method(console, 'error', () => {});
  const states = [];
  const cleanup = loadMediaImage(mediaUrl, (value) => states.push(value));
  cleanup();
  reject({ response: { status: 500 } });
  await setImmediate();
  assert.deepEqual(states, []);
  assert.equal(errors.mock.callCount(), 0);
});

test('an aborted request is not shown as a missing image or service failure', async (t) => {
  mockStorage(t);
  t.mock.method(axios, 'get', async () => { throw new axios.CanceledError(); });
  const states = [];
  const cleanup = loadMediaImage(mediaUrl, (value) => states.push(value));
  t.after(cleanup);
  await setImmediate();
  assert.deepEqual(states, []);
});

test('a network error remains visible and offers a manual retry', async (t) => {
  mockStorage(t);
  t.mock.method(axios, 'get', async () => { throw new Error('Network Error'); });
  const states = [];
  const cleanup = loadMediaImage(mediaUrl, (value) => states.push(value));
  t.after(cleanup);
  await setImmediate();
  assert.equal(states[0].status, 'error');
  assert.equal(states[0].retryable, true);
  assert.notEqual(states[0].message, 'Ảnh không còn tồn tại');
});

for (const [status, expected, retryable] of [
  [404, 'missing', false], [401, 'unauthenticated', false], [403, 'forbidden', false],
  [500, 'service-error', true], [503, 'service-error', true],
]) {
  test(`download HTTP ${status} stays distinct without exposing request credentials`, () => {
    const failure = mediaDownloadFailure({
      response: { status }, config: { headers: { Authorization: 'sensitive-test-token' } },
    });
    assert.equal(failure.status, expected);
    assert.equal(failure.retryable, retryable);
    assert.equal(JSON.stringify(failure).includes('sensitive-test-token'), false);
    if (status === 404) assert.equal(failure.message, 'Tệp không còn tồn tại');
  });
}

test('an aborted download cannot create a Blob URL after a late response', async (t) => {
  mockStorage(t);
  let resolve;
  t.mock.method(axios, 'get', () => new Promise((done) => { resolve = done; }));
  const urls = mockUrls(t);
  const controller = new AbortController();
  const downloading = downloadMedia(mediaUrl, 'example.png', { signal: controller.signal });
  controller.abort();
  resolve({ data: new Blob() });
  await assert.rejects(downloading, (error) => axios.isCancel(error));
  assert.equal(urls.create.mock.callCount(), 0);
});

test('download removes its link and schedules Blob cleanup even if clicking fails', async (t) => {
  mockStorage(t);
  t.mock.method(axios, 'get', async () => ({ data: new Blob() }));
  const urls = mockUrls(t);
  const link = { click() { throw new Error('Download blocked'); }, remove: t.mock.fn() };
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => link, body: { appendChild: t.mock.fn() } },
  });
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  });
  const timer = t.mock.method(globalThis, 'setTimeout', () => 1);
  await assert.rejects(downloadMedia(mediaUrl, 'example.png'), /Download blocked/);
  assert.equal(link.href, 'blob:test-image');
  assert.equal(link.download, 'example.png');
  assert.equal(link.remove.mock.callCount(), 1);
  assert.equal(timer.mock.calls[0].arguments[1], 1000);
  timer.mock.calls[0].arguments[0]();
  assert.equal(urls.revoke.mock.callCount(), 1);
});
