async function searchJobs({ keywords = '', location = '' }) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = process.env.ADZUNA_COUNTRY || 'gb';
  if (!appId || !appKey) throw new Error('ADZUNA_CREDENTIALS_NOT_CONFIGURED');

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: '20',
    what: keywords,
    where: location,
    content_type: 'application/json'
  });
  const response = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`);
  if (!response.ok) throw new Error(`ADZUNA_HTTP_${response.status}`);
  const data = await response.json();
  return (data.results || []).map(job => ({
    id: `adzuna-${job.id}`,
    title: job.title,
    company: job.company?.display_name || 'Empresa no informada',
    location: job.location?.display_name || location,
    description: job.description || '',
    skills: [],
    salary: job.salary_min ? `${job.salary_min}${job.salary_max ? ` - ${job.salary_max}` : ''}` : null,
    url: job.redirect_url || '#',
    source: 'Adzuna'
  }));
}
module.exports = { searchJobs };
