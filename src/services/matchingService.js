const canonical = value => String(value || '').trim().toLowerCase();
const unique = arr => [...new Set(arr.map(canonical).filter(Boolean))];

function extractRequirements(job) {
  if (Array.isArray(job.skills) && job.skills.length) return unique(job.skills);
  const text = canonical(`${job.title || ''} ${job.description || ''}`);
  const dictionary = [
    'inglés','portugués','español','excel','sql','power bi','javascript','html','css',
    'canva','crm','google analytics','ventas','atención al cliente','comunicación',
    'organización','facturación','redes sociales','marketing','scrum','liderazgo',
    'primeros auxilios','cuidado de adultos mayores','administración','contenidos web'
  ];
  return dictionary.filter(skill => text.includes(skill));
}

function calculateMatch(profile, job) {
  const profileSkills = unique([...(profile.skills || []), ...(profile.languages || [])]);
  const required = extractRequirements(job);
  if (!required.length) {
    return { score: null, matched: [], gaps: [], explanation: 'La vacante no expone suficientes requisitos estructurados para calcular un porcentaje confiable.' };
  }
  const matched = required.filter(req => profileSkills.some(skill => skill.includes(req) || req.includes(skill)));
  const gaps = required.filter(req => !matched.includes(req));
  const score = Math.round((matched.length / required.length) * 100);
  return {
    score,
    matched,
    gaps,
    explanation: `Coinciden ${matched.length} de ${required.length} requisitos detectados. El cálculo es explicable y no toma decisiones automáticas de contratación.`
  };
}

module.exports = { calculateMatch };
