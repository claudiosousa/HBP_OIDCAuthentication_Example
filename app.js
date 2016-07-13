var fs = require('fs');
var serversProxy = require('./serversProxy.js');

var CONFIG_FILE = './config.json';
var configuration = JSON.parse(fs.readFileSync(CONFIG_FILE));

serversProxy.getExperiments(configuration)
  .then(function (experiments) {
    console.log("experiments: ", JSON.stringify(experiments, null, '\t'));
  })
  .fail(function (err) {
    console.error("Failed to get experiments: ", err);
  });
