require('./test_helper');

var signup = require('../signup');
var stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
var expect = require('expect.js');
var _ = require('lodash');
var util = require('../util');

describe("signup", function() {
    this.timeout(30000);

    beforeEach(function() {
        this.ctx = {
            secrets: {
                stripeSecretKey: process.env['STRIPE_SECRET_KEY']
            },
            body:  {}
        };

        this.req = {};
        this.res = {
            redirected: false,
            status: function(code) {
                this.lastStatus = code;
                return this;
            },
            text: function(text) {
                this.lastText = text;
                return this;
            },
            redirect: function(url) {
                this.redirected = true;
                this.lastRedirect = url;
            }
        };
    });

    describe("on success", function() {
        beforeEach(function(done) {
            this.ranAt = (new Date()).valueOf();

            this.ctx.body.firstname = "Rosa";
            this.ctx.body.lastname = "Luxemburg " + this.ranAt.toString();
            this.ctx.body.address1 = "123 Main St";
            this.ctx.body.address2 = "Apt 7";
            this.ctx.body.city = "Seattle";
            this.ctx.body.state = "WA";
            this.ctx.body.zip = "98102";
            this.ctx.body.phone = "867-5309";
            this.ctx.body.amount = "7700";
            this.ctx.body.email = "rosa.l@fake.email";

            this.ctx.secrets.successRedirect = "https://seattledsa.org";

            var _ctx = this.ctx;

            util.createStripeToken().then(function(stripeToken) {
                _ctx.body.stripeToken = stripeToken.id;

                done();
            });
        });

        it("creates a stripe customer", function(done) {
            var _ranAt = this.ranAt;

            signup(this.ctx, this.req, this.res)
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

                    done();
                })
                .catch(done);
        });

        it("creates a stripe charge", function(done) {
            var _ranAt = this.ranAt;

            signup(this.ctx, this.req, this.res)
                .then(function() {
                    return stripe.charges.list();
                })
                .then(function(charges) {
                    var newCharge = _.find(_.filter(charges.data, { amount: 7700 }), function(charge) {
                        return charge.created >= _ranAt / 1000;
                    });

                    expect(newCharge).to.be.ok();

                    done();
                })
                .catch(done);
        });

        it("redirects to configured url", function(done) {
            var _res = this.res;
            signup(this.ctx, this.req, _res)
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

            this.ctx.body.firstname = "Rosa";
            this.ctx.body.lastname = "Luxemburg " + this.ranAt.toString();
            this.ctx.body.address1 = "123 Main St";
            this.ctx.body.address2 = "Apt 7";
            this.ctx.body.city = "Seattle";
            this.ctx.body.state = "WA";
            this.ctx.body.zip = "98102";
            this.ctx.body.phone = "867-5309";
            this.ctx.body.amount = "7700";

            this.ctx.secrets.successRedirect = "https://seattledsa.org";

            // Missing stripeToken and email
        });

        it("returns a 400 with error messages", function() {
            signup(this.ctx, this.req, this.res);
            expect(this.res.lastStatus).to.eql(400);
            expect(this.res.lastText).to.match(/stripeToken can't be blank/);
            expect(this.res.lastText).to.match(/email can't be blank/);
        });
    });
});
