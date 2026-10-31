<script>
  import { ChevronRight } from 'lucide-svelte';
  export let user;
</script>

<div class="card flex items-center gap-2 pl-4 text-left">
  <img class="rounded-l-lg" src={user.avatar} alt="" />
  <ChevronRight class="ml-auto group-hover:translate-x-1" />
  <input type="email" bind:value={user.email} />
</div>

<style>
  .card {
    margin-left: 8px;
    padding: 0 26px 0 20px;
  }
  .badge {
    left: 50%;
    transform: translateX(-50%);
    padding-left: env(safe-area-inset-left);
  }
</style>
