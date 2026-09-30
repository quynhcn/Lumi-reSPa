import { Loader2 } from 'lucide-react';

export function PageLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  return (
    <div className={fullScreen ? 'flex min-h-screen items-center justify-center bg-background' : 'flex items-center justify-center py-20'}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Đang tải" />
    </div>
  );
}
