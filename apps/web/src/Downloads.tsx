import { Download } from 'lucide-react';
import { useState } from 'react';
import { apiBase } from './api';
import { Button, ErrorBox } from './ui';
export function DownloadButton({
  path,
  filename,
  label,
}: {
  path: string;
  filename: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <span className="download-control">
      <Button
        secondary
        busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(undefined);
          try {
            const res = await fetch(apiBase + path, {
              credentials: 'include',
              headers: { 'X-Clara-Client': 'web' },
            });
            if (!res.ok) {
              const b = await res
                .json()
                .catch(() => ({ message: 'Não foi possível baixar o arquivo.' }));
              throw new Error(b.message);
            }
            const url = URL.createObjectURL(await res.blob()),
              a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.append(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download size={16} />
        {label}
      </Button>
      <ErrorBox error={error} />
    </span>
  );
}
