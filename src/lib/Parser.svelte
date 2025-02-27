<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Parser from 'web-tree-sitter';
  import type { SyntaxNode, Point } from 'web-tree-sitter';
  import { escapeHtml, formatTree, type FormatTree } from './utils';
  import rangy from 'rangy'
  import 'rangy/lib/rangy-core'
  import 'rangy/lib/rangy-textrange'
  
  let parser: Parser;
  let code = `function example(name) {
  console.log("Hello, " + name + "!");
}`;
  let prevCode = code
  let html: string = '';
  let div: HTMLDivElement
  let rootNode: SyntaxNode ;
  let parsedTree: FormatTree[] = [];
  let range = {
    start: 0,
    end: 0
  }

  let languages = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'tsx', label: 'Typescript (TSX)' },
    { value: 'python', label: 'Python' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'c_sharp', label: 'C#' },
    { value: 'java', label: 'Java' },
    { value: 'sql', label: 'SQL' },
  ];

  let selectedLanguage = languages[1].value;
  let hideNoNamed = true
  let hideErrors = false
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
    try {
      const tree = await parser.parse(code);
      rootNode = tree.rootNode
      parsedTree = formatTree(rootNode, hideNoNamed, hideErrors);
    } catch (error: any) {
      parsedTree = [];
    }
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

  // function handleKeyPress(event: any) {
  //   const textarea = event.target;
  //   const { selectionStart, selectionEnd, value } = textarea;

  //   if (event.key === 'Tab') {
  //       // Prevent the default action (tabbing out of the textarea)
  //       event.preventDefault();
  //       const beforeCursor = value.substring(0, selectionStart);
  //       const afterCursor = value.substring(selectionEnd);
  //       const newValue = beforeCursor + '  ' + afterCursor;
  //       textarea.value = newValue;
  //       textarea.setSelectionRange(selectionStart + 2, selectionStart + 2);
  //   }

  //   if (event.key === 'Enter') {
  //     const beforeCursor = value.substring(0, selectionStart);
  //     const afterCursor = value.substring(selectionEnd);
  //     const lastChar = beforeCursor[beforeCursor.length - 1];

  //     // Calculate the current indentation level
  //     const lines = beforeCursor.split('\n');
  //     let currentIndentLevel = 0;
  //     for (let line of lines) {
  //       currentIndentLevel += (line.match(/{/g) || []).length;
  //       currentIndentLevel -= (line.match(/}/g) || []).length;
  //     }

  //     // Get the current line's indentation
  //     const currentLine = lines[lines.length - 1];
  //     const currentIndent = currentLine.match(/^\s*/)[0];

  //     // Generate the new indentation string
  //     const indent = '  ';
  //     let newIndent = '\n' + currentIndent;

  //     if (lastChar === '{' || lastChar === ':') {
  //       newIndent += indent;
  //     }

  //     // Prevent default enter behavior and insert the new line with the correct indentation
  //     event.preventDefault();
  //     const newValue = beforeCursor + newIndent + afterCursor;
  //     textarea.value = newValue;
  //     textarea.setSelectionRange(selectionStart + newIndent.length, selectionStart + newIndent.length);

  //     // Update the bound code variable
  //     code = newValue;
  //   }
  // }

  let lastClickedButton: any = null;
  let lastItem: FormatTree | null = null;

  function handleButtonClick(event: any, item: FormatTree) {

    if (lastClickedButton) {
        lastClickedButton.style.color = '';
        lastClickedButton.style.backgroundColor = '';
        lastClickedButton.style.fontWeight = '';
      }

    const button = event.target;
    if (item.name === 'ERROR') {
      button.style.color = 'red';
    } else {
      button.style.color = '#af02ff';
    }
    button.style.backgroundColor = '#f0f0f0';
    button.style.fontWeight = 'bold'

    lastClickedButton = button;
    lastItem = item;

    range.start = getCharacterIndexFromPosition(item.startPosition);
    range.end = getCharacterIndexFromPosition(item.endPosition);
  }

  function getCharacterIndexFromPosition(position: Point) {
    const { row, column } = position;
    const lines = prevCode.split('\n');
    let charIndex = 0;

    for (let i = 0; i < row; i++) {
      charIndex += lines[i].length + 1; // +1 for the newline character
    }

    charIndex += column;
    return charIndex;
  }

  $: (async () => {
      if (code !== prevCode) {
        prevCode = code;
        html = code;
        handleContentChange();
      }
      let sel = rangy.getSelection();
      let savedSel = sel.saveCharacterRanges(div);
      let toHighlight = escapeHtml(code.substring(range.start, range.end))
      if (lastItem?.name === 'ERROR') {
        toHighlight = `<a href=# style="color: red;">${toHighlight}</a>`
      } else {
        toHighlight =  `<a href=#>${toHighlight}</a>`
      }
      html = escapeHtml(code.substring(0, range.start)) + toHighlight + escapeHtml(code.substring(range.end));
      await tick();
      sel.restoreCharacterRanges(div, savedSel);
    })();

  function handleContentChange() {
    // const item = parsedTree.find(item => item.startPosition.row === lastItem?.startPosition.row && item.name === lastItem?.name)
    // console.log({lastItem, item})
    // if (item) {
    //   item.startPosition.column +=1 
    //   range.start = getCharacterIndexFromPosition(item.startPosition);
    //   range.end = getCharacterIndexFromPosition(item.endPosition);
    //   lastItem = item
    // } else {
    range.start = 0
    range.end = 0
    if (lastClickedButton) {
      lastClickedButton.style.color = '';
      lastClickedButton.style.backgroundColor = '';
      lastClickedButton.style.fontWeight = '';
    }
    lastItem = null
    lastClickedButton = null
    // }

    // Add your logic here to run when content changes
  }

  function selectLanguage(value: string) {
    if (value !== selectedLanguage) {
      loadParser()
      selectedLanguage = value;
      handleContentChange()
    }
  }

  function handleCheckBoxChange() {
    if (code && parser) {
      parseCode(code);
    }
  }
  
</script>

<main>
  <div class="language-selector">
    <span>Language:</span>
    {#each languages as language, i}
      <button
        class:active={selectedLanguage === language.value}
        on:click={() => selectLanguage(language.value)}
      >
        {language.label}
      </button>
      {#if i < languages.length - 1}
        <span class="separator"> | </span>
      {/if}
    {/each}
  </div>
  <div class="container">
    <div class="column">
      <div class="header-container">
      <h2>Input Code</h2>
      </div>
      <div class="div-textarea"
        contenteditable="plaintext-only"
        bind:this={div}
        bind:innerHTML={html}
        bind:textContent={code}
        >
      </div>
      <!-- <textarea bind:value={code} on:keydown={handleKeyPress}></textarea> -->
    </div>

    <div class="column">
      <div class="header-container">
        <h2>Parsed Syntax Tree</h2>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={hideNoNamed} on:change={handleCheckBoxChange}>
          Hide unnamed nodes
        </label>
        <label class="checkbox-label">
          <input type="checkbox" style="accent-color: red;" bind:checked={hideErrors} on:change={handleCheckBoxChange}>
          Hide errors
        </label>
      </div>
      {#if errorMessage}
        <p style="color: red;">{errorMessage}</p>
      {:else}
        <pre>
          {#each parsedTree as item}
            <div style="font-size: 14px; font-family: monospace;">{item.prefix}<button class="hover no-border" on:click={(event)=> handleButtonClick(event, item)}
              >{#if item.name === 'ERROR'}<span class="error">{item.name}</span>{:else}{item.name}{/if}</button>{item.suffix}</div>
          {/each}
        </pre>
      {/if}
    </div>
  </div>
</main>
