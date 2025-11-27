const express = require('express');
const axios = require('axios');
const app = express();
const jobs = new Map();
require('dotenv').config();
const port = process.env.PORT || 3000;
let jobId = 1;
let isQueueFree = true;

app.use(express.json());

async function request(job) {
  try {
    const response = await axios.post(
      `http://10.0.1.8/pp4/${job.url}`,
      {job: job.data}
    );

    console.log(response.data);
  } catch (err) {
    console.error(err.message);
  }
}

const queue = async () => {
  if (isQueueFree) {
    for (let job of jobs.values()) {
      if (job.status === 'pending') {
        isQueueFree = false;
        job.status = 'working';
        //console.log('isQueueFree: ', isQueueFree);

        await request(job);

        isQueueFree = true;
        job.status = 'done';
        //console.log('isQueueFree: ', isQueueFree);
      }
    }
  }
}

const getTime = () => {
  const now = new Date();

  const options = {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };

  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(now);

  const year   = parts.find(p => p.type === 'year').value;
  const month  = parts.find(p => p.type === 'month').value;
  const day    = parts.find(p => p.type === 'day').value;
  const hour   = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  const second = parts.find(p => p.type === 'second').value;

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

app.get('/api/jobs', (request, response) => {
  response.json({jobs: [...jobs]});
});

app.get('/api/jobs/:id', (request, response) => {
  const id = parseInt(request.params.id);

  response.json({job: jobs.get(id)});
});

app.post('/api/jobs', (request, response) => {
  try {
    const job = {
      id: jobId++,
      at: getTime(),
      status: 'pending',
      app: request.body.job.app,
      url: request.body.job.url,
      data: request.body.job.data
    };

    jobs.set(job.id, job);

    queue();

    console.log('New job:', job);
    response.json({success: true, job: job});
  } catch (error) {
    response.status(500).json({success: false});
  }
});

app.listen(port, () => {
  console.log('Listening...');
});
