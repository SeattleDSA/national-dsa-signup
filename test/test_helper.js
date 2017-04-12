var _ = require('lodash');
var util = require('../util');

require('dotenv').config();

module.exports = {
    stripe: require('stripe')(process.env.STRIPE_SECRET_KEY),
    cleanupStripe: function(done) {
        var stripe = this.stripe;

        stripe.customers.list()
            .then(function(customers) {
                return Promise.all(
                    _.filter(customers.data, { email: "rosa.l@fake.email" }).map(function(customer) {
                        return stripe.customers.del(customer.id);
                    })
                );
            })
            .then(function() { done(); })
            .catch(done);
    },
    createSignup: function() {
        var signup = require("../signup").signup;

        var ranAt = (new Date()).valueOf();

        var req = {
            body: {
                firstname: "Rosa",
                lastname: "Luxemburg " + ranAt.toString(),
                address1: "123 Main St",
                address2: "Apt 7",
                city: "Seattle",
                state: "WA",
                zip: "98102",
                phone: "867-5309",
                amount: "7700",
                email: "rosa.l@fake.email"
            },
            webtaskContext: {
                secrets: {
                    stripeSecretKey: process.env['STRIPE_SECRET_KEY'],
                    successRedirect: "https://seattledsa.org"
                }
            }
        };

        var res = {
            status: function() {},
            send: function() {},
            redirect: function() {}
        };

        return util.createStripeToken().then(function(stripeToken) {
            req.body.stripeToken = stripeToken.id;

            return signup(req, res);
        });
    },
}
