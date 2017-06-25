"use strict";

var Stripe = require('stripe');
var _ = require('lodash');

const REQUIRED = [
  'firstname',
  'lastname',
  'address1',
  'city',
  'state',
  'zip',
  'amount',
  'email',
  'stripeToken'
]

var attributeErrors = function(attributes) {
  return _.compact(_.map(_.pairs(attributes), function(keyValuePair) {
    var attr = keyValuePair[0];
    var value = keyValuePair[1];

    if(!_.contains(REQUIRED, attr)) { return; }

    if(!value || !value.length) {
      return attr + " can't be blank";
    } else {
      return null;
    }
  }));
};

module.exports = function(req, res) {

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
    'monthly',
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

  customerAttributes.metadata = {
    donation: true
  };

  var secrets = require('./secrets')();

  var stripe = Stripe(secrets.stripeSecretKey);
  var isMonthly = (attributes.monthly == "true");

  return stripe.customers.create(customerAttributes)
    .then(function(customer) {
      if(isMonthly) {
        return stripe.subscriptions.create({
          plan: "monthly-donation",
          customer: customer.id,
          quantity: parseInt(attributes.amount) / 100,
          metadata: {
            donation: true
          }
        });
      } else {
        return stripe.charges.create({
          amount: attributes.amount,
          currency: 'usd',
          customer: customer.id,
          description: attributes.firstname + " " + attributes.lastname,
          metadata: {
            donation: true
          }
        });
      }
    })
    .then(function(charge) {
      res.redirect(secrets.successRedirect);

      return charge;
    })
    .catch(function(error) {
      res.status(400).text(error.message);
    });
};
