var request = require('request');
var q = require('q');

var CREATE_TOKEN_URL = '/token';

var getToken = function (baseUrl, client_id, client_secret) {

  var options = {
    method: 'post',
    form: {
      grant_type: 'client_credentials',
      client_id: client_id,
      client_secret: client_secret
    },
    url: baseUrl+CREATE_TOKEN_URL,
  };

  var deferred = q.defer();

  request(options, function (err, res, body) {
    if (err)
      deferred.reject(new Error(err));
    else {
      try {
        var access_token = JSON.parse(body).access_token
        deferred.resolve(access_token);
      } catch (e) {
        deferred.reject(new Error(body));
      }
    }
  });

  return deferred.promise;
};

module.exports = function (baseUrl) {
  return {
    getToken: function (client_id, client_secret) {
      return getToken(baseUrl, client_id, client_secret);
    }
  };
};