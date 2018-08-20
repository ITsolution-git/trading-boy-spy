'use strict';

var mongoose     = require('mongoose');

var watchingPairsSchema = new mongoose.Schema({

  symbol: {
    type: String,
    index: true
  },
  exchanges: [{
      type: Object
  }],
});


module.exports = mongoose.model('watchingPairs', watchingPairsSchema);
