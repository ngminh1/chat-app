import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundEffects } from '../src/utils/soundEffects.js';

function browserAudio({ initialState = 'running', resume } = {}) {
  const listeners = new Map();
  const contexts = [];
  let started = 0;
  let resumed = 0;
  const param = () => ({
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
  });

  class AudioContext {
    constructor() {
      this.state = initialState;
      this.currentTime = 0;
      this.destination = {};
      contexts.push(this);
    }
    resume() {
      resumed += 1;
      if (resume) return resume(this);
      this.state = 'running';
      return Promise.resolve();
    }
    createBiquadFilter() { return { frequency: param(), Q: param(), connect() {} }; }
    createGain() { return { gain: param(), connect() {} }; }
    createOscillator() {
      return { frequency: param(), connect() {}, start() { started += 1; }, stop() {} };
    }
  }

  const target = {
    AudioContext,
    navigator: { userActivation: { isActive: true } },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
  };

  return {
    target, contexts,
    get started() { return started; },
    get resumed() { return resumed; },
    get listenerCount() { return [...listeners.values()].reduce((total, set) => total + set.size, 0); },
    gesture(type = 'click', details = {}) {
      for (const listener of listeners.get(type) ?? []) listener({ type, isTrusted: true, ...details });
    },
  };
}

test('incoming/outgoing/reaction sounds do not construct audio before a user gesture', () => {
  const browser = browserAudio();
  const sounds = new SoundEffects();
  const cleanup = sounds.listenForUserActivation(browser.target);
  sounds.playIncomingMessageSound();
  sounds.playOutgoingMessageSound();
  sounds.playReactionSound();
  assert.equal(browser.contexts.length, 0);
  assert.equal(browser.resumed, 0);
  assert.equal(browser.started, 0);
  cleanup();
});

test('synthetic events, non-activation keys and inactive gestures cannot unlock audio', () => {
  const browser = browserAudio();
  const sounds = new SoundEffects();
  sounds.listenForUserActivation(browser.target);
  browser.gesture('click', { isTrusted: false });
  browser.gesture('keydown', { key: 'Escape' });
  browser.gesture('keydown', { key: 'Shift' });
  browser.gesture('keydown', { key: 'Enter', repeat: true });
  browser.target.navigator.userActivation.isActive = false;
  browser.gesture();
  assert.equal(browser.contexts.length, 0);
});

test('a trusted gesture enables later asynchronous sounds and reuses one context', () => {
  const browser = browserAudio();
  const sounds = new SoundEffects();
  sounds.listenForUserActivation(browser.target);
  browser.gesture('pointerup');
  browser.gesture('click');
  browser.target.navigator.userActivation.isActive = false;
  sounds.playIncomingMessageSound();
  sounds.playOutgoingMessageSound();
  sounds.playReactionSound();
  assert.equal(browser.contexts.length, 1);
  assert.equal(browser.resumed, 0);
  assert.equal(browser.started, 5);
});

test('suspended audio resumes only in a gesture, awaits readiness and does not replay skipped sounds', async () => {
  let finishResume;
  const browser = browserAudio({ initialState: 'suspended', resume: (ctx) => new Promise((resolve) => {
    finishResume = () => { ctx.state = 'running'; resolve(); };
  }) });
  const sounds = new SoundEffects();
  sounds.listenForUserActivation(browser.target);
  browser.gesture('keydown', { key: 'Enter' });
  browser.gesture('click');
  sounds.playIncomingMessageSound();
  assert.equal(browser.resumed, 1);
  assert.equal(browser.started, 0);
  finishResume();
  await sounds.resumePromise;
  assert.equal(browser.started, 0);
  sounds.playIncomingMessageSound();
  assert.equal(browser.started, 3);

  browser.contexts[0].state = 'suspended';
  sounds.playOutgoingMessageSound();
  assert.equal(browser.resumed, 1);
  browser.gesture('touchend');
  assert.equal(browser.resumed, 2);
  finishResume();
  await sounds.resumePromise;
});

test('resume rejection is handled and reported; a later gesture can retry', async (t) => {
  const failure = new Error('Audio device unavailable');
  const warning = t.mock.method(console, 'warn', () => {});
  let shouldFail = true;
  const browser = browserAudio({ initialState: 'suspended', resume: (ctx) => {
    if (shouldFail) return Promise.reject(failure);
    ctx.state = 'running';
    return Promise.resolve();
  } });
  const sounds = new SoundEffects();
  sounds.listenForUserActivation(browser.target);
  browser.gesture();
  await sounds.resumePromise;
  assert.equal(warning.mock.callCount(), 1);
  assert.deepEqual(warning.mock.calls[0].arguments, ['Không thể bật âm thanh sau tương tác (AudioError).']);
  sounds.playIncomingMessageSound();
  assert.equal(browser.resumed, 1);
  shouldFail = false;
  browser.gesture();
  await sounds.resumePromise;
  sounds.playReactionSound();
  assert.equal(browser.started, 1);
});

test('persistent audio activation errors log once without error details, and recovery resets deduplication', async (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  let error = { name: 'NotAllowedError', message: 'SECRET_DETAILS', config: { token: 'SECRET_TOKEN' } };
  const browser = browserAudio({ initialState: 'suspended', resume: (ctx) => {
    if (error) return Promise.reject(error);
    ctx.state = 'running';
    return Promise.resolve();
  } });
  const sounds = new SoundEffects();
  sounds.listenForUserActivation(browser.target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    browser.gesture();
    await sounds.resumePromise;
  }
  assert.equal(warning.mock.callCount(), 1);
  error = { name: 'InvalidStateError' };
  browser.gesture();
  await sounds.resumePromise;
  assert.equal(warning.mock.callCount(), 2, 'a distinct real failure remains visible');
  error = null;
  browser.gesture();
  await sounds.resumePromise;
  browser.contexts[0].state = 'suspended';
  error = { name: 'NotAllowedError' };
  browser.gesture();
  await sounds.resumePromise;
  assert.equal(warning.mock.callCount(), 3, 'new failure after recovery remains visible');
  assert.equal(JSON.stringify(warning.mock.calls.map((call) => call.arguments)).includes('SECRET_'), false);
});

test('listener cleanup prevents activation after unmount and allows a clean remount', () => {
  const browser = browserAudio();
  const sounds = new SoundEffects();
  const cleanup = sounds.listenForUserActivation(browser.target);
  assert.equal(browser.listenerCount, 4);
  cleanup();
  assert.equal(browser.listenerCount, 0);
  browser.gesture();
  assert.equal(browser.contexts.length, 0);
  const cleanupAgain = sounds.listenForUserActivation(browser.target);
  assert.equal(browser.listenerCount, 4);
  browser.gesture();
  assert.equal(browser.contexts.length, 1);
  cleanupAgain();
  assert.equal(browser.listenerCount, 0);
});

test('unsupported audio is a no-op and legacy webkit AudioContext still requires a gesture', () => {
  const browser = browserAudio();
  const sounds = new SoundEffects();
  const AudioContext = browser.target.AudioContext;
  delete browser.target.AudioContext;
  delete browser.target.navigator.userActivation;
  sounds.listenForUserActivation(browser.target);
  browser.gesture();
  sounds.playIncomingMessageSound();
  assert.equal(browser.contexts.length, 0);
  browser.target.webkitAudioContext = AudioContext;
  browser.gesture();
  sounds.playOutgoingMessageSound();
  assert.equal(browser.contexts.length, 1);
  assert.equal(browser.started, 1);
});

test('interrupted audio and a closed context recover only after another gesture', async () => {
  const browser = browserAudio();
  const sounds = new SoundEffects();
  sounds.listenForUserActivation(browser.target);
  browser.gesture();
  browser.contexts[0].state = 'interrupted';
  sounds.playIncomingMessageSound();
  assert.equal(browser.resumed, 0);
  browser.gesture();
  await sounds.resumePromise;
  assert.equal(browser.resumed, 1);
  browser.contexts[0].state = 'closed';
  sounds.playOutgoingMessageSound();
  assert.equal(browser.contexts.length, 1);
  browser.gesture();
  assert.equal(browser.contexts.length, 2);
});
