var util = require('util');
var Promise = require('promise');
var spawn = require('child_process').spawn;
var Command = require('./command');
var byline = require('byline');
var debug = require('debug')('mozdevice:logging');

var ADB_HOST = process.env.ADB_HOST;
var ADB_PORT = process.env.ADB_PORT;

var DATE_COMMAND = 'date +"%m-%d %H:%M:%S.000"';

// Cache the connection to logcat so we can re-use for additional MozDevices
var currentProcess;
var currentStream;

/**
 * API for interacting with a device's logging
 * @param {Device} device
 * @constructor
 */
var Logging = function(device) {
  this.device = device;
  this.serial = device.serial;
};

/**
 * Execute a command against `adb shell` contextual to the device serial
 * @param command
 * @returns {Promise}
 */
Logging.prototype.adbShell = function(command) {
  return new Command()
    .env('ANDROID_SERIAL', this.serial)
    .adbShell(command)
    .exec();
};

/**
 * Write a message to the ADB log
 * @param {string} priority log command priority, e.g. v, d, i, w, e
 * @param {string} [tag] log command process tag, e.g. GeckoConsole, Homescreen
 * @param {string} message message to write to the ADB log
 * @returns {Promise}
 */
Logging.prototype.write = function(priority, tag, message) {
  if (!message) {
    message = tag;
    tag = 'GeckoConsole';
  }

  var command = util.format('log -p %s -t %s "%s"', priority, tag, message);
  return this.adbShell(command);
};

/**
 * Write a verbose message to the ADB log
 * @param {string} [tag] log command process tag, e.g. GeckoConsole, Homescreen
 * @param {string} message message to write to the ADB log
 * @returns {Promise}
 */
Logging.prototype.verbose = function(tag, message) {
  return this.write('v', tag, message);
};

/**
 * Write a debug message to the ADB log
 * @param {string} [tag] log command process tag, e.g. GeckoConsole, Homescreen
 * @param {string} message message to write to the ADB log
 * @returns {Promise}
 */
Logging.prototype.debug = function(tag, message) {
  return this.write('d', tag, message);
};

/**
 * Write an info message to the ADB log
 * @param {string} [tag] log command process tag, e.g. GeckoConsole, Homescreen
 * @param {string} message message to write to the ADB log
 * @returns {Promise}
 */
Logging.prototype.info = function(tag, message) {
  return this.write('i', tag, message);
};

/**
 * Write a warning message to the ADB log
 * @param {string} [tag] log command process tag, e.g. GeckoConsole, Homescreen
 * @param {string} message message to write to the ADB log
 * @returns {Promise}
 */
Logging.prototype.warning = function(tag, message) {
  return this.write('w', tag, message);
};

/**
 * Write an error message to the ADB log
 * @param {string} [tag] log command process tag, e.g. GeckoConsole, Homescreen
 * @param {string} message message to write to the ADB log
 * @returns {Promise}
 */
Logging.prototype.error = function(tag, message) {
  return this.write('e', tag, message);
};

/**
 * Clear the ADB log
 * @returns {Promise}
 */
Logging.prototype.clear = function() {
  debug('Clearing');

  // There're two issues with |logcat -c| on Android L: 1) it does not clear the
  // buffer, and 2) it stops current logcat from outputting messages. This is a
  // workaround to take a timestamp and use it in next logcat call, i.e., next
  // start() invocation so we don't run |logcat -c| here.
  if (this.device.properties['ro.build.version.sdk'] >= 21) {
    var logging = this;

    // Sleep 1 second to make sure we won't receive any logs from past as the
    // date command we're using returns the current time in seconds.
    return this.adbShell('sleep 1; ' + DATE_COMMAND)
      .then(function(output) {
        logging.clearTimestamp = output;
      });
  }

  return this.adbShell('logcat -c');
};

/**
 * Write a User Timing performance entry mark to the ADB log
 * @param {string} name performance mark name
 * @param {number} time Unix epoch of when the performance mark occurred
 * @returns {Promise}
 */
Logging.prototype.mark = function(name, time) {
  var mark = util.format('system.gaiamobile.org|mark|%s|0|0|%s', name, time);
  return this.info('PerformanceTiming', mark);
};

/**
 * Write the memory information to the log for a given process ID
 * @param {string|number} pid process ID for which to log memory information
 * @param {string} context origin URL context to associate with entry
 * @returns {Promise}
 */
Logging.prototype.memory = function(pid, context) {
  var logging = this;
  pid = pid.toString();

  return new Command()
    .env('ANDROID_SERIAL', this.serial)
    .adbShell('b2g-info')
    .pipe('grep "' + pid + '"')
    .exec()
    .then(function(output) {
      var parts = output.split(/\s+/g);
      var index = parts.indexOf(pid) + 1;
      parts = parts.slice(index);

      logging.info('PerformanceMemory', context + '|uss|' + parts[3]);
      logging.info('PerformanceMemory', context + '|pss|' + parts[4]);
      logging.info('PerformanceMemory', context + '|rss|' + parts[5]);
    });
};

/**
 * Spawn a connection to ADB logcat and set a read-stream for entries
 */
Logging.prototype.start = function() {
  if (currentProcess) {
    this.stream = currentStream;
    return;
  }

  var args = ['adb'];
  var device = this.device;
  var serial = this.serial;
  var env = process.env;

  env.ANDROID_SERIAL = serial;

  if (ADB_HOST) {
    args.push('-H');
    args.push(ADB_HOST);
  }

  if (ADB_PORT) {
    args.push('-P');
    args.push(ADB_PORT);
  }

  args.push('logcat');

  // Apply current date or the timestamp we captured at clear() for logcat on
  // Android L. See the comment in clear() for the reason of doing so.
  if (device.properties['ro.build.version.sdk'] >= 21) {
    if (this.clearTimestamp) {
      args.push('-T');
      args.push('"' + this.clearTimestamp.replace(/\r?\n|\r/, "") + '"');
    } else {
      args.unshift('NOW=$(adb shell ' + DATE_COMMAND + ');');
      args.push('-T');
      args.push('"${NOW//[$\'\r\n\']}"');
    }
  }

  currentProcess = spawn('bash', ['-c', args.join(' ')], {
    detached: true,
    env: env
  });

  this.stream = currentStream = byline(currentProcess.stdout);

  currentStream.on('data', function(data) {
    // Prevent a race condition for when we have removed the stream but have not
    // yet parsed the data so we don't try to emit on a non-existent emitter
    if (!currentStream) {
      return;
    }

    device.util
      .parseLog(data.toString())
      .messages
      .forEach(function(entry) {
        currentStream.emit('entry', entry);
      });
  });
};

/**
 * Stop and start the connection to ADB logcat
 */
Logging.prototype.restart = function() {
  this.stop();
  this.start();
};

/**
 * Stop the connection to ADB logcat
 */
Logging.prototype.stop = function() {
  if (currentProcess) {
    debug('Stopping logging process');
    try {
      process.kill(-currentProcess.pid, 'SIGINT');
    } catch(e) {}
    currentStream.removeAllListeners();
    currentProcess = null;
    currentStream = null;
  }
};

module.exports = Logging;
