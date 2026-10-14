"use client";
import { useActionState } from "react";

type Result = { ok: boolean; msg: string } | null;

/** A form bound to a server action, showing the action's result message. */
export function ActionForm({
  action,
  children,
  submit,
  className = "stack",
  confirm: confirmText,
  danger,
  small,
}: {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  children?: React.ReactNode;
  submit: string;
  className?: string;
  confirm?: string;
  danger?: boolean;
  small?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
      <button className={`btn ${small ? "btn-sm" : ""} ${danger ? "btn-ghost" : ""}`} style={danger ? { color: "var(--err)" } : undefined} disabled={pending}>
        {pending ? "…" : submit}
      </button>
      {state && (
        <span className={`small ${state.ok ? "" : "error-text"}`} role="status" style={state.ok ? { color: "var(--ok)" } : undefined}>
          {state.msg}
        </span>
      )}
    </form>
  );
}
