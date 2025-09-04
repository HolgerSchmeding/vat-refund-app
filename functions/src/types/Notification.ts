/**
 * Notification Types and Interfaces
 * Defines the structure for real-time notifications in the VAT refund application
 */

export interface Notification {
  id?: string;
  userId: string;
  documentId: string;
  invoiceNumber?: string;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  createdAt: FirebaseFirestore.Timestamp;
  readAt?: FirebaseFirestore.Timestamp;
  metadata?: NotificationMetadata;
}

export enum NotificationType {
  STATUS_CHANGE = "status_change",
  VALIDATION_SUCCESS = "validation_success",
  VALIDATION_ERROR = "validation_error",
  SUBMISSION_READY = "submission_ready",
  CORRECTION_REQUEST = "correction_request",
  SUBMISSION_SUCCESS = "submission_success",
  SUBMISSION_ERROR = "submission_error",
  DOCUMENT_PROCESSED = "document_processed",
  SYSTEM_INFO = "system_info"
}

export enum NotificationStatus {
  UNREAD = "unread",
  READ = "read",
  DISMISSED = "dismissed"
}

export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent"
}

export interface NotificationMetadata {
  previousStatus?: string;
  newStatus?: string;
  errorCode?: string;
  errorDetails?: string;
  actionRequired?: boolean;
  actionUrl?: string;
  expiresAt?: FirebaseFirestore.Timestamp;
}

/**
 * Notification Template Configuration
 * Defines message templates for different status changes
 */
export interface NotificationTemplate {
  type: NotificationType;
  priority: NotificationPriority;
  titleTemplate: string;
  messageTemplate: string;
  actionRequired?: boolean;
}

/**
 * Pre-defined notification templates for common status changes
 */
export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  ready_for_submission: {
    type: NotificationType.SUBMISSION_READY,
    priority: NotificationPriority.HIGH,
    titleTemplate: "Dokument bereit zur Einreichung",
    messageTemplate: "Gute Nachrichten! Ihre Rechnung {{invoiceNumber}} wurde erfolgreich validiert und ist bereit zur Einreichung.",
    actionRequired: true,
  },

  validation_error: {
    type: NotificationType.VALIDATION_ERROR,
    priority: NotificationPriority.HIGH,
    titleTemplate: "Validierungsfehler festgestellt",
    messageTemplate: "Handlung erforderlich: Bei Ihrer Rechnung {{invoiceNumber}} wurde ein Problem festgestellt. Bitte überprüfen Sie die Details.",
    actionRequired: true,
  },

  in_correction_address: {
    type: NotificationType.CORRECTION_REQUEST,
    priority: NotificationPriority.MEDIUM,
    titleTemplate: "Korrekturanfrage gesendet",
    messageTemplate: "Eine Korrekturanfrage für die Rechnung {{invoiceNumber}} wurde automatisch gesendet. Sie werden über den Fortschritt informiert.",
    actionRequired: false,
  },

  submitted: {
    type: NotificationType.SUBMISSION_SUCCESS,
    priority: NotificationPriority.MEDIUM,
    titleTemplate: "Erfolgreich eingereicht",
    messageTemplate: "Ihre Rechnung {{invoiceNumber}} wurde erfolgreich beim Finanzamt eingereicht. Sie erhalten Updates über den Bearbeitungsstatus.",
    actionRequired: false,
  },

  validated: {
    type: NotificationType.VALIDATION_SUCCESS,
    priority: NotificationPriority.MEDIUM,
    titleTemplate: "Validierung erfolgreich",
    messageTemplate: "Ihre Rechnung {{invoiceNumber}} wurde erfolgreich validiert. Alle Daten sind korrekt.",
    actionRequired: false,
  },

  document_ai_error: {
    type: NotificationType.VALIDATION_ERROR,
    priority: NotificationPriority.HIGH,
    titleTemplate: "Dokumentverarbeitung fehlgeschlagen",
    messageTemplate: "Die automatische Verarbeitung Ihrer Rechnung {{invoiceNumber}} ist fehlgeschlagen. Bitte kontaktieren Sie den Support.",
    actionRequired: true,
  },

  processing_error: {
    type: NotificationType.VALIDATION_ERROR,
    priority: NotificationPriority.HIGH,
    titleTemplate: "Verarbeitungsfehler",
    messageTemplate: "Bei der Verarbeitung Ihrer Rechnung {{invoiceNumber}} ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
    actionRequired: true,
  },
};

/**
 * Helper function to replace template variables
 */
export function renderNotificationTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return rendered;
}
