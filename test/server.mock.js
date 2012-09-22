var expect = require('chai').expect;
var sinon = require('sinon');
var Open311 = require('open311');
var fs = require('fs');

var SRID = 0

var createRequest = function (updatedDatetime, updated) {
  var request =  {
    service_request_id: "12-" + SRID++,
    status: "open",
    service_name: "Building Violation",
    service_code: "4fd3bd72e750846c530000cd",
    agency_responsible: "DOB - Conservation",
    requested_datetime: "2012-09-19T09:46:42-05:00",
    updated_datetime: updatedDatetime,
    address: "3044 S KILDARE AVE, CHICAGO, IL, 60623",
    lat: 41.83782286799041,
    long: -87.73166761976265,
    zipcode: "60623",
    notes: [
      {
        datetime: "2012-09-19T09:46:42-05:00",
        summary: "Request opened",
        type: "opened"
      }
    ],
    extended_attributes: {
      channel: "phone",
      ward: "22",
      police_district: "10"
    }
  };
  
  if (updated === 0) {
    request.notes.push({
      datetime: "2012-09-19T09:46:42-05:00",
      summary: "Request updated",
      type: "updated"
    });
  }
  
  return request;
}

var generateRequests = function (options, callback) {
  console.log('GENERATING!')
  var requests = [];
  var date = new Date((new Date()).getTime() - (2 * 60 * 1000));
  // every 5 seconds
  for (var i=0; i < 24; i++) {
    date = new Date( date.getTime() + 5000);
    requests.push(createRequest(new Date(date.getTime() + Math.floor((Math.random()*5000)+1)), i%3));
    console.log("Mocking Request: ", date);
    
  }
  
  callback(null, requests);
}

var open311 = new Open311('chicago');

var stub = sinon.stub(Open311.prototype, 'serviceRequests', generateRequests);


// AND START THE SERVER
var server = require('../server');
