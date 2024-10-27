import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-pro',
  generationConfig: {
    candidateCount: 1,
  },
});

async function getSymptomAnalysis(symptoms, additionalInfo) {
  const prompt = `
    Act as a medical AI assistant. Based on the following symptoms and information,
    provide a brief analysis. Include general recommendations, and state this is not a diagnosis.

    Symptoms: ${symptoms.join(', ')}
    Additional Information: ${additionalInfo}
  `;

  try {
    const result = await model.generateContent(prompt);
    const analysisText = result.response.text();

    const criticalKeywords = [
      "seek immediate medical attention",
      "life-threatening",
      "emergency",
      "hospital",
      "urgent care",
      "severe",
      "risk of death",
      "heart attack",
      "stroke"
    ];

    const isCritical = criticalKeywords.some(
      keyword => analysisText.toLowerCase().includes(keyword)
    );

    // Extract recommendations from the analysis text
    const recommendations = extractRecommendations(analysisText);

    return {
      analysis: analysisText,
      recommendations: recommendations,
      critical: isCritical
    };
  } catch (error) {
    console.error('Error fetching analysis from Google Gemini:', error);
    throw new Error('Failed to get analysis');
  }
}

// Function to extract recommendations from the analysis text
function extractRecommendations(analysisText) {
  // This is a placeholder implementation. You can adjust this logic based on how
  // recommendations are formatted in the analysis text.
  const recommendationStart = analysisText.indexOf('General Recommendations:');
  if (recommendationStart !== -1) {
    return analysisText.substring(recommendationStart).trim();
  }
  return 'No specific recommendations provided.';
}

app.post('/api/analyze-symptoms', async (req, res) => {
  const { symptoms, additionalInfo } = req.body;

  if (!Array.isArray(symptoms) || typeof additionalInfo !== 'string') {
    return res.status(400).json({
      error: 'Invalid input: symptoms should be an array and additionalInfo a string.'
    });
  }

  try {
    const analysis = await getSymptomAnalysis(symptoms, additionalInfo);
    res.json(analysis);
  } catch {
    res.status(500).json({ error: 'Error processing request.' });
  }
});

app.listen(port, () => {
  console.log(`Vitality Health API running on port ${port}`);
});
