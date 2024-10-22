import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse incoming JSON
app.use(express.json());

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Generate symptom analysis
async function getSymptomAnalysis(symptoms, additionalInfo) {
    const prompt = `
    Act as a medical AI assistant. Based on the following symptoms and information,
    provide a brief analysis. Include general recommendations, and state this is not a diagnosis.
    
    Symptoms: ${symptoms.join(', ')}
    Additional Information: ${additionalInfo}
  `;

  try {
    const result = await model.generateContent(prompt);
    let analysisText = result.response.text();

    // Remove unnecessary disclaimer and format the response
    analysisText = analysisText.replace(/It's important to remember that I am an AI assistant and cannot provide medical advice\./gi, '');

    // Check for critical conditions in the response
    const criticalKeywords = [
      "seek immediate medical attention", "life-threatening", "emergency",
      "hospital", "urgent care", "severe", "risk of death", "heart attack", "stroke"
    ];

    const isCritical = criticalKeywords.some(keyword => analysisText.toLowerCase().includes(keyword));

    // Format for readability
    analysisText = analysisText.replace(/^(?=.*\*\*General Recommendations\*\*|Warning Signs:|When to Seek Immediate Medical Attention:)/gm, '\n$&')
                               .replace(/(?:^|\n)(?=\*\*General Recommendations\*\*)/, '');

    return {
      analysis: analysisText.trim(), // Trim any whitespace
      critical: isCritical // Flag indicating if it's critical
    };
  } catch (error) {
    console.error('Error fetching analysis from Google Gemini:', error);
    throw new Error('Failed to get analysis');
  }
}

// Analyze symptoms endpoint
app.post('/api/analyze-symptoms', async (req, res) => {
  const { symptoms, additionalInfo } = req.body;

  if (!Array.isArray(symptoms) || typeof additionalInfo !== 'string') {
    return res.status(400).json({ error: 'Invalid input: symptoms should be an array and additionalInfo a string.' });
  }

  try {
    const analysis = await getSymptomAnalysis(symptoms, additionalInfo);
    res.json(analysis);
  } catch {
    res.status(500).json({ error: 'Error processing request.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Vitality Health API running on port ${port}`);
});
