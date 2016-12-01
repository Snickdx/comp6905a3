var express = require('express');
var azure = require('azure-sb');
var async = require("async");
var querystring = require('querystring');
var fs = require('fs');

var connectionString ="Endpoint=sb://test806003586.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=Op1irpLtHBbGyR0sA4nWBQkCtp1xIJiIrpPfiozjusY=";

var serviceBusService = azure.createServiceBusService(connectionString);

var app = express();

function checkForMessages(sbService, queueName, callback) {
	sbService.receiveQueueMessage(queueName, { isPeekLock: true }, function (err, lockedMessage) {
		if (err) {
			if (err == 'No messages to receive') {
				callback(err, "No Messages");
			} else {
				callback(err);
			}
		} else {
			callback(null, lockedMessage);
		}
	});
}

function post(url, val){
	var data = querystring.stringify(val);
	
	var options = {
		host: url,
		port: 80,
		path: '/login',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(data)
		}
	};
	
	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			console.log("body: " + chunk);
		});
	});
	
	req.write(data);
	req.end();
}

app.get('/sendmessage/:queue/:message', function (req, res) {
	
	serviceBusService.sendQueueMessage(req.params.queue, req.params.message, function (err) {
		if (err) {
			console.log('Failed Tx: ', err);
			res.send('Failed Tx: ', err);
		} else {
			console.log('Sent ' + req.params.message);
			res.send('Sent ' + req.params.message);
		}
	});
	
});

app.get('/blast/:queue', function (req, res) {
	
	var obj;
	fs.readFile('data-500.json', 'utf8', function (err, data) {
		if (err) throw err;
		obj = JSON.parse(data);
		
		var q = async.queue(function (item, callback) {
			callback(item);
		}, 1000);
		
		var str="output\n";
		
		var count = 0;
		var bigcount = 0;
		
		var task = function(item) {
			var msg = JSON.stringify(item);
			serviceBusService.sendQueueMessage(req.params.queue, msg, function (err) {
				count++;
				if (err) {
					console.log('Failed Tx: ', err);
					str+='\nFailed Tx: '+err;
				} else {
					// console.log('Sent ' + msg);
					str+='\nSent: '+msg;
				}
				console.log(count);
				if(count >= obj.length && bigcount < 10){
					q.push(obj, task);
					count = 0;
					bigcount++;
				}
				
				if(count >= obj.length){
					console.log('finished '+bigcount);
				}
			});
		};
		
		q.push(obj, task);
		
		res.send("request sent :)");
		
		
	});
	
});

app.get('/', function (req, res) {
	res.send('Hello World!')
});


app.get('/getmessages/:queueName/', function (req, res) {
	
	checkForMessages(serviceBusService, req.params.queueName, function(err, response){
		console.log(response);
		res.send(response);
	});
});


app.listen(3000, function () {
	console.log('Example app listening on port 3000!')
});