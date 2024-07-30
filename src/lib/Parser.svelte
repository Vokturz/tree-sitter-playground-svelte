<script lang="ts">
  import { onMount } from 'svelte';

  let parser;
  let code = `function example() {
    console.log("Hello, Tree-sitter!");
}`;
  let tree;
  let parsedTree = '';


  function formatTree(treeString: string) {
    const indent = '  ';
    let formatted = '';
    let level = 0;
    let openParenCount = 0;

    for (let i = 0; i < treeString.length; i++) {
      let char = treeString[i];

      if (char === '(') {
        openParenCount++;
        if (openParenCount % 2 === 0) {
          if (i > 0 && treeString[i - 1] !== '(' && treeString[i - 1] !== ' ') {
            formatted += '\n' + indent.repeat(level);
          }
          formatted += char + '\n' + indent.repeat(++level);
        } else {
          formatted += char;
        }
      } else if (char === ')') {
        if (openParenCount % 2 === 0) {
          formatted += '\n' + indent.repeat(--level) + char;
        } else {
          formatted += char;
        }
        openParenCount--;
      } else if (char === ' ' && treeString[i + 1] !== '(' && treeString[i + 1] !== ')') {
        formatted += char + '\n ' + indent.repeat(level);
      } else {
        formatted += char;
      }
    }

    return formatted;
  }


  async function loadParser() {
    const { default: Parser } = await import('web-tree-sitter');
    await Parser.init();
    parser = new Parser();
    const JavaScript = await Parser.Language.load('/tree-sitter-javascript.wasm');
    parser.setLanguage(JavaScript);
  }

  async function parseCode(code: string) {
    tree = parser.parse(code);
    parsedTree = formatTree(tree.rootNode.toString());

    console.log(tree.rootNode)
  }

  onMount(async () => {
    console.log('starting');
    await loadParser();
    await parseCode(code);
  });

  $: if (parser) {
    parseCode(code);
  }

  function handleKeyPress(event) {
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
      <textarea bind:value={code} on:keydown={handleKeyPress}></textarea>
    </div>
    <div class="column">
      <h2>Parsed Syntax Tree</h2>
      <pre>{parsedTree}</pre>
    </div>
  </div>
</main>
