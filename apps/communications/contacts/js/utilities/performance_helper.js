'use strict';

/**
 * Utility class to fire events needed to measure the performance
 * of the application.
 * For an explanation of what means each event go here:
 * https://bugzilla.mozilla.org/show_bug.cgi?id=996038
 * For an explanation of how are adapted to the specific needs
 * in the contacts app please go here:
 * https://bugzilla.mozilla.org/show_bug.cgi?id=1015388#c8
 */
(function(){

  window.utils = window.utils || {};

  var PerformanceHelper = {
    domLoaded: function() {
      window.performance.mark('navigationLoaded');
    },
    chromeInteractive: function() {
      window.performance.mark('navigationInteractive');
    },
    visuallyComplete: function() {
      window.performance.mark('visuallyLoaded');
    },
    contentInteractive: function() {
      window.performance.mark('contentInteractive');
    },
    loadEnd: function() {
      window.performance.mark('fullyLoaded');
    },

    list: {
      referenceMark: function() {
        window.performance.mark('listReference');
      },
      firstContactRenderedMark: function() {
        window.performance.mark('listFirstContactRendered');
      },
      firstContactRenderedMeasure: function() {
        window.performance.measure('list_first_contact_rendered', 'listReference', 'listFirstContactRendered');
      },
      chunkContactRenderedMark: function(){
        window.performance.mark('listChunkRendered');
      },
      chunkContactRenderedMeasure: function(){
        window.performance.measure('list_chunk_contact_rendered', 'listReference', 'listChunkRendered');
      },
      allContactsRenderedMark: function(){
        window.performance.mark('listAllRendered');
      },
      allContactsRenderedMeasure: function(){
        window.performance.measure('list_all_contacts_rendered', 'listReference', 'listAllRendered');
      }
    },
    
    details: {
      initContactDetails: function() {
        window.performance.mark("detailsReference");
      },
      contactRenderedMark: function() {
        window.performance.mark("DetailsContactRendered");
      },
      contactRenderedMeasure: function() {
        window.performance.measure("details_contact_rendered", "detailsReference", "DetailsContactRendered");
      }
    },

    common: {
      getLastMeasure: function(measure_name) {
        var entries = [];
        entries = window.performance.getEntriesByName(measure_name);
        return entries[entries.length - 1];
      }
    }
  };


  window.utils.PerformanceHelper = PerformanceHelper;

})();
