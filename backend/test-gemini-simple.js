require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const modelName = 'gemini-2.0-flash';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

console.log('Testing Gemini API...');
console.log('Model:', modelName);
console.log('URL:', url.replace(apiKey, '[API_KEY]'));

const requestBody = {
  contents: [
    {
      parts: [
        {
          text: "Extract JSON with vendor_name, amount, category, confidence. Example: {\"vendor_name\":\"Test\",\"amount\":100,\"category\":\"Food\",\"confidence\":1.0}"
        }
      ]
    }
  ],
  generationConfig: {
    temperature: 0.1
  }
};

console.log('\nRequest body:', JSON.stringify(requestBody, null, 2));

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody)
})
.then(async response => {
  console.log('\nResponse status:', response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Error response:', errorText);
    try {
      const errorData = JSON.parse(errorText);
      console.error('❌ Parsed error:', JSON.stringify(errorData, null, 2));
    } catch {}
  } else {
    const data = await response.json();
    console.log('✅ Success! Response data:', JSON.stringify(data, null, 2));
  }
})
.catch(error => {
  console.error('❌ Fetch error:', error);
});
