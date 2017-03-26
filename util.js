var stripe = require("stripe");

exports.createStripeToken = function() {
    return stripe(process.env.STRIPE_SECRET_KEY).tokens.create({
        card: {
            "number": '4242424242424242',
            "exp_month": 12,
            "exp_year": 2018,
            "cvc": '123'
        }
    });
};
