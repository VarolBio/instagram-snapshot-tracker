import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li';
}) {
  return (
    <Tag className={cx('rounded-xl border border-ink-800 bg-ink-900/60 backdrop-blur', className)}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-ink-200 uppercase">{children}</h2>
      {hint ? <p className="text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
};

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-violet-500 text-white hover:bg-violet-400 disabled:bg-violet-500/40',
  ghost: 'border border-ink-700 text-ink-200 hover:border-ink-600 hover:text-ink-50',
  subtle: 'bg-ink-800 text-ink-200 hover:bg-ink-700',
  danger: 'border border-rose-500/50 text-rose-300 hover:bg-rose-500/10',
};

export function Button({ variant = 'ghost', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
        'disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100',
        'placeholder:text-ink-500 focus:border-violet-500 focus:outline-none',
        className,
      )}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      className={cx(
        'rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100',
        'focus:border-violet-500 focus:outline-none',
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-violet-500"
      />
      {label}
    </label>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="p-10 text-center">
      <h3 className="text-base font-semibold text-ink-100">{title}</h3>
      {children ? <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">{children}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'violet' | 'emerald' | 'amber' | 'sky';
  onClick?: () => void;
}) {
  const accents = {
    violet: 'text-violet-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    sky: 'text-sky-300',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Card
      className={cx(
        'p-4 text-left transition-colors',
        onClick && 'hover:border-ink-600 cursor-pointer',
      )}
    >
      <Tag onClick={onClick} className="block w-full text-left">
        <p className="text-xs font-medium tracking-wide text-ink-400 uppercase">{label}</p>
        <p className={cx('mt-1 text-2xl font-semibold', accent ? accents[accent] : 'text-ink-50')}>
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
      </Tag>
    </Card>
  );
}

export function Callout({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'warning' | 'danger' | 'good';
  title?: ReactNode;
  children: ReactNode;
}) {
  const tones = {
    neutral: 'border-ink-700 bg-ink-900/60 text-ink-300',
    good: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-100',
    danger: 'border-rose-500/30 bg-rose-500/5 text-rose-100',
  };
  return (
    <div className={cx('rounded-lg border px-4 py-3 text-sm', tones[tone])}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="[&_a]:underline">{children}</div>
    </div>
  );
}
