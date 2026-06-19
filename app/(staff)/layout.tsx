import { cookies } from "next/headers";
import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { SidebarProvider } from "../../components/ui/sidebar";
import { StaffSidebar } from "../../components/layout/StaffSidebar";
import { StaffHeader } from "../../components/layout/StaffHeader";
import { StaffGuard } from "../../components/layout/StaffGuard";

// Server-side auth checker to fetch active user session/profile
async function getServerUser() {
  try {
    const cookieStore = await cookies();
    // Locate the Supabase auth token cookie if present
    const authCookie = cookieStore.getAll().find((c) => c.name.includes("auth-token"));
    if (!authCookie) return null;

    const sessionData = JSON.parse(authCookie.value);
    const accessToken = sessionData?.access_token;
    if (!accessToken) return null;

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) return null;

    const [{ data: profile }, { data: rolesData }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("user_roles" as any).select("role").eq("user_id", user.id) as any,
    ]);

    const roles: string[] = (rolesData || []).map((r: any) => r.role as string);

    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.email?.split("@")[0] || "User",
      avatar_url: profile?.avatar_url || null,
      designation: profile?.designation || null,
      role: roles[0] || "staff",
      isStaff: roles.some((r: string) => r !== "client"),
    };
  } catch (e) {
    console.error("Server-side auth failed:", e);
    return null;
  }
}

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  return (
    <StaffGuard>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <StaffSidebar serverUser={user} />
          <div className="flex flex-1 flex-col min-w-0">
            <StaffHeader serverUser={user} />
            <main className="flex-1 overflow-x-hidden">
              <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </StaffGuard>
  );
}
