"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { useDisplayName } from "../hooks/useDisplayName";
import { ThemeToggle } from "./ThemeToggle";

interface SettingsRowProps {
  label: string;
  description: string;
  action?: React.ReactNode;
}

function SettingsRow({ label, description, action }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between py-4 border-t border-border first:border-t-0">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EditButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[34px] px-4 rounded-lg bg-secondary text-foreground text-[13px] font-medium border border-border hover:bg-accent transition-colors"
    >
      Edit
    </button>
  );
}

function Toggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? "bg-primary" : "bg-switch-background"
      }`}
    >
      <span
        className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SelectButton({
  value,
  onClick,
}: {
  value: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[34px] px-4 rounded-lg bg-secondary text-foreground text-[13px] font-medium border border-border hover:bg-accent transition-colors min-w-[116px]"
    >
      {value}
    </button>
  );
}

export function SettingsPage() {
  const router = useRouter();
  const { name: displayName, initial: displayInitial } = useDisplayName();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const [theme, setTheme] = useState("System");

  return (
    <div className="min-h-screen h-screen flex bg-background text-foreground overflow-hidden">
      <AppSidebar
        variant="home"
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
        currentSessionTitle={null}
        isSessionActive={false}
        onNewSession={() => router.push("/")}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        <div className="w-full max-w-[1200px] mx-auto px-14 pt-10 pb-16">
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2">
            Account, learning preferences, and voice teaching options.
          </p>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-[920px]">
            {/* Profile card - full width */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-primary text-[22px] font-semibold shrink-0">
                  {displayInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-foreground">
                    {displayName || "User"}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    user@email.com · Free plan
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/settings/account")}
                  className="h-[34px] px-4 rounded-lg bg-card text-foreground text-[13px] font-medium border border-border hover:bg-accent transition-colors"
                >
                  Manage account
                </button>
              </div>
            </div>

            {/* Learning profile card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => router.push("/settings/learning")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push("/settings/learning");
                }
              }}
              className="bg-card border border-border rounded-2xl overflow-hidden text-left hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="px-5 pt-5 pb-4">
                <p className="text-[15px] font-semibold text-foreground">
                  Learning profile
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Based on your onboarding choices.
                </p>
              </div>
              <div className="px-5 pb-5">
                <SettingsRow
                  label="Level"
                  description="University"
                  action={<EditButton />}
                />
                <SettingsRow
                  label="Focus topics"
                  description="Calculus, Geometry, Statistics"
                  action={<EditButton />}
                />
                <SettingsRow
                  label="Goal"
                  description="Deep understanding"
                  action={<EditButton />}
                />
                <SettingsRow
                  label="Learning style"
                  description="Visual + step-by-step"
                  action={<EditButton />}
                />
              </div>
            </div>

            {/* Appearance card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <p className="text-[15px] font-semibold text-foreground">
                  Appearance
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  How mathlon looks on your device.
                </p>
              </div>
              <div className="px-5">
                <SettingsRow
                  label="Theme"
                  description="Light, dark, or system"
                  action={
                    <SelectButton
                      value={theme}
                      onClick={() => {
                        const themes = ["System", "Light", "Dark"];
                        const idx = themes.indexOf(theme);
                        setTheme(themes[(idx + 1) % themes.length]);
                      }}
                    />
                  }
                />
              </div>
            </div>

            {/* Voice & teaching card */}
            <button
              type="button"
              onClick={() => router.push("/settings/voice")}
              className="bg-card border border-border rounded-2xl overflow-hidden text-left hover:bg-accent/50 transition-colors"
            >
              <div className="px-5 pt-5 pb-4">
                <p className="text-[15px] font-semibold text-foreground">
                  Voice & teaching
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Controls for live math sessions.
                </p>
              </div>
              <div className="px-5 pb-5">
                <div className="flex items-center justify-between py-4 border-t border-border first:border-t-0">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Voice sessions
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      Hold space to talk with Mathlon
                    </p>
                  </div>
                  <div className="bg-primary h-6 w-11 rounded-full relative">
                    <span className="absolute right-0.5 top-0.5 block h-5 w-5 rounded-full bg-white shadow-lg" />
                  </div>
                </div>
              </div>
            </button>

            {/* Account card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 pt-5 pb-2">
                <p className="text-[15px] font-semibold text-foreground">
                  Account
                </p>
              </div>
              <div className="px-5">
                <button
                  type="button"
                  onClick={() => router.push("/settings/billing")}
                  className="group w-full flex items-center justify-between gap-4 border border-transparent px-4 py-4 text-left transition-all duration-200 hover:border-border/70 hover:bg-accent/40 hover:shadow-sm hover:-translate-y-0.5"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Billing & plans
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-snug">
                      Upgrade to Pro for unlimited sessions
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-primary transition-transform duration-200 group-hover:translate-x-0.5">
                    Manage →
                  </span>
                </button>
                <div className="flex items-center justify-between py-3 border-t border-border">
                  <p className="text-sm font-medium text-foreground">
                    Sign out
                  </p>
                  <button
                    type="button"
                    onClick={() => setSignOutOpen(true)}
                    className="text-sm font-medium text-destructive hover:underline"
                  >
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign out confirmation modal */}
      {signOutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="bg-white rounded-2xl shadow-[0px_24px_60px_rgba(3,2,19,0.28)] w-[420px] overflow-hidden relative">
            <button
              type="button"
              onClick={() => setSignOutOpen(false)}
              className="absolute right-4 top-4 w-[30px] h-[30px] rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                Sign out of Mathlon?
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Your saved sessions and learning profile will stay available
                when you sign back in.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSignOutOpen(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setSignOutOpen(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium bg-[#d4183d] text-white hover:bg-[#b91c3a] transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
