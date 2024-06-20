<script lang="ts">
  export let href: string;
</script>

<a
  {href}
  target="_blank"
  rel="noopener noreferrer"
  class="underline underline-offset-2 transition hover:no-underline"
>
  <slot />
</a>
