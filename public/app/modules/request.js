define([
  // Global application context.
  "app",

  // Third-party libraries.
  "backbone",
  "lodash",
  "timeago",
  "ui"
],

function(app, Backbone, _) {

  var Request = app.module();

  //
  // MODEL
  //
  Request.Model = Backbone.Model.extend({
       
    idAttribute: "service_request_id",
    
    lastAction: false
        
  });

  //
  // COLLECTION
  //
  Request.Collection = Backbone.Collection.extend({
    url: "api/requests",

    model: Request.Model,
    
    comparator: function(a) {
      return -(new Date(a.get('updated_datetime')).getTime());
    },
    
    maxSize: 60,
    
    checkSize: function() {
      if (this.models.length > this.maxSize) {
        var outdatedRequests = [];
        console.log('TOO BIG! There are %d models in our collection', this.models.length);
        // remove everything older than 1 hour
        var outdatedRequests = _.filter(this.models, function(request, index) {
          // prune if there are more than maxSize requests 
          // AND the request is older than 30 minutes
          if ( (index > this.maxSize) ///&&
               // (new Date(request.get('updated_datetime')).getTime() < (new Date().getTime() - 30*60*1000) )
          ) {
            return true;
          }
          return false;
        }, this);
        
        if (outdatedRequests.length) {
          console.log("Pruned %d outdated requests", outdatedRequests.length);
          this.remove(outdatedRequests);
        }
      }
    },
    
    newRequest: function(request) {
      var lastSummary;
        
      // check if there is an existing request; if so remove it
      var existingRequest = this.get(request['service_request_id']);
      if (existingRequest) {
        this.remove(existingRequest);
        console.log('Updated Service Request #%s', request['service_request_id']);
      }
      else {
        console.log('Added Service Request #%s', request['service_request_id']);
      }
        
      lastSummary= request['notes'][request['notes'].length - 1].summary;
        
      if (lastSummary.toLowerCase() === 'request opened') {
        request.lastAction = 'opened';
      }
      else {
        request.lastAction = 'updated';
      }
      this.add(request);
    },
    
    initialize: function(models, options) {
      this.socket = options.socket;
      
      this.fetch();
      // this.on('add', this.checkSize, this);
      // this.on('reset', this.checkSize, this);      
      
      this.newRequest = _.bind(this.newRequest, this);
      this.socket.on('new-request', this.newRequest);
    }
  });
  
  //
  // ROW VIEW
  //
  Request.Views.Row = Backbone.View.extend({
    template: "request/row",

    tagName: "tr",

    serialize: function() {
      return { request: this.model.attributes };
    },
    
    afterRender: function() {
      this.$el.find('abbr.timeago').timeago();
            
      if (this.model.get('lastAction')) {
        this.$el.effect("highlight", {color: "#FBC321"}, 1500);
      }
    },

    initialize: function() {
      this.model.on('remove', this.remove, this);
    }
    
  });
  
  //
  // BEAST VIEW
  //
  Request.Views.Beast = Backbone.View.extend({
    template: "request/beast",
    
    tagName: 'div',
    
    className: 'beast', // modified on creation to include the beast-type

    serialize: function() {
      return { request: this.model.attributes };
    },
    
    move: function() {
      var self = this;
      var WIDTH = 960;
      var SPEED = 4;
      
      var oldPosx = 0;
      if (self.$el.css('right')) {
        oldPosx = self.$el.css('right').match(/(-?[0-9]*)px/)[1];
      }
      if (self.model.get('lastAction') === 'updated') {
        SPEED = 3;
      }
      
      var posX = Number(oldPosx) + SPEED;
      // set the position
      self.$el.css('right', posX + 'px' );
      
      // remove the element if it goes beyond the width of the scene
      if (posX > $('#foreground').width()) {
        self.remove();
      } 
    },
    
    initialize: function(options) {
      this.parent = options.parent;
      var self = this;
      this.className =  'beast ' + this.model.get('lastAction');
      this.parent.on('loop', this.move, this);       
    }
  });
  
  //
  // LIST VIEW
  //
  Request.Views.List = Backbone.View.extend({
    template: "request/list",   
    
    serialize: function() {
      return { 
        collection: this.collection,
        sceneForegroundX: this.sceneForegroundX,
        daytime: this.daytime
      };
    },
    
    beforeRender: function() {
      this.collection.each(function(request) {
        this.insertView("tbody", new Request.Views.Row({
          model: request
        }));
      }, this);
    },
    
    afterRender: function() {
      $('abbr.timeago').timeago();
    },
    
    addRequest: function(model, collection, options) {
      // Add a beast
      this.addBeast(model);
      
      // and add it to the table
      this.insertView("tbody", new Request.Views.Row({
        model: model,
        // in reverse order
        append: function(root, child) {
          $(root).prepend(child);
        }
      })).render();
    },
    
    addBeast: function(model) {
      var self = this;
      
      var TOTALTIMEOUT = 150 * 1000; // we now things will be delayed by 2 minutes, but give it 30 seconds to cross screen
      var timeout = (new Date()).getTime() - ((new Date(model.get('updated_datetime'))).getTime() + 120000);
      if (timeout < 0) {
        timeout = 0;
      }      
      // add it to the scene
      setTimeout(function() {        
        self.insertView("#scene", new Request.Views.Beast({
          model: model,
          parent: self,
          className: 'beast ' + model.get('lastAction')
        })).render();
      }, timeout);
    },
    
    daytime: true,
    foregroundX: 0,
    backgroundX: 0,
    
    moveForeground: function() {
      // scroll the foreground
      var SPEED = -2;
      var WIDTH = 960;
      var posX = this.foregroundX;
      var foregroundPos= $('#foreground').css('background-position');
      if (foregroundPos) {
        posX = Number( foregroundPos.match(/(-?[0-9]*)px 100%/)[1] );
      }
      this.foregroundX = (posX + SPEED) % WIDTH;
      $('#foreground').css('background-position', this.foregroundX + 'px 100%' );
    },
    
    moveBackground: function() {
      // scroll the background
      var SPEED = -1;
      var WIDTH = 315;
      var posX = this.backgroundX;
      var backgroundPos= $('#background').css('background-position');
      if (backgroundPos) {
        posX = Number( backgroundPos.match(/(-?[0-9]*)px 100%/)[1] );
      }
      this.backgroundX = (posX + SPEED) % WIDTH;
      $('#background').css('background-position', this.backgroundX + 'px 100%' );
    },
    
    mayorJump: function(event) {
      // only jump for the spacebar
      if (event.keyCode === 32) { 
        var mayor = $('#mayor');
        
        event.preventDefault();
      
        // make the mayor jump
        if (!$(mayor).hasClass('jump')) {
          $(mayor).addClass('jump');
          $(mayor).addClass('manual'); // make sure to make it manual
          console.log('JUMP!');
          $(mayor).find('audio.jump')[0].play();
        
          setTimeout(function() { 
            $(mayor).removeClass('manual');
          }, 700);
        }
      }
    },
    
    mayorCollision: function() {
      var self = this;
      var mayor = $('#mayor');
      var beasts = self.$el.find('.beast');
      var jump = $(mayor).find('audio')[0];
      var underneath = self.$el.find('.beast.underneath').length;
      
      // Land the mayor if nothing is underneath him
      if ( underneath === 0 &&
           $(mayor).hasClass('jump') &&
           (!$(mayor).hasClass('manual')) 
      ) {
        $('#mayor').removeClass('jump');
      }
      
      _.each(beasts, function(beast) {
        if ( $(beast).position().left < ($(mayor).position().left + $(mayor).width()) &&
            ($(mayor).position().left) < ($(beast).position().left + $(beast).width())
          ) {
            
          if ( !$(beast).hasClass('underneath') ) {
            // first time the mayor encounters this beast
            $(beast).addClass('underneath');
            
            // check if it's a coin block
            if ($(beast).hasClass('update')) {
              $(mayor).find('audio.coin')[0].play();
            }
          }
          
          // make the mayor jump
          if (!$(mayor).hasClass('jump')) {   
            $(mayor).addClass('jump');
            console.log('JUMP!');
            $(mayor).find('audio.jump')[0].play();
          }
        }
        else {
          // the beast is not underneath the mayor
          if ( $(beast).hasClass('underneath') ) {
            $(beast).removeClass('underneath');
          }
        }
      });
    },

    
    dayNightCycle: function() {
      // change the background to be night/day
      currentHour = (new Date()).getHours() + ( (new Date()).getTimezoneOffset()/60 ) % 24;
      if ( (currentHour > 24) || (currentHour < 11) ) {
        $('#scene').addClass('night');
        this.daytime = false;
      } else {
        $('#scene').removeClass('night');
        this.daytime = true;
      }
    },
    
    eventLoop: function() {
      var EVENTRATE = 50;
      var self = this;
      
      setInterval(function() {
        self.trigger('loop');
      }, EVENTRATE);
    },
    
    initialize: function() {
      this.collection.on('reset', this.render, this);
      
      this.collection.on('add', this.addRequest, this);
      
      this.daytime = this.dayNightCycle();
      
      this.on('loop', this.moveForeground, this);
      this.on('loop', this.moveBackground, this);
      this.on('loop', this.dayNightCycle, this);
      this.on('loop', this.mayorCollision, this);
      this.eventLoop();  
      
      this.collection.on('reset', function() { console.log("Reset!"); });

      // have the mayor jump
      $(document).keypress(this.mayorJump);
    },
    
    cleanup: function() {
      // unbind the mayor jump keypress!
      $(document).unbind('keypress');
    }
  });
  
  return Request;

});