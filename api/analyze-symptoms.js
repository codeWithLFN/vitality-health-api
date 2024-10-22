import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse incoming JSON
app.use(express.json());

// Initialize the Google Generative AI instance
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Helper function to generate analysis
// Helper function to generate analysis
async function getSymptomAnalysis(symptoms, additionalInfo) {
    const prompt = `
      Act as a medical AI assistant. Based on the following symptoms and information,
      provide a brief analysis of possible conditions. Include general recommendations
      and clearly state this is not a diagnosis.
  
      Symptoms: ${symptoms.join(', ')}
      Additional Information: ${additionalInfo}
  
      Please format the response with:
      1. Possible conditions
      2. General recommendations
      3. Warning signs to watch for
      4. When to seek immediate medical attention
    `;
  
    try {
      const result = await model.generateContent(prompt);
      const analysisText = result.response.text();
  
      // Check for critical conditions in the generated response (this is a simple logic, you can expand based on your needs)
      const isCritical = analysisText.includes("seek immediate medical attention") || analysisText.includes("life-threatening");
  
      return {
        analysis: analysisText,
        critical: isCritical // Flag to indicate if it's critical
      };
    } catch (error) {
      console.error('Error fetching analysis from Google Gemini:', error);
      throw new Error('Failed to get analysis');
    }
  }
  
  // API Endpoint to analyze symptoms
  app.post('/analyze-symptoms', async (req, res) => {
    const { symptoms, additionalInfo } = req.body;
  
    if (!symptoms || !additionalInfo) {
      return res.status(400).json({ error: 'Please provide symptoms and additional information.' });
    }
  
    try {
      const analysis = await getSymptomAnalysis(symptoms, additionalInfo);
      res.json(analysis); // Return both the analysis and the critical flag
    } catch (error) {
      res.status(500).json({ error: 'Error processing your request.' });
    }
  });