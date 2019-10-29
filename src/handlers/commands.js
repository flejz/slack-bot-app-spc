/*
    Licensed under MIT-0
    This function processes events from Slack (received through API Gateway) and echoes them back to Slack.
*/
const AWS = require('aws-sdk');
const { parse } = require('url');

// The main handler
exports.handler = async (event) => {
    console.log(JSON.stringify(event));

    if (event == undefined || !event.hasOwnProperty('body')) {
        console.error('Malformed event');
        return { statusCode: 200 };
    }

    const keyValues = event.body.split('&').map(item => item.split('='))
    console.log(JSON.stringify(keyValues));

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
        res.on('data', (d) => {
            process.stdout.write(d);
        });

        resolve({statusCode: 200});
    });

    // If error
    req.on('error', (e) => {
        console.error('Error: ', e);
        reject({statusCode: 200});
    });

    // Send the request
    req.write(JSON.stringify(data));
    req.end();
  });
};

const verifySignature = async (slackTimestamp,slackBody,slackSignature,signingSecret) => {
  return new Promise((resolve,reject) => {
    const crypto = require('crypto');

    // Verifying if the timestamp is within 5 minutes from the current time
    const currentTime = Math.floor(new Date().getTime()/1000);
    if (Math.abs(currentTime - slackTimestamp) > 300) {
        console.error('The request is older than 5 minutes');
        resolve(false);
    } else {
        // Calculating and verifying the signature with headers in the Slack request
        const sigBasestring = `v0:${slackTimestamp}:${slackBody}`;
        const calculatedSignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring,'utf8').digest('hex');
        if (calculatedSignature === slackSignature) {
            resolve(true);
        } else {
            console.error('Signature does not match');
            resolve(false);
        }
    }

  });
};
