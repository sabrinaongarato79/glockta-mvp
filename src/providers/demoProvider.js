const jobs = [
  {
    id: 'demo-1',
    title: 'Asistente de Marketing Digital',
    company: 'Empresa Demo',
    location: 'Buenos Aires / Híbrido',
    description: 'Buscamos una persona con comunicación, redes sociales, Canva, atención al cliente e inglés. Se valora Google Analytics y CRM.',
    skills: ['comunicación', 'redes sociales', 'canva', 'atención al cliente', 'inglés', 'google analytics', 'crm'],
    url: '#',
    source: 'Glockta Demo'
  },
  {
    id: 'demo-2',
    title: 'Administrativo/a de Atención al Cliente',
    company: 'Servicios Demo',
    location: 'Remoto',
    description: 'Atención al cliente, organización, facturación, herramientas digitales y portugués deseable.',
    skills: ['atención al cliente', 'organización', 'facturación', 'herramientas digitales', 'portugués'],
    url: '#',
    source: 'Glockta Demo'
  },
  {
    id: 'demo-3',
    title: 'Junior Web Content Assistant',
    company: 'Tech Demo',
    location: 'Buenos Aires',
    description: 'HTML, CSS, comunicación, inglés y manejo básico de contenidos web.',
    skills: ['html', 'css', 'comunicación', 'inglés', 'contenidos web'],
    url: '#',
    source: 'Glockta Demo'
  }
];

async function searchJobs({ keywords = '', location = '' }) {
  const q = `${keywords} ${location}`.toLowerCase().trim();
  if (!q) return jobs;
  const filtered = jobs.filter(j => `${j.title} ${j.company} ${j.location} ${j.description}`.toLowerCase().includes(keywords.toLowerCase()));
  return filtered.length ? filtered : jobs;
}

module.exports = { searchJobs };
