var request = require("request");
var Promise = require("bluebird");
var _ = require("lodash");

var doRequest = function(requestOptions) {
    return new Promise(function(resolve, reject) {
        var req = request(requestOptions, function(err, _res, body) {
            if(err) {
                reject(err);
            } else {
                resolve(body);
            }
        });
    });
};

var Slack = function (apiKey) {
    this.apiKey = apiKey;
};

Slack.prototype._requestOptions = function(endpoint, data) {
    var options = {
        url: "https://api.slack.com" + endpoint,
        method: 'POST',
        form: _.defaults({ token: this.apiKey, as_user: true }, data)
    };

    return options;
};

Slack.prototype.post = function(to, message) {
    var postData = {
        channel: to,
        text: message
    };

    var requestOptions = this._requestOptions("/api/chat.postMessage", postData);

    return doRequest(requestOptions);
};

Slack.prototype.upload = function(to, initialComment, contents) {
    var postData = {
        channels: to,
        initial_comment: initialComment,
        content: contents,
        filename: "signups.csv"
    };

    var requestOptions = this._requestOptions("/api/files.upload", postData);

    return doRequest(requestOptions);
};

module.exports = Slack;
