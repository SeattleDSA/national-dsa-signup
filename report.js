var Stripe = require("stripe");
var _ = require("lodash");
var Promise = require("bluebird");
var moment = require("moment");
var Slack = require("./lib/slack");
var csvStringify = require("csv-stringify");

var fetchPageOfCharges = function(stripe, startTime, endTime, startAfter) {
    var opts = {
        created: { gte: startTime, lt: endTime }
    };

    if(startAfter) {
        opts.starting_after = startAfter;
    }

    return stripe.charges.list(opts);
};

var fetchAllCharges = function(stripe, startTime, endTime) {
    var chargesByCustomerId = {};
    var startAfter = null;

    var customerPromises = [];

    return new Promise(function(resolve, reject) {

        function doFetch() {
            return fetchPageOfCharges(stripe, startTime, endTime, startAfter)
                .then(function(response) {
                    response.data.forEach(function(charge) {
                        if(charge.metadata.nationalSignup == "true") {
                            chargesByCustomerId[charge.customer] = charge;
                            customerPromises.push(fetchCustomer(stripe, charge.customer));
                        }
                    });

                    if(response.has_more) {
                        startAfter = _.last(response.data).id;

                        doFetch();
                    } else {
                        resolve({
                            charges: chargesByCustomerId,
                            customerPromises: customerPromises
                        });
                    }
                })
                .catch(reject);
        }

        doFetch();
    });
};

var fetchCustomer = function(stripe, customerId) {
    return stripe.customers.retrieve(customerId);
};

var sendReport = function(slackApiKey, to, signups) {
    var slack = new Slack(slackApiKey);

    if(signups && signups.length) {
        var signupCsv = csvStringify(signups.map(function(signup) {
            var name = signup.customer.first_name + " " + signup.customer.last_name;
            var amount = signup.charge.amount / 100;
            var createdAt = moment(signup.charge.created_at * 1000).format("M/D/YYYY h:mm a");

            [name, amount, createdAt];
        }));

        return slack.upload(to, "National signups, yesterday at midnight through now", signupCsv);
    } else {
        return slack.post(to, "There were no new national signups :-(");
    }
};

module.exports = function(ctx, cb) {
    var stripe = Stripe(ctx.secrets.stripeSecretKey);

    var startTime = moment().subtract(1, "day").hours(0).minutes(0).seconds(0).unix();
    var endTime = moment().unix();

    // for charge pagination
    var startAfter = null;

    var chargesByCustomerId = {};

    return fetchAllCharges(stripe, startTime, endTime)
        .then(function(info) {
            chargesByCustomerId = info.charges;

            return Promise.all(info.customerPromises).then(function(responses) {
                return _.compact(responses.map(function(customer) {
                    if(customer.deleted) {
                        return null;
                    } else {
                        return { customer: customer, charge: chargesByCustomerId[customer.id] };
                    }
                }));
            })
                .then(function(signups) { return sendReport(ctx.secrets.slackApiKey, ctx.secrets.sendTo, signups); })
                .then(function(resp) { cb(null, resp) })
                .catch(cb);
        });
};
