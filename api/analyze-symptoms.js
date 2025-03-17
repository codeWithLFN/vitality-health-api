import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import winston from 'winston';

// Load environment variables from .env file
dotenv.config();

// Initialize the Express app
const app = express();
const port = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet()); // Security headers
app.use(cors({ origin: ['https://vitality-health-api.vercel.app/'] })); // Restrict origins
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

// API Key Middleware
const apiKeyMiddleware = (req, res, next) => {
  if (req.headers['x-api-key'] !== process.env.API_SECRET_KEY) {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  next();
};
app.use('/api/', apiKeyMiddleware);

// Logging setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

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

    // Define urgency levels
    const urgencyLevels = [
      "low",
      "medium",
      "high"
    ];

    // Check if any critical keywords are present in the analysis
    const isCritical = criticalKeywords.some(
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

// API endpoint to post symptoms for analysis
app.post('/api/analyze-symptoms',
  [
    body('symptoms').isArray().withMessage('Symptoms must be an array'),
    body('additionalInfo').isString().trim().escape()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
      logger.error('API Error: ' + error.message);
      res.status(500).json({ 
        error: 'Error processing request.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

//api endpoint to get the model
app.get('/api/model', async (req, res) => {
  res.json({ model: model.model });
});

//api endponit to check the health of the api
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString()
  };
  res.json(health);
});

//api endpoint to get the version of the api
app.get('/api/version', async (req, res) => {
  const version = {
    version: '1.0.0',
    timestamp: new Date().toISOString()
  };
  res.json(version);
});

//api endpoint to get the status of the api
app.get('/api/status', async (req, res) => {
  const status = {
    status: 'running',
    timestamp: new Date().toISOString()
  };
  res.json(status);
});

// Start the Express server
app.listen(port, () => {
  console.log(`BantuHealth AI API running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
