import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY as string;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// File handling functions
async function uploadToGemini(filePath: string, mimeType: string) {
  try {
    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType,
      displayName: path.basename(filePath),
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

async function waitForFilesActive(files: any[]) {
  console.log("Waiting for file processing...");
  for (const name of files.map((file) => file.name)) {
    let file = await fileManager.getFile(name);
    while (file.state === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      file = await fileManager.getFile(name);
    }
    if (file.state !== "ACTIVE") {
      throw Error(`File ${file.name} failed to process`);
    }
  }
  console.log("...all files ready");
  return files;
}

// Enhanced file handling
interface FileMapping {
  [key: string]: {
    filePath: string;
    mimeType: string;
    file?: any;
  }
}

// Define all files to be used with the chatbot
const fileDefinitions: FileMapping = {
  'eacHymn': {
    filePath: path.join(process.cwd(), 'src', 'app', 'reference', 'EAC MANILA - HYMN.pdf'),
    mimeType: "application/pdf"
  },

  // Add more files as needed
  // 'anotherFile': {
  //   filePath: path.join(process.cwd(), 'src', 'app', 'reference', 'filename.ext'),
  //   mimeType: "application/appropriate-mime-type"
  // },
};

// Flag to track initialization
let filesInitialized = false;

// Initialize files on first run with better error handling
async function initializeFiles() {
  if (filesInitialized) return;
  
  console.log("Initializing reference files...");
  const uploadedFiles = [];
  const failedFiles = [];
  
  for (const [key, fileInfo] of Object.entries(fileDefinitions)) {
    try {
      if (!fs.existsSync(fileInfo.filePath)) {
        console.warn(`File not found: ${fileInfo.filePath}`);
        failedFiles.push(key);
        continue;
      }
      
      console.log(`Uploading ${key} from ${fileInfo.filePath}`);
      const uploadedFile = await uploadToGemini(fileInfo.filePath, fileInfo.mimeType);
      fileInfo.file = uploadedFile;
      uploadedFiles.push(uploadedFile);
      
    } catch (error) {
      console.error(`Error uploading ${key}:`, error);
      failedFiles.push(key);
    }
  }
  
  if (uploadedFiles.length > 0) {
    try {
      await waitForFilesActive(uploadedFiles);
    } catch (error) {
      console.error("Error waiting for files to become active:", error);
    }
  }
  
  if (failedFiles.length > 0) {
    console.warn(`Failed to initialize these files: ${failedFiles.join(', ')}`);
  }
  
  filesInitialized = true;
  console.log("Files initialization completed");
}

// Retrieve file by key
function getFile(key: string) {
  return fileDefinitions[key]?.file || null;
}

// Setup the model with system instructions
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: "*Input your system instruction here*",
});

// Define the generation configuration
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
    // Initialize files if not already done
    if (!filesInitialized) {
      await initializeFiles();
    }
    
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
        {
          role: "model",
          parts: [
            {text: "As an institution, Emilio Aguinaldo College (EAC) is guided by three core values: Virtue, Excellence, and Service. These values shape the EAC community and its commitment to quality education.\n"},
          ],
        },
        {
          role: "user",
          parts: [
            {text: "what is the 3 core values of eac manila?"},
          ],
        },
        {
          role: "model",
          parts: [
            {text: "The three core values of Emilio Aguinaldo College Manila are Virtue, Excellence, and Service.\n"},
          ],
        },
        {
          role: "user",
          parts: getFile('eacHymn') ? [
            {
              fileData: {
                mimeType: getFile('eacHymn').mimeType,
                fileUri: getFile('eacHymn').uri,
              },
            },
            {text: "The attached file contains the official hymn of EAC Manila. Extract and display the full lyrics while maintaining their original wording and structure. Whenever someone asks for the EAC Hymn, provide the extracted text."},
          ] : [
            {text: "what is the eac hymn?"},
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