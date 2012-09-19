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
      this.requests = new Request.Collection();
      
      var socket = io.connect('/');
      socket.on('requests', function (data) {
        console.log('Loaded %d Service Requests', data.length)
        // be sure to treat them as if the sound has been played
        _.each(data, function(request) {
          request.sound = false;
        });
                
        self.requests.add(data);
      });
      
      socket.on('request', function (data) {
        // check if there is an existing request; if so remove it
        var existingRequest = self.requests.get(data['service_request_id']);
        if (existingRequest) {
          self.requests.remove(existingRequest, {silent: true})
          console.log('Updated Service Request #%s', data['service_request_id']);
        }
        else {
          console.log('Added Service Request #%s', data['service_request_id']);
        }
        
        var lastSummary = data['notes'][data['notes'].length - 1].summary;
        
        if (lastSummary.toLowerCase() === 'request opened') {
          data.sound = 'open';
        }
        else {
          data.sound = 'update';
        }
        
        self.requests.add(data);
      });
            
      app.layout.setViews({
        "#navbar": new Backbone.View({
          template: 'navbar/navbar'
        }),
      });
    }

  });

  return Router;

});
