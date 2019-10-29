const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();
const superagent = require('superagent');
const { parse } = require('url');

// the main handler
exports.handler = async (event) => {
  console.log(JSON.stringify(event));

  if (event == undefined || !event.hasOwnProperty('body')) {
    console.error('Malformed event');
    return { statusCode: 200 };
  }

  // retreiving the secret from secrets manager
  const secretData = await secretsManager.getSecretValue({SecretId: process.env.SECRET}).promise();
  const secretString = JSON.parse(secretData.SecretString);

  /*
  "token=y9JDN4wpJQEy72az28clPHgZ&team_id=TPZ8RC2FQ&team_domain=flejz-playground&channel_id=DPWK0NHD2&channel_name=directmessage&user_id=UPKJ5830T&user_name=jaimelopesflores&command=%2Fhey&text=ho&response_url=https%3A%2F%2Fhooks.slack.com%2Fcommands%2FTPZ8RC2FQ%2F801789999939%2FvL9qG9f9jiQzBkkXTXppWTxs&trigger_id=812796215268.815297410534.93e42dcf487804f27b0087dc576b65ca"
  [
    'token=y9JDN4wpJQEy72az28clPHgZ',
    'team_id=TPZ8RC2FQ',
    'team_domain=flejz-playground',
    'channel_id=DPWK0NHD2',
    'channel_name=directmessage',
    'user_id=UPKJ5830T',
    'user_name=jaimelopesflores',
    'command=/hey',
    'text=ho',
    'response_url=https://hooks.slack.com/commands/TPZ8RC2FQ/801789999939/vL9qG9f9jiQzBkkXTXppWTxs',
    'trigger_id=812796215268.815297410534.93e42dcf487804f27b0087dc576b65ca',
  ]
  */

  // format the key values
  const keyValues = event.body.split('&').map(item => item.split('='))
  const find = (compare) => keyValues.find(([key]) => key === compare)[1]
  console.log(JSON.stringify(keyValues));

  // fetch weather information
  const city = find('text')
  console.log(`city ${city}`);
  const { body } = await superagent
    .get('https://api.openweathermap.org/data/2.5/weather')
    .query({
      q: city,
      units: 'metric',
      appid: secretString.Weather_Appid
    });
  console.log(`data ${JSON.stringify(body)}`);

  let text = `${body.name} is ${body.main.temp} °C with wind speed of ${body.wind.speed} and ${body.clouds.all}% chance of raining`
  console.log(`text ${text}`);

  // get the response_url key-value from the body request
  const url = find('response_url')
  console.log(`url ${url}`);
  return await postToSlack(decodeURIComponent(url), text);
};

const postToSlack = async (url, text) => {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const { hostname, path } = parse(url);
    const data = { text };

    const options = {
      hostname,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    };

    const req = https.request(options, (res) => {
      console.log(`statusCode: ${res.statusCode}`);
      res.on('data', (d) => { process.stdout.write(d) });
      resolve({statusCode: 200});
    });

    req.on('error', (e) => {
      console.error('Error: ', e);
      reject({statusCode: 200});
    });

    req.write(JSON.stringify(data));
    req.end();
  });
};
