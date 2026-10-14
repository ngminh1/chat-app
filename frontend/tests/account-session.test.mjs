import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { mountApp, act, deferred, userA, userB, conversation, message } from './app-test-harness.mjs';

const aConversation = conversation(7, 'Private account A', 5);
const bConversation = conversation(7, 'Private account B', 9);
const conversationsPath = (user) => `/chat/conversations/my-chats/${user.id}`;

test('A pending conversation response cannot overwrite B after logout and login', async (t) => {
  const h = await mountApp(t);
  const pendingA = h.take('get', conversationsPath(userA));
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);

  await h.resolve(pendingA, [aConversation]);

  assert.deepEqual(h.view('Sidebar').conversations, [bConversation]);
  assert.equal(h.view('Sidebar').currentUser.id, userB.id);
  assert.equal(JSON.parse(localStorage.getItem('auth_user')).id, userB.id);
});

test('logout clears cached conversations immediately and stale A finally cannot finish B loading', async (t) => {
  const h = await mountApp(t);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  const clientA = await h.connect();
  await act(async () => {
    void clientA.subscriptions.get(`/topic/users/${userA.id}/messages`)({ body: JSON.stringify({ event: 'GROUP_MEMBERS_CHANGED' }) });
  });
  const refreshA = h.take('get', conversationsPath(userA));

  await h.switchTo();
  assert.deepEqual(h.view('Sidebar').conversations, []);
  assert.equal(h.view('Sidebar').isLoadingConversations, true);
  await h.resolve(refreshA, [aConversation]);
  assert.deepEqual(h.view('Sidebar').conversations, []);
  assert.equal(h.view('Sidebar').isLoadingConversations, true, 'only the current session can finish its loading indicator');
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  assert.equal(h.view('Sidebar').isLoadingConversations, false);
});

test('A preview decryption already in progress cannot publish into B', async (t) => {
  const h = await mountApp(t);
  const preview = deferred();
  h.decryptPreview = (value, userId) => userId === userA.id ? preview.promise : Promise.resolve(value);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  await act(async () => { preview.resolve(aConversation); });
  assert.deepEqual(h.view('Sidebar').conversations, [bConversation]);
  assert.equal(h.view('Sidebar').isLoadingConversations, false);
});

test('same user logging out and in receives a new lifetime, even with the same token', async (t) => {
  const h = await mountApp(t);
  const previousLogin = h.take('get', conversationsPath(userA));
  await h.switchTo(userA);
  const nextConversation = conversation(19, 'New login');
  await h.resolve(h.take('get', conversationsPath(userA)), [nextConversation]);
  await h.resolve(previousLogin, [aConversation]);
  assert.deepEqual(h.view('Sidebar').conversations, [nextConversation]);
});

test('old profile and group callbacks cannot change B identity, storage, rooms or modal state', async (t) => {
  const h = await mountApp(t);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  await h.select(aConversation);
  const profileA = h.view('ProfileModal').onProfileUpdated;
  const groupCreatedA = h.view('CreateGroupModal').onGroupCreated;
  const groupUpdatedA = h.view('GroupDetailModal').onGroupUpdated;
  const groupLeftA = h.view('GroupDetailModal').onLeftGroup;
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  await h.select(bConversation);
  const beforeRequestCount = h.requests.length;

  await act(async () => {
    profileA({ id: userA.id, displayName: 'Stale A profile' });
    groupCreatedA({ id: 99, title: 'Stale A group' });
    groupUpdatedA({ title: 'Stale A update', theme: 'red' });
    groupLeftA();
  });

  assert.equal(h.view('Sidebar').currentUser.id, userB.id);
  assert.equal(h.view('Sidebar').currentUser.displayName, userB.displayName);
  assert.equal(JSON.parse(localStorage.getItem('auth_user')).id, userB.id);
  assert.deepEqual(h.view('ChatArea').activeConversation, bConversation);
  assert.equal(h.requests.length, beforeRequestCount, 'old child callbacks must not start requests as B');
});

test('A message-history decrypt cannot populate B even when conversation IDs overlap', async (t) => {
  const h = await mountApp(t);
  const decryptA = deferred();
  h.decryptMessage = (value, userId) => userId === userA.id ? decryptA.promise : Promise.resolve(value);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  await h.select(aConversation);
  await h.resolve(h.take('get', '/chat/conversations/7/messages'), [message(101, 7, 'A history')]);
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  await h.select(bConversation);
  const bMessage = message(201, 7, 'B history');
  await h.resolve(h.take('get', '/chat/conversations/7/messages'), [bMessage]);
  await act(async () => { decryptA.resolve(message(101, 7, 'A history')); });
  assert.deepEqual(h.view('ChatArea').messages, [bMessage]);
  assert.equal(h.view('ChatArea').isLoadingMessages, false);
});

test('A in-flight WebSocket decrypt cannot add B messages, previews, sounds or toasts', async (t) => {
  const h = await mountApp(t);
  const decryptA = deferred();
  h.decryptMessage = (value, userId) => userId === userA.id ? decryptA.promise : Promise.resolve(value);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  const clientA = await h.connect();
  const frameA = message(101, 7, 'A socket message');
  let receiveA;
  await act(async () => {
    receiveA = clientA.subscriptions.get(`/topic/users/${userA.id}/messages`)({ body: JSON.stringify(frameA) });
  });
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  await h.select(bConversation);
  const bMessage = message(201, 7, 'B history');
  await h.resolve(h.take('get', '/chat/conversations/7/messages'), [bMessage]);
  const requestCount = h.requests.length;
  await act(async () => { decryptA.resolve(frameA); await receiveA; });
  assert.deepEqual(h.view('ChatArea').messages, [bMessage]);
  assert.deepEqual(h.view('Sidebar').conversations, [bConversation]);
  assert.equal(h.view('ToastNotification').toast, null);
  assert.deepEqual(h.sounds, []);
  assert.deepEqual(h.notifications, []);
  assert.equal(h.requests.length, requestCount);
});

test('stale A WebSocket events and reconnect handlers cannot affect B', async (t) => {
  const h = await mountApp(t);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  const clientA = await h.connect();
  await h.select(aConversation);
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  await h.select(bConversation);
  const requestCount = h.requests.length;
  await act(async () => {
    clientA.subscriptions.get('/topic/presence')({ body: JSON.stringify({ userId: 33, isOnline: true, lastSeenAt: 'A only' }) });
    clientA.subscriptions.get('/topic/conversations/7/typing')({ body: JSON.stringify({ userId: 33, userName: 'A only', isTyping: true }) });
    clientA.subscriptions.get('/topic/conversations/7/theme')({ body: 'red' });
    clientA.options.onWebSocketClose();
    clientA.options.onWebSocketError();
    clientA.options.onStompError();
    clientA.options.onConnect();
  });
  assert.deepEqual(h.view('Sidebar').presenceMap, {});
  assert.deepEqual(h.view('ChatArea').lastSeenMap, {});
  assert.equal(h.view('ChatArea').typingUser, null);
  assert.equal(h.view('ChatArea').activeConversation.theme, 'blue');
  assert.ok(!h.container.textContent.includes('Đang kết nối lại'));
  assert.equal(h.requests.length, requestCount);
});

test('A read receipt response cannot reset B unread count in a shared conversation', async (t) => {
  const h = await mountApp(t);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  const readA = await h.select(aConversation);
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  await h.resolve(readA, {});
  assert.equal(h.view('Sidebar').conversations[0].unreadCount, 9);
});

test('A direct-chat creation cannot select a room or start follow-up requests as B', async (t) => {
  const h = await mountApp(t);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  let startA;
  await act(async () => {
    startA = h.view('Sidebar').onSelectUserToChat({ id: 44, displayName: 'A friend' });
  });
  const pendingA = h.take('post', '/chat/conversations/direct');
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  await h.select(bConversation);
  const requestCount = h.requests.length;
  await h.resolve(pendingA, { id: 99, theme: 'red' });
  await startA;
  assert.deepEqual(h.view('ChatArea').activeConversation, bConversation);
  assert.equal(localStorage.getItem('active_conv_id'), '7');
  assert.equal(h.requests.length, requestCount);
});

for (const outcome of ['resolve', 'reject']) {
  test(`A friend request ${outcome} cannot publish a toast in B`, async (t) => {
    const h = await mountApp(t);
    let sendA;
    await act(async () => { sendA = h.view('Sidebar').onSendFriendRequest(44); });
    const pendingA = h.take('post', '/friends/request');
    await h.switchTo();
    await act(async () => {
      if (outcome === 'resolve') pendingA.resolve({ data: {} });
      else pendingA.reject({ response: { status: 409, data: { message: 'A private error' } } });
      await sendA;
    });
    assert.equal(h.view('ToastNotification').toast, null);
  });
}

test('delayed A search cannot replace B results for an identical query', async (t) => {
  const h = await mountApp(t);
  await act(async () => { h.view('Sidebar').onSearchChange('same query'); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 320)); });
  const searchA = h.take('get', '/users/search');
  await h.switchTo();
  assert.equal(h.view('Sidebar').searchQuery, '');
  assert.deepEqual(h.view('Sidebar').searchResults, []);
  await act(async () => { h.view('Sidebar').onSearchChange('same query'); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 320)); });
  const bResults = [{ id: 44, displayName: 'B allowed search result' }];
  await h.resolve(h.take('get', '/users/search'), bResults);
  await h.resolve(searchA, [{ id: 55, displayName: 'A private search result' }]);
  assert.deepEqual(h.view('Sidebar').searchResults, bResults);
});

for (const mutation of [
  { name: 'edit', prop: 'onEditMessage', args: [101, 'A edited text'], method: 'put', path: '/chat/messages/edit' },
  { name: 'reaction', prop: 'onToggleReaction', args: [101, '❤️'], method: 'post', path: '/chat/messages/reaction' },
  { name: 'pin', prop: 'onTogglePinMessage', args: [101], method: 'put', path: '/chat/messages/101/pin' },
  { name: 'delete', prop: 'onDeleteMessage', args: [101], method: 'delete', path: '/chat/messages/101' }
]) {
  test(`A pending message ${mutation.name} cannot replace B message with the same ID`, async (t) => {
    const h = await mountApp(t);
    await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
    await h.select(aConversation);
    await h.resolve(h.take('get', '/chat/conversations/7/messages'), [message(101, 7, 'A original')]);
    let actionA;
    await act(async () => {
      actionA = h.view('ChatArea')[mutation.prop](...mutation.args);
      // Some UI callbacks deliberately surface ordinary request failures.
      if (actionA?.catch) actionA = actionA.catch(() => {});
    });
    if (mutation.name === 'delete') {
      await act(async () => {
        [...h.container.querySelectorAll('button')].find((button) => button.textContent === 'Xác nhận').click();
      });
    }
    const pendingA = h.take(mutation.method, mutation.path);
    await h.switchTo();
    await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
    await h.select(bConversation);
    const bMessage = message(101, 7, 'B current message');
    await h.resolve(h.take('get', '/chat/conversations/7/messages'), [bMessage]);
    await h.resolve(pendingA, message(101, 7, 'A changed message'));
    await actionA;
    assert.deepEqual(h.view('ChatArea').messages, [bMessage]);
  });
}

test('A encryption pending at logout cannot submit a message with B credentials', async (t) => {
  const h = await mountApp(t);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  await h.select(aConversation);
  const encryptionA = deferred();
  h.encrypt = () => encryptionA.promise;
  let sendA;
  await act(async () => {
    sendA = h.view('ChatArea').onSendMessage('A secret', null).catch(() => {});
  });
  await h.switchTo();
  await act(async () => {
    encryptionA.resolve({ ciphertext: 'A ciphertext', iv: 'A iv', encryptionVersion: 'AES_GCM_V1' });
    await sendA;
  });
  assert.ok(!h.requests.some((request) => request.method === 'post' && request.url.endsWith('/chat/messages')));
  assert.deepEqual(h.sounds, []);
});

test('A forward loop stops before its next recipient after logout', async (t) => {
  const h = await mountApp(t);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  await h.select(aConversation);
  const source = message(101, 7, 'A original');
  await h.resolve(h.take('get', '/chat/conversations/7/messages'), [source]);
  await act(async () => { h.view('ChatArea').onStartForwardMessage(source); });
  let forwardA;
  await act(async () => {
    forwardA = h.view('ForwardModal').onConfirmForward(101, [8, 9]).catch(() => {});
  });
  const firstRecipient = h.take('post', '/chat/messages');
  await h.switchTo();
  await h.resolve(firstRecipient, message(102, 8, 'A forwarded'));
  await forwardA;
  assert.equal(h.requests.filter((request) => request.method === 'post' && request.url.endsWith('/chat/messages')).length, 1);
  assert.equal(h.view('ToastNotification').toast, null);
  assert.deepEqual(h.sounds, []);
});

test('A desktop notification click retained by the browser cannot select a room as B', async (t) => {
  const h = await mountApp(t);
  Object.defineProperty(h.browser.document, 'hidden', { value: true, configurable: true });
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  const clientA = await h.connect();
  await act(async () => {
    await clientA.subscriptions.get(`/topic/users/${userA.id}/messages`)({ body: JSON.stringify(message(101, 7, 'A notification')) });
  });
  assert.equal(h.notifications.length, 1);
  const clickA = h.notifications[0][3];
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  const requestCount = h.requests.length;
  await act(async () => { clickA(); });
  assert.ok(!h.mounted.has('ChatArea'));
  assert.equal(localStorage.getItem('active_conv_id'), null);
  assert.equal(h.requests.length, requestCount);
});

test('retained login callback cannot restore A after B has logged in', async (t) => {
  const h = await mountApp(t, { user: null });
  const oldLogin = h.view('AuthScreen').onLoginSuccess;
  await h.login(userA);
  await h.switchTo();
  await act(async () => { oldLogin(userA); });
  assert.equal(h.view('Sidebar').currentUser.id, userB.id);
  assert.equal(localStorage.getItem('auth_token'), userB.token);
  assert.equal(JSON.parse(localStorage.getItem('auth_user')).id, userB.id);
});

test('A requests are aborted and each login pins its own Authorization header', async (t) => {
  const h = await mountApp(t);
  const pendingA = h.take('get', conversationsPath(userA));
  assert.equal(pendingA.config.headers.get('Authorization'), `Bearer ${userA.token}`);
  assert.equal(pendingA.config.signal.aborted, false);
  await h.switchTo();
  const pendingB = h.take('get', conversationsPath(userB));
  assert.equal(pendingA.config.signal.aborted, true);
  assert.equal(pendingB.config.signal.aborted, false);
  assert.equal(pendingB.config.headers.get('Authorization'), `Bearer ${userB.token}`);
});

test('delayed offline presence interceptor keeps A token after B logs in', async (t) => {
  const h = await mountApp(t);
  const offlineGate = deferred();
  const interceptor = axios.interceptors.request.use(async (request) => {
    if (request.params?.isOnline === false) await offlineGate.promise;
    return request;
  });
  t.after(() => { axios.interceptors.request.eject(interceptor); offlineGate.resolve(); });
  await h.switchTo();
  await act(async () => { offlineGate.resolve(); });
  const offlineA = h.requests.find((request) => request.url.endsWith('/chat/presence') && request.config.params.isOnline === false);
  assert.ok(offlineA);
  assert.equal(offlineA.config.params.userId, userA.id);
  assert.equal(offlineA.config.headers.get('Authorization'), `Bearer ${userA.token}`);
  assert.equal(localStorage.getItem('auth_token'), userB.token);
});

test('StrictMode effect replay keeps the active login usable and disposed sockets inert', async (t) => {
  const h = await mountApp(t, { strict: true });
  assert.ok(h.clients.length >= 2, 'the test actually exercises React StrictMode effect replay');
  const disposedClient = h.clients[0];
  const currentClient = h.clients.at(-1);
  const requestCount = h.requests.length;
  await act(async () => {
    disposedClient.options.onConnect();
    disposedClient.options.onWebSocketClose();
  });
  assert.equal(h.requests.length, requestCount);
  assert.ok(!h.container.textContent.includes('Đang kết nối lại'));
  await h.connect(currentClient);
  assert.ok(currentClient.subscriptions.has(`/topic/users/${userA.id}/messages`));
  const pendingA = h.take('get', conversationsPath(userA));
  assert.equal(pendingA.config.signal.aborted, false);
  await h.switchTo();
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  await h.resolve(pendingA, [aConversation]);
  assert.deepEqual(h.view('Sidebar').conversations, [bConversation]);
});

test('A delete finally cannot close a confirmation newly opened by B', async (t) => {
  const h = await mountApp(t);
  await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
  await h.select(aConversation);
  await act(async () => { h.view('ChatArea').onDeleteMessage(101); });
  await act(async () => {
    [...h.container.querySelectorAll('button')].find((button) => button.textContent === 'Xác nhận').click();
  });
  const deletingA = h.take('delete', '/chat/messages/101');
  await h.switchTo();
  assert.ok(!h.container.textContent.includes('Thu hồi tin nhắn'), 'logout discards the old dialog');
  await h.resolve(h.take('get', conversationsPath(userB)), [bConversation]);
  await h.select(bConversation);
  await act(async () => { h.view('ChatArea').onDeleteMessage(201); });
  await h.resolve(deletingA, message(101, 7, 'A deleted'));
  assert.ok(h.container.textContent.includes('Thu hồi tin nhắn'), 'B confirmation remains open');
});

for (const operation of ['edit', 'forward']) {
  test(`A ${operation} waiting for encryption cannot send after B login`, async (t) => {
    const h = await mountApp(t);
    await h.resolve(h.take('get', conversationsPath(userA)), [aConversation]);
    await h.select(aConversation);
    const source = message(101, 7, 'A original');
    await h.resolve(h.take('get', '/chat/conversations/7/messages'), [source]);
    const encryptA = deferred();
    h.encrypt = () => encryptA.promise;
    let actionA;
    await act(async () => {
      actionA = operation === 'edit'
        ? h.view('ChatArea').onEditMessage(101, 'A edit').catch(() => {})
        : h.view('ForwardModal').onConfirmForward(101, [8]).catch(() => {});
    });
    await h.switchTo();
    const requestCount = h.requests.length;
    await act(async () => {
      encryptA.resolve({ ciphertext: 'A encrypted text', iv: 'A iv', encryptionVersion: 'AES_GCM_V1' });
      await actionA;
    });
    assert.equal(h.requests.length, requestCount);
    assert.equal(h.view('ToastNotification').toast, null);
    assert.deepEqual(h.sounds, []);
  });
}
