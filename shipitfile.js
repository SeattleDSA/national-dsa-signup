require('dotenv').config();

module.exports = function (shipit) {
  require('shipit-deploy')(shipit);

  // TODO this only works if our cmds don't have quotes in them
  var runAsDeployUser = function(cmd) {
    sudoCmd = "sudo -E -u " + process.env.APP_USER + " \"" + cmd + "\"";

    return shipit.remote(sudoCmd);
  };

  var current = process.env.DEPLOY_TO + "/current";

  shipit.initConfig({
    default: {
      workspace: '/tmp/national-dsa-signup-deploy',
      deployTo: process.env.DEPLOY_TO,
      repositoryUrl: 'https://github.com/seattledsa/national-dsa-signup.git',
      branch: "self_hosted",
      ignores: ['.git', 'node_modules'],
      rsync: ['--del'],
      keepReleases: 2,
      key: process.env['SSH_KEY'],
      shallowClone: true
    },
    production: {
      servers: process.env['PRODUCTION_SERVER']
    }
  });

  shipit.on("deployed", function() {
    shipit.start("fix-permissions");
    shipit.start("npm-install");
    shipit.start("restart-server");
  });

  shipit.task("fix-permissions", function() {
    shipit.remote("chown -R " + process.env.APP_USER + " " + process.env.DEPLOY_TO);
  });

  shipit.task("npm-install", function() {
    runAsDeployUser("cd " + current + " && npm install");
  });

  shipit.task("restart-server", function() {
    runAsDeployUser("cd " + current + " && node_modules/pm2/bin/pm2 restart app.js");
  });
};
