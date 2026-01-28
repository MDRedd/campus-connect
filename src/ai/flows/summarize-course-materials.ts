'use server';

/**
 * @fileOverview Summarizes course materials for students.
 *
 * - summarizeCourseMaterials - A function that summarizes course materials.
 * - SummarizeCourseMaterialsInput - The input type for the summarizeCourseMaterials function.
 * - SummarizeCourseMaterialsOutput - The return type for the summarizeCourseMaterials function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeCourseMaterialsInputSchema = z.object({
  courseName: z.string().describe('The name of the course.'),
  material: z.string().describe('The course material to summarize.'),
});
export type SummarizeCourseMaterialsInput = z.infer<typeof SummarizeCourseMaterialsInputSchema>;

const SummarizeCourseMaterialsOutputSchema = z.object({
  summary: z.string().describe('A summary of the course material.'),
});
export type SummarizeCourseMaterialsOutput = z.infer<typeof SummarizeCourseMaterialsOutputSchema>;

export async function summarizeCourseMaterials(
  input: SummarizeCourseMaterialsInput
): Promise<SummarizeCourseMaterialsOutput> {
  return summarizeCourseMaterialsFlow(input);
}

const summarizeCourseMaterialsPrompt = ai.definePrompt({
  name: 'summarizeCourseMaterialsPrompt',
  input: {schema: SummarizeCourseMaterialsInputSchema},
  output: {schema: SummarizeCourseMaterialsOutputSchema},
  prompt: `You are an expert summarizer for college students.

  Summarize the following course material for the course "{{courseName}}".

  Material: {{{material}}}`,
});

const summarizeCourseMaterialsFlow = ai.defineFlow(
  {
    name: 'summarizeCourseMaterialsFlow',
    inputSchema: SummarizeCourseMaterialsInputSchema,
    outputSchema: SummarizeCourseMaterialsOutputSchema,
  },
  async input => {
    const {output} = await summarizeCourseMaterialsPrompt(input);
    return output!;
  }
);
