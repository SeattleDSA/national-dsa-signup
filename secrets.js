var genEnvSecrets = function() {
  return {
    successRedirect: process.env.SUCCESS_REDIRECT,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY
  }
};

module.exports = function() {
  return genEnvSecrets();
};
