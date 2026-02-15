'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate feedback for a student submission.
 *
 * - generateSubmissionFeedback - A function that generates feedback.
 * - GenerateSubmissionFeedbackInput - The input type for the generateSubmissionFeedback function.
 * - GenerateSubmissionFeedbackOutput - The return type for the generateSubmissionFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSubmissionFeedbackInputSchema = z.object({
  assignmentTitle: z.string().describe("The title of the assignment."),
  assignmentDescription: z.string().describe("The description of the assignment."),
  marksAwarded: z.number().describe("The marks awarded to the student (out of 100)."),
  studentName: z.string().describe("The name of the student."),
});
export type GenerateSubmissionFeedbackInput = z.infer<typeof GenerateSubmissionFeedbackInputSchema>;

const GenerateSubmissionFeedbackOutputSchema = z.object({
  feedback: z.string().describe('The generated feedback for the student.'),
});
export type GenerateSubmissionFeedbackOutput = z.infer<typeof GenerateSubmissionFeedbackOutputSchema>;

export async function generateSubmissionFeedback(
  input: GenerateSubmissionFeedbackInput
): Promise<GenerateSubmissionFeedbackOutput> {
  return generateSubmissionFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSubmissionFeedbackPrompt',
  input: {schema: GenerateSubmissionFeedbackInputSchema},
  output: {schema: GenerateSubmissionFeedbackOutputSchema},
  prompt: `You are a helpful and encouraging teaching assistant.

A student named {{{studentName}}} has received a score of {{{marksAwarded}}}/100 on the assignment titled "{{{assignmentTitle}}}".

The assignment description was: "{{{assignmentDescription}}}"

Based on their score, please write a short, constructive, and encouraging feedback message.

If the score is high (above 85), praise their effort and understanding.
If the score is average (between 60 and 85), acknowledge their work and suggest one or two areas for improvement.
If the score is low (below 60), be encouraging, point out that there's room to grow, and suggest they review the core concepts or reach out for help.

Keep the feedback concise and positive in tone.`,
});

const generateSubmissionFeedbackFlow = ai.defineFlow(
  {
    name: 'generateSubmissionFeedbackFlow',
    inputSchema: GenerateSubmissionFeedbackInputSchema,
    outputSchema: GenerateSubmissionFeedbackOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
