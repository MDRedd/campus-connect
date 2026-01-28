'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate study questions based on course materials.
 *
 * The flow takes course materials as input and returns a set of study questions.
 *
 * @fileOverview A study questions AI agent.
 *
 * - generateStudyQuestions - A function that handles the study questions generation process.
 * - GenerateStudyQuestionsInput - The input type for the generateStudyQuestions function.
 * - GenerateStudyQuestionsOutput - The return type for the generateStudyQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStudyQuestionsInputSchema = z.object({
  courseMaterials: z
    .string()
    .describe('The course materials to generate study questions from.'),
});
export type GenerateStudyQuestionsInput = z.infer<typeof GenerateStudyQuestionsInputSchema>;

const GenerateStudyQuestionsOutputSchema = z.object({
  studyQuestions: z
    .string()
    .describe('The generated study questions based on the course materials.'),
});
export type GenerateStudyQuestionsOutput = z.infer<typeof GenerateStudyQuestionsOutputSchema>;

export async function generateStudyQuestions(
  input: GenerateStudyQuestionsInput
): Promise<GenerateStudyQuestionsOutput> {
  return generateStudyQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStudyQuestionsPrompt',
  input: {schema: GenerateStudyQuestionsInputSchema},
  output: {schema: GenerateStudyQuestionsOutputSchema},
  prompt: `You are an expert educator specializing in creating effective study questions.

  Based on the provided course materials, generate a set of study questions that will help students test their understanding and prepare for exams.

  Course Materials: {{{courseMaterials}}}`,
});

const generateStudyQuestionsFlow = ai.defineFlow(
  {
    name: 'generateStudyQuestionsFlow',
    inputSchema: GenerateStudyQuestionsInputSchema,
    outputSchema: GenerateStudyQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
