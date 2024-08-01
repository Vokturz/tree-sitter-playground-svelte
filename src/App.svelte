<script>
  import Parser from './lib/Parser.svelte'
  import treeSitterLogo from './assets/tree-sitter-small.png'
</script>

<style>
.header {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo {
  margin-right: 15px;
}

.logo img {
  height: 100px; /* Adjust the height as needed */
  width: auto;
}
</style>

<main>

  <div class="header">
    <div class="logo">
      <img src={treeSitterLogo} alt="Tree Sitter Logo" />
    </div>
    <h1>Tree-sitter Playground</h1>
  </div>
  <div>
    <Parser />
  </div>

</main>
