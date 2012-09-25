Super Mayor
==============

Lists service requests within the City of Chicago's 311 system that have recently been created, updated or closed. It uses civic data from [Chicago's Open311 API](http://dev.cityofchicago.org/docs/api). 

Features:

- Service requests appear as they're created/updated/closes
- Watch (and listen to) the mayor as he leaps over newly submitted requests and collects boxes when requests are updated/closed
- Background changes depending on day/night
 

![Screenshot of Super Mayor](https://raw.github.com/bensheldon/super-mayor/master/screenshot.png)

_Skyline graphic by [TJ McKimmey](http://tjmckimmey.com/), logo by [Angel Kittiyachavalit](http://iamakit.com/)._

Potential Reusability in other Open311 cities
------------------------------
 Slim to none. This application uses a non-standard, Chicago-specific query argument, `updated_after` that allows the querying service requests by when they were last _updated_ (the official Open311 specification only allows querying by _creation_ date).
 
Installation and Configuration
------------------------------

The front-end application uses Backbone-Boilerplate running on a Node server and uses Socket.io to send new updates from the server.

1. Install the packages: `$ npm install`
2. Start the server: `$ node server.js`
3. Visit the webpage: `http://localhost:3000`

On startup, the server initially fetches all service requests update in the previous hour. It then checks every 2 minutes for newly updated service requests and emits them to the browser with a 2 minute delay (as well as a little logic to avoid emitting multiple requests at exactly the same instance). So a service request that was updated at 02:**46**:15 will be emitted to the client at 02:**48**:15.

Testing
-------
 
If you don't want to wait for actual service requests, you can generate fake service requests by starting the server with the command `node test/server.mock.js` and then visiting `http://localhost:3000` (you will still need to wait ~2 minutes for fake requests to start streaming in).