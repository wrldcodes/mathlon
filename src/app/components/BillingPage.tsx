"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Check,
  X,
  ShieldCheck,
  ArrowRight,
  FileText,
} from "lucide-react";
import { AppSidebar } from "../components/AppSidebar";
import { useDisplayName } from "../hooks/useDisplayName";

const TOP_UP_OPTIONS = [
  {
    id: "30",
    minutes: "+30 minutes",
    description: "A couple of extra sessions",
    price: "$2",
  },
  {
    id: "60",
    minutes: "+60 minutes",
    description: "A full week of extra study",
    price: "$3.50",
    badge: "Best value",
  },
  {
    id: "120",
    minutes: "+120 minutes",
    description: "For exam-season crunch",
    price: "$6",
  },
];

const INVOICES = [
  {
    date: "Jul 1, 2026",
    description: "Beta access · Monthly",
    amount: "$7.00",
  },
  {
    date: "Jun 14, 2026",
    description: "Top-up · +60 minutes",
    amount: "$3.50",
  },
  {
    date: "Jun 1, 2026",
    description: "Beta access · Monthly",
    amount: "$7.00",
  },
  {
    date: "May 1, 2026",
    description: "Beta access · Monthly",
    amount: "$7.00",
  },
];

export function BillingPage() {
  const router = useRouter();
  const { name: displayName, initial: displayInitial } = useDisplayName();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [selectedTopUp, setSelectedTopUp] = useState("60");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const minutesUsed = 9;
  const minutesTotal = 15;
  const minutesLeft = minutesTotal - minutesUsed;
  const usagePercent = (minutesUsed / minutesTotal) * 100;

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
            Billing & plans
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2 max-w-[700px]">
            You have paid Beta access. Every session is voice and canvas working
            together — you get a fresh 15 voice minutes every day, and can top
            up anytime you need more.
          </p>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
            {/* Today's voice usage */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <p className="text-[15px] font-semibold text-foreground">
                Today&apos;s voice usage
              </p>
              <p className="text-[13px] text-muted-foreground mt-1">
                Your daily voice minutes. Resets every day at midnight.
              </p>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-[40px] font-bold text-foreground leading-none tracking-tight">
                  {minutesUsed} / {minutesTotal} min
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1e6bb8]" />
                  Beta
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground mt-1">
                Voice tutoring time used today
              </p>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1e6bb8] to-[#4f8fd9] transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {minutesLeft} minutes left today
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Resets at midnight
                  </p>
                </div>
              </div>

              {/* Info box */}
              <div className="mt-5 p-4 rounded-xl bg-[#f8f6f1] border border-[#ece7dc]">
                <p className="text-[13px] text-[#5f6470] leading-relaxed">
                  When you reach 15 minutes, your sessions pause. Top up more
                  voice minutes to keep going today, or come back tomorrow for a
                  fresh 15.
                </p>
              </div>

              {/* Top up button */}
              <button
                type="button"
                onClick={() => setTopUpOpen(true)}
                className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Top up voice minutes
              </button>
            </div>

            {/* Payment card */}
            <div className="bg-card border border-border rounded-2xl p-6 h-fit">
              <p className="text-[15px] font-semibold text-foreground">
                Payment
              </p>
              <p className="text-[13px] text-muted-foreground mt-1">
                Your card on file for Beta access.
              </p>

              {/* Card */}
              <div className="mt-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Card</p>
                  <p className="text-[13px] text-muted-foreground">
                    Visa •••• 4242
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentOpen(true)}
                  className="text-[13px] font-medium text-foreground hover:underline"
                >
                  Update
                </button>
              </div>

              {/* Next charge */}
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Next charge
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    Aug 1, 2026
                  </p>
                </div>
                <p className="text-[13px] font-medium text-foreground">$7</p>
              </div>

              {/* Billing history */}
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Billing history
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    Invoices & receipts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="text-[13px] font-medium text-foreground hover:underline"
                >
                  View
                </button>
              </div>
            </div>
          </div>

          {/* Your plan card */}
          <div className="mt-5 bg-card border-2 border-foreground rounded-2xl p-8 drop-shadow-[0px_10px_15px_rgba(3,2,19,0.06)]">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-[#1e6bb8] uppercase tracking-wider">
                  Your plan
                </p>
                <h2 className="text-xl font-semibold text-foreground mt-1">
                  Beta access
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-[500px]">
                  Founding pricing while we build toward launch. This rate is
                  locked in for as long as you stay subscribed.
                </p>

                {/* Features */}
                <div className="mt-5 pt-5 border-t border-border flex flex-wrap gap-x-6 gap-y-3">
                  {[
                    "15 voice minutes every day",
                    "Canvas that draws as you talk",
                    "Every step-by-step diagram",
                    "30-day session history",
                    "Top up minutes anytime",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-md bg-[rgba(30,107,184,0.12)] flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-[#1e6bb8]" />
                      </div>
                      <span className="text-[13px] text-foreground">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price + CTA */}
              <div className="flex flex-col items-end gap-3 min-w-[153px]">
                <div className="text-right">
                  <span className="text-[32px] font-bold text-foreground leading-none">
                    $7
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    / month
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="w-full h-11 px-5 rounded-xl text-[13px] font-medium bg-secondary border border-border text-foreground hover:bg-accent transition-colors text-right"
                >
                  Manage or cancel
                </button>
              </div>
            </div>
          </div>

          {/* Thank you note */}
          <p
            className="mt-6 text-[20px] text-[#5f6470]"
            style={{ fontFamily: "var(--font-handwritten)" }}
          >
            Thank you for backing Mathlon this early — this price is yours for
            life.
          </p>
        </div>
      </div>

      {/* Top up modal overlay */}
      {topUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="bg-white rounded-[18px] shadow-[0px_24px_60px_rgba(3,2,19,0.28)] w-[480px] overflow-hidden relative">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setTopUpOpen(false)}
              className="absolute right-[18px] top-[18px] w-[30px] h-[30px] rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Header */}
            <div className="px-[26px] pt-6 pb-1">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                Top up voice minutes
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Extra minutes are used after your daily 15 run out, and
                don&apos;t expire — they stay on your balance until you use
                them.
              </p>
            </div>

            {/* Top-up options */}
            <div className="px-[26px] pt-[18px] pb-5 flex flex-col gap-3">
              {TOP_UP_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedTopUp(option.id)}
                  className={`flex items-center gap-3.5 px-[17px] py-3.5 rounded-[14px] border transition-colors text-left ${
                    selectedTopUp === option.id
                      ? "bg-[#faf9f6] border-foreground shadow-[inset_0px_0px_0px_2px_#030213]"
                      : "bg-card border-border hover:border-foreground/50"
                  }`}
                >
                  {/* Radio */}
                  <div
                    className={`w-[18px] h-[18px] rounded-[9px] border-2 flex items-center justify-center shrink-0 ${
                      selectedTopUp === option.id
                        ? "border-foreground"
                        : "border-[#c7c3ba]"
                    }`}
                  >
                    {selectedTopUp === option.id && (
                      <div className="w-2 h-2 rounded-[4px] bg-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-semibold text-foreground">
                        {option.minutes}
                      </p>
                      {option.badge && (
                        <span className="px-[7px] py-[3px] rounded-md bg-[rgba(30,107,184,0.12)] text-[12.5px] font-bold text-[#717182] uppercase tracking-wider">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>

                  {/* Price */}
                  <p className="text-base font-bold text-foreground shrink-0">
                    {option.price}
                  </p>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-[26px] pb-5 flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-xs text-[#9a9aa6]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Secure checkout via our payment partner
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setTopUpOpen(false)}
                  className="h-11 px-5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setTopUpOpen(false)}
                  className="h-11 px-5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                >
                  Continue to checkout
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing history modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="bg-white rounded-2xl shadow-[0px_24px_60px_rgba(3,2,19,0.28)] w-[480px] max-h-[80vh] overflow-hidden relative flex flex-col">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="absolute right-4 top-4 w-[30px] h-[30px] rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                Billing history
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your Beta invoices and receipts. Download any of them as a PDF.
              </p>
            </div>

            {/* Invoice list */}
            <div className="px-6 flex-1 overflow-y-auto">
              {INVOICES.map((invoice, i) => (
                <div
                  key={`${invoice.date}-${i}`}
                  className={`flex items-center justify-between py-4 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {invoice.date}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {invoice.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-sm font-medium text-foreground">
                      {invoice.amount}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#e8f5e9] text-[11px] font-semibold text-[#2e7d32]">
                      Paid
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <button
                type="button"
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Show full billing history
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="h-9 px-4 rounded-xl text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel plan modal */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="bg-white rounded-2xl shadow-[0px_24px_60px_rgba(3,2,19,0.28)] w-[480px] overflow-hidden relative">
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              className="absolute right-4 top-4 w-[30px] h-[30px] rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                Cancel Beta access?
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                You&apos;ll keep access until the end of your billing period on Aug 1, 2026. After that, your sessions stop.
              </p>
            </div>

            <div className="px-6 py-4">
              <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4">
                <p className="text-sm font-semibold text-[#991b1b] mb-3">
                  If you cancel, you&apos;ll lose:
                </p>
                <div className="space-y-2.5">
                  {[
                    "Your 15 daily voice minutes & the canvas tutor",
                    { text: "Your $7 founding price — ", bold: "it won't come back" },
                    "Any topped-up minutes left on your balance",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-[#fee2e2] flex items-center justify-center shrink-0 mt-0.5">
                        <X className="w-3 h-3 text-[#dc2626]" />
                      </div>
                      <p className="text-sm text-[#991b1b]">
                        {typeof item === 'string' ? item : (
                          <>{item.text}<span className="font-bold">{item.bold}</span></>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
              >
                Cancel anyway
              </button>
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="h-10 px-5 rounded-xl text-sm font-semibold bg-[#18181b] text-white hover:bg-[#27272a] transition-colors"
              >
                Keep my access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update payment method modal */}
      {paymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="bg-white rounded-2xl shadow-[0px_24px_60px_rgba(3,2,19,0.28)] w-[440px] overflow-hidden relative">
            <button
              type="button"
              onClick={() => setPaymentOpen(false)}
              className="absolute right-4 top-4 w-[30px] h-[30px] rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                Update payment method
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                We&apos;ll take you to our secure payment partner to update your
                card. Mathlon never sees or stores your card details.
              </p>
            </div>

            {/* Current card */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 rounded bg-[#1a1f71] flex items-center justify-center">
                    <span className="text-white text-[11px] font-bold italic">
                      VISA
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Visa •••• 4242
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      Expires 08/27
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#f0f0f0] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Current
                </span>
              </div>
            </div>

            {/* Security note */}
            <div className="px-6 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-[#9a9aa6]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Handled by our payment partner
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPaymentOpen(false)}
                className="h-10 px-5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setPaymentOpen(false)}
                className="h-10 px-5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity inline-flex items-center gap-2"
              >
                Continue to payment partner
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
