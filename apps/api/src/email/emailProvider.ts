/** A validated, enriched enquiry ready to be delivered by email. */
export interface EnquiryEmail {
  id: string;
  productId: number;
  productTitle: string;
  name: string;
  email: string;
  message: string;
}

/**
 * The seam between the enquiry service and whatever delivers email.
 * SMTP is one implementation; a transactional API (SES, Resend, …) can
 * replace it without changing the service or the route.
 */
export interface EmailProvider {
  send(email: EnquiryEmail): Promise<void>;
}
