var dotenv = require('dotenv').load();
var db      = require('./mongo');
const ccxt = require ('ccxt')
const spyConfig = require('../spy-config');
const moment = require('moment');

var mongoose     = require('mongoose');
var watchingPairsModel      = require('mongoose').model('watchingPairs');


 
import * as admin from "firebase-admin";
var serviceAccount = require("../trading-dashboard-bot-firebase-adminsdk-3ydu7-bd57693f2b.json");

var app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://trading-dashboard-bot.firebaseio.com"
});
var firestore = admin.firestore(app);



db.connect(() => {
	runSpider();
});

var exchanges = [];
var runFetchTicker = ['yobit'];
let watchingPairs = [];
let symbols = [];


function runSpider() {

	// watchingPairs
	exchanges = spyConfig.exchanges.map(exchange=>{
		return new ccxt[exchange]();
	});

	Promise.all(exchanges.map(exchange=>{
		return exchange.loadMarkets();
	})).then(result=>{
		getWatchingPairs();
		setInterval(()=>{
			getWatchingPairs();
		}, 1000 * 60 * 60);

		calcMatrix();
		setInterval(()=>{
			calcMatrix();
		}, 1000 * 60 * 3)

		cleanDB();
		setInterval(()=>{
			cleanDB();
		}, 1000 * 60 * 60 * 24)
	});
}

function cleanDB() {
	//Delete watching paris
	watchingPairs.map(pair=>{

	    var SymbolModel = (mongoose.models && mongoose.models[pair.symbol]
						  ? mongoose.models[pair.symbol]
						  : mongoose.model(pair.symbol, new mongoose.Schema({}, { strict: false })))

	    SymbolModel.remove({timestamp: {$lt: moment().subtract(2, 'weeks').unix() } }).exec().then(()=>{

	    });

	});

	//Delete Ticker 
	exchanges.map((exchange, index)=>{
	  	var ExchangeModel = (mongoose.models && mongoose.models[exchange.id]
		  ? mongoose.models[exchange.id]
		  : mongoose.model(exchange.id, new mongoose.Schema({}, { strict: false })))

	    ExchangeModel.remove({timestamp: {$lt: moment().subtract(2, 'weeks').unix() } }).exec().then(()=>{

	    });
	})
}

function getWatchingPairs() {

	symbols = [];
	exchanges.map(ex=>{
		let markets = Object.keys(ex.markets);
		let exMarkets = [];
		markets.map(m=>{
			if (symbols.indexOf(m) == -1) {
				symbols.push(m);
				exMarkets.push(m);
			}
		});
	});

	watchingPairs = [];
	symbols.map(symbol=>{
		let exs = [];
		exchanges.map(ex=>{

			let markets = Object.keys(ex.markets);
			if (markets.indexOf(symbol) != -1) {
				exs.push(ex.id);
			}
		});
		if (exs.length >= 2) {
			watchingPairs.push({symbol: symbol, exchanges: exs});
		}
	});

	symbols = watchingPairs.map(w=>w.symbol);

	watchingPairsModel.remove({}).exec().then(()=>{
		watchingPairsModel.collection.insert(watchingPairs, function(){
			console.log(`Saved ${watchingPairs.length} Pairs`);
		})
	});
}


function calcMatrix(){
	let timestamp = moment().unix();
	Promise.all(exchanges.map((exchange,index)=>{
		let sys = Object.keys(exchange.markets).filter(m=>symbols.indexOf(m)!=-1);
		if (exchange.has['fetchTickers'] ) {

			if (exchange.id == 'yobit') {
				let promises = [];
				for (let i = 0; i < sys.length; i += 100)
					promises.push(exchange.fetchTickers(sys.splice(i, Math.min(100, sys.length - i * 100))));

				return Promise.all(promises).then(res=>res.reduce((r1,r2)=>r1.concat(r2), []));
			}
			else {
				return exchange.fetchTickers();
			}
		} else {
			return Promise.all(sys.map(m=>exchange.fetchTicker(m)));
		}
	})).then(tickers => {

		//Save Ticker 
		exchanges.map((exchange, index)=>{
		  	var ExchangeModel = (mongoose.models && mongoose.models[exchange.id]
			  ? mongoose.models[exchange.id]
			  : mongoose.model(exchange.id, new mongoose.Schema({}, { strict: false })))

		    ExchangeModel.collection.insert(Object.keys(tickers[index]).map(k=>tickers[index][k]));
		})
			  
		//Calulate Arbitrage
		watchingPairs.map(pair=>{
			let values = {};
			pair.exchanges.map(e=>{
				let index = spyConfig.exchanges.indexOf(e);
				if (index != -1) {
					values[spyConfig.exchanges[index]] = tickers[index][pair.symbol];
				}

			});

			let curExs = Object.keys(values);
			let targetObj = {};
			curExs.map(ex1=>{
				targetObj[ex1] = {};
				curExs.map(ex2=>{
					
					if (values[ex1] && values[ex2]) {
						targetObj[ex1][ex2] = {
							arbit: (values[ex2].bid - values[ex1].ask)/values[ex1].ask * 100,
							volume1: values[ex1].quoteVolume,
							volume2: values[ex2].quoteVolume,
						}
						

					} else {
						targetObj[ex1][ex2] = 0;
					}
					

					if (targetObj[ex1][ex2] > 5) {
						/***push notification ***/
						firestore.collection('notification').add({
							createdAt: moment().unix().format('YYYY-MM-DD HH:mm:ss'), 
							message: `Arbit on ${ex1} ${ex2} is ${targetObj[ex1][ex2]} at ${moment().unix().format('YYYY-MM-DD HH:mm:ss')}`, 
							type: 'HIGH_ARBIT', 
							timestamp: moment().unix()});
						/***push notification ***/
					}
				})
			});
	    	var SymbolModel = (mongoose.models && mongoose.models[pair.symbol]
						  ? mongoose.models[pair.symbol]
						  : mongoose.model(pair.symbol, new mongoose.Schema({}, { strict: false })))
		    new SymbolModel({symbol:pair.symbol, matrix: targetObj, timestamp:timestamp}).save();

		});	

		console.log(`Saved targetObj Pairs`);
	});

}
