define(["exports", "components/fxos-mvc/dist/mvc", "gaia-component", "gaia-dialog", "js/view/main_view", "js/controller/list_controller", "js/view/upload_view.js", "js/lib/helpers"], function (exports, _componentsFxosMvcDistMvc, _gaiaComponent, _gaiaDialog, _jsViewMainView, _jsControllerListController, _jsViewUploadViewJs, _jsLibHelpers) {
  "use strict";

  var _extends = function (child, parent) {
    child.prototype = Object.create(parent.prototype, {
      constructor: {
        value: child,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    child.__proto__ = parent;
  };

  var RoutingController = _componentsFxosMvcDistMvc.RoutingController;
  var MainView = _jsViewMainView["default"];
  var ListController = _jsControllerListController["default"];
  var UploadView = _jsViewUploadViewJs["default"];
  var ActivityHelper = _jsLibHelpers.ActivityHelper;
  var AchievementsHelper = _jsLibHelpers.AchievementsHelper;
  var MainController = (function (RoutingController) {
    var MainController = function MainController() {
      this.view = new MainView({ el: document.body });
      this.activityHelper = new ActivityHelper();
      this.achievementsHelper = new AchievementsHelper();
      this.listController = new ListController();
      RoutingController.call(this, {
        apps: this.listController,
        addons: this.listController
      });
    };

    _extends(MainController, RoutingController);

    MainController.prototype.main = function () {
      var _this = this;
      this.activityHelper.ready.then(function (route) {
        _this.view.render(_this.activityHelper.isActivity);
        // We cannot upload from the activity.
        if (!_this.activityHelper.isActivity) {
          _this.renderUploadView();
        }

        // If current hash does not match current route, change the hash
        // to invoke routing function, otherwise invoke route explicitly.
        if (window.location.hash.slice(1) !== route) {
          window.location.hash = "#" + route;
        } else {
          _this.route();
        }
      });
    };

    MainController.prototype.renderUploadView = function () {
      var _this2 = this;
      this.uploadView = new UploadView();
      this.uploadView.render();
      this.view.el.appendChild(this.uploadView.el);
      this.view.onUpload(function () {
        _this2.uploadView.show();
      });
    };

    return MainController;
  })(RoutingController);

  exports["default"] = MainController;
});