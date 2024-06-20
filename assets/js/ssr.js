import { createInertiaApp } from "@inertiajs/svelte";

export function render(page) {
  return createInertiaApp({
    page,
    resolve: async (name) => await import(`./pages/${name}.svelte`),
    setup({ el, App }) {
      new App({ target: el, hydrate: true });
    },
  });
}
