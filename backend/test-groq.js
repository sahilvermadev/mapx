require('dotenv').config({ path: '../.env' });
const Groq = require('groq-sdk');

console.log('🔧 Testing Groq API...');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Set' : '❌ Not set');

if (!process.env.GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY not found in environment variables');
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function testGroq() {
  try {
    console.log('🤖 Testing Groq API call...');
    
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant."
        },
        {
          role: "user",
          content: "Say 'Hello from Groq!' in a friendly way."
        }
      ],
      model: "qwen/qwen3-32b",
      temperature: 0.7,
      max_tokens: 50,
    });

    const response = completion.choices[0]?.message?.content;
    console.log('✅ Groq API Response:', response);
    console.log('🎉 Groq API is working correctly!');
    
  } catch (error) {
    console.error('❌ Groq API Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testGroq(); 