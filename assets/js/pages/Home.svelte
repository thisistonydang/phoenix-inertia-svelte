<script lang="ts">
  import Fa from "svelte-fa";
  import { faHeart } from "@fortawesome/free-solid-svg-icons";

  import Link from "$lib/components/Link.svelte";

  export let name: string;

  let count = 0;
</script>

<div class="space-y-3">
  <h1 class="flex items-center gap-1 font-bold">
    Hello from {name}!
    <Fa class="text-red-500" icon={faHeart} />
  </h1>

  <p>
    This page is a <Link href="https://svelte.dev/">Svelte</Link> component, server rendered with
    <Link href="https://github.com/inertiajs/inertia-phoenix">inertia-phoenix</Link>
    and hydrated on the client with the
    <Link href="https://inertiajs.com/client-side-setup">@inertiajs/svelte</Link> library.
  </p>

  <p>
    Try disabling JS and reloading the page. You will see that the HTML is indeed rendered from the
    server, and the button below will not work since it requires JavaScript.
  </p>

  <button class="btn" on:click={() => count++}>
    Clicked: {count}
  </button>
</div>
