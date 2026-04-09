import fetch from 'node-fetch';

const GRAPHQL_ENDPOINT = 'https://search-api.artlist.io/v1/graphql';

async function findMaxPages(searchTerm, maxPagesToTest = 20) {
  console.log(`🔍 Finding max pages for "${searchTerm}" (testing up to page ${maxPagesToTest})...\n`);

  const allIds = new Set();
  let lastPageWithResults = 0;

  for (let page = 1; page <= maxPagesToTest; page++) {
    const payload = {
      query: `
        query ClipList($searchTerms: [String]) {
          clipList(searchTerms: $searchTerms, page: ${page}) {
            exactResults { id clipName }
            totalExact
          }
        }
      `,
      variables: { searchTerms: [searchTerm] }
    };

    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      const clips = data?.data?.clipList?.exactResults || [];

      if (clips.length === 0) {
        console.log(`  Page ${page}: 0 risultati → STOP`);
        break;
      }

      // Count new unique IDs
      clips.forEach(c => allIds.add(c.id));

      const isDuplicate = clips.some(c => {
        // Check if first ID already seen
        return Array.from(allIds).filter(id => id !== c.id).length < allIds.size;
      });

      console.log(`  Page ${page}: ${clips.length} clip (totalUnique so far: ${allIds.size})`);
      lastPageWithResults = page;

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.log(`  Page ${page}: errore ${e.message}`);
      break;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ "${searchTerm}" → ${allIds.size} clip uniche su ${lastPageWithResults} pagine`);
  console.log('═'.repeat(60));

  return allIds.size;
}

// Test multiple terms with different popularity
(async () => {
  for (const term of ["spider", "nature", "city", "people"]) {
    await findMaxPages(term, 10);
    console.log();
    await new Promise(r => setTimeout(r, 1000));
  }
})();
