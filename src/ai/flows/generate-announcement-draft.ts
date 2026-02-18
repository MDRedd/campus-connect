'use server';
/**
 * @fileOverview This file defines a Genkit flow to generate a professional announcement draft from bullet points.
 *
 * - generateAnnouncementDraft - A function that crafts a professional announcement.
 * - GenerateAnnouncementDraftInput - The input type for the function.
 * - GenerateAnnouncementDraftOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAnnouncementDraftInputSchema = z.object({
  keyPoints: z.string().describe("The main points to include in the announcement."),
  targetAudience: z.enum(['all', 'students', 'faculty']).describe("The intended audience."),
});
export type GenerateAnnouncementDraftInput = z.infer<typeof GenerateAnnouncementDraftInputSchema>;

const GenerateAnnouncementDraftOutputSchema = z.object({
  title: z.string().describe('A catchy and relevant title for the announcement.'),
  description: z.string().describe('The full, professionally written announcement text.'),
});
export type GenerateAnnouncementDraftOutput = z.infer<typeof GenerateAnnouncementDraftOutputSchema>;

export async function generateAnnouncementDraft(input: GenerateAnnouncementDraftInput): Promise<GenerateAnnouncementDraftOutput> {
  return generateAnnouncementDraftFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAnnouncementDraftPrompt',
  input: {schema: GenerateAnnouncementDraftInputSchema},
  output: {schema: GenerateAnnouncementDraftOutputSchema},
  prompt: `You are a professional communications officer for a university.

Given the following key points and target audience, write a professional and clear announcement.

Target Audience: {{{targetAudience}}}
Key Points: {{{keyPoints}}}

The announcement should be welcoming, informative, and concise. Provide a suitable title and the full description.`,
});

const generateAnnouncementDraftFlow = ai.defineFlow(
  {
    name: 'generateAnnouncementDraftFlow',
    inputSchema: GenerateAnnouncementDraftInputSchema,
    outputSchema: GenerateAnnouncementDraftOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
