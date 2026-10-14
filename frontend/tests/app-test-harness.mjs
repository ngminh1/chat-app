import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement, act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { Window } from 'happy-dom';
import { build } from 'vite';

const harnessKey = '__dispatchAppSessionTest';
const accessHarness = `globalThis.${harnessKey}`;
const fixtures = {
  '@stomp/stompjs': `export class Client {
    constructor(options) {
      this.options = options;
      this.connected = false;
      this.subscriptions = new Map();
      ${accessHarness}.clients.push(this);
    }
    activate() {}
    deactivate() { this.connected = false; return Promise.resolve(); }
    subscribe(topic, callback) {
      this.subscriptions.set(topic, callback);
      return { unsubscribe() {} };
    }
  }`,
  'sockjs-client': 'export default class SockJS {}',
  'lucide-react': 'export const Loader2 = () => null; export const AlertCircle = () => null;',
  './utils/soundEffects': `export const soundManager = {
    listenForUserActivation: () => () => {},
    playIncomingMessageSound: () => ${accessHarness}.sounds.push('incoming'),
    playOutgoingMessageSound: () => ${accessHarness}.sounds.push('outgoing'),
    playReactionSound: () => ${accessHarness}.sounds.push('reaction')
  };`,
  './utils/browserNotifications': `export const showDesktopNotification = (...args) => ${accessHarness}.notifications.push(args);`,
  './utils/crypto': `export const encryptMessage = (...args) => ${accessHarness}.encrypt(...args);`,
  './utils/aesKeyManager': `export const getConversationAESKey = (...args) => ${accessHarness}.getKey(...args); export const clearAESKeyCache = () => {};`,
  './utils/messageDecryption': `export const createMessageDecryptor = () => ({
    decryptMessagePayload: (...args) => ${accessHarness}.decryptMessage(...args),
    decryptConversationPreview: (...args) => ${accessHarness}.decryptPreview(...args),
    clearFailures: () => {}
  }); export const getReadableMessageText = (message) => message.content;`
};

// Compile the real App and its session helpers. Only transport, crypto and child
// views are replaced; React state/effects and all App callbacks execute normally.
// No test can fall through to an actual backend, socket or hosted media service.
const bundled = await build({
  configFile: false,
  logLevel: 'silent',
  envDir: false,
  define: { 'import.meta.env.VITE_BACKEND_URL': JSON.stringify('http://local.test') },
  oxc: { jsx: { runtime: 'automatic' } },
  plugins: [{
    name: 'app-session-test-doubles',
    enforce: 'pre',
    resolveId(source) {
      if (source === 'axios' || source === 'react' || source.startsWith('react/')) {
        return { id: import.meta.resolve(source), external: true };
      }
      if (fixtures[source] || source.startsWith('./components/')) return `\0test-double:${source}`;
    },
    load(id) {
      if (!id.startsWith('\0test-double:')) return;
      const source = id.slice('\0test-double:'.length);
      if (fixtures[source]) return fixtures[source];
      const name = source.slice('./components/'.length);
      return `import { useEffect } from 'react';
        export default function Component(props) {
          ${accessHarness}.props.set('${name}', props);
          useEffect(() => {
            ${accessHarness}.mounted.add('${name}');
            return () => ${accessHarness}.mounted.delete('${name}');
          }, []);
          return null;
        }`;
    }
  }],
  build: {
    write: false,
    minify: false,
    lib: { entry: fileURLToPath(new URL('../src/App.jsx', import.meta.url)), formats: ['es'] }
  }
});
const appCode = (Array.isArray(bundled) ? bundled : [bundled])
  .flatMap((result) => result.output)
  .find((file) => file.type === 'chunk' && file.isEntry).code;
const { default: App } = await import(`data:text/javascript;base64,${Buffer.from(appCode).toString('base64')}`);

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export const userA = { id: 11, token: 'local-token-A', displayName: 'Account A' };
export const userB = { id: 22, token: 'local-token-B', displayName: 'Account B' };
export const conversation = (id, title, unreadCount = 0) => ({
  conversationId: id, title, type: 'DIRECT', theme: 'blue', lastMessage: title, unreadCount,
  otherUser: { id: 33, displayName: 'Local fixture' }
});
export const message = (id, conversationId, content = 'Local fixture') => ({
  id, conversationId, senderId: 33, senderName: 'Local fixture', messageType: 'TEXT', content
});

export async function mountApp(t, { user = userA, strict = false } = {}) {
  const browser = new Window({ url: 'http://local.test/' });
  const previous = new Map();
  const globals = {
    window: browser,
    document: browser.document,
    localStorage: browser.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  if (user) {
    browser.localStorage.setItem('auth_token', user.token);
    browser.localStorage.setItem('auth_user', JSON.stringify(user));
  }
  const container = browser.document.createElement('div');
  browser.document.body.append(container);
  const root = createRoot(container);
  const h = {
    browser, container, props: new Map(), mounted: new Set(), requests: [], clients: [], sounds: [], notifications: [],
    getKey: async () => 'test-key',
    encrypt: async () => ({ ciphertext: 'test-ciphertext', iv: 'test-iv', encryptionVersion: 'AES_GCM_V1' }),
    decryptMessage: async (value) => value,
    decryptPreview: async (value) => value,
    // Abort is deliberately ignored by the transport. A completed response or
    // crypto operation can race cancellation; session validity must still win.
    request(config) {
      const { method, url } = config;
      assert.ok(url.startsWith('http://local.test/'), 'requests stay in the local fake transport');
      const pending = deferred();
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      const request = { method, url, body, config, ...pending, taken: false };
      h.requests.push(request);
      if (/\/chat\/(presence|typing)$/.test(url)) pending.resolve({ data: {} });
      return pending.promise.then((response) => ({ status: 200, statusText: 'OK', headers: {}, config, ...response }));
    },
    view(name) {
      assert.ok(h.mounted.has(name), `${name} is mounted`);
      return h.props.get(name);
    },
    take(method, path) {
      const match = h.requests.find((item) => !item.taken && item.method === method && item.url.endsWith(path));
      assert.ok(match, `expected ${method.toUpperCase()} ${path}`);
      match.taken = true;
      return match;
    },
    async flush() {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    },
    async resolve(request, data) {
      await act(async () => { request.resolve({ data }); });
    },
    async login(nextUser = userB) {
      await act(async () => { h.view('AuthScreen').onLoginSuccess(nextUser); });
      await h.flush();
    },
    async logout() {
      await act(async () => { h.view('Sidebar').onLogout(); });
    },
    async switchTo(nextUser = userB) {
      await h.logout();
      await h.login(nextUser);
    },
    async connect(client = h.clients.at(-1)) {
      await act(async () => { client.connected = true; client.options.onConnect(); });
      return client;
    },
    async select(conv) {
      await act(async () => { void h.view('Sidebar').onSelectConversation(conv); });
      return h.take('put', `/chat/conversations/${conv.conversationId}/read`);
    }
  };
  const previousAdapter = axios.defaults.adapter;
  axios.defaults.adapter = h.request;
  globalThis[harnessKey] = h;
  t.after(async () => {
    await act(async () => { root.unmount(); });
    await browser.happyDOM.close();
    axios.defaults.adapter = previousAdapter;
    delete globalThis[harnessKey];
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  await act(async () => { root.render(strict ? createElement(StrictMode, null, createElement(App)) : createElement(App)); });
  await h.flush();
  return h;
}

export { act };
