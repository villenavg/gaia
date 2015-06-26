/* global MocksHelper, BaseModule, Service */
'use strict';

require('/js/service.js');
require('/js/base_module.js');
require('/js/camera_trigger.js');
require('/test/unit/mock_activity.js');

var mocksForCameraTrigger = new MocksHelper([
  'MozActivity'
]).init();

suite('system/CameraTrigger', function() {
  var subject;
  mocksForCameraTrigger.attachTestHelpers();

  setup(function() {
    subject = BaseModule.instantiate('CameraTrigger');
    subject.start();
  });

  teardown(function() {
    subject.stop();
  });

  suite('Launch Camera', function() {
    var activitySpy;
    var expectedActivity = {
      name: 'record',
      data: {
        type: 'photos'
      }
    };

    setup(function() {
      activitySpy = this.sinon.spy(window, 'MozActivity');
    });

    suite('Allows MozActivity', function() {
      setup(function() {
        this.sinon.stub(Service, 'query', function(name) {
          return (name !== 'locked' && name !== 'isFtuRunning');
        });
      });

      test('holdcamera triggers MozActivity', function() {
        window.dispatchEvent(new CustomEvent('holdcamera', {}));
        sinon.assert.calledWith(activitySpy, expectedActivity);
      });
    });

    suite('LockScreen is locked', function() {
      setup(function() {
        this.sinon.stub(Service, 'query', function(name) {
          return (name === 'locked');
        });
      });

      test('holdcamera inhibited by lockscreen', function() {
        window.dispatchEvent(new CustomEvent('holdcamera', {}));
        sinon.assert.notCalled(activitySpy);
      });
    });

    suite('FTU is running', function() {
      setup(function() {
        this.sinon.stub(Service, 'query', function(name) {
          return (name === 'isFtuRunning');
        });
      });
      test('holdcamera inhibited when FTU running', function() {
        window.dispatchEvent(new CustomEvent('holdcamera', {}));
        sinon.assert.notCalled(activitySpy);
      });
    });

  });
});
