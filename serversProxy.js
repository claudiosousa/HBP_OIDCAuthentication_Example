var request = require('request');
var q = require('q');
var oidcAuthenticator = require('./oidcAuthenticator.js');

var SERVER_URLS = {
  EXPERIMENT: '/experiment',
  HEALTH: '/health/errors',
  SIMULATION: '/simulation'
};

var SIMULATION_STATES = {
  CREATED: 'created',
  STARTED: 'started',
  PAUSED: 'paused',
  INITIALIZED: 'initialized',
  HALTED: 'halted',
  FAILED: 'failed',
  STOPPED: 'stopped'
};

var RUNNING_SIMULATION_STATES = [
  SIMULATION_STATES.CREATED,
  SIMULATION_STATES.PAUSED,
  SIMULATION_STATES.STARTED,
  SIMULATION_STATES.INITIALIZED,
  SIMULATION_STATES.HALTED
];


var executeServerRequest = function (url, token) {
  var options = {
    method: 'GET',
    url: url,
    headers: { Authorization: 'Bearer ' + token }
  };

  var deferred = q.defer();

  request(options, function (err, res, body) {
    if (err)
      deferred.reject(new Error(err));
    else if (res.statusCode < 200 || res.statusCode >= 300)
      deferred.reject(new Error("Status code: " + res.statusCode + "\n" + body));
    else {
      try {
        var bodyObj = JSON.parse(body);
        deferred.resolve(bodyObj);
      } catch (e) {
        deferred.reject(new Error(body));
      }
    }
  });

  return deferred.promise;
};

var executeRequest4AllServers = function (configuration, token, urlPostFix) {
  var serversResponses = [];
  for (var serverId in configuration.servers) {
    var serverConfig = configuration.servers[serverId];
    (function (serverId) {
      serversResponses.push(executeServerRequest(serverConfig.gzweb['nrp-services'] + urlPostFix, token)
        .then(function (serverResponse) {
          return [serverId, serverResponse];
        }));
    })(serverId);
  }
  return q.all(serversResponses);
};

var convertResponseToDict = function (response) {
  var dict = {};
  response.forEach(function (res) { dict[res[0]] = res[1]; });
  return dict;
};

var mergeData = function (responsesData) {
  var data = {
    experiments: responsesData[0],
    health: convertResponseToDict(responsesData[1]),
    simulations: convertResponseToDict(responsesData[2])
  };


  for (var serverId in data.simulations) {
    var serverSimulations = data.simulations[serverId];
    serverSimulations.runningSimulation = serverSimulations.filter(function (s) { return RUNNING_SIMULATION_STATES.indexOf(s.state) != -1; })[0]
  }

  var mergedData = {};
  data.experiments.forEach(function (expArr) {
    var serverExperiements = expArr[1].data;
    var serverId = expArr[0];
    for (var expId in serverExperiements) {
      var exp = serverExperiements[expId];
      if (!mergedData[expId])
        mergedData[expId] = {
          configuration: exp,
          availableServers: [],
          joinableServers: []
        };
      var responseExp = mergedData[expId];
      var runningSimulation = data.simulations[serverId].runningSimulation;
      if (!runningSimulation) //server is free
        responseExp.availableServers.push(serverId);
      else
        if (runningSimulation.experimentConfiguration === responseExp.configuration.experimentConfiguration) //server is running this experiment
          responseExp.joinableServers.push({
            server: serverId,
            runningSimulation: runningSimulation
          });
    }
  });
  return mergedData;
};

var getExperiments = function (configuration) {
  return oidcAuthenticator(configuration.auth.url)
    .getToken(configuration.auth.clientId, configuration.auth.clientSecret)
    .then(function (token) {
      return q.all([
        executeRequest4AllServers(configuration, token, SERVER_URLS.EXPERIMENT),
        executeRequest4AllServers(configuration, token, SERVER_URLS.HEALTH),
        executeRequest4AllServers(configuration, token, SERVER_URLS.SIMULATION)
      ])
        .then(mergeData);
    });
};

module.exports = {
  getExperiments: getExperiments
};