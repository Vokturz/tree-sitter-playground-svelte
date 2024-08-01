<script lang="ts">
  import { onMount } from 'svelte';
  import Parser from 'web-tree-sitter';
  import type { SyntaxNode, Point } from 'web-tree-sitter';
  import { formatTree, type FormatTree } from './utils';


  let parser: Parser;
  let code = `function example() {
  console.log("Hello, Tree-sitter!");
}`;
  let rootNode: SyntaxNode ;
  let parsedTree: FormatTree[] = [];

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
      parsedTree = []; 
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

  if (event.key === 'Tab') {
      // Prevent the default action (tabbing out of the textarea)
      event.preventDefault();
      const beforeCursor = value.substring(0, selectionStart);
      const afterCursor = value.substring(selectionEnd);
      const newValue = beforeCursor + '  ' + afterCursor;
      textarea.value = newValue;
      textarea.setSelectionRange(selectionStart + 2, selectionStart + 2);
  }

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

let lastClickedButton: any = null;

function handleButtonClick(event: any, item: FormatTree) {

  if (lastClickedButton) {
      lastClickedButton.style.color = '';
      lastClickedButton.style.backgroundColor = '';
      lastClickedButton.style.fontWeight = '';
    }

    const button = event.target;
    button.style.color = '#af02ff';
    button.style.backgroundColor = '#f0f0f0';
    button.style.fontWeight = 'bold'
    console.log(item.node);

    lastClickedButton = button;

    const start = getCharacterIndexFromPosition(item.node.startPosition);
    const end = getCharacterIndexFromPosition(item.node.endPosition);

    console.log(code.substring(start, end));
}

function getCharacterIndexFromPosition(position: Point) {
  const { row, column } = position;
  const lines = code.split('\n');
  let charIndex = 0;

  for (let i = 0; i < row; i++) {
    charIndex += lines[i].length + 1; // +1 for the newline character
  }

  charIndex += column;
  return charIndex;
}
</script>

<main>
  <h1>Tree-sitter Playground</h1>
  <p>Language:
    <select bind:value={selectedLanguage}>
      {#each languages as language }
      <option value={language.value}>{language.label}</option>
      {/each}
    </select></p>
  <div class="container">
    <div class="column">
      <h2>Input Code</h2>


      <textarea bind:value={code} on:keydown={handleKeyPress}></textarea>
    </div>
    <div class="column">
      
      <h2>Parsed Syntax Tree</h2>
      {#if errorMessage}
      <p style="color: red;">{errorMessage}</p>
      {:else}
      <pre>
        {#each parsedTree as item}
          <div>{item.prefix}<button class="hover no-border" on:click={(event)=> handleButtonClick(event, item)}>{item.name}</button>{item.suffix}</div>
        {/each}
      </pre>
      {/if}
    </div>
  </div>
</main>
