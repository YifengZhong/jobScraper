'use strict';
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

function getNewJob(yesterdayJobs, result) {
  const yesterdayJobsUrl = yesterdayJobs.map(job => job.url);
  return result.filter(job => !yesterdayJobsUrl.includes(job.url));
}

exports.entry = async (event, context) => {
  const puppeteerLambda = require('puppeteer-lambda');
  const browser = await puppeteerLambda.getBrowser({
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://careers.google.com/jobs/results/?company=Google&company=Google%20Fiber&company=YouTube&employment_type=FULL_TIME&location=United%20States&q=Software%20Engineer,%20Software%20Developer&skills=javascript',
      { waitUntil: 'networkidle0' });

    let todayJb = [];
    while (true) {
      console.log("---start---");
      const obj = await page.evaluate(() => {
        //From here there is no log output
        const searchResult = document.querySelector('#search-results');
        const sections = searchResult.getElementsByClassName('gc-card');
        const jb1 = Array.from(sections).map(x => {
          const url = x.href;
          const title = x.innerText;
          return { title, url };
        });
        let hasNextInternal = true;
        const nextHref = document.querySelector('#jump-content > div.gc-l-split > main > div.gc-p-results.gc-h-flex > div:nth-child(3) > div > div > div > a:nth-child(2)');
        if (nextHref && nextHref.style.display !== 'none') {
          nextHref.click();
        } else {
          hasNextInternal = false;
        }
        return { jb1, hasNextInternal };
        //untill here no log output
      });
      todayJb = [...todayJb, ...obj.jb1];
      console.log('hasNextInternal', obj.hasNextInternal, obj.jb1);
      if (obj.hasNextInternal) {
        await page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' });
      } else {
        break;
      }
    }

    console.log('before dynamo');
    const dynamo = new AWS.DynamoDB.DocumentClient()
    const allRecords = await dynamo.scan({
      TableName: 'scrapperjobs',
      Key: {
        listingId: 'Google'
      }
    }).promise();
    let newJob = todayJb;
    if (allRecords.Items[0]) {
      const yesterdayJobs = allRecords.Items[0].jobs;
      newJob = getNewJob(yesterdayJobs, todayJb);
      // Delete old jobs
      // const jobsToDelete = allRecords.Items[0] ? allRecords.Items[0].listingId : null;
      // if (jobsToDelete) {
      await dynamo.delete({
        TableName: 'scrapperjobs',
        Key: {
          listingId: 'Google'
        }
      }).promise();
      // }
    }
    //Save new jobs
    if (todayJb) {
      await dynamo.put({
        TableName: 'scrapperjobs',
        Item: {
          listingId: 'Google',
          jobs: todayJb
        }
      }).promise();
    }
    //if (newJob.length !== 0) {
    //send SMS here
    const receiver = "+15153055694";
    const sender = "aws";
    const normalizedJobs = newJob.map((job, index) => {
      return `${index}. title:${job.title}.\nURL: ${job.url}.`;
    })

    const message = `Today has ${todayJb.length} positions. new jobs are:\n\n${normalizedJobs.join('\n\n')}`;
    console.log("Sending message", message, "to receiver", receiver);
    await sns.publish({
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Promotional'
        },
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: sender
        },
      },
      PhoneNumber: receiver
    }).promise();
    return successRespond(200, newJob);
  } catch (error) {
    console.log(error);
    return errorResponse(500, error);
  } finally {
    await browser.close();
  }
}