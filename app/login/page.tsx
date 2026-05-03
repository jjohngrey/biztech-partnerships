import { signInWithGoogle } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; redirectedFrom?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  domain:
    "Your Google account isn't in the BizTech Workspace. Sign in with your @ubcbiztech.com account.",
  "dev-auth-disabled": "Local development sign-in is not enabled.",
  "domain-email":
    "That Google account's email isn't an @ubcbiztech.com address. Sign in with your BizTech Workspace account.",
  "domain-hd":
    "You're signed in with an @ubcbiztech.com address, but Google didn't report it as part of the BizTech Workspace. This usually means the account is a Gmail with a custom address rather than a real Workspace user. Check the server log for details.",
  oauth: "Something went wrong completing sign-in. Please try again.",
  "profile-sync":
    "You signed in, but we couldn't link your account to the CRM user directory. Ask an admin to check the BizTech Directors list.",
  unknown: "Something went wrong. Please try again.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const message = error
    ? ERROR_MESSAGES[error] ?? decodeURIComponent(error)
    : null;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#0d0d0f] p-6 text-zinc-100">
      <div className="w-full max-w-sm rounded-md border border-white/[0.09] bg-[#111113] p-6">
        <h1 className="text-[17px] font-medium text-white">
          BizTech Partnerships
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-zinc-500">
          Sign in with your @ubcbiztech.com Google account to continue.
        </p>

        {message ? (
          <div className="mt-5 rounded-md border border-red-400/20 bg-red-400/10 p-3 text-[13px] text-red-200">
            {message}
          </div>
        ) : null}

        <form action={signInWithGoogle} className="mt-5">
          <button
            type="submit"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-zinc-700 px-4 text-[13px] font-medium text-white transition hover:bg-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 cursor-pointer">
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
