import { useState, useCallback } from "react";
import * as MailComposer from "expo-mail-composer";
import { Platform } from "react-native";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  task_reminder: {
    id: "task_reminder",
    name: "Task Reminder",
    subject: "Reminder: {{taskTitle}}",
    body: `You have a task reminder:\n\nTask: {{taskTitle}}\nDue: {{dueDate}}\nPriority: {{priority}}\n\nComplete this task in Geminio OS.`,
    variables: ["taskTitle", "dueDate", "priority"],
  },
  goal_update: {
    id: "goal_update",
    name: "Goal Update",
    subject: "Goal Progress: {{goalTitle}}",
    body: `Your goal has been updated:\n\nGoal: {{goalTitle}}\nProgress: {{progress}}%\nMilestone: {{milestone}}\n\nKeep up the great work!`,
    variables: ["goalTitle", "progress", "milestone"],
  },
  daily_summary: {
    id: "daily_summary",
    name: "Daily Summary",
    subject: "Your Daily Summary",
    body: `Here's your daily summary:\n\nTasks Completed: {{tasksCompleted}}\nGoals Updated: {{goalsUpdated}}\nNotes Created: {{notesCreated}}\n\nHave a productive day!`,
    variables: ["tasksCompleted", "goalsUpdated", "notesCreated"],
  },
  collaboration_invite: {
    id: "collaboration_invite",
    name: "Collaboration Invite",
    subject: "{{inviterName}} invited you to collaborate",
    body: `{{inviterName}} has invited you to collaborate on:\n\nItem: {{itemTitle}}\nPermission: {{permission}}\n\nAccept the invitation in Geminio OS.`,
    variables: ["inviterName", "itemTitle", "permission"],
  },
};

export function useEmailIntegration() {
  const [isComposerAvailable, setIsComposerAvailable] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Check if email composer is available
  const checkEmailAvailability = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        setIsComposerAvailable(false);
        return false;
      }

      const available = await MailComposer.isAvailableAsync();
      setIsComposerAvailable(available);
      return available;
    } catch (error) {
      console.error("Error checking email availability:", error);
      setIsComposerAvailable(false);
      return false;
    }
  }, []);

  // Send email using template
  const sendEmailFromTemplate = useCallback(
    async (
      templateId: string,
      recipientEmail: string,
      variables: Record<string, string>
    ) => {
      try {
        setIsSending(true);

        const template = EMAIL_TEMPLATES[templateId];
        if (!template) {
          return {
            success: false,
            error: "Template not found",
          };
        }

        // Replace variables in template
        let subject = template.subject;
        let body = template.body;

        Object.entries(variables).forEach(([key, value]) => {
          subject = subject.replace(`{{${key}}}`, value);
          body = body.replace(`{{${key}}}`, value);
        });

        if (Platform.OS === "web") {
          // For web, create mailto link
          const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          window.location.href = mailtoLink;

          return { success: true };
        }

        // For native, use mail composer
        const available = await MailComposer.isAvailableAsync();
        if (!available) {
          return {
            success: false,
            error: "Email not available on this device",
          };
        }

        const result = await MailComposer.composeAsync({
          recipients: [recipientEmail],
          subject,
          body,
          isHtml: false,
        });

        return {
          success: result.status === "sent",
          status: result.status,
        };
      } catch (error) {
        console.error("Send email error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send email",
        };
      } finally {
        setIsSending(false);
      }
    },
    []
  );

  // Send custom email
  const sendCustomEmail = useCallback(
    async (
      recipientEmail: string,
      subject: string,
      body: string,
      attachments?: string[]
    ) => {
      try {
        setIsSending(true);

        if (Platform.OS === "web") {
          const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          window.location.href = mailtoLink;
          return { success: true };
        }

        const available = await MailComposer.isAvailableAsync();
        if (!available) {
          return {
            success: false,
            error: "Email not available on this device",
          };
        }

        const result = await MailComposer.composeAsync({
          recipients: [recipientEmail],
          subject,
          body,
          attachments: attachments || [],
          isHtml: false,
        });

        return {
          success: result.status === "sent",
          status: result.status,
        };
      } catch (error) {
        console.error("Send custom email error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send email",
        };
      } finally {
        setIsSending(false);
      }
    },
    []
  );

  // Send bulk emails
  const sendBulkEmails = useCallback(
    async (
      recipients: string[],
      subject: string,
      body: string
    ) => {
      try {
        setIsSending(true);

        const results = await Promise.all(
          recipients.map((email) =>
            sendCustomEmail(email, subject, body)
          )
        );

        const successCount = results.filter((r) => r.success).length;

        return {
          success: successCount === recipients.length,
          successCount,
          failureCount: recipients.length - successCount,
          results,
        };
      } catch (error) {
        console.error("Bulk send error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Bulk send failed",
        };
      } finally {
        setIsSending(false);
      }
    },
    [sendCustomEmail]
  );

  // Get available templates
  const getTemplates = useCallback(() => {
    return Object.values(EMAIL_TEMPLATES);
  }, []);

  // Create custom template
  const createTemplate = useCallback(
    (
      id: string,
      name: string,
      subject: string,
      body: string,
      variables: string[]
    ) => {
      const template: EmailTemplate = {
        id,
        name,
        subject,
        body,
        variables,
      };

      // In production, save to storage
      return template;
    },
    []
  );

  return {
    isComposerAvailable,
    isSending,
    checkEmailAvailability,
    sendEmailFromTemplate,
    sendCustomEmail,
    sendBulkEmails,
    getTemplates,
    createTemplate,
  };
}
