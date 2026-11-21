import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { requireStaff, actorOf } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { listUsers } from "@/lib/admin/users";
import { displayPhone } from "@/lib/phone";
import { EmptyState, PageHeader, Pill, ROLE_LABELS, btn, fmtDate } from "@/components/admin/ui";
import { ROLES } from "@/models/User";
import { PageSkeleton } from "@/components/learn/ui";
import { UserSearch } from "@/components/admin/user-search";

export const metadata: Metadata = { title: "Users" };

async function Users({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const me = await requireStaff("/admin/utilisateurs");
  if (!can.manageUsers(actorOf(me))) redirect("/admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const role = typeof sp.role === "string" ? sp.role : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Number(sp.page) || 1;
  const { items, total, pages } = await listUsers({ q, role, status, page });
  const qs = (p: number) => `?${new URLSearchParams({ ...(q && { q }), ...(role && { role }), ...(status && { status }), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`${total} account${total > 1 ? "s" : ""}`}
        actions={
          <Link href="/admin/utilisateurs/nouveau" className={btn.primary}>
            <UserPlus className="size-4" aria-hidden /> Create an account
          </Link>
        }
      />
      <UserSearch q={q} role={role} status={status} roles={ROLES} />

      {items.length === 0 ? (
        <EmptyState>No matching accounts.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/utilisateurs/${u.id}`} className="font-semibold text-brand-deep hover:underline">
                      {u.name} {u.surname}
                    </Link>
                    <span className="block text-xs text-muted-foreground">@{u.username}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.email && <span className="block">{u.email}</span>}
                    {u.phoneE164 && <span className="block">{displayPhone(u.phoneE164)}</span>}
                  </td>
                  <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-3">
                    {!u.active ? <Pill tone="red">Deactivated</Pill> : u.activated ? <Pill tone="green">Active</Pill> : <Pill tone="amber">Not activated</Pill>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && <Link href={qs(page - 1)} className={btn.secondary}>Previous</Link>}
          <span className="text-sm text-muted-foreground">
            Page {page} / {pages}
          </span>
          {page < pages && <Link href={qs(page + 1)} className={btn.secondary}>Next</Link>}
        </nav>
      )}
    </>
  );
}

export default function UsersPage({ searchParams }: PageProps<"/admin/utilisateurs">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}
