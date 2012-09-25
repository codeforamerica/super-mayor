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
    MAXCACHE        = 50, // maximum number of requests to cache
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
getRequests(LASTUPDATED, function (err, requests) {
  if (err) {
    console.log("Error retrieving initial requests: %s", err);
    return;
  }
  LASTUPDATED = new Date();
  requests.reverse(); // because we're directly storing them,
                      //  we need to sort them DESC
  if (requests.length > MAXCACHE) {
    REQUESTSCACHE = requests.slice(0, MAXCACHE);
  }
});

//
// CRON FUNCTION
//
new cron.CronJob('0 */' + REFRESHMIN + ' * * * *', function(){
  getRequests(LASTUPDATED, function (err, requests) {
    if (err) {
      console.log("Error retrieving requests: %s", err);
      return;
    }
    LASTUPDATED = new Date();
    emitRequests(requests);
  });
}, null, // no function to call when finished
  true // Start the job right now
);

function getRequests(lastUpdated, callback) {
  chicago.serviceRequests({
    "updated_after": lastUpdated.toISOString(),
    "extensions": "true"
  }, function(err, data) {
    if (err) { 
      callback(err, null); 
      return; 
    }
    console.log("Retrieved %d service requests at %s", data.length, LASTUPDATED.toISOString());
    
    // Process our requests
    var requests = __.chain(data)       // Underscore chaining!
      .reject(function(request) {       // Remove any requests that don't have service_request_id's
        if (typeof request['service_request_id'] === 'undefined') {
          return true;
        }
        return false;
      })
      .sortBy('updated_datetime')       // Sort by updated_datetime
      .value();                         // and complete the chain
    
    callback(null, requests);
  });
}


/**
 * Take a collection of requests and emit them over a period of time
 *
 */
function emitRequests(requests) {
  var i, expectedEmit;
    
  async.forEachSeries(requests, function(request, done) {
    expectedEmit = new Date(request['updated_datetime'].getTime() + (REFRESHMIN * 60000));
    
    // check if expectedEmit falls before our Minimum Delay; 
    if (expectedEmit.getTime() < prevEmit.getTime() + EMITDELAY) {
      // if so, set it to our minimum delay
      expectedEmit = new Date(prevEmit.getTime() + EMITDELAY)
    }
    
    console.log('Expect to emit SR #%s at %s', request['service_request_id'], expectedEmit)
    
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

function comparator(request) {
  return -(new Date(request['updated_datetime']).getTime());
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
  insertion = __.sortedIndex(REQUESTSCACHE, request, comparator);
  REQUESTSCACHE.splice(insertion, 0, request);
  console.log('Cached request #%s', request['service_request_id']);
  
  // ensure that we don't cache too many requests
  if (REQUESTSCACHE.length >= MAXCACHE ) {
    // find the index of the 
    removal = __.sortedIndex(REQUESTSCACHE, { 'updated_datetime': new Date(new Date().getTime() - 30*6000)}, comparator )
    if (removal > MAXCACHE) {
      REQUESTSCACHE = REQUESTSCACHE.splice(0, removal);
    }
    else {
      REQUESTSCACHE = REQUESTSCACHE.splice(0, MAXCACHE);
    }
    console.log('Pruned cache; now size of %d', REQUESTSCACHE.length);
  }
}

// assuming io is the Socket.IO server object
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

app.get('/api/requests', function(req, res) {
  res.json(REQUESTSCACHE);
});

app.listen(PORT, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});