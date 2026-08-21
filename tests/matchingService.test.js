const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateMatch } = require('../src/services/matchingService');

test('calculateMatch: sin requisitos detectables devuelve score null y explica por qué', () => {
  const result = calculateMatch(
    { skills: ['ventas'], languages: ['español'] },
    { title: 'Puesto sin descripción útil', description: '' }
  );
  assert.equal(result.score, null);
  assert.deepEqual(result.matched, []);
  assert.match(result.explanation, /no expone suficientes requisitos/);
});

test('calculateMatch: coincidencia total da 100% y sin brechas', () => {
  const result = calculateMatch(
    { skills: ['excel', 'ventas'], languages: ['inglés'] },
    { title: 'Vacante', description: 'Buscamos experiencia en excel, ventas e inglés' }
  );
  assert.equal(result.score, 100);
  assert.equal(result.gaps.length, 0);
  assert.ok(result.matched.includes('excel'));
});

test('calculateMatch: coincidencia parcial calcula el porcentaje y detecta brechas', () => {
  const result = calculateMatch(
    { skills: ['excel'], languages: ['español'] },
    { title: 'Vacante', description: 'Requiere excel, inglés y sql' }
  );
  // 1 de 3 requisitos detectados (excel) => 33%
  assert.equal(result.score, 33);
  assert.ok(result.matched.includes('excel'));
  assert.ok(result.gaps.includes('inglés'));
  assert.ok(result.gaps.includes('sql'));
});

test('calculateMatch: usa job.skills explícitos en vez del diccionario cuando están presentes', () => {
  const result = calculateMatch(
    { skills: ['react', 'node'], languages: [] },
    { title: 'Dev', description: 'irrelevante', skills: ['React', 'Node', 'AWS'] }
  );
  assert.equal(result.matched.length, 2);
  assert.deepEqual(result.gaps, ['aws']);
});

test('calculateMatch: la comparación de habilidades no distingue mayúsculas/minúsculas ni espacios', () => {
  const result = calculateMatch(
    { skills: ['  Excel  '], languages: [] },
    { title: 'Vacante', description: 'Se requiere excel' }
  );
  assert.equal(result.score, 100);
});

test('calculateMatch: nunca decide automáticamente (sólo informa coincidencias y brechas)', () => {
  const result = calculateMatch(
    { skills: [], languages: [] },
    { title: 'Vacante', description: 'Se requiere excel y sql' }
  );
  assert.equal(result.score, 0);
  assert.match(result.explanation, /no toma decisiones automáticas de contratación/);
});
