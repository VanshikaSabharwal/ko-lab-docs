---
sidebar_position: 3
title: Testing
---

# Frontend testing

See [Testing](../getting-started/testing.md) for setup and conventions. This
page covers what is specific to UI.

## Component tests

Seven files under `apps/web/__tests__/components/`, weighted toward the call
UI: `CallUI`, `CallProvider`, `CallComponents`, `CallResponsiveness`,
`TrashPanel`, `ImagePreview`, `LargeFileViewer`.

```bash
cd apps/web
npx vitest run __tests__/components
```

## Patterns

### Query the way a user perceives the UI

```tsx
// Good — survives a style refactor
screen.getByRole("button", { name: /accept call/i });
screen.getByTitle(/Group selection/);

// Fragile
container.querySelector(".btn-primary");
```

### Provider-dependent components

Wrap in the same providers the app uses, or the component throws:

```tsx
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <SessionProvider session={{ user: { id: "u1" }, expires: "" }}>
      {ui}
    </SessionProvider>,
  );
}
```

### Responsiveness

`CallResponsiveness.test.tsx` drives layout by stubbing viewport width:

```tsx
function setViewport(width: number) {
  vi.stubGlobal("innerWidth", width);
  window.dispatchEvent(new Event("resize"));
}

it("stacks tiles on mobile", () => {
  setViewport(375);
  render(<CallGrid participants={two} />);
  // assert the stacked layout
});
```

## What component tests cannot reach

Be honest about the boundary — these need [manual
checks](../getting-started/testing.md#manual-testing):

- Canvas drag, marquee selection, group-drag on React Flow
- Live cursors and presence across two clients
- Real camera, microphone and screen share
- CodeMirror editing, syntax highlighting, lint gutters
- Visual contrast in dark **and** light mode

## Manual checklist

Before shipping UI work:

1. Both themes — the app defaults to dark; light mode is where contrast bugs
   hide
2. 320 px, 768 px, 1440 px
3. Keyboard-only navigation with a visible focus ring
4. Empty, loading and error states, not just the happy path
5. Two windows for anything collaborative
