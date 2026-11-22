import nodemailer from "nodemailer";
import type { EmailProvider, EnquiryEmail } from "./emailProvider";

export interface SmtpProviderOptions {
  host: string;
  port: number;
  user?: string | undefined;
  pass?: string | undefined;
  from: string;
  to: string;
}

export interface EnquiryMessage {
  subject: string;
  text: string;
  html: string;
}

/**
 * Nodemailer-backed provider. Mailpit captures messages locally; production
 * only needs different SMTP credentials.
 */
export function createSmtpEmailProvider(
  options: SmtpProviderOptions,
): EmailProvider {
  const transporter = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    // Port 465 uses implicit TLS; Mailpit and most local servers use 1025/587.
    secure: options.port === 465,
    auth:
      options.user !== undefined &&
      options.user !== "" &&
      options.pass !== undefined &&
      options.pass !== ""
        ? { user: options.user, pass: options.pass }
        : undefined,
    // Fail fast instead of holding the HTTP request open indefinitely.
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10_000,
  });

  return {
    async send(enquiry) {
      const { subject, text, html } = buildEnquiryMessage(enquiry);

      await transporter.sendMail({
        from: options.from,
        to: options.to,
        subject,
        text,
        html,
      });
    },
  };
}

/**
 * Builds the message body. Kept separate from the transport so it can be
 * unit-tested without an SMTP server.
 */
export function buildEnquiryMessage(enquiry: EnquiryEmail): EnquiryMessage {
  const message = enquiry.message.trim();
  const messageText = message === "" ? "(no message provided)" : message;

  return {
    subject: `New enquiry: ${sanitizeHeader(enquiry.productTitle)}`,
    text: [
      `New enquiry for ${enquiry.productTitle} (product ${enquiry.productId})`,
      "",
      `Name: ${enquiry.name}`,
      `Email: ${enquiry.email}`,
      "",
      "Message:",
      messageText,
      "",
      `Enquiry ID: ${enquiry.id}`,
    ].join("\n"),
    html: [
      "<h2>New enquiry</h2>",
      `<p><strong>Product:</strong> ${escapeHtml(enquiry.productTitle)} (ID: ${enquiry.productId})</p>`,
      `<p><strong>Name:</strong> ${escapeHtml(enquiry.name)}</p>`,
      `<p><strong>Email:</strong> ${escapeHtml(enquiry.email)}</p>`,
      "<p><strong>Message:</strong></p>",
      `<p>${escapeHtml(messageText).replace(/\n/g, "<br>")}</p>`,
      `<p><strong>Enquiry ID:</strong> ${escapeHtml(enquiry.id)}</p>`,
    ].join("\n"),
  };
}

/**
 * Every user-provided value in the HTML body goes through this. Escaping the
 * product title too is defence in depth: it comes from upstream, not from us.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Removes CR/LF so user data cannot inject extra mail headers. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}
