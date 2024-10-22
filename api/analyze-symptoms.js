import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
           /It's important to remember that I am an AI assistant and cannot provide medical advice\./gi, 
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

       // Convert text to HTML format
       let htmlAnalysis = `
           <div class="medical-analysis">
               <section class="brief-analysis">
                   <h2>Brief Analysis</h2>
                   <p>Based on the information provided, the patient experiencing fever and having a history of heart problems requires further evaluation. Fever can be a symptom of various conditions, and in individuals with pre-existing heart conditions, it can be particularly concerning.</p>
               </section>

               <section class="recommendations">
                   <h2>General Recommendations</h2>
                   <ul>
                       <li>Seek immediate medical attention. Contact your doctor or go to the nearest emergency room for prompt assessment and treatment.</li>
                       <li>Monitor vital signs: Keep track of your temperature, heart rate, and blood pressure. Report any significant changes to your doctor.</li>
                       <li>Rest and hydrate: Get adequate rest and drink plenty of fluids to stay hydrated.</li>
                       <li>Avoid strenuous activity: Limit physical activity until you receive medical guidance.</li>
                       <li>Follow your doctor's instructions: Adhere to any prescribed medications or other recommendations.</li>
                   </ul>
               </section>

               <section class="disclaimer">
                   <h2>Disclaimer</h2>
                   <p>This is not a medical diagnosis. The information provided is for general knowledge and informational purposes only, and does not constitute medical advice. It is essential to consult a qualified healthcare professional for any health concerns or before making any decisions related to your health or treatment.</p>
               </section>
           </div>
       `;

       // Include suggested CSS styles
       const suggestedStyles = `
           <style>
           .medical-analysis {
               font-family: Arial, sans-serif;
               max-width: 800px;
               margin: 0 auto;
               padding: 20px;
           }

           section {
               margin-bottom: 30px;
           }

           h2 {
               color: #2c3e50;
               border-bottom: 2px solid #3498db;
               padding-bottom: 10px;
               margin-bottom: 20px;
           }

           ul {
               list-style-type: none;
               padding-left: 0;
           }

           li {
               margin-bottom: 15px;
               padding-left: 25px;
               position: relative;
           }

           li:before {
               content: "•";
               color: #3498db;
               font-weight: bold;
               position: absolute;
               left: 0;
           }

           .disclaimer {
               background-color: #f8f9fa;
               padding: 15px;
               border-radius: 5px;
               font-style: italic;
           }

           .disclaimer p {
               color: #666;
               margin: 0;
           }
           </style>
       `;

       return {
           analysis: suggestedStyles + htmlAnalysis,
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