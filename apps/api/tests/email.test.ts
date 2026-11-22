import nodemailer from "nodemailer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail })),
  },
}));

import {
  buildEnquiryMessage,
  createSmtpEmailProvider,
  escapeHtml,
} from "../src/email/smtpProvider";

const enquiry = {
  id: "enq_123",
  productId: 4,
  productTitle: "WD 2TB Elements Portable External Hard Drive",
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Is it in stock?",
};

beforeEach(() => {
  sendMail.mockReset();
  sendMail.mockResolvedValue({ messageId: "test" });
  vi.mocked(nodemailer.createTransport).mockClear();
});

describe("buildEnquiryMessage", () => {
  it("puts the product and contact details in the subject and body", () => {
    const message = buildEnquiryMessage(enquiry);

    expect(message.subject).toBe(
      "New enquiry: WD 2TB Elements Portable External Hard Drive",
    );
    expect(message.text).toContain("product 4");
    expect(message.text).toContain("Ada Lovelace");
    expect(message.text).toContain("ada@example.com");
    expect(message.text).toContain("Is it in stock?");
    expect(message.text).toContain("enq_123");
  });

  it("escapes user-provided values in the HTML body", () => {
    const message = buildEnquiryMessage({
      ...enquiry,
      name: '<script>alert("x")</script>',
      message: "Fish & chips <b>please</b>",
      productTitle: "Drive <2TB>",
    });

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("&amp;");
    expect(message.html).toContain("&lt;b&gt;");
    expect(message.html).toContain("Drive &lt;2TB&gt;");
  });

  it("keeps the plain-text body readable", () => {
    const message = buildEnquiryMessage({
      ...enquiry,
      name: "Ada <script>",
      message: "Line one\nLine two & more",
    });

    expect(message.text).toContain("Ada <script>");
    expect(message.text).toContain("Line one\nLine two & more");
  });

  it("strips newlines from the subject so headers cannot be injected", () => {
    const message = buildEnquiryMessage({
      ...enquiry,
      productTitle: "Drive\r\nBcc: attacker@example.com",
    });

    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.subject).toBe(
      "New enquiry: Drive Bcc: attacker@example.com",
    );
  });

  it("marks an omitted message clearly", () => {
    const message = buildEnquiryMessage({ ...enquiry, message: "" });

    expect(message.text).toContain("(no message provided)");
    expect(message.html).toContain("(no message provided)");
  });
});

describe("escapeHtml", () => {
  it("escapes all HTML-significant characters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});

describe("createSmtpEmailProvider", () => {
  const options = {
    host: "localhost",
    port: 1025,
    from: "sales@productcatalogue.local",
    to: "sales-inbox@productcatalogue.local",
  };

  it("sends the built message through nodemailer", async () => {
    const provider = createSmtpEmailProvider(options);

    await provider.send(enquiry);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: options.from,
      to: options.to,
      subject: "New enquiry: WD 2TB Elements Portable External Hard Drive",
      text: expect.stringContaining("Ada Lovelace"),
      html: expect.stringContaining("Ada Lovelace"),
    });
  });

  it("omits auth when credentials are empty", () => {
    createSmtpEmailProvider({ ...options, user: "", pass: "" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "localhost", port: 1025, auth: undefined }),
    );
  });

  it("passes credentials when they are configured", () => {
    createSmtpEmailProvider({ ...options, user: "user", pass: "secret" });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: "user", pass: "secret" } }),
    );
  });

  it("propagates transport failures to the caller", async () => {
    sendMail.mockRejectedValueOnce(new Error("smtp down"));
    const provider = createSmtpEmailProvider(options);

    await expect(provider.send(enquiry)).rejects.toThrow("smtp down");
  });
});
