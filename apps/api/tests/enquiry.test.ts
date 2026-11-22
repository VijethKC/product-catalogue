import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { EmailProvider, EnquiryEmail } from "../src/email/emailProvider";
import { createFixtureAdapter } from "../src/repositories/fixtureAdapter";
import { products } from "./fixtures/products";

const validEnquiry = {
  productId: 4,
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Is it in stock?",
};

function fakeEmailProvider() {
  const sent: EnquiryEmail[] = [];
  const provider: EmailProvider = {
    async send(email) {
      sent.push(email);
    },
  };

  return { provider, sent };
}

function appWith(provider: EmailProvider) {
  return createApp({
    productRepository: createFixtureAdapter(products),
    emailProvider: provider,
  });
}

function productById(id: number) {
  const product = products.find((item) => item.id === id);

  if (product === undefined) {
    throw new Error(`Missing fixture product ${id}`);
  }

  return product;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/enquiries", () => {
  it("sends the enquiry and returns 201 with an id", async () => {
    const { provider, sent } = fakeEmailProvider();

    const response = await request(appWith(provider))
      .post("/api/enquiries")
      .send(validEnquiry);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.stringMatching(/^enq_[0-9a-f-]{36}$/),
      message: "Thank you — we'll be in touch shortly.",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      id: response.body.id,
      productId: 4,
      productTitle: productById(4).title,
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Is it in stock?",
    });
  });

  it("allows the message to be omitted", async () => {
    const { provider, sent } = fakeEmailProvider();

    const response = await request(appWith(provider))
      .post("/api/enquiries")
      .send({ productId: 4, name: "Ada", email: "ada@example.com" });

    expect(response.status).toBe(201);
    expect(sent[0]?.message).toBe("");
  });

  it("trims submitted values before emailing", async () => {
    const { provider, sent } = fakeEmailProvider();

    await request(appWith(provider))
      .post("/api/enquiries")
      .send({
        productId: 4,
        name: "  Ada  ",
        email: "  ada@example.com  ",
        message: "  hello  ",
      });

    expect(sent[0]).toMatchObject({
      name: "Ada",
      email: "ada@example.com",
      message: "hello",
    });
  });

  it("rejects an enquiry for an unknown product", async () => {
    const { provider, sent } = fakeEmailProvider();

    const response = await request(appWith(provider))
      .post("/api/enquiries")
      .send({ ...validEnquiry, productId: 999 });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    expect(sent).toHaveLength(0);
  });

  it("rejects an invalid payload with field details", async () => {
    const { provider, sent } = fakeEmailProvider();

    const response = await request(appWith(provider))
      .post("/api/enquiries")
      .send({ productId: 4, name: "A", email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(response.body.error.details).toHaveProperty("name");
    expect(response.body.error.details).toHaveProperty("email");
    expect(sent).toHaveLength(0);
  });

  it("rejects a missing product id", async () => {
    const { provider } = fakeEmailProvider();

    const response = await request(appWith(provider))
      .post("/api/enquiries")
      .send({ name: "Ada", email: "ada@example.com" });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toHaveProperty("productId");
  });

  it("rejects a malformed JSON body as a validation error", async () => {
    const { provider } = fakeEmailProvider();

    const response = await request(appWith(provider))
      .post("/api/enquiries")
      .set("Content-Type", "application/json")
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("returns 502 when the email provider fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider: EmailProvider = {
      async send() {
        throw new Error("smtp down");
      },
    };

    const response = await request(appWith(provider))
      .post("/api/enquiries")
      .send(validEnquiry);

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: {
        code: "EMAIL_UNAVAILABLE",
        message: "The enquiry could not be sent. Please try again.",
      },
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});
