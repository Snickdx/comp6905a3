(function(){
	
	const os = require('os');
	const hostName = os.hostname();
	var express = require('express');
	var request = require('request');
	var moment = require('moment');
	var fs = require('fs');
	var async = require("async");
	var azure = require('azure-sb');
	var azureStorage = require('azure-storage');
	var path = require('path');
	var firebase = require('firebase');
	
	var connectionString ="Endpoint=sb://workqueue.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=lsDykEMJdiJj8PyrcLhcWwOa4ZiXR0zJjOlmE2lam7k=";
	var tableStorageKey ="33MfV7gjfiTBwArgm36pHRi7tik8BUbmUUE1MIEN5sWUgahPLIm5WImfPrcB2aJfdCrJW6h4N+Mlha8oXkcxbg==";
	var storageAccount ="defaultstorage806003586";
	var tableService = azureStorage.createTableService(storageAccount,tableStorageKey);
	
	var app = express();
	
	var msgReceived = 0;
	var batchNo = 0;
	var msgQueueId =0;
	var serviceBusService = azure.createServiceBusService(connectionString);
	var qName = 'q1';
	var working = true;
	var successSend = 0;
	var sentCount =0;
	var errorCount =0;
	var startTime;
	var stopTime;
	var elapsed;
	var jsonData;
	var port  	 = process.env.PORT || 80; 				// set the port
	var bodyParser = require('body-parser'); 	// pull information from HTML POST (express4)
	var methodOverride = require('method-override'); // simulate DELETE and PUT (express4)
	
	
	app.use(express.static(__dirname + '/public')); 				// set the static files location /public/img will be /img for users
	app.use(bodyParser.urlencoded({'extended':'true'})); 			// parse application/x-www-form-urlencoded
	app.use(bodyParser.json()); 									// parse application/json
	app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
	app.use(methodOverride());
	
	app.use(function(req, res, next) {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		next();
	});
	
	
	var saveToTable = function(eType,data){
		var entGen = azureStorage.TableUtilities.entityGenerator;
		var date  = (new Date).toISOString();
		//console.log(entGen.String(date));	
		var entity = {
			PartitionKey: entGen.String(hostName) ,
			RowKey: entGen.String(date),
			ErrorType: entGen.String(eType.toString()),
			Json:entGen.String(JSON.stringify(data))
		};
		
		var count = 0;
		
		var trySave = function(data){
			tableService.insertEntity('Messages', entity, function(error, result, response) {
				if (!error) {
					// result contains the ETag for the new entity
					//console.log(result);
				}
				else{
					count++;
					console.log("Table-Storage-error-Retry "+count+" of 10");
					console.log(error);
					if(count < 10){
						trySave(data);
					}
				}
			});
		};
		
		trySave(data);
		//console.log("END CALL 1");
		//trySave(data);
	};
	
	var doWork = function(batchSize,batchNo){
		var i;
		//node does this async
		for(i=0; i < batchSize; i++){
			
			(function(msgId,batchId){
				serviceBusService.receiveQueueMessage(qName, { isPeekLock: true }, function(error, lockedMessage){
					if(!error){
						// Message received and locked
						//console.log(lockedMessage);
						//Check if valid
						//If falid process
						//If not valid store failure in azure table. 
						
						if(msgId % 300 == 0){
							//a simulated failure
							saveToTable("Message-Failure",lockedMessage);
						}
						
						//Delete message from queue
						serviceBusService.deleteMessage(lockedMessage, function (deleteError){
							
							if(msgId % 500 == 0){
								//a simulated failure
								saveToTable("Delete-Failure",lockedMessage);
							}
							
							if(!deleteError){
								// Message deleted
								//msgReceived++;
								//console.log("+batch "+batchId+" msg "+msgId);
							}
							else{
								//console.log("delete error batch "+batchId+" msg "+msgId);
								//msgReceived++;
							}
						});
					}
					else{
						//If failed, the message will still be on the queue and some
						//other consumer will get it
						
						//console.log("-batch "+batchId+" msg "+msgId);
						//msgReceived++;
					}
					
					msgReceived++;
				});
			})(msgQueueId,batchNo);
			msgQueueId++;
		}
	};
	
	var runBatch = function(length){
		//console.log("queued "+msgQueueId +" received " +msgReceived);
		
		if(length > 0){
			var diff = msgQueueId - msgReceived ;
			var max = 1000 - diff;
			
			batchNo++;
			if(length < max){
				doWork(length,batchNo);
			}
			else{
				doWork(max,batchNo);
			}
			//res.send('started batch '+batchNo + "queued "+msgQueueId +" received " +msgReceived);
			console.log('started batch '+batchNo + "queued "+msgQueueId +" received " +msgReceived +" length " + length);
		}
		else{
			//res.send('load '+ (msgQueueId - msgReceived));
			console.log('load '+ (msgQueueId - msgReceived) +" length " + length);
		}
	};
	
	var start = function(){
		var diff = msgQueueId - msgReceived ;
		if(diff <= 200){
			var serviceBusService = azure.createServiceBusService(connectionString);
			
			serviceBusService.getQueue(qName, function(err, queue){
				if (err) {
					console.log('Error on get queue length: ', err);
				} else {
					// length of queue (active messages ready to read)
					var length = queue.CountDetails['d2p1:ActiveMessageCount'];
					console.log(length + ' messages currently in the queue');
					runBatch(length);
					//return length;
				}
			});
		}
		
	};
	
	var send500 = function(queue){
		fs.readFile('data-500.json', 'utf8', function (err, data) {
			if (err) throw err;
			var obj = JSON.parse(data);
			var count = 0;
			var empty= false;
			var start;
			
			var q = async.queue(function (item, callback) {
				callback(item);
				count++;
				
				// elapsed = moment.utc(moment(new Date(),"DD/MM/YYYY HH:mm:ss").diff(moment(startTime,"DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss");
			}, 1000);
			
			q.drain = function(){
				empty = true;
			};
			
			var task = function(item) {
				// console.log('sent'+JSON.stringify(item));
				serviceBusService.sendQueueMessage(queue, JSON.stringify(item), function (err) {
					if (err) {
						errorCount++;
						console.log('Failed Tx: ', err);
					} else {
						// console.log('Sent item'+successSend+": "+ JSON.stringify(item));
						successSend++;
						if(errorCount + successSend == 490){
							var now = moment();
							var elapsed = moment.utc(moment(now,"DD/MM/YYYY HH:mm:ss").diff(moment(start,"DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss");
							console.log('Sent 500! in '+elapsed);
						}
					}
				});
			};
			
			console.log('running tasks');
			start = moment();
			q.push(obj, task);
		});
	};
	
	var senderLoop = function () {
		if(working === true) {
			var diff = sentCount - successSend;
			var limit = 500;
			if (diff < limit) {
				senderN(qName, limit - diff);
			}
		}
	};
	
	var senderN = function(sendQueueName, n){
		var serviceBusService = azure.createServiceBusService(connectionString);
		var message;
		
		for(var i=0;i < n;i++) {
			
			var error = successSend%10 === 2;//1 in 10 error rate
			if(error){
				//noinspection JSAnnotator
				message = `{
				"Transaction Date": "2014-06-03T17:07:28+00:00",
					"Sale Price": 11768,
					"ProductName": "Error",
					"SellerID": "C3",
					"UserID": "E5",
					"TransactionID": 463
				}`;
				console.log('error = '+ error);
			}else{
				jsonData[i].TransactionID = successSend;
				message = JSON.stringify(jsonData[i]);
			}
			
			serviceBusService.sendQueueMessage(sendQueueName, message, function (err) {
				if (err) {
					//increment error count
					errorCount++;
					console.log(err);
				} else {
					//increment count for success
					successSend++;
					elapsed = moment.utc(moment(new Date(),"DD/MM/YYYY HH:mm:ss").diff(moment(startTime,"DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss");
					console.log("Success Count "+ successSend+" Time: "+elapsed);
				}
				//increment a count for received
			});
			sentCount++;
		}
	};
	
	app.get('/', function(req, res) {
		res.sendFile(path.join(__dirname, 'public', 'index.html'));
	});
	
	app.get('/blast/:queue', function (req, res) {
		send500(req.params.queue);
		res.send('blasted queue!');
	});
	
	app.get('/count', function (req, res) {
		var diff = sentCount - successSend;
		var message = "Send Count "+sentCount +" Success Send "+ successSend +" Diff "+diff + " Error Count "+errorCount;
		if(!working){
			var elapsed = moment.utc(moment(new Date(),"DD/MM/YYYY HH:mm:ss").diff(moment(startTime,"DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss");
			message = message + "<br/>Time Elapsed" + elapsed;
		}
		else message = message + "<br> working " + working;
		elapsed = moment.utc(moment(new Date(),"DD/MM/YYYY HH:mm:ss").diff(moment(startTime,"DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss");
		message += message + "<br/>Time Elapsed" + elapsed;
		res.send(message);
	});
	
	app.get('/start', function (req, res) {
		res.header('Access-Control-Allow-Origin', req.headers.origin || "*");
		res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,HEAD,DELETE,OPTIONS');
		res.header('Access-Control-Allow-Headers', 'content-Type,x-requested-with');
		working = true;
		startTime = new Date();
		res.send("Working "+working);
	});
	
	app.get('/getCount', function (req, res) {
		res.send(JSON.stringify(
			{
				count: sentCount+errorCount,
				time: elapsed = moment.utc(moment(new Date(),"DD/MM/YYYY HH:mm:ss").diff(moment(startTime,"DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss")
			}
		));
	});
	
	app.get('/stop', function (req, res) {
		working = false;
		stopTime = new Date();
		console.log('stopped');
		res.send("Working "+working);
	});
	
	app.get('/getSBLength', function(req, res){
		serviceBusService.getQueue(qName, function(err, queue){
			if (err) {
				console.log('Error on get queue length: ', err);
				res.send(JSON.stringify(-1));
			} else {
				// length of queue (active messages ready to read)
				var length = queue.CountDetails['d2p1:ActiveMessageCount'];
				res.send(JSON.stringify(length));
			}
		});
	});
	
	
	app.listen(port, function () {
		console.log(hostName+' Example app listening on port '+port);
		working = false;
		request('https://raw.githubusercontent.com/Snickdx/comp6905a3/master/data/data-500.json', function (error, response, body) {
			if (!error && response.statusCode == 200) {
				jsonData = JSON.parse(body);
				console.log('Json data loaded');
				setInterval(senderLoop,3000);
			}
		});
		
	})
})();
