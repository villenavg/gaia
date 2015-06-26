/* global bridge */

(function(exports) {
  'use strict';

  /**
   * Name of the service that is responsible for managing activities.
   * @type {string}
   */
  const SERVICE_NAME = 'activity-service';

  /**
   * Name of the system message that is leveraged by activities.
   * @type {string}
   */
  const SYSTEM_MESSAGE_NAME = 'activity';

  /**
   * Reference to active bridge service instance.
   * @type {Service}
   */
  var service = null;

  /**
   * Reference to currently active activity request.
   * @type {ActivityRequestHandler}
   */
  var activityRequest = null;

  /**
   * Posts activity request result.
   * @param {*} result Data to post as activity request result.
   */
  function onPostResult(result) {
    if (!activityRequest) {
      throw new Error('There is no any activity request to post result to!');
    }

    activityRequest.postResult(result || { success: true });

    activityRequest = null;
  }

  /**
   * Posts activity request error.
   * @param {*} error Error to post as activity request error.
   */
  function onPostError(error) {
    if (!activityRequest) {
      throw new Error('There is no any activity request to post error to!');
    }

    activityRequest.postError(error);

    activityRequest = null;
  }

  /**
   * Handler that fires once app receives activity request via system message.
   * @param {ActivityRequestHandler} request Activity request.
   */
  function onActivityRequest(request) {
    activityRequest = request;

    // Should be removed once the following "bridge" issue is resolved:
    // https://github.com/gaia-components/threads/issues/40
    setTimeout(() => {
      service.broadcast('activity-request', request.source);
    });
  }

  /**
   * ActivityShim is a shim around "activity" system message handling code that
   * allows to access activity request data by the consumer that can't handle
   * system messages directly (document hosted in a different URl or worker) via
   * exposing bridge service with required methods.
   * @type {Object}
   */
  var ActivityShim = {
    /**
     * Initialized activity service bridge.
     * @type {number} appInstanceId Unique identifier of the app instance that
     * is used to establish 1-to-1 only connection between this service and
     * corresponding client hosted in the same app instance.
     */
    init(appInstanceId) {
      if (!appInstanceId) {
        throw new Error('App instance id is not specified!');
      }

      service = bridge.service(SERVICE_NAME + appInstanceId);

      service.method('postResult', onPostResult);
      service.method('postError', onPostError);

      navigator.mozSetMessageHandler(SYSTEM_MESSAGE_NAME, onActivityRequest);
    },

    /**
     * Checks if activity service has pending activity request.
     */
    hasPendingRequest() {
      return navigator.mozHasPendingMessage(SYSTEM_MESSAGE_NAME);
    }
  };

  exports.ActivityShim = Object.freeze(ActivityShim);
})(window);
