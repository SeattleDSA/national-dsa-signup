var Express = require('express');

var app = Express();
var bodyParser = require('body-parser');
var morgan = require('morgan');

app.use(bodyParser.urlencoded())
app.use(morgan('tiny'));

var donate = require('./donate');
var signup = require('./signup');

app.post('/donate', donate);
app.post('/signup', signup);

var port = process.env.PORT || 3000;

app.listen(port, function () {
  console.log('Example app listening on port ' + port.toString() + '!');
});
