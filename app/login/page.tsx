import { signInWithGoogle } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; redirectedFrom?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  domain:
    "Your Google account isn't in the BizTech Workspace. Sign in with your @ubcbiztech.com account.",
  "domain-email":
    "That Google account's email isn't an @ubcbiztech.com address. Sign in with your BizTech Workspace account.",
  "domain-hd":
    "You're signed in with an @ubcbiztech.com address, but Google didn't report it as part of the BizTech Workspace. This usually means the account is a Gmail with a custom address rather than a real Workspace user. Check the server log for details.",
  oauth: "Something went wrong completing sign-in. Please try again.",
  unknown: "Something went wrong. Please try again.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const message = error
    ? ERROR_MESSAGES[error] ?? decodeURIComponent(error)
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">
          BizTech Partnerships
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Sign in with your @ubcbiztech.com Google account to continue.
        </p>

        {message ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {message}
          </div>
        ) : null}

        <form action={signInWithGoogle} className="mt-6">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
