var testHelper = require('./test_helper');
var stripe = testHelper.stripe;

var signup = require('../signup').signup;
var expect = require('expect.js');
var _ = require('lodash');
var util = require('../util');
var Promise = require('bluebird');

describe("signup", function() {
    this.timeout(30000);

    beforeEach(function() {
        this.req = {
            body: {},
            webtaskContext: {
                secrets: {
                    stripeSecretKey: process.env['STRIPE_SECRET_KEY'],
                    successRedirect: "https://seattledsa.org"
                }
            }
        };

        this.res = {
            redirected: false,
            status: function(code) {
                this.lastStatus = code;
                return this;
            },
            send: function(text) {
                this.lastText = text;
                return this;
            },
            redirect: function(url) {
                this.redirected = true;
                this.lastRedirect = url;
            }
        };
    });

    // TODO use replay or something similar so we don't have to do this
    after(testHelper.cleanupStripe.bind(testHelper));

    describe("on success", function() {
        beforeEach(function(done) {
            this.ranAt = (new Date()).valueOf();

            this.req.body.firstname = "Rosa";
            this.req.body.lastname = "Luxemburg " + this.ranAt.toString();
            this.req.body.address1 = "123 Main St";
            this.req.body.address2 = "Apt 7";
            this.req.body.city = "Seattle";
            this.req.body.state = "WA";
            this.req.body.zip = "98102";
            this.req.body.phone = "867-5309";
            this.req.body.amount = "7700";
            this.req.body.email = "rosa.l@fake.email";

            var _req = this.req;

            util.createStripeToken().then(function(stripeToken) {
                _req.body.stripeToken = stripeToken.id;

                done();
            });
        });

        it("creates a stripe customer", function(done) {
            var _ranAt = this.ranAt;

            signup(this.req, this.res)
                .then(function() {
                    return stripe.customers.list();
                })
                .then(function(customers) {
                    var name = "Rosa Luxemburg " + _ranAt;

                    var newCustomer = _.find(customers.data, { description: name });

                    expect(newCustomer).to.be.ok();
                    expect(newCustomer.description).to.be(name);
                    expect(newCustomer.shipping).to.be.ok();
                    expect(newCustomer.shipping.address).to.be.ok();
                    expect(newCustomer.shipping.address.line1).to.be("123 Main St");
                    expect(newCustomer.shipping.address.line2).to.be("Apt 7");
                    expect(newCustomer.shipping.address.city).to.be("Seattle");
                    expect(newCustomer.shipping.address.state).to.be("WA");
                    expect(newCustomer.shipping.address.postal_code).to.be("98102");
                    expect(newCustomer.shipping.phone).to.be("867-5309");
                    expect(newCustomer.sources.data).to.be.ok();
                    expect(newCustomer.sources.data.length).to.be(1);
                    expect(newCustomer.sources.data[0].object).to.be("card");
                    expect(newCustomer.metadata.nationalSignup).to.be("true");

                    done();
                })
                .catch(done);
        });

        it("creates a stripe charge", function(done) {
            var _ranAt = this.ranAt;

            signup(this.req, this.res)
                .then(function() {
                    return stripe.charges.list();
                })
                .then(function(charges) {
                    var newCharge = _.find(_.filter(charges.data, { amount: 7700 }), function(charge) {
                        return charge.created >= _ranAt / 1000;
                    });

                    expect(newCharge).to.be.ok();
                    expect(newCharge.metadata.nationalSignup).to.be("true");

                    done();
                })
                .catch(done);
        });

        it("redirects to configured url", function(done) {
            var _res = this.res;
            signup(this.req, _res)
                .then(function() {
                    expect(_res.redirected).to.eql(true);
                    expect(_res.lastRedirect).to.be("https://seattledsa.org");
                    done();
                })
                .catch(done);
        });
    });

    describe("with missing parameters", function() {
        // These tests don't need to be asynchronous since a promise doesn't get
        // returned if validation fails
        beforeEach(function() {
            this.ranAt = (new Date()).valueOf();

            this.req.body.firstname = "Rosa";
            this.req.body.lastname = "Luxemburg " + this.ranAt.toString();
            this.req.body.address1 = "123 Main St";
            this.req.body.address2 = "Apt 7";
            this.req.body.city = "Seattle";
            this.req.body.state = "WA";
            this.req.body.zip = "98102";
            this.req.body.phone = "867-5309";
            this.req.body.amount = "7700";

            // Missing stripeToken and email
        });

        it("returns a 400 with error messages", function() {
            signup(this.req, this.res);
            expect(this.res.lastStatus).to.eql(400);
            expect(this.res.lastText).to.match(/stripeToken can't be blank/);
            expect(this.res.lastText).to.match(/email can't be blank/);
        });
    });

    describe("with an amount < 1900", function() {
        beforeEach(function() {
            this.ranAt = (new Date()).valueOf();

            this.req.body.firstname = "Rosa";
            this.req.body.lastname = "Luxemburg " + this.ranAt.toString();
            this.req.body.address1 = "123 Main St";
            this.req.body.address2 = "Apt 7";
            this.req.body.city = "Seattle";
            this.req.body.state = "WA";
            this.req.body.zip = "98102";
            this.req.body.phone = "867-5309";
            this.req.body.amount = "600";
        });

        it("returns a 400 with an error message", function() {
            signup(this.req, this.res);
            expect(this.res.lastStatus).to.eql(400);
            expect(this.res.lastText).to.match(/amount must be >= \$19/);
        });
    });
});
