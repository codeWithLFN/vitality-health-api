import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Initialize the Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON body
app.use(express.json());

// Initialize the Google Generative AI model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    candidateCount: 1,
  },
});

async function getSymptomAnalysis(symptoms, additionalInfo) {
  // Construct the prompt for the AI model
  const prompt = `
    You are BantuHealth AI, a medical assistant. Analyze the following symptoms and information:

    SYMPTOMS:
    ${symptoms.join(', ')}

    ADDITIONAL INFORMATION:
    ${additionalInfo}

    Please provide a structured response with the following sections:

    1. INITIAL ASSESSMENT:
    - Brief overview of the situation
    - Potential conditions to consider

    2. RECOMMENDATIONS:
    - Immediate actions to take
    - Lifestyle modifications
    - Self-care measures

    3. URGENCY LEVEL:
    - Rate urgency (Low/Medium/High)
    - Specify if immediate medical attention is needed

    4. DISCLAIMER:
    Include a clear medical disclaimer

    Keep the response professional but easy to understand. Focus on actionable advice and clear next steps.
  `;

  // Generate content using the Google Gemini model
  try {
    const result = await model.generateContent(prompt);
    const analysisText = result.response.text();

    /*// Commented out for now, can be used to check for critical keywords
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
    */

    // Define urgency levels
    const urgencyLevels = [
      "low",
      "medium",
      "high"
    ];

    // Check if any critical keywords are present in the analysis
    const isCritical = urgencyLevels.some(
      keyword => analysisText.toLowerCase().includes(keyword)
    );

    // Parse the analysis into structured sections
    const sections = parseAnalysisSections(analysisText);

    return {
      analysis: analysisText,
      structured: sections,
      critical: isCritical,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching analysis from Google Gemini:', error);
    throw new Error('Failed to get analysis');
  }
}

function parseAnalysisSections(analysisText) {
  const sections = {
    assessment: '',
    recommendations: '',
    urgency: '',
    disclaimer: ''
  };

  const sectionMatches = {
    assessment: /INITIAL ASSESSMENT:(.*?)(?=RECOMMENDATIONS:|$)/s,
    recommendations: /RECOMMENDATIONS:(.*?)(?=URGENCY LEVEL:|$)/s,
    urgency: /URGENCY LEVEL:(.*?)(?=DISCLAIMER:|$)/s,
    disclaimer: /DISCLAIMER:(.*?)$/s
  };

  for (const [key, regex] of Object.entries(sectionMatches)) {
    const match = analysisText.match(regex);
    if (match) {
      sections[key] = match[1].trim();
    }
  }

  return sections;
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
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Error processing request.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.listen(port, () => {
  console.log(`BantuHealth AI API running on port ${port}`);
});
