const demo = require('../providers/demoProvider');
const jooble = require('../providers/joobleProvider');
const adzuna = require('../providers/adzunaProvider');

const providers = { demo, jooble, adzuna };

async function searchJobs(input, requestedProvider) {
  const providerName = requestedProvider || process.env.JOB_PROVIDER || 'demo';
  const provider = providers[providerName];
  if (!provider) throw new Error('UNKNOWN_PROVIDER');
  const jobs = await provider.searchJobs(input);
  return { provider: providerName, jobs };
}

module.exports = { searchJobs };
