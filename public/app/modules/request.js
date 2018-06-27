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
    
    maxSize: 30,
    
    checkSize: function() {
      if (this.models.length > this.maxSize) {
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
      var lastType;
        
      // check if there is an existing request; if so remove it
      var existingRequest = this.get(request['service_request_id']);
      if (existingRequest) {
        this.remove(existingRequest);
        console.log('Updated Service Request #%s', request['service_request_id']);
      }
      else {
        console.log('Added Service Request #%s', request['service_request_id']);
      }
        
        
      lastType = request['notes'][request['notes'].length - 1].type;
      if (lastType && lastType.toLowerCase() === 'opened') {
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
    
    posX: -36,
    
    move: function() {
      var SPEED = 3;
      
      if (this.model.get('lastAction') === 'updated') {
        SPEED = 2;
      }
      
      this.posX = this.posX + SPEED;
      this.$el.css('right', this.posX + 'px' );
      
      // remove the element if it goes beyond the width of the scene
      if (this.posX > this.parent.width) {
        this.remove();
      } 
    },
    
    initialize: function(options) {
      this.parent = options.parent;
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
        foregroundX: this.foregroundX,
        backgroundX: this.backgroundX,
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
      this.$mayor = this.$el.find('#mayor');
      
      this.resize();
      // startup our loop after the render
      this.on('loop', this.moveForeground, this);
      this.on('loop', this.moveBackground, this);
      this.on('loop', this.dayNightCycle, this);
      this.on('loop', this.mayorCollision, this);
      this.eventLoop();
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
      var TOTALTIMEOUT = 150 * 1000; // we now things will be delayed by 2 minutes, but give it 30 seconds to cross screen
      var timeout = (new Date()).getTime() - ((new Date(model.get('updated_datetime'))).getTime() + 120000);
      if (timeout < 0) {
        timeout = 0;
      }      
      // add it to the scene
      setTimeout(_.bind(function() {        
        this.insertView("#scene", new Request.Views.Beast({
          model: model,
          parent: this,
          className: 'beast ' + model.get('lastAction')
        })).render();
      }, this), timeout);
    },
    
    daytime: true,
    foregroundX: 0,
    backgroundX: 0,
    width: 960,
    $mayor: false,
    mayorWidth: 48,
    
    moveForeground: function() {
      // scroll the foreground
      var SPEED = -0.5;
      var WIDTH = 960;
      this.foregroundX = (this.foregroundX + SPEED) % WIDTH;
      this.$el.find('#foreground').css('background-position', this.foregroundX + 'px 100%' );
    },
    
    moveBackground: function() {
      // scroll the background
      var SPEED = -.25;
      var WIDTH = 315;
      this.backgroundX = (this.backgroundX + SPEED) % WIDTH;
      this.$el.find('#background').css('background-position', this.backgroundX + 'px 100%' );
    },
    
    mayorJump: function(event) {
      // only jump for the spacebar
      if (event.keyCode === 32) { 
        event.preventDefault();
      
        // make the mayor jump
        if (!this.$mayor.hasClass('jump')) {
          this.$mayor.addClass('jump');
          this.$mayor.addClass('manual'); // make sure to make it manual
          console.log('JUMP!');
          this.$mayor.find('audio.jump')[0].play();
        
          setTimeout(_.bind(function() { 
            this.$mayor.removeClass('manual');
          }, this), 700);
        }
      }
    },
    
    mayorCollision: function() {
      var beasts = this.$el.find('.beast');
      var underneath = this.$el.find('.beast.underneath').length;      
      
      // Land the mayor if nothing is underneath him
      if ( underneath === 0 &&
           this.$mayor.hasClass('jump') &&
           (!this.$mayor.hasClass('manual')) 
      ) {
        this.$mayor.removeClass('jump');
      }
      
      var mayorLeft = $(mayor).position().left;
      
      _.each(beasts, _.bind(function(beast) {
        var $beast = $(beast);
        var beastLeft = $beast.position().left;
        var beastWidth = $beast.width();
        
        if (beastLeft  < (mayorLeft + this.mayorWidth) &&
            (mayorLeft) < (beastLeft + beastWidth)
          ) {
            
          if ( !$beast.hasClass('underneath') ) {
            // first time the mayor encounters this beast
            $beast.addClass('underneath');
            $beast.addClass('active');
            
            // check if it's a coin block
            if ($beast.hasClass('updated')) {
              this.$mayor.find('audio.coin')[0].play();
            }
          }
          
          // make the mayor jump
          if (!this.$mayor.hasClass('jump')) {   
            this.$mayor.addClass('jump');
            console.log('JUMP!');
            this.$mayor.find('audio.jump')[0].play();
          }
        }
        else {
          // the beast is not underneath the mayor
          $beast.removeClass('underneath');
        }
      }, this));
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
      
      setInterval(_.bind(function() {
        this.trigger('loop');
      }, this), EVENTRATE);
    },
    
    resize: function() {
      this.width = this.$el.find('#foreground').width();
      this.mayorWidth = this.$el.find('#mayor').width();
    },
    
    initialize: function() { 
      this.collection.on('reset', this.render, this);
      this.collection.on('add', this.addRequest, this);
      this.daytime = this.dayNightCycle();
      
      this.collection.on('reset', function() { console.log("Reset!"); });

      // have the mayor jump
      $(document).keypress(_.bind(this.mayorJump, this));
      $(window).bind("resize.app", _.bind(this.resize, this));
    },
    
    cleanup: function() {
      // unbind the mayor jump keypress!
      $(document).unbind('keypress');
      $(window).unbind("resize.app");
    }
  });
  
  return Request;

});