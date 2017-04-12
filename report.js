var Stripe = require("stripe");
var _ = require("lodash");
var Promise = require("bluebird");
var moment = require("moment");
var Slack = require("./lib/slack");
var csvStringify = require("csv-stringify");

var fetchPageOfCharges = function(stripe, startTime, endTime, startAfter) {
    var opts = {
        created: { gte: startTime, lte: endTime },
        expand: ["data.customer"]
    };

    if(startAfter) {
        opts.starting_after = startAfter;
    }

    return stripe.charges.list(opts);
};

var fetchAllCharges = function(stripe, startTime, endTime) {
    var allCharges = [];
    var startAfter = null;

    return new Promise(function(resolve, reject) {

        function doFetch() {
            return fetchPageOfCharges(stripe, startTime, endTime, startAfter)
                .then(function(response) {
                    response.data.forEach(function(charge) {
                        if(charge.metadata.nationalSignup == "true") {
                            allCharges.push(charge);
                        }
                    });

                    if(response.has_more) {
                        startAfter = _.last(response.data).id;

                        doFetch();
                    } else {
                        resolve(allCharges);
                    }
                })
                .catch(reject);
        }

        doFetch();
    });
};

var sendReport = function(slackApiKey, to, signups) {
    var slack = new Slack(slackApiKey);

    if(signups && signups.length) {
        var headers = ["Name",
                       "Address 1",
                       "Address 2",
                       "City",
                       "State",
                       "Zip",
                       "Full Amount",
                       "Half Amount",
                       "Signed up at"];

        var csvData = [headers].concat(signups.map(function(signup) {
            var name = signup.customer.shipping.name;
            var address = signup.customer.shipping.address;

            var fullAmount = signup.amount / 100;
            var halfAmount = fullAmount / 2;
            var createdAt = moment(signup.created * 1000).format("M/D/YYYY h:mm a");

            return [name,
                    address.line1,
                    address.line2,
                    address.city,
                    address.state,
                    address.postal_code,
                    fullAmount,
                    halfAmount,
                    createdAt];
        }));

        return new Promise(function(resolve, reject) {
            csvStringify(csvData, function(err, signupCsv) {
                if(err) {
                    reject(err);
                } else {
                    slack.upload(to, "New National DSA signups", signupCsv)
                        .then(function(resp) {
                            resolve(resp);
                        }).catch(function(err) {
                            reject(err);
                        });
                }
            });
        });
    } else {
        to.split(",").forEach(function(handle) {
            return slack.post(handle, "There were no new National DSA signups :-(");
        });
    }
};

module.exports = function(ctx, cb) {
    var stripe = Stripe(ctx.secrets.stripeSecretKey);

    if(ctx.secrets.startTime) {
        var startTime = moment(ctx.secrets.startTime);
    } else {
        var startTime = moment().subtract(1, "day").hours(0).minutes(0).seconds(0).unix();
    }
    var endTime = moment().unix();

    // for charge pagination
    var startAfter = null;

    var chargesByCustomerId = {};

    return fetchAllCharges(stripe, startTime, endTime)
        .then(function(charges) {
            return _.reject(charges, function(charge) {
                return charge.customer.deleted;
            });
        })
        .then(function(signups) { return sendReport(ctx.secrets.slackApiKey, ctx.secrets.sendTo, signups); })
        .then(function(resp) { return cb(null, resp); })
        .catch(cb);
};
