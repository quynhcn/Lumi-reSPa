'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, User } from 'lucide-react';
import { getRedirectPath } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { LoginForm } from '@/components/login-form';
import { AuthHeading } from '@/components/auth-card';
import { cn } from '@/lib/utils';

interface LoginDialogProps {
  className?: string;
  mobile?: boolean;
  iconOnly?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function LoginDialog({ className, mobile = false, iconOnly = false, onClick }: LoginDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            iconOnly
              ? 'rounded-full p-2 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground'
              : mobile
                ? 'text-left'
                : 'flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary',
            className
          )}
          title="Tài khoản & Đăng nhập"
        >
          {iconOnly ? (
            <User className="h-5 w-5" />
          ) : (
            <>
              {!mobile && <Mail className="h-4 w-4" />}
              Đăng nhập
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[440px] rounded-2xl px-8 py-9 shadow-[0_24px_80px_hsl(var(--brand)_/_20%)]">
        <DialogHeader className="items-center text-center">
          <AuthHeading />
          <DialogTitle className="page-title mt-1">Chào mừng trở lại</DialogTitle>
          <DialogDescription>Đăng nhập để xem và quản lý lịch hẹn của bạn.</DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {open && (
            <LoginForm
              idPrefix="login-dialog"
              autoFocus
              onSuccess={(role) => {
                setOpen(false);
                router.push(getRedirectPath(role));
              }}
            />
          )}
        </div>

        <p className="mt-2 text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link href="/signup" onClick={() => setOpen(false)} className="font-semibold text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
