import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.GEMINI_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: "enter your system instructions here",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

// Define type for request body
interface RequestBody {
  message: string;
  history?: Array<{
    role: 'user' | 'model';
    parts: Array<{text: string}>;
  }>;
}

// Handler for POST requests
export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body: RequestBody = await request.json();
    
    // Validate the incoming history
    let validHistory = body.history || [];
    
    // Ensure the history is in the correct format
    if (!Array.isArray(validHistory)) {
      validHistory = [];
    }
    
    // Create a chat session with history if provided
    const chatSession = model.startChat({
      generationConfig,
      history: validHistory.length > 0 ? validHistory : [
        {
          role: "user",
          parts: [
            {text: "what is the 3 core values of eac?"},
          ],
        },
      ],
    });

    // Send message to model with timeout handling
    try {
      const result = await Promise.race([
        chatSession.sendMessage(body.message),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]) as any;
      
      // Return response with full history
      return NextResponse.json({ 
        response: result.response.text(),
        history: chatSession.getHistory()
      });
    } catch (error) {
      console.error('Error from AI model:', error);
      return NextResponse.json({ 
        response: "I'm having trouble generating a response right now. Please try again.",
        history: chatSession.getHistory() // Still return history even if there's an error
      });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        response: "I'm sorry, there was a problem with your request."
      },
      { status: 500 }
    );
  }
}