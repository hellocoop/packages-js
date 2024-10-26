<script lang="ts">
    import { useAuth } from "../auth.js"
    import type { Readable } from "svelte/store"
    
    const isLoggedIn = (): Readable<boolean> | boolean => useAuth()?.isLoggedIn || false
  </script>
  
  {#if !isLoggedIn()}
    <slot/>
  {/if}