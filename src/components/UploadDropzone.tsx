import { useRef, useState, type DragEvent } from 'react';
import { cx } from './ui';

export function UploadDropzone({
  onFiles,
  busy,
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cx(
        'rounded-xl border-2 border-dashed p-10 text-center transition-colors',
        dragging ? 'border-violet-400 bg-violet-500/5' : 'border-ink-700 bg-ink-900/40',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".zip,.html,.htm"
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = '';
        }}
      />

      <p className="text-base font-medium text-ink-100">
        {busy ? 'Reading your export…' : 'Drop your Instagram export here'}
      </p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-ink-400">
        Drop the ZIP, or unzip it and drop the two HTML files:{' '}
        <code className="text-ink-300">followers</code> and{' '}
        <code className="text-ink-300">following</code>.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-5 inline-flex items-center rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-60"
      >
        Choose files
      </button>
    </div>
  );
}
