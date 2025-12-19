import OpenAI from "openai";

// Using Replit's AI Integrations service for OpenAI access
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface AIFoodResponse {
  foodName: string;
  servingSize: string;
  numberOfServings: number;
  macrosPerServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  micronutrients?: Record<string, string>;
}

export interface AIFoodIdentificationResponse {
  foodName: string;
  searchTerms: string[];
  servingSizeEstimate: string;
  numberOfServings: number;
  confidence: 'high' | 'medium' | 'low';
}

const FOOD_ANALYSIS_PROMPT = `You are a nutritionist API. Analyze the food and return a JSON object ONLY.
Identify the food. Determine a standard serving size and how many servings are shown/described.

CRITICAL: 
- "servingSize" should be a human-readable serving size label like "1 cup (240ml)", "100g", "1 piece", "1 container", etc.
- "numberOfServings" is how many of that serving size is shown/described (can be 0.5, 1, 1.5, 2, etc.)
- "macrosPerServing" is the nutrition for ONE serving (not total)

Return ONLY valid JSON with this exact structure:
{
  "foodName": "Grilled Chicken Breast",
  "servingSize": "100g",
  "numberOfServings": 2,
  "macrosPerServing": {
    "calories": 165,
    "protein": 31,
    "carbs": 0,
    "fat": 3.6
  },
  "micronutrients": {
    "iron": "0.5mg",
    "potassium": "256mg"
  }
}`;

export async function analyzeFoodFromText(description: string): Promise<AIFoodResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o for food analysis
      messages: [
        { role: "system", content: FOOD_ANALYSIS_PROMPT },
        { role: "user", content: description },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return parsed as AIFoodResponse;
  } catch (error) {
    console.error("AI text analysis error:", error);
    throw new Error("Failed to analyze food description");
  }
}

export async function analyzeFoodFromImage(imageBase64: string): Promise<AIFoodResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o with vision
      messages: [
        { role: "system", content: FOOD_ANALYSIS_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this food image and provide nutritional information.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return parsed as AIFoodResponse;
  } catch (error) {
    console.error("AI image analysis error:", error);
    throw new Error("Failed to analyze food image");
  }
}

const FOOD_IDENTIFICATION_PROMPT = `You are a food identification API. Your ONLY job is to identify what food is in the image.
DO NOT estimate nutrition values - the user will look up accurate nutrition from a database.

Your tasks:
1. Identify the food item(s) shown
2. Provide searchable terms for FDA database lookup
3. Estimate serving size and quantity shown

Return ONLY valid JSON with this exact structure:
{
  "foodName": "Grilled Chicken Breast with Rice",
  "searchTerms": ["grilled chicken breast", "white rice", "steamed rice"],
  "servingSizeEstimate": "1 breast (about 150g) + 1 cup rice",
  "numberOfServings": 1,
  "confidence": "high"
}

Guidelines:
- "foodName" should be a human-readable description of the complete meal/food
- "searchTerms" should be individual ingredients that can be searched in a nutrition database (FDA FoodData Central)
- Keep searchTerms simple and generic (e.g., "chicken breast" not "grilled herb-crusted chicken")
- "confidence" is how sure you are about the identification: "high", "medium", or "low"`;

export async function identifyFoodFromImage(imageBase64: string): Promise<AIFoodIdentificationResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: FOOD_IDENTIFICATION_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Identify the food in this image. Do not estimate nutrition.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 512,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return parsed as AIFoodIdentificationResponse;
  } catch (error) {
    console.error("AI food identification error:", error);
    throw new Error("Failed to identify food in image");
  }
}

export interface AIMETResponse {
  estimatedMET: number;
  confidence: string;
  reasoning: string;
}

const MET_ESTIMATION_PROMPT = `You are an exercise physiologist API. Estimate the MET (Metabolic Equivalent of Task) value for physical activities.

MET values indicate energy expenditure relative to rest (MET 1 = resting).
Reference values:
- Walking (3mph): 3.5 MET
- Jogging: 7.0 MET
- Running (6mph): 9.8 MET
- Cycling (moderate): 6.8 MET
- Swimming (laps): 7.0 MET
- HIIT: 12.0 MET

Return ONLY valid JSON with this exact structure:
{
  "estimatedMET": 6.5,
  "confidence": "high",
  "reasoning": "Brief explanation comparing to known activities"
}

Confidence levels: "high" (well-known activity), "medium" (similar to known activities), "low" (unusual activity, rough estimate)`;

export async function estimateActivityMET(activityName: string): Promise<AIMETResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using smaller model for simple estimation
      messages: [
        { role: "system", content: MET_ESTIMATION_PROMPT },
        { role: "user", content: `Estimate the MET value for: "${activityName}"` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 256,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return parsed as AIMETResponse;
  } catch (error) {
    console.error("AI MET estimation error:", error);
    throw new Error("Failed to estimate activity MET value");
  }
}

// ============ CHECK-IN ANALYSIS ============

export interface CheckInAnalysisFlag {
  severity: 'high' | 'medium' | 'low';
  category: 'weight' | 'adherence' | 'nutrition' | 'recovery' | 'motivation' | 'other';
  issue: string;
  data_points: string[];
}

export interface AICheckInAnalysisResponse {
  summary: string;
  risk_score: number;
  flags: CheckInAnalysisFlag[];
  wins: string[];
  suggested_response: string;
  coaching_notes: string;
  key_insights: string[];
}

export interface CheckInAnalysisInput {
  clientName: string;
  weekStart: string;
  metrics: {
    weight: {
      current_kg: number | null;
      delta_kg: number | null;
      trend_4_week: 'gaining' | 'losing' | 'stable' | null;
    };
    training: {
      sessions_completed: number;
      sessions_assigned: number;
      adherence_percent: number;
      missed_days: string[];
      notable_performances: string[];
    };
    nutrition: {
      avg_calories: number | null;
      target_calories: number | null;
      avg_protein_g: number | null;
      target_protein_g: number | null;
      days_logged: number;
      adherence_percent: number | null;
    };
    cardio: {
      total_minutes: number;
      activities: string[];
    };
    fasting: {
      fasts_completed: number;
      avg_duration_hours: number | null;
      adherence_percent: number | null;
    };
    data_quality: {
      missing_data: string[];
      reliability: 'high' | 'medium' | 'low';
    };
  };
  questions: Array<{
    question: string;
    answer: string | null;
  }>;
  previousWeekSummary?: string;
}

const CHECK_IN_ANALYSIS_PROMPT = `You are an expert fitness and nutrition coach assistant. Analyze a client's weekly check-in data and provide actionable insights for the trainer.

Your role is to:
1. Identify patterns, concerns, and wins from the data
2. Assign a risk score (1-10) where:
   - 1-3: Client is on track, minor adjustments only
   - 4-6: Some concerns, trainer should address in next session
   - 7-10: Urgent attention needed, possible regression or health concern
3. Generate a warm, professional suggested response the trainer can use
4. Flag specific issues with severity levels
5. Note any wins to celebrate with the client

Consider:
- Weight trends vs goals
- Training adherence and progression
- Nutrition compliance
- Recovery indicators from client answers
- Mental/motivational state from qualitative responses
- Data reliability (missing data affects confidence)

Return ONLY valid JSON with this exact structure:
{
  "summary": "2-3 sentence overview of the week",
  "risk_score": 4,
  "flags": [
    {
      "severity": "medium",
      "category": "adherence",
      "issue": "Missed 3 training sessions this week",
      "data_points": ["Training: 2/5 sessions", "Mentioned feeling tired"]
    }
  ],
  "wins": ["Hit protein goal 6/7 days", "Completed all cardio sessions"],
  "suggested_response": "Hey [name]! Thanks for checking in. I noticed... [personalized response]",
  "coaching_notes": "Internal notes for the trainer about areas to explore",
  "key_insights": ["Client may be overreaching", "Consider deload week"]
}`;

export async function analyzeCheckIn(input: CheckInAnalysisInput): Promise<AICheckInAnalysisResponse> {
  try {
    const userPrompt = `Analyze this weekly check-in for ${input.clientName} (Week of ${input.weekStart}):

## METRICS DATA
${JSON.stringify(input.metrics, null, 2)}

## CLIENT RESPONSES
${input.questions.map(q => `Q: ${q.question}\nA: ${q.answer || '(no response)'}`).join('\n\n')}

${input.previousWeekSummary ? `## PREVIOUS WEEK CONTEXT\n${input.previousWeekSummary}` : ''}

Please analyze and provide your assessment.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CHECK_IN_ANALYSIS_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    
    // Replace [name] placeholder with actual client name
    if (parsed.suggested_response) {
      parsed.suggested_response = parsed.suggested_response.replace(/\[name\]/gi, input.clientName);
    }
    
    return parsed as AICheckInAnalysisResponse;
  } catch (error) {
    console.error("AI check-in analysis error:", error);
    throw new Error("Failed to analyze check-in");
  }
}
