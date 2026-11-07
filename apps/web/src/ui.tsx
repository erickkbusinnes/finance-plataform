import { ArrowUpRight, Landmark, LoaderCircle, X } from 'lucide-react';
import type { FormEvent, ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon" aria-hidden="true">
        c<span />
      </span>
      clara
      <span className="brand-dot" aria-hidden="true">
        .
      </span>
    </span>
  );
}
export function Button({
  children,
  busy = false,
  secondary = false,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; secondary?: boolean }) {
  return (
    <button
      className={`button ${secondary ? 'secondary' : ''} ${className}`}
      {...props}
      disabled={busy || props.disabled}
    >
      {busy ? <LoaderCircle size={17} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="input-wrap">
        {isValidElement(children)
          ? cloneElement(children as ReactElement<{ id: string; 'aria-describedby'?: string }>, {
              id,
              'aria-describedby': hint ? id + '-hint' : undefined,
            })
          : children}
      </span>
      {hint && <small id={id + '-hint'}>{hint}</small>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.target === e.currentTarget &&
          (e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom)
        )
          onClose();
      }}
    >
      <header>
        <h2 id={id}>{title}</h2>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}>
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Landmark size={27} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Form({
  children,
  onSave,
  submit = 'Salvar',
  onSuccess,
}: {
  children?: ReactNode;
  onSave: (data: FormData) => Promise<unknown>;
  submit?: string;
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(new FormData(e.currentTarget));
      onSuccess?.();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="form">
      <ErrorBox error={error} />
      {children}
      <Button type="submit" busy={busy}>
        {submit}
        <ArrowUpRight size={17} />
      </Button>
    </form>
  );
}
export function Status({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="status">
      {children}
    </p>
  );
}
