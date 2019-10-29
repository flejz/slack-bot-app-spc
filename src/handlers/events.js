const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

// the main handler
exports.handler = async (event) => {
  console.log(JSON.stringify(event));

  if (event == undefined || !event.hasOwnProperty('body')) {
    console.error('Malformed event');
    return { statusCode: 200 };
  }

  const eventBody = JSON.parse(event.body);

  // retreiving the secret from secrets manager
  const secretData = await secretsManager.getSecretValue({SecretId: process.env.SECRET}).promise();
  const secretString = JSON.parse(secretData.SecretString);

  // verifying the signature to confirm that the message was sent by slack
  // reference: https://api.slack.com/docs/verifying-requests-from-slack
  const signatureVerified = await verifySignature (event.headers['X-Slack-Request-Timestamp'],
    event.body,
    event.headers['X-Slack-Signature'],
    secretString.Signing_Secret);

  if (!signatureVerified) {
    console.error('Signature verification failed. Exiting.');
    return {statusCode: 200};
  } else
    console.log('Signature verification succeeded.');

  // challenge verification. if 'challenge' is present in the request, return the challenge value
  if (eventBody.hasOwnProperty('challenge')) {
    console.log('Challenge present in the request. Returning the challenge string back to Slack. Exiting.');
    return { statusCode: 200, body: eventBody.challenge };
  }

  // in direct message conversations with bots, slack sends bot's messages back to the events
  // endpoint. if the subtype of the event is 'bot_message', the function will ignore it.
  if (eventBody.event.subtype == 'bot_message') {
    console.log("subtype = bot_message. Exiting.");
    return { statusCode: 200 };
  }

  console.log(`user ${eventBody.event.user} sent in channel ${eventBody.event.channel}, message ${eventBody.event.text}, of type ${eventBody.event.type} and subtype ${eventBody.event.subtype}`);
  return await postToSlack(secretString.Bot_Token, eventBody.event.channel, `You said: ${eventBody.event.text}`);
};

const postToSlack = async (token, channel, text) => {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const data = { token, channel, text };

    const options = {
      hostname: 'slack.com',
      port: 443,
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`
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
