'use server';
/**
 * @fileOverview This file defines a Genkit flow to generate a summary of class performance for an assignment.
 *
 * - generateClassSummary - A function that analyzes class submissions and returns insights.
 * - GenerateClassSummaryInput - The input type for the generateClassSummary function.
 * - GenerateClassSummaryOutput - The return type for the generateClassSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateClassSummaryInputSchema = z.object({
  assignmentTitle: z.string().describe("The title of the assignment."),
  submissions: z.array(z.object({
    studentName: z.string(),
    marks: z.number().optional(),
    comments: z.string().optional(),
    feedback: z.string().optional(),
  })).describe("A list of student submissions with their marks and comments."),
});
export type GenerateClassSummaryInput = z.infer<typeof GenerateClassSummaryInputSchema>;

const GenerateClassSummaryOutputSchema = z.object({
  summary: z.string().describe('A high-level summary of class performance, highlighting trends and common areas for improvement.'),
});
export type GenerateClassSummaryOutput = z.infer<typeof GenerateClassSummaryOutputSchema>;

export async function generateClassSummary(input: GenerateClassSummaryInput): Promise<GenerateClassSummaryOutput> {
  return generateClassSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateClassSummaryPrompt',
  input: {schema: GenerateClassSummaryInputSchema},
  output: {schema: GenerateClassSummaryOutputSchema},
  prompt: `You are an expert educational analyst.

Given the following student submissions for the assignment titled "{{{assignmentTitle}}}", provide a concise and insightful summary of the class's overall performance.

Focus on:
1. General trends in performance (average marks or common achievement levels).
2. Key strengths identified across multiple submissions.
3. Common areas where students struggled or made errors.
4. Actionable advice for the instructor on what topics to review or clarify in the next session.

Keep the summary constructive and professional.

Submissions Data:
{{#each submissions}}
- Student: {{studentName}}, Marks: {{#if marks}}{{marks}}{{else}}N/A{{/if}}, Comments: "{{comments}}", Feedback: "{{feedback}}"
{{/each}}`,
});

const generateClassSummaryFlow = ai.defineFlow(
  {
    name: 'generateClassSummaryFlow',
    inputSchema: GenerateClassSummaryInputSchema,
    outputSchema: GenerateClassSummaryOutputSchema,
  },
  async input => {
    // Don't generate if there are no submissions
    if (!input.submissions || input.submissions.length === 0) {
        return { summary: "No submissions available to analyze." };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
