'use server';
/**
 * @fileOverview This file defines a Genkit flow to generate an interactive multiple-choice quiz from course materials.
 *
 * - generateQuiz - A function that creates a 5-question MCQ quiz.
 * - GenerateQuizInput - The input type for the function.
 * - GenerateQuizOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuizInputSchema = z.object({
  material: z.string().describe('The course material text to generate a quiz from.'),
  courseName: z.string().describe('The name of the course.'),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

const GenerateQuizOutputSchema = z.object({
  quiz: z.array(z.object({
    question: z.string().describe('The quiz question.'),
    options: z.array(z.string()).describe('Exactly four possible answers.'),
    correctAnswerIndex: z.number().describe('The 0-based index of the correct answer (0-3).'),
    explanation: z.string().describe('A brief explanation of the correct answer.'),
  })).describe('A list of exactly 5 multiple-choice questions.'),
});
export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>;

export async function generateQuiz(input: GenerateQuizInput): Promise<GenerateQuizOutput> {
  return generateQuizFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizPrompt',
  input: {schema: GenerateQuizInputSchema},
  output: {schema: GenerateQuizOutputSchema},
  prompt: `You are an expert academic examiner.

Given the following study material for the course "{{{courseName}}}", generate a challenging but fair multiple-choice quiz.

Instructions:
1. Generate exactly 5 questions.
2. Each question must have exactly 4 plausible options.
3. Identify the correct answer by its 0-based index.
4. Provide a helpful, one-sentence explanation for the correct answer.

Study Material:
{{{material}}}`,
});

const generateQuizFlow = ai.defineFlow(
  {
    name: 'generateQuizFlow',
    inputSchema: GenerateQuizInputSchema,
    outputSchema: GenerateQuizOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
