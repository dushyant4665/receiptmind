require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('Please set GEMINI_API_KEY in .env');
  process.exit(1);
}

const checkModel = async (modelName) => {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}?key=${apiKey}`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Model available: ${modelName}`);
      console.log(`   Name: ${data.displayName}`);
      console.log(`   Version: ${data.version}`);
      console.log('');
      return true;
    } else {
      const error = await response.json();
      console.log(`❌ Model not available: ${modelName}`);
      console.log(`   Error: ${error.error?.message || 'Unknown error'}`);
      console.log('');
      return false;
    }
  } catch (e) {
    console.error(`❌ Error checking model ${modelName}:`, e.message);
    return false;
  }
};

const testModels = [
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash',
  'gemini-2.5-flash-latest',
  'gemini-2.5-pro-latest',
  'gemini-3.1-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.0-pro',
];

console.log('Checking available Gemini models...\n');

(async () => {
  const available = [];
  for (const model of testModels) {
    const ok = await checkModel(model);
    if (ok) available.push(model);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n========================================');
  console.log('Available models:', available);
  console.log('========================================');
})();
