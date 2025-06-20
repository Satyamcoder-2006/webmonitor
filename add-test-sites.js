import fetch from 'node-fetch';

async function addTestSites() {
  const baseUrl = 'http://localhost:5000/api/websites';
  const headers = {
    'Content-Type': 'application/json'
  };

  for (let i = 1; i <= 99; i++) {
    const data = {
      url: `https://fusoweb-fuso.azurewebsites.net/?test=${i}`,
      name: `FUSO Web Test ${i}`,
      email: `test${i}@example.com`,
      checkInterval: 1
    };

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        console.log(`Added website ${i}`);
      } else {
        console.error(`Failed to add website ${i}:`, await response.text());
      }
    } catch (error) {
      console.error(`Error adding website ${i}:`, error);
    }
  }
}

addTestSites(); 