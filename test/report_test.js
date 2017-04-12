var testHelper = require('./test_helper');

var stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
var report = require('../report');
var expect = require('expect.js');
var _ = require('lodash');
var util = require('../util');
var Promise = require('bluebird');

describe("report", function() {
    this.timeout(30000);

    beforeEach(function() {
        this.ctx = {
            secrets: {
                stripeSecretKey: process.env.STRIPE_SECRET_KEY,
                slackApiKey: process.env.SLACK_API_KEY,
                sendTo: "@" + process.env.MY_SLACK_HANDLE
            }
        };
    });

    describe("with signups", function() {
        beforeEach(function(done) {
            testHelper.createSignup()
                .then(function() { done(); })
                .catch(done);
        });

        afterEach(testHelper.cleanupStripe.bind(testHelper));

        it("generates a signup report and slacks it", function(done) {
            report(this.ctx, function(err, resp) {
                if(resp) {
                    var parsed = JSON.parse(resp);

                    expect(parsed.ok).to.be(true);
                    expect(parsed.file).to.be.ok();
                }

                done(err);
            });
        });
    });

    describe("with no signups", function() {
        it("sends a message", function(done) {
            report(this.ctx, function(err, resp) {
                if(resp) {
                    var parsed = JSON.parse(resp);
                    expect(parsed.ok).to.be(true);
                    expect(parsed.message.type).to.be("message");
                    expect(parsed.message.text).to.be("There were no new National DSA signups :-(");
                }

                done(err);
            });
        });
    });
});
