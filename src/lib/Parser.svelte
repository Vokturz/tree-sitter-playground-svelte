<script lang="ts">
  import { onMount } from 'svelte';
  import Parser from 'web-tree-sitter';
  import type { SyntaxNode } from 'web-tree-sitter';
  import { formatTree } from './utils';


  let parser: Parser;
  let code = `function example() {
    console.log("Hello, Tree-sitter!");
}`;
  let rootNode: SyntaxNode ;
  let parsedTree = '';

  let languages = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'rust', label: 'Rust' },
    { value: 'sql', label: 'SQL' },
  ];

  let selectedLanguage = languages[0].value;

  let errorMessage = '';

  async function loadParser() {
    const { default: Parser } = await import('web-tree-sitter');
    await Parser.init();
    parser = new Parser();
   
  }

  async function loadLanguage(language: string = 'javascript') {
    try {
      const Language = await Parser.Language.load(`/tree-sitter-${language}.wasm`);
      parser.setLanguage(Language);
      errorMessage = '';
      await parseCode(code);
    } catch (error: any) {
      errorMessage = 'Language not supported';
      console.error(error);
      parsedTree = ''; 
    }
  }


  async function parseCode(code: string) {
    const tree = await parser.parse(code);
    rootNode = tree.rootNode
    parsedTree = formatTree(rootNode);

  }

  onMount(async () => {
    await loadParser();
    await loadLanguage(selectedLanguage);
  });

  $: if (selectedLanguage && parser) {
    loadLanguage(selectedLanguage);
  } 

  $: if (code && parser) {
    parseCode(code);
  }

  function handleKeyPress(event: any) {
  const textarea = event.target;
  const { selectionStart, selectionEnd, value } = textarea;

  if (event.key === 'Enter') {
    const beforeCursor = value.substring(0, selectionStart);
    const afterCursor = value.substring(selectionEnd);
    const lastChar = beforeCursor[beforeCursor.length - 1];

    // Calculate the current indentation level
    const lines = beforeCursor.split('\n');
    let currentIndentLevel = 0;
    for (let line of lines) {
      currentIndentLevel += (line.match(/{/g) || []).length;
      currentIndentLevel -= (line.match(/}/g) || []).length;
    }

    // Get the current line's indentation
    const currentLine = lines[lines.length - 1];
    const currentIndent = currentLine.match(/^\s*/)[0];

    // Generate the new indentation string
    const indent = '  ';
    let newIndent = '\n' + currentIndent;

    if (lastChar === '{' || lastChar === ':') {
      newIndent += indent;
    }

    // Prevent default enter behavior and insert the new line with the correct indentation
    event.preventDefault();
    const newValue = beforeCursor + newIndent + afterCursor;
    textarea.value = newValue;
    textarea.setSelectionRange(selectionStart + newIndent.length, selectionStart + newIndent.length);

    // Update the bound code variable
    code = newValue;
  }
}


</script>

<style>
  .container {
    display: flex;
    flex-direction: row;
    gap: 20px;
    padding: 20px;
    height: 50vh;
  }
  .column {
    flex-grow: 1;
    padding: 10px;
    display: flex;
    flex-direction: column;
    width: 100vh;
  }
  textarea {
    flex-grow: 1;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }
  pre {
    flex-grow: 1;
    background: #f4f4f4;
    padding: 10px;
    border: 1px solid #ddd;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: auto;
    text-align: left;
  }
  h1, h2 {
    text-align: center;
  }
</style>

<main>
  <h1>Tree-sitter</h1>
  
  <div class="container">
    <div class="column">
      <h2>Input Code</h2>
      <p>Language:
        <select bind:value={selectedLanguage}>
          {#each languages as language }
          <option value={language.value}>{language.label}</option>
          {/each}
        </select></p>

      <textarea bind:value={code} on:keydown={handleKeyPress}></textarea>
    </div>
    <div class="column">
      
      <h2>Parsed Syntax Tree</h2>
      {#if errorMessage}
      <p style="color: red;">{errorMessage}</p>
      {:else}
      <pre>{parsedTree}</pre>
      {/if}
    </div>
  </div>
</main>
