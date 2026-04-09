import fetch from 'node-fetch';

const GRAPHQL_ENDPOINT = 'https://search-api.artlist.io/v1/graphql';

async function testPagination() {
  const searchTerm = "spider";

  console.log('🔍 Testing pagination for "spider"...\n');

  const results = {};

  // Test pages 1, 2, 3
  for (const page of [1, 2, 3]) {
    const payload = {
      query: `
        query ClipList($searchTerms: [String]) {
          clipList(searchTerms: $searchTerms, page: ${page}) {
            exactResults {
              id
              clipName
            }
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
      const clipList = data?.data?.clipList;
      const clips = clipList?.exactResults || [];
      const total = clipList?.totalExact || 0;

      // Get first 3 IDs
      const firstIds = clips.slice(0, 3).map(c => c.id);

      console.log(`  Page ${page}: totalExact=${total}, results=${clips.length}`);
      console.log(`    First 3 IDs: ${firstIds.join(', ')}`);

      results[page] = { ids: firstIds, count: clips.length, total };

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.log(`  Page ${page}: errore ${e.message}`);
    }
  }

  // Check if pages return different results
  console.log('\n' + '═'.repeat(60));

  const page1Ids = results[1]?.ids || [];
  const page2Ids = results[2]?.ids || [];

  if (page1Ids.length > 0 && page2Ids.length > 0) {
    if (page1Ids[0] === page2Ids[0]) {
      console.log('⚠️  Page 1 e Page 2 hanno gli STESSI ID → API bloccata');
      console.log('   Serve autenticazione per paginazione reale');
    } else {
      console.log('✅ Page 1 e Page 2 hanno ID DIVERSI → Paginazione funziona!');
      console.log(`   Pagine disponibili: ${Math.ceil(results[1].total / 50)}`);
      console.log(`   Risultati totali: ${results[1].total}`);
    }
  }
}

testPagination();
