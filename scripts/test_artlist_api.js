import fetch from 'node-fetch';

const GRAPHQL_ENDPOINT = 'https://search-api.artlist.io/v1/graphql';

async function discoverSchema() {
  console.log('🔍 Discovering Artlist GraphQL Schema...\n');

  // Fixed query based on error messages
  const payload = {
    query: `
      query ClipList($searchTerms: [String]) {
        clipList(searchTerms: $searchTerms, page: 1) {
          exactResults {
            id
            clipName
            clipPath
            duration
            width
            height
            thumbnailUrl
          }
          totalExact
        }
      }
    `,
    variables: {
      searchTerms: ["spider"]
    }
  };

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://artlist.io',
        'Referer': 'https://artlist.io/'
      },
      body: JSON.stringify(payload)
    });

    console.log(`📥 Response status: ${response.status}`);
    const data = await response.json();
    
    if (data?.data?.clipList) {
      const clipList = data.data.clipList;
      console.log(`\n✅ Success!`);
      console.log(`   Total clips: ${clipList.totalExact}`);
      console.log(`   Results on page: ${clipList.exactResults?.length || 0}`);
      
      if (clipList.exactResults?.length > 0) {
        console.log(`\n   First clip:`);
        console.log(JSON.stringify(clipList.exactResults[0], null, 2));
        console.log(`\n   Sample clipPath: ${clipList.exactResults[0].clipPath}`);
      }
    } else if (data?.errors) {
      console.log(`\n❌ Errors:`);
      data.errors.forEach(e => console.log(`   - ${e.message}`));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

discoverSchema();
