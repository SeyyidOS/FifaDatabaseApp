import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/cn";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-loss">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input h-11", className)} {...props} />;
}

export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input type={shown ? "text" : "password"} className={cn("input h-11 pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-faint hover:text-fg"
        aria-label={shown ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-muted select-none">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className={cn(
          "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
          checked ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface-2",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  );
}
