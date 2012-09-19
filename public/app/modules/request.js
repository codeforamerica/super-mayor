define([
  // Global application context.
  "app",

  // Third-party libraries.
  "backbone",
  "lodash",

],

function(app, Backbone, _) {

  var Request = app.module();

  //
  // MODEL
  //
  Request.Model = Backbone.Model.extend({
       
    idAttribute: "service_request_id",
        
  });

  //
  // COLLECTION
  //
  Request.Collection = Backbone.Collection.extend({

    model: Request.Model,
    
    comparator: function(a, b) {
      if ( a.get('updated_datetime') < b.get('updated_datetime') ) {
        return 1;
      }
      else if (a.get('updated_datetime') > b.get('updated_datetime')) {
        return -1;
      };
      return 0;
    },
    
  });
  
  //
  // ITEM VIEW
  //
  Request.Views.Item = Backbone.View.extend({
    template: "request/item",

    tagName: "tr",

    serialize: function() {
      return { request: this.model.attributes };
    },

    initialize: function() {
      // this.collection.on("reset", this.render, this);
    },
    
  });
  
  //
  // LIST VIEW
  //
  Request.Views.List = Backbone.View.extend({
    template: "request/list",   
    
    serialize: function() {
      return { collection: this.collection };
    },
    
    beforeRender: function() {
      this.collection.each(function(request) {
        this.insertView("tbody", new Request.Views.Item({
          model: request
        }));
      }, this);
    },
    
    initialize: function() {
      this.collection.on('reset', this.render, this);
      this.collection.on('add', this.render, this);
      
      this.collection.on('reset', function() {console.log("Reset!")})
    },
  });
  

  return Request;

});