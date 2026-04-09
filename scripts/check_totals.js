import fetch from 'node-fetch';

const GRAPHQL_ENDPOINT = 'https://search-api.artlist.io/v1/graphql';

async function checkTotal(searchTerms) {
  console.log('🔍 Checking total results for various terms...\n');

  for (const term of searchTerms) {
    const payload = {
      query: `
        query ClipList($searchTerms: [String]) {
          clipList(searchTerms: $searchTerms, page: 1) {
            exactResults { id }
            totalExact
          }
        }
      `,
      variables: { searchTerms: [term] }
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
      const total = data?.data?.clipList?.totalExact || 0;
      const pages = Math.ceil(total / 50);

      console.log(`  "${term}" → ${total} clips → ${pages} pagine`);
    } catch (e) {
      console.log(`  "${term}" → errore: ${e.message}`);
    }
  }
}

checkTotal([
  "nature",
  "city",
  "people",
  "food",
  "business",
  "technology",
  "travel",
  "sports",
  "music",
  "love",
  "family",
  "water",
  "animal",
  "space",
  "abstract"
]);
