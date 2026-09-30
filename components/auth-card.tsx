import Link from 'next/link';
import Image from 'next/image';

/** Brand mark shown above every auth form (page and dialog). */
export function AuthHeading() {
  return (
    <div className="mb-4 flex items-center justify-center">
      <Image
        src="/logo-ngang.png"
        alt="Lumière Spa"
        width={160}
        height={62}
        className="h-12 sm:h-14 w-auto object-contain"
        priority
      />
    </div>
  );
}

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Full-page wrapper for /sign-in and /signup, visually identical to the login dialog. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="card-base px-8 py-9 shadow-[0_24px_80px_hsl(var(--brand)_/_12%)]">
          <div className="mb-6 flex flex-col items-center text-center">
            <Link href="/" aria-label="Về trang chủ" className="flex flex-col items-center">
              <AuthHeading />
            </Link>
            <h1 className="page-title mt-1">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
        {footer && <p className="mt-5 text-center text-sm text-muted-foreground">{footer}</p>}
      </div>
    </div>
  );
}
