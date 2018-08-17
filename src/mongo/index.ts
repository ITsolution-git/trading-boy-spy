'use strict';

var mongoose   = require('mongoose');
var Promise    = require('bluebird');
var requireDir = require('require-dir');

mongoose.Promise = Promise;
mongoose.models = {};

requireDir('./models');

var connection = mongoose.connection;
var cbConnection = null;

connection.on('error', err => {
    console.info('Database connection error', err);
});

connection.on('connected', () => {
    console.info('Connected to database: ' + process.env.MONGO_CONNNECTION);

    if (cbConnection) {
        cbConnection();
    }
});

connection.on('disconnected', () => {
    console.info('Disconnected from database');
});

exports.connection = connection;

exports.connect = function(cb) {
    var open = Promise.promisify(connection.openUri, { context: connection });
    cbConnection = cb;
    return open(process.env.MONGO_CONNNECTION);
};

exports.disconnect = function() {
    var close = Promise.promisify(connection.close, { context: connection });
    return close();
};
