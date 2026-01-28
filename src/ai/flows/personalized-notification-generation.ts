'use server';

/**
 * @fileOverview Personalized notification generation for students.
 *
 * - generatePersonalizedNotification - A function that generates personalized notifications.
 * - PersonalizedNotificationInput - The input type for the generatePersonalizedNotification function.
 * - PersonalizedNotificationOutput - The return type for the generatePersonalizedNotification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedNotificationInputSchema = z.object({
  studentId: z.string().describe('The ID of the student.'),
  updateType: z.enum(['assignmentDeadline', 'examSchedule']).describe('The type of academic update.'),
  details: z.string().describe('Detailed information about the update.'),
});
export type PersonalizedNotificationInput = z.infer<typeof PersonalizedNotificationInputSchema>;

const PersonalizedNotificationOutputSchema = z.object({
  notificationMessage: z.string().describe('The personalized notification message for the student.'),
});
export type PersonalizedNotificationOutput = z.infer<typeof PersonalizedNotificationOutputSchema>;

export async function generatePersonalizedNotification(
  input: PersonalizedNotificationInput
): Promise<PersonalizedNotificationOutput> {
  return personalizedNotificationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedNotificationPrompt',
  input: {schema: PersonalizedNotificationInputSchema},
  output: {schema: PersonalizedNotificationOutputSchema},
  prompt: `You are an AI assistant designed to generate personalized notifications for students regarding academic updates.

  Given the student ID, update type, and details, create a concise and engaging notification message.

  Student ID: {{{studentId}}}
  Update Type: {{{updateType}}}
  Details: {{{details}}}

  Notification Message:`,
});

const personalizedNotificationFlow = ai.defineFlow(
  {
    name: 'personalizedNotificationFlow',
    inputSchema: PersonalizedNotificationInputSchema,
    outputSchema: PersonalizedNotificationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
