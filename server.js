var __              = require('lodash'),
    async           = require('async'),
    express         = require('express'),
    app             = module.exports = express.createServer(),
    io              = require('socket.io').listen(app),
    PORT            = process.env.PORT || 3000,
    cron            = require('cron'),
    Open311         = require('open311'),
    chicago         = new Open311('chicago'), // Configure the Open311 endpoint
    REFRESHMIN      = 2, // refresh things every how many minutes
    LASTUPDATED     = new Date(), // when this was last updated
    REQUESTSCACHE  = [],  // a holder for all our requests
    MAXCACHE        = 100, // maximum number of requests to cache
    EMITDELAY       = 1500, // minimum time between emits 
    prevEmit        = new Date(0); // the last time we emitted something
    

/** Express Configuration **/
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.compress());
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  
  // Backbone routing
  app.use(express.static(__dirname + '/public'));
});

app.configure('production', function(){
  app.use(express.errorHandler());
  io.set('log level', 1); // reduce logging
  
  // Backbone routing: compilation step is included in `npm install` script
  app.use('/app', express.static(__dirname + '/public/dist/release'));
  app.use('/assets/js/libs', express.static(__dirname + '/public/dist/release'));
  app.use('/assets/css', express.static(__dirname + '/public/dist/release'));
  app.use(express.static(__dirname + '/public'));
});


// Get requests from the last hour on startup
LASTUPDATED = new Date(LASTUPDATED.getTime() - 60*60*1000);
getRequests(LASTUPDATED, { emit: false });

//
// CRON FUNCTION
//
new cron.CronJob('0 */' + REFRESHMIN + ' * * * *', function(){
  getRequests(LASTUPDATED, { emit: false });
}, null, // no function to call when finished
  true // Start the job right now
);

function getRequests(lastUpdated, options) {
  chicago.serviceRequests({
    "updated_after": lastUpdated.toISOString(),
    "extensions": "true"
  }, function(err, data) {
    if (err) { console.log('Error retrieving requests:', err); return; }
      
    console.log("Retrieved %d service requests at %s", data.length, LASTUPDATED.toISOString());
      
    if (data.length === 0) { return; }

    var requests = __.chain(data)       // Underscore chaining!
      .reject(function(request) {       // Remove any requests that don't have service_request_id's
        if (typeof request['service_request_id'] === 'undefined') {
          return true;
        }
        return false;
      })
      .sortBy('updated_datetime')       // Sort by updated_datetime
      .value();                         // and complete the chain
      
    // Add/emit requests
    addRequests(requests, options);
  });
    
  // Update when we last updated
  lastUpdated = new Date();
}


/**
 * Take a collection of requests and emit them over a period of time
 *
 */
function addRequests(requests, options) {
  var i, expectedEmit;
  
  options = __.defaults(options, {
    emit: true
  });
  
  if (options.emit === 'false') {
    for (i = 0; i < requests.length; i++) {
      cacheRequest(requests[i]);
    }
    return; // don't emit anything
  }
  
  async.forEachSeries(requests, function(request, done) {
    expectedEmit = new Date(request['updated_datetime'].getTime() + (REFRESHMIN * 60000));
    
    // check if expectedEmit falls before our Minimum Delay; 
    if (expectedEmit.getTime() < prevEmit.getTime() + EMITDELAY) {
      // if so, set it to our minimum delay
      expectedEmit = new Date(prevEmit.getTime() + EMITDELAY)
    }
    
    // save the emit time for our next loop
    prevEmit = expectedEmit;
    
    // Emit it at our expectedEmit time
    new cron.CronJob(expectedEmit, function(){
      // broadcast globally
      io.sockets.emit("new-request", request);
      cacheRequest(request);
    }, null, // no function to call when finished
      true // Start the job right now
    );
   done(); 
  });
}

function cacheRequest(request) {
  var insertion; 
  
  // Remove the request from our list of existing cached requests 
  // (in case it already exists)
  REQUESTSCACHE = __.reject(REQUESTSCACHE, function(cRequest) {
    if (cRequest['service_request_id'] === request['service_request_id']) {
      return true;
    }
    return false;
  });

  // Insert the request in order (so will probably end up at the end)
  insertion = __.sortedIndex(REQUESTSCACHE, request, function(request) { return request['updated_datetime'] });
  REQUESTSCACHE.splice(insertion, 0, request);
  
  // ensure that we don't cache too many requests
  if (REQUESTSCACHE.length >= MAXCACHE ) {
    // if so, pop one off the top
    REQUESTSCACHE.shift();
  }
  console.log('Cached request #%s', request['service_request_id']);
  console.log('Cache is now size of %d', REQUESTSCACHE.length);
}

// assuming io is the Socket.IO server object
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

io.sockets.on('connection', function (socket) {
  socket.emit('existing-requests', REQUESTSCACHE); // send all of our requests on the first connection
});

app.listen(PORT, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});