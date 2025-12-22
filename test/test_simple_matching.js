// Test semplice delle funzioni di matching
console.log('=== TEST SEMPLICE MATCHING ===');

// Funzioni di utilità copiate dal servizio
function calculateNameSimilarity(name1, name2) {
  if (!name1 || !name2) return 0;

  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 1.0;

  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[str2.length][str1.length];
}

function hasCommonKeywords(name1, name2) {
  if (!name1 || !name2) return false;

  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const n1 = normalize(name1);
  const n2 = normalize(name2);

  const keywords = [
    'viana', 'moretti', 'peroni', 'heineken', 'corona', 'guinness',
    'budweiser', 'pilsner', 'ipa', 'lager', 'stout', 'weizen'
  ];

  const commonKeywords = keywords.filter(keyword =>
    n1.includes(keyword) && n2.includes(keyword)
  );

  if (commonKeywords.length > 0) {
    console.log('Parole chiave comuni trovate:', commonKeywords);
    return true;
  }

  const parts1 = n1.split(/\s+/).filter(p => p.length > 3);
  const parts2 = n2.split(/\s+/).filter(p => p.length > 3);

  const commonParts = parts1.filter(part =>
    parts2.some(p2 => calculateNameSimilarity(part, p2) > 0.8)
  );

  return commonParts.length >= 2;
}

// Dati di test basati sui birrifici reali nel database
const mockBreweries = [
  { breweryName: 'Birrificio Viana S.r.l.' },
  { breweryName: 'Birrificio Indipendente Viana' },
  { breweryName: 'Heineken' },
  { breweryName: 'Peroni' }
];

const searchName = 'Birrificio Indipendente Viana';
console.log('Nome cercato:', searchName);
console.log('Birrifici nel database mock:', mockBreweries.length);

console.log('\n=== ANALISI FUZZY MATCHING ===');

const fuzzyMatches = mockBreweries
  .map(b => ({
    ...b,
    similarity: calculateNameSimilarity(searchName, b.breweryName),
    keywordMatch: hasCommonKeywords(searchName, b.breweryName)
  }))
  .filter(b => b.similarity > 0.6 || b.keywordMatch)
  .sort((a, b) => b.similarity - a.similarity);

console.log('Risultati fuzzy matching:');
fuzzyMatches.forEach((match, i) => {
  console.log(`${i+1}. ${match.breweryName} (similarity: ${match.similarity.toFixed(2)}, keywords: ${match.keywordMatch})`);
});

// Logica di decisione ambiguità (aggiornata con multiple keyword matches)
const bestMatch = fuzzyMatches[0];
const hasHighConfidence = bestMatch.similarity > 0.85;
const hasKeywordMatch = bestMatch.keywordMatch;
const hasMultipleSimilar = fuzzyMatches.filter(b => b.similarity > 0.7).length > 1;
const hasMultipleKeywordMatches = fuzzyMatches.filter(b => b.keywordMatch).length > 1;

console.log('\n=== LOGICA DECISIONALE (AGGIORNATA) ===');
console.log('Best match:', bestMatch.breweryName);
console.log('High confidence:', hasHighConfidence);
console.log('Keyword match:', hasKeywordMatch);
console.log('Multiple similar:', hasMultipleSimilar);
console.log('Multiple keyword matches:', hasMultipleKeywordMatches);

if (hasMultipleSimilar || (fuzzyMatches.length > 1 && fuzzyMatches[1].similarity > 0.6) || hasMultipleKeywordMatches) {
  console.log('\n✅ RISULTATO: Ambiguità rilevata - necessita disambiguazione');
  if (hasMultipleKeywordMatches) {
    console.log('Motivo: Multiple corrispondenze con parole chiave comuni');
  } else {
    console.log('Motivo: Multiple corrispondenze simili trovate');
  }
} else if (bestMatch.similarity > 0.7 || bestMatch.keywordMatch) {
  console.log('\n✅ RISULTATO: Match singolo ambiguo - necessita conferma');
  console.log('Motivo: Match con confidenza media o keyword match');
} else {
  console.log('\n❌ RISULTATO: Nessuna corrispondenza - creare nuovo birrificio');
}

console.log('\n=== DETTAGLI AMBIGUITÀ ===');
console.log('Totale matches:', fuzzyMatches.length);
console.log('Matches con similarity > 0.7:', fuzzyMatches.filter(b => b.similarity > 0.7).length);
console.log('Secondo match similarity:', fuzzyMatches[1]?.similarity || 'N/A');
