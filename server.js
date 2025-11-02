// ============================================================================
// AI FITNESS COACH - COMPLETE SERVER.JS (All 5 Endpoints)
// ============================================================================
// PASTE THIS DIRECTLY INTO YOUR server.js FILE
// This file contains ALL 5 endpoints with all API integrations

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const PDFDocument = require('pdfkit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================================================
// API KEYS FROM .ENV FILE
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyAT-SmPZlEi7cdnMSQmjtmiknGTOVHNZ8Y";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "sk_3cc35c9412ea1bc930c652f8d1bdfae50763d779776c67bd";
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || "r8_ej1Jhu9vPsQg0YNM6ISGTzzTttHCgqi0BDFwn";

// ============================================================================
// ENDPOINT 1: GENERATE FITNESS PLAN (AI-Powered)
// ============================================================================

app.post('/api/generate-plan', async (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      height,
      weight,
      goal,
      fitnessLevel,
      location,
      diet,
      medicalHistory,
      stressLevel
    } = req.body;

    // Validate required fields
    if (!name || !age || !height || !weight) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate BMI
    const heightInMeters = height / 100;
    const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(2);

    // Create detailed prompt for AI
    const prompt = `You are an expert fitness coach and nutritionist. Create a comprehensive, personalized fitness and diet plan STRICTLY in valid JSON format. Return ONLY the JSON with no markdown, no extra text, no code blocks.

PERSONAL INFORMATION:
- Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Height: ${height}cm
- Weight: ${weight}kg
- BMI: ${bmi}
- Fitness Goal: ${goal}
- Current Fitness Level: ${fitnessLevel}
- Workout Location: ${location}
- Dietary Preference: ${diet}
- Medical History: ${medicalHistory || 'None'}
- Stress Level: ${stressLevel}

RESPONSE FORMAT - RETURN ONLY THIS JSON (no extra text):
{
  "workoutPlan": [
    {"day": "Monday", "exercises": [{"name": "Exercise Name", "sets": "3", "reps": "12", "rest": "60 seconds"}]},
    {"day": "Tuesday", "exercises": [{"name": "Exercise Name", "sets": "4", "reps": "10", "rest": "90 seconds"}]},
    {"day": "Wednesday", "exercises": [{"name": "Exercise Name", "sets": "3", "reps": "15", "rest": "45 seconds"}]},
    {"day": "Thursday", "exercises": [{"name": "Exercise Name", "sets": "3", "reps": "12", "rest": "60 seconds"}]},
    {"day": "Friday", "exercises": [{"name": "Exercise Name", "sets": "4", "reps": "8", "rest": "90 seconds"}]},
    {"day": "Saturday", "exercises": [{"name": "Exercise Name", "sets": "3", "reps": "12", "rest": "75 seconds"}]},
    {"day": "Sunday", "exercises": [{"name": "Rest or Light Stretching", "sets": "1", "reps": "30 min", "rest": "N/A"}]}
  ],
  "dietPlan": {
    "breakfast": [{"name": "Food Item", "calories": 400, "protein": 25}],
    "lunch": [{"name": "Food Item", "calories": 550, "protein": 35}],
    "dinner": [{"name": "Food Item", "calories": 500, "protein": 30}],
    "snacks": [{"name": "Food Item", "calories": 150, "protein": 10}]
  },
  "tips": ["Tip 1", "Tip 2", "Tip 3", "Tip 4", "Tip 5"]
}`;

    let planData;

    // Try Gemini first
    if (GEMINI_API_KEY) {
      try {
        console.log('Trying Gemini API...');
        const geminiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [{
              parts: [{ text: prompt }]
            }]
          },
          { timeout: 300000 }
        );

        const responseText = geminiResponse.data.candidates[0].content.parts[0].text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          planData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response from Gemini');
        }
      } catch (geminiError) {
        console.log('Gemini failed:', geminiError.message);
        
        if (!OPENAI_API_KEY) {
          throw new Error('Gemini failed and no OpenAI key available');
        }

        // Fallback to OpenAI
        console.log('Falling back to OpenAI...');
        const openaiResponse = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a fitness expert. Respond ONLY with valid JSON, no extra text or markdown.'
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        const responseText = openaiResponse.data.choices[0].message.content;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          planData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response from OpenAI');
        }
      }
    } else if (OPENAI_API_KEY) {
      // Use OpenAI if Gemini not available
      console.log('Using OpenAI API...');
      const openaiResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a fitness expert. Respond ONLY with valid JSON.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const responseText = openaiResponse.data.choices[0].message.content;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        planData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    } else {
      throw new Error('No AI API keys configured');
    }

    // Ensure proper structure
    if (!planData.workoutPlan || !planData.dietPlan || !planData.tips) {
      throw new Error('Invalid response structure from AI');
    }

    console.log('Plan generated successfully');
    res.json(planData);
  } catch (error) {
    console.error('Error in generate-plan:', error.message);
    res.status(500).json({
      error: 'Failed to generate fitness plan',
      message: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 2: GENERATE IMAGE (For Exercises & Meals)
// ============================================================================

app.post('/api/generate-image', async (req, res) => {
  try {
    const { itemName, type } = req.body;

    if (!itemName || !type) {
      return res.status(400).json({ error: 'Missing itemName or type' });
    }

    const prompt = type === 'exercise'
      ? `Professional gym demonstration of ${itemName} exercise, correct form, athlete in action, high quality, realistic, 4K resolution, well-lit`
      : `Delicious and appetizing ${itemName}, professional food photography, well-plated, good lighting, magazine quality, high resolution`;

    let imageUrl;

    // Try Replicate first (best quality)
    if (REPLICATE_API_KEY) {
      try {
        console.log('Trying Replicate API for image generation...');
        
        // Create prediction
        const predictionResponse = await axios.post(
          'https://api.replicate.com/v1/predictions',
          {
            version: 'a45f82a1d6c31f76a91ff8a8e66f69671123bb46ef812d1da7066aaad44c0215',
            input: {
              prompt: prompt,
              num_outputs: 1,
              width: 512,
              height: 512,
              guidance_scale: 7.5
            }
          },
          {
            headers: {
              'Authorization': `Token ${REPLICATE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        const predictionId = predictionResponse.data.id;
        let prediction = predictionResponse.data;
        let attempts = 0;
        const maxAttempts = 60;

        // Poll for result
        while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const statusResponse = await axios.get(
            `https://api.replicate.com/v1/predictions/${predictionId}`,
            {
              headers: {
                'Authorization': `Token ${REPLICATE_API_KEY}`
              },
              timeout: 30000
            }
          );
          
          prediction = statusResponse.data;
          attempts++;
        }

        if (prediction.status === 'succeeded' && prediction.output && prediction.output.length > 0) {
          imageUrl = prediction.output[0];
          console.log('Replicate image generated successfully');
        } else {
          throw new Error('Image generation failed or timed out');
        }
      } catch (replicateError) {
        console.log('Replicate failed, trying OpenAI DALL-E...');
        
        if (!OPENAI_API_KEY) {
          console.log('No OpenAI key, using placeholder');
          imageUrl = `https://via.placeholder.com/512x512?text=${encodeURIComponent(itemName)}`;
        } else {
          // Fallback to OpenAI
          try {
            const dalleResponse = await axios.post(
              'https://api.openai.com/v1/images/generations',
              {
                model: 'dall-e-2',
                prompt: prompt,
                n: 1,
                size: '512x512',
                quality: 'standard'
              },
              {
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              }
            );

            imageUrl = dalleResponse.data.data[0].url;
            console.log('OpenAI DALL-E image generated successfully');
          } catch (dalleError) {
            console.log('OpenAI DALL-E also failed, using placeholder');
            imageUrl = `https://via.placeholder.com/512x512?text=${encodeURIComponent(itemName)}`;
          }
        }
      }
    } else if (OPENAI_API_KEY) {
      try {
        console.log('Using OpenAI DALL-E for image generation...');
        
        const dalleResponse = await axios.post(
          'https://api.openai.com/v1/images/generations',
          {
            model: 'dall-e-2',
            prompt: prompt,
            n: 1,
            size: '512x512',
            quality: 'standard'
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        imageUrl = dalleResponse.data.data[0].url;
        console.log('OpenAI DALL-E image generated successfully');
      } catch (dalleError) {
        console.log('OpenAI DALL-E failed, using placeholder');
        imageUrl = `https://via.placeholder.com/512x512?text=${encodeURIComponent(itemName)}`;
      }
    } else {
      // Fallback to placeholder (FREE, no key needed)
      console.log('No image API available, using placeholder');
      imageUrl = `https://via.placeholder.com/512x512?text=${encodeURIComponent(itemName)}`;
    }

    res.json({ imageUrl });
  } catch (error) {
    console.error('Error in generate-image:', error.message);
    // Return placeholder as fallback
    const { itemName } = req.body;
    res.json({
      imageUrl: `https://via.placeholder.com/512x512?text=${encodeURIComponent(itemName || 'Image')}`
    });
  }
});

// ============================================================================
// ENDPOINT 3: TEXT TO SPEECH (ElevenLabs)
// ============================================================================

app.post('/api/text-to-speech', async (req, res) => {
  try {
    let { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    // Convert to string if object
    if (typeof text !== 'string') {
      text = JSON.stringify(text);
    }

    // Limit text length for API
    text = text.substring(0, 4000);

    if (!ELEVENLABS_API_KEY) {
      return res.status(400).json({ error: 'ElevenLabs API key not configured' });
    }

    console.log('Generating speech with ElevenLabs...');

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
      {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.data.length,
      'Cache-Control': 'no-cache'
    });

    console.log('Speech generated successfully');
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Error in text-to-speech:', error.message);
    res.status(500).json({
      error: 'Failed to generate speech',
      message: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 4: EXPORT PDF
// ============================================================================

app.post('/api/export-pdf', async (req, res) => {
  try {
    const planData = req.body;

    if (!planData || !planData.workoutPlan || !planData.dietPlan) {
      return res.status(400).json({ error: 'Invalid plan data' });
    }

    console.log('Generating PDF...');

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40
    });

    const filename = `fitness-plan-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    doc.pipe(res);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Your Personalized Fitness Plan', {
      align: 'center'
    });
    doc.moveDown(0.5);

    // Generated Date
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, {
      align: 'center'
    });
    doc.moveDown(1.5);

    // Workout Plan Section
    doc.fontSize(18).font('Helvetica-Bold').text('Workout Plan', {
      underline: true
    });
    doc.moveDown(0.8);

    if (planData.workoutPlan && Array.isArray(planData.workoutPlan)) {
      planData.workoutPlan.forEach((day) => {
        doc.fontSize(12).font('Helvetica-Bold').text(day.day || 'Day', {
          color: '#667eea'
        });

        if (day.exercises && Array.isArray(day.exercises)) {
          day.exercises.forEach((exercise) => {
            const exerciseText = `• ${exercise.name}: ${exercise.sets} sets × ${exercise.reps} reps (Rest: ${exercise.rest})`;
            doc.fontSize(10).font('Helvetica').text(exerciseText, {
              indent: 20
            });
          });
        }

        doc.moveDown(0.5);
      });
    }

    // Add new page for Diet Plan
    doc.addPage();

    doc.fontSize(18).font('Helvetica-Bold').text('Diet Plan', {
      underline: true
    });
    doc.moveDown(0.8);

    if (planData.dietPlan && typeof planData.dietPlan === 'object') {
      Object.entries(planData.dietPlan).forEach(([meal, items]) => {
        const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);
        doc.fontSize(12).font('Helvetica-Bold').text(mealLabel, {
          color: '#42b883'
        });

        if (Array.isArray(items)) {
          items.forEach((item) => {
            const itemText = `• ${item.name}: ${item.calories} cal, ${item.protein}g protein`;
            doc.fontSize(10).font('Helvetica').text(itemText, {
              indent: 20
            });
          });
        }

        doc.moveDown(0.5);
      });
    }

    // Add Tips Section
    if (planData.tips && Array.isArray(planData.tips) && planData.tips.length > 0) {
      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').text('💡 Tips & Recommendations', {
        underline: true
      });
      doc.moveDown(0.8);

      planData.tips.forEach((tip, index) => {
        const tipText = `${index + 1}. ${tip}`;
        doc.fontSize(10).font('Helvetica').text(tipText, {
          align: 'left'
        });
        doc.moveDown(0.6);
      });
    }

    // Add footer page
    doc.addPage();
    doc.fontSize(10).font('Helvetica').text(
      'Remember to consult with a fitness professional before starting any new exercise program.',
      { align: 'center' }
    );

    doc.end();
    console.log('PDF generated successfully');
  } catch (error) {
    console.error('Error in export-pdf:', error.message);
    res.status(500).json({
      error: 'Failed to export PDF',
      message: error.message
    });
  }
});

// ============================================================================
// ENDPOINT 5: DAILY MOTIVATION
// ============================================================================

app.get('/api/motivation', async (req, res) => {
  try {
    const motivationPrompt = 'Generate a short, powerful, and inspiring fitness motivation quote in exactly one sentence (max 15 words). Return ONLY the quote, nothing else, no quotes around it.';

    let quote;

    // Try Gemini first
    if (GEMINI_API_KEY) {
      try {
        console.log('Fetching motivation from Gemini...');
        
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [{
              parts: [{ text: motivationPrompt }]
            }]
          },
          { timeout: 10000 }
        );

        quote = response.data.candidates[0].content.parts[0].text.trim();
      } catch (geminiError) {
        console.log('Gemini failed, trying OpenAI...');

        if (OPENAI_API_KEY) {
          try {
            const openaiResponse = await axios.post(
              'https://api.openai.com/v1/chat/completions',
              {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: motivationPrompt }],
                max_tokens: 50,
                temperature: 0.9
              },
              {
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                timeout: 10000
              }
            );

            quote = openaiResponse.data.choices[0].message.content.trim();
          } catch (openaiError) {
            throw new Error('Both APIs failed');
          }
        } else {
          throw new Error('No AI API available');
        }
      }
    } else if (OPENAI_API_KEY) {
      try {
        console.log('Fetching motivation from OpenAI...');
        
        const openaiResponse = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: motivationPrompt }],
            max_tokens: 50,
            temperature: 0.9
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        quote = openaiResponse.data.choices[0].message.content.trim();
      } catch (error) {
        throw new Error('OpenAI API failed');
      }
    } else {
      throw new Error('No AI API keys available');
    }

    // Clean up quote
    quote = quote.replace(/['"]+/g, '').substring(0, 200);

    console.log('Motivation fetched successfully');
    res.json({ quote });
  } catch (error) {
    console.error('Error in motivation:', error.message);

    // Return fallback quote if all APIs fail
    const fallbackQuotes = [
      'The only bad workout is the one that didn\'t happen.',
      'Your body can stand almost anything. Your mind you have to convince.',
      'The pain you feel today will be the strength you feel tomorrow.',
      'Success starts with self-discipline.',
      'Make yourself proud.',
      'Your transformation begins today.',
      'Train like a champion.',
      'Every rep counts toward your goals.',
      'Consistency is the key to success.',
      'Push harder than yesterday.'
    ];

    const fallbackQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    res.json({ quote: fallbackQuote });
  }
});

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'Server is running ✅',
    timestamp: new Date(),
    uptime: process.uptime(),
    port: PORT,
    apis: {
      gemini: GEMINI_API_KEY ? '✅ Configured' : '❌ Not configured',
      openai: OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured',
      elevenlabs: ELEVENLABS_API_KEY ? '✅ Configured' : '❌ Not configured',
      replicate: REPLICATE_API_KEY ? '✅ Configured' : '❌ Not configured'
    },
    endpoints: {
      'POST /api/generate-plan': 'Generate AI fitness plan',
      'POST /api/generate-image': 'Generate AI images for exercises/meals',
      'POST /api/text-to-speech': 'Convert text to speech',
      'POST /api/export-pdf': 'Export plan as PDF',
      'GET /api/motivation': 'Get daily motivation quote',
      'GET /health': 'Health check'
    }
  });
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  💪 AI FITNESS COACH SERVER STARTED SUCCESSFULLY           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 AVAILABLE ENDPOINTS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  1. POST /api/generate-plan      - Generate AI fitness plan');
  console.log('  2. POST /api/generate-image     - Generate exercise/meal images');
  console.log('  3. POST /api/text-to-speech     - Read plan aloud (ElevenLabs)');
  console.log('  4. POST /api/export-pdf         - Export plan as PDF');
  console.log('  5. GET  /api/motivation         - Get daily motivation quote');
  console.log('  6. GET  /health                 - Server health check');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('🔑 API STATUS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Gemini API:      ${GEMINI_API_KEY ? '✅ Active' : '❌ Not configured'}`);
  console.log(`  OpenAI API:      ${OPENAI_API_KEY ? '✅ Active' : '❌ Not configured'}`);
  console.log(`  ElevenLabs API:  ${ELEVENLABS_API_KEY ? '✅ Active' : '❌ Not configured'}`);
  console.log(`  Replicate API:   ${REPLICATE_API_KEY ? '✅ Active' : '❌ Not configured'}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('🎯 TEST YOUR SETUP:');
  console.log('  1. Open: http://localhost:5000/health');
  console.log('  2. Open frontend: http://localhost:3000');
  console.log('  3. Fill the form and click "Generate My Fitness Plan"');
  console.log('');
  console.log('💡 TIP: Check console for detailed API logs');
  console.log('');
});

module.exports = app;
