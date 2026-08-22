<template>
  <!--
    `<main>` rather than a bare `<div>`: without a landmark, assistive tech has no
    way to jump past the chrome to the content, and every page using this layout
    (all of `/auth/**`) had no landmark structure at all.

    The skip link is visually hidden until focused — the first tab stop on the page.
  -->
  <div class="min-h-screen">
    <a
      href="#main-content"
      class="bg-default text-default focus:ring-primary sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:ring-2"
    >
      Zum Inhalt springen
    </a>
    <main id="main-content" class="flex min-h-screen items-center justify-center">
      <slot></slot>
    </main>
  </div>
</template>
