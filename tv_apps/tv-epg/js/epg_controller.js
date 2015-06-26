/* global evt, Promise, ChannelManager */

'use strict';

(function(exports) {

  function EPGController(timelineOffset, timelineUnit) {
    this.totalTimeslotCount = 0;
    this.timelineUnit = timelineUnit;
    this.timelineOffset = timelineOffset;
    this.channelOffset = 0;
    this.channelManager = new ChannelManager();
    this.programTable = [];

    this.channelManager.scanTuners();
    this.channelManager.on('scanned', this._onScanned.bind(this));
  }

  var proto = Object.create(new evt());

  proto._onScanned = function epg__onScanned() {
    this.programTable = [];

    this.channelManager.setPlayingSource(function() {
      window.location.hash = this.channelManager.currentHash;
    }.bind(this));
    this._createChannelList(this.channelManager.getSource().channels);
    this.fire('scanned', this.channelManager.getTuner().tuner.stream);
  };

  /**
   * fetchPrograms function fetches more programs starting from startTime to
   * startTime + duration.
   */
  proto.fetchPrograms = function epg_fetchPrograms(startTime, duration) {
    return new Promise(function (resolve) {
      this._addTimeline(startTime, duration);
      this.fire('allTimelineAdded');

      var fetchedChannelCount = 0;
      var channelItems = this.channelManager.getSource().channels;
      channelItems.forEach(function(channelItem, index) {
        channelItem.channel.getPrograms({
          startTime: startTime * this.timelineUnit,
          duration: duration * this.timelineUnit
        }).then(function(programs) {
          this._addPrograms(index, programs);
          fetchedChannelCount++;
          if (fetchedChannelCount === channelItems.length) {
            resolve();
          }
        }.bind(this)).catch(function(err) {
          console.error(err);
        });
      }.bind(this));
    }.bind(this));
  };

  /**
   * Add more timestamp to timeline
   */
  proto._addTimeline = function epg__addTimeline(startTime, duration) {
    var time;
    var i;
    // Scan from left to right, append to end if the timeslot does not exist.
    for(i = 0; i < duration; i++) {
      time = startTime + i;
      if (time > this.timelineOffset + this.programTable.length - 1) {
        this.totalTimeslotCount++;
        this.programTable.push({});
        this.fire(
          'addTimeline',
          this.programTable.length - 1,
          time * this.timelineUnit
        );
      }
    }

    // Scan from right to left, add to head if the timeslot does not exist.
    for(i = duration - 1; i >= 0; i--) {
      time = startTime + i;
      if (time < this.timelineOffset) {
        this.totalTimeslotCount++;
        this.programTable.unshift({});
        this.timelineOffset--;
        this.fire('addTimeline', 0, time * this.timelineUnit);
      }
    }
  };

  /**
   * Add more programs to programTable. Note that a program, from startTime to
   * startTime + duration, may not perfectly lies in existing timeline interval,
   * in order to easily controll the table, timeslot that goes beyond the
   * interval will be filtered out.
   */
  proto._addPrograms = function epg__addPrograms(row, programs) {
    var column;
    var startTime;
    var endTime;
    var isFirstProgramSlot;
    var program;
    var time;
    var i;

    // Scan programs from right to left (assume programs are sorted)
    for (i = programs.length - 1; i >= 0; i--) {
      program = programs[i];
      isFirstProgramSlot = true;
      startTime = Math.floor(program.startTime / this.timelineUnit);
      endTime = startTime + Math.ceil(program.duration / this.timelineUnit);
      endTime =
        Math.min(endTime, this.timelineOffset + this.totalTimeslotCount);

      for(time = startTime; time < endTime; time++) {
        column = time - this.timelineOffset;
        // filter out non-existing timeline
        if (this.programTable[column]) {
          // only the first timeslot within the interval will be displayed
          this.programTable[column][row] = {
            program: program
          };
          if (isFirstProgramSlot) {
            this.fire('updateProgram', {
              title: new Date(program.startTime).getHours() + ':' +
                     new Date(program.startTime).getMinutes() +  ', ' +
                     Math.ceil(program.duration / this.timelineUnit) + ', ' +
                     program.title,
              row: row,
              column: column,
              duration: endTime - time,
              isVisible: true,
              item: this.programTable[column][row]
            });
            isFirstProgramSlot = false;
          } else {
            // Easier to index the first visible element of a program
            this.programTable[column][row].element =
              this.programTable[column - 1][row].element;
            this.fire('updateProgram', {
              row: row,
              column: column,
              isVisible: false
            });
          }
        }
      }
    }
  };

  proto.switchChannel = function epg_switchChannel(index) {
    var number = this.channelManager.getSource().channels[index].channel.number;
    this.channelManager.playingState.channelNumber = number;
    this.channelManager.setPlayingChannel(function() {
      window.location.hash = this.channelManager.currentHash;
    }.bind(this));
  };

  proto._createChannelList = function epg__createChannelList(channels) {
    var fetchedChannelCount = 0;
    channels.forEach(function(channelItem, index) {
      this.fire('appendChannel', channelItem.channel, index);
      fetchedChannelCount++;
      if (fetchedChannelCount === channels.length) {
        this.fire('allChannelFetched');
      }
    }.bind(this));
  };

  exports.EPGController = EPGController;
  EPGController.prototype = proto;
})(window);
