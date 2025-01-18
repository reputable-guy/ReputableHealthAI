import axios from 'axios';

async function checkRagStats() {
  try {
    console.log('Checking RAG statistics...');
    const response = await axios.get('http://localhost:5000/api/rag/stats', {
      headers: {
        'Accept': 'application/json'
      }
    });
    console.log('\n=== Current RAG Statistics ===');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error fetching RAG stats:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

checkRagStats();