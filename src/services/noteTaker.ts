import Groq from "groq-sdk";
import { COMPANY_INFO_CATEGORIES } from '../config/constants';
import { logger } from '../utils/logger';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function createNotes(pages: string[], batchSize: number = 1): Promise<any[]> {
  const notes: any[] = [];
  
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const batchNotes = await processBatch(batch);
    notes.push(...batchNotes);
  }

  return combineNotesByCategory(notes);
}

async function processBatch(batch: string[]): Promise<any[]> {
  const systemPrompt = createSystemPrompt();
  const userPrompt = createUserPrompt(batch);
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "llama3-8b-8192",
        response_format: { type: "json_object" },
        max_tokens: 3000,
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (content) {
        try {
          const parsedContent = JSON.parse(content);
          return Array.isArray(parsedContent.notes) ? parsedContent.notes : [];
        } catch (parseError) {
          logger.error(`Error parsing JSON content: ${parseError}`);
          return [];
        }
      }
      return [];
    } catch (error: any) {
      if (error.status === 400 && attempt < maxRetries) {
        logger.warn(`400 error on attempt ${attempt}, retrying...`);
        continue;
      }
      logger.error(`Error processing batch (attempt ${attempt}): ${error}`);
      if (attempt === maxRetries) {
        return [];
      }
    }
  }
  return [];
}

function createSystemPrompt(): string {
  const categories = Object.entries(COMPANY_INFO_CATEGORIES)
    .map(([key, description]) => `"${key}": "${description}"`)
    .join(',\n    ');

  return `You are an AI assistant that analyzes text and creates notes for specific categories. 
Your task is to generate a JSON object containing an array of notes for each category. Please ONLY provide content if you are EXTREMELY confident in the accuracy and applicability to the category.
The categories are:
{
  ${categories}
}

Respond with a JSON object in the following format:
{
  "notes": [
    {
      "category": "Category Name",
      "notes": "Relevant information for this category from the provided text."
    }
  ]
}

Important JSON formatting rules:
1. Use double quotes for all strings, including property names.
2. Do not include trailing commas after the last item in an array or object.
3. Ensure all brackets and braces are properly closed.
4. Do not include any text outside of the JSON object.

Example of a valid response:
{
  "notes": [
    {
      "category": "Overview",
      "notes": "The company specializes in AI-powered solutions for various industries."
    },
    {
      "category": "Products/services",
      "notes": "Their main product is an AI platform that offers data analysis and predictive modeling."
    }
  ]
}

If there's no relevant information for a category, omit it entirely rather than including an empty string.`;
}

function createUserPrompt(pages: string[]): string {
  return `Analyze the following text from a company 10K filing and create notes for each category:

${pages.join('\n\n')}

Provide your analysis as a JSON object with the structure described in the system prompt. Take notes verbatim from the provided text.`;
}

function combineNotesByCategory(notes: any[]): any[] {
  const combinedNotes: { [key: string]: string[] } = {};

  for (const note of notes) {
    if (note && note.category && typeof note.notes === 'string') {
      if (!combinedNotes[note.category]) {
        combinedNotes[note.category] = [];
      }
      const trimmedNote = note.notes.trim();
      if (trimmedNote !== '') {
        combinedNotes[note.category].push(trimmedNote);
      }
    }
  }

  return Object.entries(combinedNotes).map(([category, notesList]) => ({
    category,
    notes: notesList.join(' ')
  }));
}
