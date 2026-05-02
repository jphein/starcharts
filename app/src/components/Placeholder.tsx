interface PlaceholderProps {
  name: string;
  hint?: string;
}

export function Placeholder({ name, hint }: PlaceholderProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--sc-gold)",
            fontWeight: 500,
            marginBottom: 14,
          }}
        >
          starcharts · m0
        </p>
        <h1
          style={{
            fontFamily: "var(--sc-serif)",
            fontSize: "clamp(2rem, 5vw, 3.2rem)",
            fontWeight: "var(--sc-serif-weight)" as never,
            margin: 0,
            color: "var(--sc-fg)",
            lineHeight: 1.05,
          }}
        >
          {name}
        </h1>
        <p
          style={{
            color: "var(--sc-fg-muted)",
            marginTop: 12,
            fontFamily: "var(--sc-serif)",
            fontStyle: "italic",
          }}
        >
          {hint ?? "placeholder — this screen will be built in a later milestone"}
        </p>
      </div>
    </main>
  );
}
