import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import type { CrmUserSummary } from "@/lib/partnerships/types";

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function userSummaryFromRow(row: typeof users.$inferSelect): CrmUserSummary {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    role: row.role,
    team: row.team,
  };
}

export function displayNameFromAuthUser(user: SupabaseAuthUser) {
  const metadata = user.user_metadata ?? {};
  return (
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    user.email?.split("@")[0] ??
    user.email ??
    "there"
  );
}

function splitName(displayName: string, email: string) {
  const fallback = email.split("@")[0] || "User";
  const parts = displayName
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const firstName = parts[0] ?? fallback;
  const lastName = parts.slice(1).join(" ");

  return { firstName, lastName };
}

export async function resolveCrmUserForAuthUser(
  authUser: SupabaseAuthUser,
): Promise<CrmUserSummary> {
  const email = authUser.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Your signed-in account does not have an email address.");
  }

  const [existingById] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (existingById) {
    return userSummaryFromRow(existingById);
  }

  const [existingByEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingByEmail) {
    return userSummaryFromRow(existingByEmail);
  }

  const { firstName, lastName } = splitName(
    displayNameFromAuthUser(authUser),
    email,
  );

  const [created] = await db
    .insert(users)
    .values({
      id: authUser.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role: "member",
      team: "partnerships",
    })
    .returning();

  return userSummaryFromRow(created);
}
