import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', 
    generationConfig: {
        candidateCount: 1,
        stopSequences: ["x"],
        maxOutputTokens: 100,
        temperature: 1.0,
  }
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
       let analysisText = result.response.text();

       analysisText = analysisText.replace(
           /\n\nIt's important to remember that I am an AI assistant and cannot provide medical advice\./gi, 
           ''
       );

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

       // Clean up formatting characters and add spacing
       analysisText = analysisText
           .replace(/\*/g, '')  // Remove asterisks
           .replace(/\\n/g, '\n\n')  // Replace \n with actual line breaks
           .replace(/\s+/g, ' ')  // Normalize spaces
           .split('\n')  // Split into lines
           .map(line => line.trim())  // Trim each line
           .filter(line => line)  // Remove empty lines
           .join('\n\n')  // Join with double line breaks
           .trim();  // Final trim

       // Add spacing around sections
       analysisText = analysisText
           .replace(/Brief Analysis:/g, '\nBrief Analysis:\n')
           .replace(/General Recommendations:/g, '\nGeneral Recommendations:\n')
           .replace(/Disclaimer:/g, '\nDisclaimer:\n');

       return {
           analysis: analysisText,
           critical: isCritical
       };
   } catch (error) {
       console.error('Error fetching analysis from Google Gemini:', error);
       throw new Error('Failed to get analysis');
   }
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