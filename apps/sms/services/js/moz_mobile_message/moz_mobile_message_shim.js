/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */


/* global bridge, Utils */

/* exported MozMobileMessageShim */

(function(exports) {
'use strict';

/**
 * Name of the service for mozMobileMessage API shim.
 * @type {string}
 */
const SERVICE_NAME = 'mozMobileMessageShim';

/**
 * Array of the event names that is corresponding to mozMobileMessage events.
 * @type {Array.<string>}
 */
const EVENTS = ['received', 'sending', 'sent', 'failed', 'deleted',
                'readsuccess', 'deliverysuccess'];

/**
 * Array of method names that need to be exposed for API shim.
 * @type {Array.<string>}
 */
const METHODS = ['getMessage', 'retrieveMMS', 'send', 'sendMMS',
                 'delete', 'markMessageRead', 'getSegmentInfoForText'];

/**
 * Array of stream names that need to return data (messages/threads) in chunk.
 * @type {Array.<string>}
 */
const STREAMS = ['getThreads', 'getMessages'];

var mozMobileMessage = null;

var service = null;

var MozMobileMessageShim = {
  init(mobileMessage) {
    if (!mobileMessage) {
      return;
    }

    mozMobileMessage = mobileMessage;
    service = bridge.service(SERVICE_NAME);

    EVENTS.forEach((event) => {
      mozMobileMessage.addEventListener(
        event,
        this[Utils.camelCase(`on-${event}`)]
      );
    });

    METHODS.forEach((shimMethod) => {
      service.method(shimMethod, this[shimMethod]);
    });

    STREAMS.forEach((shimStream) => {
      service.stream(shimStream, this[shimStream]);
    });
  },

  /* Events */

  onSending(e) {
    service.broadcast('message-sending', { message: e.message });
  },

  onFailed(e) {
    service.broadcast('message-failed-to-send', { message: e.message });
  },

  onDeliverysuccess(e) {
    service.broadcast('message-delivered', { message: e.message });
  },

  onReadsuccess(e) {
    service.broadcast('message-read', { message: e.message });
  },

  onSent(e) {
    service.broadcast('message-sent', { message: e.message });
  },

  onReceived(e) {
    service.broadcast('message-received', { message: e.message });
  },

  onDeleted(e) {
    if (e.deletedThreadIds && e.deletedThreadIds.length) {
      service.broadcast('threads-deleted', {
        ids: e.deletedThreadIds
      });
    }
  },

  /* Methods */  

  getMessage(id) {
    return mozMobileMessage.getMessage(id);
  },

  retrieveMMS(id) {
    return mozMobileMessage.retrieveMMS(id);
  },

  send(recipient, content, sendOpts) {
    return mozMobileMessage.send(recipient, content, sendOpts);
  },

  sendMMS(dataOpts, sendOpts) {
    return mozMobileMessage.sendMMS(dataOpts, sendOpts);
  },

  delete(id) {
    return mozMobileMessage.delete(id);
  },

  markMessageRead(id, isRead, sendReadReport) {
    return mozMobileMessage.markMessageRead(id, isRead, sendReadReport);
  },

  getSegmentInfoForText(text) {
    return mozMobileMessage.getSegmentInfoForText(text);
  },

  /* Streams */

  /**
   * Stream wrapper for getThreads API for returning threads in chunk.
   * @param {ServiceStream} stream Channel for returning thread.
   */
  getThreads(stream) {
    var cursor = null;

    // WORKAROUND for bug 958738. We can remove 'try\catch' block once this bug
    // is resolved
    try {
      cursor = mozMobileMessage.getThreads();
    } catch(e) {
      console.error('Error occurred while retrieving threads: ' + e.name);
      stream.abort();
      return;
    }

    cursor.onsuccess = function onsuccess() {
      var result = this.result;

      if (result) {
        // TODO: we might need to track result of write to stop iterating
        //       through cursor.
        stream.write(result);
        this.continue();
        return;
      }

      stream.close();
    };

    cursor.onerror = function onerror() {
      console.error('Reading the database. Error: ' + this.error.name);
      stream.abort();
    };
  },

  /**
   * Stream wrapper for getMessages API for returning messages in chunk.
   * @param {ServiceStream} stream Channel for returning message.
   * @param {*} options Options for getMessages API.
   */
  getMessages(stream, options) {
    /*
    options { 
      filter: a MobileMessageFilter or similar object
      invert: option to invert the selection
    }

     */
    var invert = options.invert;
    var filter = options.filter;
    var cursor = mozMobileMessage.getMessages(filter, !invert);

    cursor.onsuccess = function onsuccess() {
      if (!this.done) {
        stream.write(this.result);
        this.continue();
      } else {
        stream.close();
      }
    };

    cursor.onerror = function onerror() {
      var msg = 'Reading the database. Error: ' + this.error.name;
      console.error(msg);
      stream.abort();
    };

    stream.cancel = function() {
      stream.close();
    };
  }
};

exports.MozMobileMessageShim = MozMobileMessageShim;

}(this));
