"use client";

import { RippleButton } from "../lib/components/ripple-button";

/**
 * Demo page for RippleButton.
 * Three sections:
 *   1. Hero  — one large button centred in 55vh
 *   2. Variants — small / medium / large in a flex row
 *   3. Context card — settings panel grounding the component in a real UI
 */
export default function RippleButtonDemo() {
  return (
    <div
      style={{
        background: "#050505",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* 1. Hero                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "18px",
          padding: "24px",
        }}
      >
        <RippleButton
          rippleDuration={750}
          rippleScale={3}
          style={{ fontSize: "20px", padding: "20px 64px" }}
        >
          Click anywhere
        </RippleButton>

        <p
          style={{
            margin: 0,
            color: "rgba(255,255,255,0.28)",
            fontSize: "13px",
            letterSpacing: "0.07em",
            textTransform: "lowercase",
          }}
        >
          cursor position tints each ripple
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Variant row                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "0 24px 64px",
          flexWrap: "wrap",
        }}
      >
        {/* Small */}
        <RippleButton style={{ padding: "6px 14px", fontSize: "12px" }}>
          Dismiss
        </RippleButton>

        {/* Medium — default sizing */}
        <RippleButton>Confirm</RippleButton>

        {/* Large */}
        <RippleButton style={{ padding: "12px 28px", fontSize: "15px" }}>
          Save changes
        </RippleButton>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Context card — settings panel                                    */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "0 24px 80px",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "14px",
            padding: "24px",
            maxWidth: "400px",
            width: "100%",
          }}
        >
          {/* Card heading */}
          <h3
            style={{
              margin: "0 0 20px",
              color: "rgba(255,255,255,0.75)",
              fontSize: "14px",
              fontWeight: 500,
              letterSpacing: "0.01em",
            }}
          >
            Display settings
          </h3>

          {/* Static toggle rows — visual rhythm only */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <SettingRow label="Dark mode" enabled />
            <SettingRow label="Reduce motion" enabled={false} />
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "22px",
            }}
          >
            <RippleButton>Save changes</RippleButton>
            <RippleButton
              glowOnHover={false}
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Cancel
            </RippleButton>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingRow — static presentational row for the context card
// ---------------------------------------------------------------------------

function SettingRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "11px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.42)", fontSize: "13px" }}>
        {label}
      </span>

      {/* Pill toggle — purely decorative */}
      <div
        style={{
          width: "34px",
          height: "18px",
          borderRadius: "9px",
          background: enabled
            ? "rgba(255,255,255,0.16)"
            : "rgba(255,255,255,0.06)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "2px",
            ...(enabled ? { right: "2px" } : { left: "2px" }),
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: enabled
              ? "rgba(255,255,255,0.88)"
              : "rgba(255,255,255,0.32)",
          }}
        />
      </div>
    </div>
  );
}
