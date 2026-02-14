'use server';

/**
 * @fileOverview An AI agent that suggests answers to student helpdesk tickets.
 *
 * - suggestHelpdeskResponse - A function that suggests a response to a student's issue.
 * - SuggestHelpdeskResponseInput - The input type for the suggestHelpdeskResponse function.
 * - SuggestHelpdeskResponseOutput - The return type for the suggestHelpdeskResponse function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestHelpdeskResponseInputSchema = z.object({
  issueDescription: z
    .string()
    .describe('The detailed description of the student\'s issue.'),
});
export type SuggestHelpdeskResponseInput = z.infer<typeof SuggestHelpdeskResponseInputSchema>;

const SuggestHelpdeskResponseOutputSchema = z.object({
  suggestedResponse: z.string().describe('The AI-generated suggested response to the student.'),
});
export type SuggestHelpdeskResponseOutput = z.infer<typeof SuggestHelpdeskResponseOutputSchema>;

export async function suggestHelpdeskResponse(
  input: SuggestHelpdeskResponseInput
): Promise<SuggestHelpdeskResponseOutput> {
  return suggestHelpdeskResponseFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestHelpdeskResponsePrompt',
  input: {schema: SuggestHelpdeskResponseInputSchema},
  output: {schema: SuggestHelpdeskResponseOutputSchema},
  prompt: `You are an AI assistant for the DigiCampus helpdesk. Your goal is to provide immediate, helpful answers to common student questions based on their issue description.

  Keep your answers concise and actionable.

  Here are some common problems and their solutions:
  - Password Reset: "You can reset your password on the Settings page. If you are unable to log in, please contact administration directly."
  - Cannot Find Course: "Please ensure you are enrolled in the course via the Course Catalog. If you are enrolled and it's still not showing up, contact your faculty advisor."
  - Incorrect Attendance: "You can request an attendance correction. Go to the Attendance page, find the course, view your history, and click 'Request Correction' for the specific date."
  - Fee Payment Issue: "You can view and pay fees on the Fees page. For payment processing issues, please contact the finance department."
  - Technical Issue / Bug: "Thank you for reporting this. Please provide as much detail as possible, including what you were doing, what you expected to happen, and what actually happened. Our technical team will investigate."

  Now, based on the following student issue, provide a helpful suggestion. If the issue doesn't match a common problem, provide a general response acknowledging their issue and assuring them a support team member will look into it.

  Student's Issue: {{{issueDescription}}}`,
});

const suggestHelpdeskResponseFlow = ai.defineFlow(
  {
    name: 'suggestHelpdeskResponseFlow',
    inputSchema: SuggestHelpdeskResponseInputSchema,
    outputSchema: SuggestHelpdeskResponseOutputSchema,
  },
  async input => {
    // Don't respond to very short queries.
    if (input.issueDescription.length < 15) {
      return { suggestedResponse: '' };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
