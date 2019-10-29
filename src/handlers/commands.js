const { parse } = require('url');

// the main handler
exports.handler = async (event) => {
  console.log(JSON.stringify(event));

  if (event == undefined || !event.hasOwnProperty('body')) {
    console.error('Malformed event');
    return { statusCode: 200 };
  }

  // format the key values
  const keyValues = event.body.split('&').map(item => item.split('='))
  console.log(JSON.stringify(keyValues));

  // get the response_url key-value from the body request
  const [key, url] = keyValues.find(([key]) => key === 'response_url')
  console.log(`url ${url}`);
  return await postToSlack(decodeURIComponent(url), `Hey-Ho, let's go!`);
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
