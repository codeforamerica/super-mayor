// Set the require.js configuration for your application.
require.config({

  // Initialize the application with the main application file.
  deps: ["main"],

  paths: {
    // JavaScript folders.
    libs: "../assets/js/libs",
    plugins: "../assets/js/plugins",

    // Libraries.
    jquery: "../assets/js/libs/jquery",
    lodash: "../assets/js/libs/lodash",
    backbone: "../assets/js/libs/backbone",
    bootstrap: "../assets/vendor/bootstrap/js/bootstrap",
    io: "../assets/vendor/socket.io",
    ui: "../assets/js/plugins/jquery-ui.custom",
    timeago: "../assets/js/plugins/jquery.timeago"
  },

  shim: {
    // Backbone library depends on lodash and jQuery.
    backbone: {
      deps: ["lodash", "jquery"],
      exports: "Backbone"
    },

    bootstrap: {
      deps: ["jquery"],
    },
    
    ui: {
      deps: ["jquery"]
    },
    
    timeago: {
      deps: ["jquery"]
    },
    
    io: {
      exports: "io"
    },
    
    // Backbone.LayoutManager depends on Backbone.
    "plugins/backbone.layoutmanager": ["backbone"]
  }

});
