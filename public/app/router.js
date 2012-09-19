define([
  // Application.
  "app",
  
  // Libraries.
  "lodash",
  "io",

  // Modules.
  "modules/request",
],

function(app, _, io, Request) {

  // Defining the application router, you can attach sub routers here.
  var Router = Backbone.Router.extend({
    routes: {
      "": "index",
    },
    
    index: function() {
      // Use the main layout.
      app.useLayout("main").render();
      
      app.layout.setViews({
        "#body": new Request.Views.List({
          collection: this.requests,
        }),
      }).render();
      
      app.layout.render();
    },
    
    // Shortcut for building a url.
    go: function() {
      return this.navigate(_.toArray(arguments).join("/"), true);
    },

    initialize: function() {
      var self = this;
      app.useLayout("main");
      
      self.requests;
      
      var socket = io.connect('/');
      this.requests = new Request.Collection(null, {socket: socket});
            
      app.layout.setViews({
        "#navbar": new Backbone.View({
          template: 'navbar/navbar'
        }),
      });
    }

  });

  return Router;

});
