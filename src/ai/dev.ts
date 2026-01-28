import { config } from 'dotenv';
config();

import '@/ai/flows/generate-study-questions.ts';
import '@/ai/flows/personalized-notification-generation.ts';
import '@/ai/flows/summarize-course-materials.ts';