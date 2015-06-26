/*global MessageManager,
         MocksHelper,
         Navigation,
         LazyLoader,
         InboxView,
         App
*/

'use strict';

require('/views/shared/js/app.js');

require('/services/test/unit/mock_message_manager.js');
require('/views/shared/test/unit/mock_navigation.js');
require('/views/shared/test/unit/mock_inbox.js');

require('/shared/test/unit/mocks/mock_lazy_loader.js');

var mocksHelper = new MocksHelper([
  'MessageManager',
  'LazyLoader',
  'Navigation',
  'InboxView'
]).init();

suite('Startup >', function() {
  var container, originalMozHasPendingMessage;

  mocksHelper.attachTestHelpers();

  suiteSetup(function(done) {
    originalMozHasPendingMessage = navigator.mozHasPendingMessage;
    navigator.mozHasPendingMessage = () => {};

    sinon.stub(window, 'addEventListener');
    require('/views/shared/js/startup.js', done);
  });

  suiteTeardown(function() {
    navigator.mozHasPendingMessage = originalMozHasPendingMessage;
    window.addEventListener.restore();
  });

  setup(function() {
    this.sinon.stub(window, 'dispatchEvent');
    this.sinon.stub(window, 'removeEventListener');
    this.sinon.stub(navigator, 'mozHasPendingMessage').returns(false);
    this.sinon.stub(LazyLoader, 'load').returns(Promise.reject());
    this.sinon.stub(MessageManager, 'init');
    this.sinon.stub(Navigation, 'init');
    this.sinon.stub(InboxView, 'init');
    this.sinon.spy(InboxView, 'renderThreads');
    this.sinon.stub(InboxView, 'once');
    this.sinon.stub(Navigation, 'once');
    this.sinon.stub(Navigation, 'isDefaultPanel');
    this.sinon.spy(Navigation, 'toDefaultPanel');
    this.sinon.stub(App, 'setReady');

    container = document.createElement('div');
    container.innerHTML = `
      <gaia-header no-font-fit></gaia-header>
    `;
    document.body.appendChild(container);
  });

  teardown(function() {
    container.remove();
  });

  test('if target panel is default one', function() {
    Navigation.isDefaultPanel.returns(true);

    window.addEventListener.withArgs('DOMContentLoaded').yield();

    // Navigate to Inbox immediately.
    sinon.assert.callOrder(
      MessageManager.init,
      Navigation.init,
      InboxView.init,
      InboxView.renderThreads,
      Navigation.toDefaultPanel
    );
    sinon.assert.notCalled(LazyLoader.load);
    assert.isTrue(
      container.querySelector('gaia-header').hasAttribute('no-font-fit'),
      '<gaia-header> elements are not initialized yet'
    );

    // First page of threads loaded
    InboxView.once.withArgs('visually-loaded').yield();

    // Lazy load the rest of scripts only once first page of threads is loaded
    sinon.assert.calledOnce(LazyLoader.load);

    assert.isFalse(
      container.querySelector('gaia-header').hasAttribute('no-font-fit'),
      '<gaia-header> elements are initialized'
    );
  });

  test('if first panel is not default one', function() {
    Navigation.isDefaultPanel.returns(false);

    window.addEventListener.withArgs('DOMContentLoaded').yield();

    sinon.assert.callOrder(
      MessageManager.init,
      Navigation.init,
      InboxView.init,
      LazyLoader.load
    );
    sinon.assert.notCalled(Navigation.toDefaultPanel);
    sinon.assert.notCalled(InboxView.renderThreads);

    sinon.assert.calledOnce(LazyLoader.load);

    assert.isFalse(
      container.querySelector('gaia-header').hasAttribute('no-font-fit'),
      '<gaia-header> elements are initialized'
    );

    // Threads should start rendering only once target panel is ready.
    Navigation.once.withArgs('navigated').yield();

    // Now we have time and resources to render threads.
    sinon.assert.calledOnce(InboxView.renderThreads);

    // App is marked is ready only when all threads are loaded.
    sinon.assert.notCalled(App.setReady);

    InboxView.once.withArgs('fully-loaded').yield();

    sinon.assert.calledOnce(App.setReady);
  });

  test('if has pending "notification" system message', function() {
    Navigation.isDefaultPanel.returns(true);
    navigator.mozHasPendingMessage.withArgs('notification').returns(true);

    window.addEventListener.withArgs('DOMContentLoaded').yield();

    sinon.assert.callOrder(
      MessageManager.init,
      Navigation.init,
      InboxView.init,
      LazyLoader.load
    );
    sinon.assert.notCalled(Navigation.toDefaultPanel);
    sinon.assert.notCalled(InboxView.renderThreads);

    sinon.assert.calledOnce(LazyLoader.load);

    assert.isFalse(
      container.querySelector('gaia-header').hasAttribute('no-font-fit'),
      '<gaia-header> elements are initialized'
    );

    // Threads should start rendering only once target panel is ready.
    Navigation.once.withArgs('navigated').yield();

    // Now we have time and resources to render threads.
    sinon.assert.calledOnce(InboxView.renderThreads);

    // App is marked is ready only when all threads are loaded.
    sinon.assert.notCalled(App.setReady);

    InboxView.once.withArgs('fully-loaded').yield();

    sinon.assert.calledOnce(App.setReady);
  });
});
