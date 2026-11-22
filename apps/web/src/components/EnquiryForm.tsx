import { useState } from "react";
import type { FormEvent } from "react";
import { enquirySchema } from "@catalogue/shared";
import { useCreateEnquiry } from "../hooks/useCatalogue";

interface FieldErrors {
  name?: string;
  email?: string;
  message?: string;
}

interface EnquiryFormProps {
  productId: number;
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  textarea?: boolean;
  maxLength?: number;
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  textarea = false,
  maxLength,
}: FieldProps) {
  const describedBy = error === undefined ? undefined : `${id}-error`;
  const inputClass = [
    "w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2",
    error === undefined
      ? "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
      : "border-red-400 focus:border-red-500 focus:ring-red-500",
  ].join(" ");

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          maxLength={maxLength}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy}
          className={inputClass}
        />
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function EnquiryForm({ productId }: EnquiryFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useCreateEnquiry();

  if (mutation.isSuccess) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        {mutation.data?.message ?? "Thank you — we'll be in touch shortly."}
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = enquirySchema.safeParse({
      productId,
      name,
      email,
      message,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (field === "name" || field === "email" || field === "message") {
          next[field] ??= issue.message;
        }
      }

      setErrors(next);
      return;
    }

    setErrors({});
    mutation.mutate(parsed.data);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Enquire about this product
      </h2>

      {mutation.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          We couldn&apos;t send your enquiry. Please try again.
        </p>
      )}

      <Field
        id="name"
        label="Name"
        value={name}
        onChange={setName}
        error={errors.name}
        maxLength={100}
      />
      <Field
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        error={errors.email}
        maxLength={254}
      />
      <Field
        id="message"
        label="Message (optional)"
        value={message}
        onChange={setMessage}
        error={errors.message}
        textarea
        maxLength={2000}
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {mutation.isPending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
