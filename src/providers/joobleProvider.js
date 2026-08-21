async function searchJobs({ keywords = '', location = '' }) {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) throw new Error('JOOBLE_API_KEY_NOT_CONFIGURED');

  const response = await fetch(`https://jooble.org/api/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, location })
  });

  if (!response.ok) throw new Error(`JOOBLE_HTTP_${response.status}`);
  const data = await response.json();
  const items = Array.isArray(data.jobs) ? data.jobs : [];

  return items.slice(0, 20).map((job, i) => ({
    id: `jooble-${i}-${job.link || job.title || 'job'}`,
    title: job.title || 'Oportunidad laboral',
    company: job.company || 'Empresa no informada',
    location: job.location || location || 'Ubicación no informada',
    description: job.snippet || '',
    skills: [],
    salary: job.salary || null,
    type: job.type || null,
    updated: job.updated || null,
    url: job.link || '#',
    source: job.source || 'Jooble'
  }));
}

module.exports = { searchJobs };
