import type { ReactNode } from 'react';
import { ApiError } from './api.ts';

export type FieldErrors = Record<string, string[]>;

type FieldProps = { label: string; htmlFor: string; errors?: string[]; children: ReactNode };

export function Field({ label, htmlFor, errors, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {errors?.map((message) => <p key={message} className="field-error">{message}</p>)}
    </div>
  );
}

// Splits an API failure into per-field messages and one line for the top of the form.
export function describeError(err: unknown): { fields: FieldErrors; message: string } {
  const fields = err instanceof ApiError ? err.details : {};
  const message = Object.keys(fields).length ? 'Check the highlighted fields.' : (err as Error).message;
  return { fields, message };
}
