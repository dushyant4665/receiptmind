import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TeamPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <h2 className="text-[15px] font-medium text-text-primary">Team members</h2>
        <div className="mt-4 space-y-3">
          {[
            ["Arjun Kumar", "Admin"],
            ["Sarah Reid", "Editor"],
            ["Marcus Johnson", "Viewer"],
          ].map(([name, role]) => (
            <div key={name} className="flex items-center justify-between rounded-[8px] border border-border-subtle bg-bg-page px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-text-primary">{name}</p>
                <p className="text-[12px] text-text-muted">{role}</p>
              </div>
              <Button variant="ghost">Manage</Button>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[12px] border border-border-default bg-bg-surface p-5">
        <h2 className="text-[15px] font-medium text-text-primary">Invite teammate</h2>
        <form className="mt-4 space-y-4">
          <div>
            <Label htmlFor="inviteEmail" className="mb-1.5 text-[12px] font-medium text-text-secondary">Email</Label>
            <Input id="inviteEmail" type="email" />
          </div>
          <div>
            <Label htmlFor="role" className="mb-1.5 text-[12px] font-medium text-text-secondary">Role</Label>
            <select id="role" className="h-9 w-full rounded-[8px] border border-border-default bg-bg-surface px-3 text-[13px] text-text-primary outline-none transition-[border-color] hover:border-border-strong focus:border-text-primary">
              <option>Admin</option>
              <option>Editor</option>
              <option>Viewer</option>
            </select>
          </div>
          <Button variant="amber" className="w-full">Send invite</Button>
        </form>
      </section>
    </div>
  );
}
