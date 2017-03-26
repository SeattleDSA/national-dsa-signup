require('dotenv').config();
var util = require('../util');

util.createStripeToken().then(function(token) {
    console.log(token.id);
});
