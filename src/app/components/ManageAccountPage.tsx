'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from './AppSidebar';
import { useDisplayName } from '../hooks/useDisplayName';

export function ManageAccountPage() {
  const router = useRouter();
  const { name: displayName, initial: displayInitial } = useDisplayName();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const [name, setName] = useState(displayName || 'Somtochukwu');
  const [email, setEmail] = useState('somtochukwu@email.com');

  return (
    <div className="min-h-screen h-screen flex bg-background text-foreground overflow-hidden">
      <AppSidebar
        variant="home"
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
        currentSessionTitle={null}
        isSessionActive={false}
        onNewSession={() => router.push('/')}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        <div className="w-full max-w-[1200px] mx-auto px-14 pt-10 pb-16">
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
            Manage account
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2">
            Basic account details. Learning preferences stay in your learning profile.
          </p>

          <div className="mt-8 max-w-[600px]">
            {/* Account identity card */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="mb-5">
                <p className="text-[15px] font-semibold text-foreground">
                  Account identity
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Used for login, billing, and account recovery.
                </p>
              </div>

              <div className="space-y-5">
                {/* Display name */}
                <div className="space-y-2">
                  <label htmlFor="display-name" className="text-sm font-medium text-foreground">
                    Display name
                  </label>
                  <input
                    id="display-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  />
                </div>

                {/* Email address */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <input
                    id="password"
                    type="text"
                    value="Last changed recently"
                    readOnly
                    className="w-full h-11 px-4 rounded-xl bg-secondary border border-border text-muted-foreground text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-border">
                <button
                  type="button"
                  onClick={() => router.push('/settings')}
                  className="h-10 px-5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/settings')}
                  className="h-10 px-5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
