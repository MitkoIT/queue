const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const app = express();
const jobs = new Map();
require('dotenv').config();
const port = process.env.PORT || 3000;
let jobId = 1;
let isQueueFree = true;

app.use(express.json());

class Api {
  constructor() {
    const API_TOKEN = process.env.MITKO_API_TOKEN;
    const API_KEY   = process.env.MITKO_API_KEY;

    const payload = {
      token: API_TOKEN,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    this.token = jwt.sign(payload, API_KEY, { algorithm: 'HS256' });
  }

  async call(app, route, method, content, fireAndForget) {
    try {
      //route = `api${route}`;
      const response = await axios.post(
        `http://10.0.0.33/mitko_api/gate`,
        {app, route, method, content, fireAndForget},
        {headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'X-App-Origin': process.env.APP_NAME ?? 'queue'
        }}
      );

      console.log(response.data);
      return response.data;
    } catch (err) {
      console.error(err.message);
    }
  }
}

const api = new Api();

/*(async () => {
  const gates = await api.call('mitko_api', '/gates', 'GET');
  console.log('gates');
  console.log(gates);
})();*/

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

        const response = await api.call(
          'pat_panel_producentow',
          `/${job.url}`,
          'POST',
          job.data
        );

        isQueueFree = true;
        job.status = 'done';
        job.response = response;
        console.log(job);
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
  const page = request.query.page;
  const elementsPerPage = 10;

  if (jobs.size === 0) {
    return response.json({jobs: []});
  }

  if (page) {
    const slicedJobs = Array.from(jobs).slice(
      (page - 1) * elementsPerPage,
      page * elementsPerPage
    );
    return response.json({jobs: slicedJobs});
  } else {
    return response.json({jobs: [...jobs]});
  }
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
      app: request.body.app,
      url: request.body.url,
      data: request.body.data
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
