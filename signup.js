"use strict";

var Stripe = require('stripe');
var _ = require('lodash');


var Express = require('express');

if(process.env.NODE_ENV != 'test') {
    var Webtask = require('webtask-tools');
}

var app = Express();
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded())

var attributeErrors = function(attributes) {
    return _.compact(_.map(_.pairs(attributes), function(keyValuePair) {
        var attr = keyValuePair[0];
        var value = keyValuePair[1];

        if(!value || !value.length) {
            return attr + " can't be blank";
        } else if((attr == "amount") && parseInt(value) < 5000) {
            return "amount must be >= $50"
        } else {
            return null;
        }
    }));
};

var signup = function(req, res) {
    var ctx = req.webtaskContext;

    var attributes = {};

    [
        'firstname',
        'lastname',
        'address1',
        'address2',
        'city',
        'state',
        'zip',
        'phone',
        'amount',
        'email',
        'stripeToken'
    ].forEach(function(attribute) {
        attributes[attribute] = req.body[attribute];
    });

    var errorMessages = attributeErrors(attributes);

    if(errorMessages.length) {
        res.status(400).send(errorMessages.join("\n"));

        return;
    }

    var customerAttributes = {};

    var name = attributes.firstname + " " + attributes.lastname;

    customerAttributes.description = name;
    customerAttributes.email = attributes.email;
    customerAttributes.source = attributes.stripeToken;
    customerAttributes.shipping = {
        name: name,
        address: {
            line1: attributes.address1,
            line2: attributes.address2,
            city: attributes.city,
            state: attributes.state,
            postal_code: attributes.zip
        },
        phone: attributes.phone
    };

    var stripe = Stripe(ctx.secrets.stripeSecretKey);

    return stripe.customers.create(customerAttributes)
        .then(function(customer) {
            return stripe.charges.create({
                amount: attributes.amount,
                currency: 'usd',
                customer: customer.id,
                description: attributes.firstname + " " + attributes.lastname
            });
        })
        .then(function(charge) {
            res.redirect(ctx.secrets.successRedirect);

            return charge;
        })
        .catch(function(error) {
            console.log(error);
            res.status(400).text(error.message);
        });
};

app.post('/', signup);

if(process.env.NODE_ENV != 'test') {
    module.exports = Webtask.fromExpress(app);
}

module.exports.signup = signup;
