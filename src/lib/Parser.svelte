<script lang="ts">
  import { onMount, tick , onDestroy} from 'svelte';
  import Parser from 'web-tree-sitter';
  import type { SyntaxNode, Point } from 'web-tree-sitter';
  import { escapeHtml, formatTree, type FormatTree } from './utils';
  import rangy from 'rangy'
  import 'rangy/lib/rangy-core'
  import 'rangy/lib/rangy-textrange'
  
  // Optionally, import a mode for syntax highlighting:
  // import 'codemirror/mode/javascript/javascript.js';
  import { EditorState } from '@codemirror/state';
  import { javascript } from '@codemirror/lang-javascript';
  import { EditorView, lineNumbers } from '@codemirror/view';
  import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
  import { keymap } from '@codemirror/view';

  import { StateEffect, StateField, RangeSetBuilder } from "@codemirror/state";
  import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view";

  // Define a state effect to apply highlighting


  // State field that tracks highlighted ranges
  const highlightEffect = StateEffect.define<{ start: number; end: number; color?: string }[]>();

  const highlightField = StateField.define({
    create() {
      return Decoration.none;
    },
    update(highlights, tr) {
      let builder = new RangeSetBuilder();
      let newNodeHighlight = null;
      let queryHighlights: any[] = [];

      for (let effect of tr.effects) {
        if (effect.is(highlightEffect)) {
          for (const { start, end, color } of effect.value) {
            if (color) {
              // Store query highlights separately
              queryHighlights.push({ start, end, deco: Decoration.mark({ class: `highlighted-text-${color}` }) });
            } else {
              // Only keep the latest node highlight
              newNodeHighlight = { start, end, deco: Decoration.mark({ class: "clicked-node-highlight" }) };
            }
          }
        }
      }

      // **Ensure only ONE node highlight exists at a time**
      if (newNodeHighlight) {
        builder.add(newNodeHighlight.start, newNodeHighlight.end, newNodeHighlight.deco);
      }

      // **Keep query highlights persistent**
      for (let { start, end, deco } of queryHighlights) {
        builder.add(start, end, deco);
      }

      return builder.finish();
    },
    provide: (f) => EditorView.decorations.from(f),
  });

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
    { value: 'dart', label: 'Dart' },
  ];

  let selectedLanguage = languages[1].value;
  let hideNoNamed = true
  let hideErrors = false
  let errorMessage = '';
  let currentLanguage: any;

  // NEW: query variable to hold the query text
  let query = '';
  let queryHighlightRanges: Array<{ start: number; end: number }> = [];

  // Remove or deprecate the old 'div' variable if it's only used for the old code box.
  // Instead, introduce a variable for CodeMirror's container:
  let editorContainer: HTMLDivElement;
  let editorView: EditorView;

  let queryEditorContainer: HTMLDivElement;
  let queryEditor: EditorView;
  

  async function loadParser() {
    const { default: Parser } = await import('web-tree-sitter');
    await Parser.init();
    parser = new Parser();
   
  }

  async function loadLanguage(language: string = 'javascript') {
    try {
      const Language = await Parser.Language.load(`/tree-sitter-${language}.wasm`);
      parser.setLanguage(Language);
      currentLanguage = Language;
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

  // NEW: Function to handle executing the query
  let queryResults: any[] = [];
  const captureRegex = /@\s*([\w\._-]+)/g;
  let captureColors = new Map<string, string>();
  const predefinedColors = ["red", "blue", "green", "orange", "purple", "brown", "pink"];

  let queryTimeout: NodeJS.Timeout;

  function executeQuery() {
      if (!currentLanguage || !rootNode) {
          console.error("Language or parse tree not available");
          return;
      }

      clearTimeout(queryTimeout);
      queryTimeout = setTimeout(() => {
          try {
              const treeQuery = currentLanguage.query(query);
              const matches = treeQuery.matches(rootNode);

              queryHighlightRanges = [];
              let colorIndex = 0;
              const assignedColors = new Map();

              for (const match of matches) {
                  for (const capture of match.captures) {
                      const start = getCharacterIndexFromPosition(capture.node.startPosition);
                      const end = getCharacterIndexFromPosition(capture.node.endPosition);

                      if (!assignedColors.has(capture.name)) {
                          assignedColors.set(capture.name, predefinedColors[colorIndex % predefinedColors.length]);
                          colorIndex++;
                      }

                      const color = assignedColors.get(capture.name);
                      queryHighlightRanges.push({ start, end, color });
                  }
              }

              updateQueryHighlighting();
              updateQueryEditor(); // Update highlighting in the query editor as well
          } catch (e) {
              console.error("Query error:", e);
          }
      }, 200);
  }


  function updateCaptureColors(query: string) {
      captureColors.clear(); // Reset previous color assignments

      const seenCaptures = new Set<string>();
      let match;
      let colorIndex = 0;  // Track order of first appearance

      while ((match = captureRegex.exec(query)) !== null) {
          const captureName = match[1];

          if (!seenCaptures.has(captureName)) {
              seenCaptures.add(captureName);

              if (!captureColors.has(captureName)) {
                  captureColors.set(
                      captureName,
                      predefinedColors[colorIndex % predefinedColors.length]
                  );
                  colorIndex++;
              }
          }
      }

      // Update query box highlights
      updateQueryEditor();
  }
  function updateQueryEditor() {
      let effects = [];
      let seenPositions = new Set<number>(); // Track positions to avoid duplicate highlights

      [...query.matchAll(captureRegex)].forEach(match => {
          let captureName = match[1];
          let color = captureColors.get(captureName) || "black";

          // Find the correct `start` position by ensuring it hasn't been used before
          let start = query.indexOf(match[0]);
          while (seenPositions.has(start)) {
              start = query.indexOf(match[0], start + 1); // Find next occurrence
          }
          seenPositions.add(start);

          let end = start + match[0].length;

          if (start >= 0 && start < end) { // Ensure valid range
              effects.push(highlightEffect.of([{ start, end, color }]));
          } else {
              console.warn(`Skipping invalid query range: start(${start}) > end(${end})`);
          }
      });

      // **Sort by `start` before applying to avoid CodeMirror errors**
      effects.sort((a, b) => a.start - b.start);

      // Apply sorted highlights to the query editor
      queryEditor.dispatch({
          effects: effects
      });
  }

  function updateQueryHighlighting() {
    
    queryHighlightRanges.sort((a, b) => a.start - b.start);

    let effects = [
      ...queryHighlightRanges.map(({ start, end, color }) => ({
        start, end, color
      }))
    ];

    editorView.dispatch({
      effects: [
        highlightEffect.of([
          ...effects,
          ...[{ start: range.start, end: range.end }] // Preserve the currently clicked node highlight
        ])
      ]
    });
  }

  onMount(async () => {
    await loadParser();
    await loadLanguage(selectedLanguage);
    await tick(); // Ensure Svelte has assigned the container before using it

    // Create an EditorState with the current code as the document.
    const state = EditorState.create({
      doc: code,
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]), // Basic keybindings
        history(), // Undo/redo support
        javascript(), // Language support
        highlightField,  // Add highlight tracking
        lineNumbers(), // Enable line numbers 
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            code = update.state.doc.toString();
          }
        })
      ]
    });

    // Create and mount the CodeMirror editor.
    editorView = new EditorView({
      state,
      parent: editorContainer
    });

    editorView.focus(); // Ensure it accepts input

    queryEditor = new EditorView({
        state: EditorState.create({
            doc: query, // Initial query text
            extensions: [
                keymap.of([...defaultKeymap, ...historyKeymap]),
                lineNumbers(),
                highlightField, // Enable query highlighting
                EditorView.updateListener.of(update => {
                    if (update.docChanged) {
                        query = update.state.doc.toString();
                        updateCaptureColors(query);
                        executeQuery(); // Update highlights in both editors
                    }
                })
            ]
        }),
        parent: queryEditorContainer // Mount the query editor
    });
  });

  onDestroy(() => {
    if (editorView) {
      editorView.destroy();
    }
  });


  $: if (selectedLanguage && parser) {
    loadLanguage(selectedLanguage);
  } 


  $: if (code && parser) {
    parseCode(code);
  }

  $: (async () => {
    if (code !== prevCode) {
      prevCode = code;
      // Clear any previous highlights when code changes
      queryHighlightRanges = [];
      handleContentChange();
    }
    let sel = rangy.getSelection();
    let savedSel = sel.saveCharacterRanges(div);

    // If there are query highlights, render them
    if (queryHighlightRanges.length > 0) {
      // Sort ranges by their starting index
      const sortedRanges = queryHighlightRanges.slice().sort((a, b) => a.start - b.start);
      let highlightedHtml = "";
      let lastIndex = 0;
      // Loop through each range and wrap the matching text
      for (const range of sortedRanges) {
        highlightedHtml += escapeHtml(code.substring(lastIndex, range.start));
        const toHighlight = escapeHtml(code.substring(range.start, range.end));
        highlightedHtml += `<span style="background-color: yellow;">${toHighlight}</span>`;
        lastIndex = range.end;
      }
      highlightedHtml += escapeHtml(code.substring(lastIndex));
      html = highlightedHtml;
    } else if (range.start !== 0 || range.end !== 0) {
      // fallback: if a single range is set (from button click), use it
      let toHighlight = escapeHtml(code.substring(range.start, range.end));
      if (lastItem?.name === 'ERROR') {
        toHighlight = `<a href=# style="color: red;">${toHighlight}</a>`;
      } else {
        toHighlight = `<a href=#>${toHighlight}</a>`;
      }
      html = escapeHtml(code.substring(0, range.start)) + toHighlight + escapeHtml(code.substring(range.end));
    } else {
      // No highlights, just show the plain code
      html = escapeHtml(code);
    }
    await tick();
    sel.restoreCharacterRanges(div, savedSel);
  })();

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
  let lastClickedItem: FormatTree | null = null;

  let highlightDecoration = Decoration.mark({ class: "highlighted-text" });
  let highlightRanges = [];

  function handleButtonClick(event: any, item: FormatTree) {
      // If the same node is clicked again, toggle it off (remove highlight & bold)
      if (lastClickedItem === item) {
          if (lastClickedButton) {
              lastClickedButton.style.color = "";
              lastClickedButton.style.backgroundColor = "";
              lastClickedButton.style.fontWeight = "";
          }

          lastClickedItem = null;
          lastClickedButton = null;

          // Clear highlight in the code editor
          updateClickedNodeHighlight(0, 0);
          return;
      }

      // Clear previous selection
      if (lastClickedButton) {
          lastClickedButton.style.color = "";
          lastClickedButton.style.backgroundColor = "";
          lastClickedButton.style.fontWeight = "";
      }

      // Apply bold styling to the clicked node
      const button = event.target;
      button.style.color = "black"; // Keep it readable
      button.style.backgroundColor = "#f0f0f0";
      button.style.fontWeight = "bold";

      lastClickedButton = button;
      lastClickedItem = item;

      // Get character index from Tree-Sitter node position
      range.start = getCharacterIndexFromPosition(item.startPosition);
      range.end = getCharacterIndexFromPosition(item.endPosition);

      // Apply highlight in the code editor
      updateClickedNodeHighlight(range.start, range.end);
  }

  function updateClickedNodeHighlight(start: number, end: number) {
  editorView.dispatch({
    effects: [
      highlightEffect.of([
        ...queryHighlightRanges.map(({ start, end, color }) => ({ start, end, color })), // Keep existing query highlights
        { start, end } // Apply new node highlight (removes old node highlight)
      ])
    ]
  });
}

  function updateHighlight(start: number, end: number) {
    editorView.dispatch({
      effects: [
        highlightEffect.of({ start, end }) // This replaces previous highlights
      ]
    });
  }

  function updateHighlighting() {
    editorView.dispatch({
      effects: [
        highlightEffect.of(
          queryHighlightRanges.map(({ start, end, color }) => ({
            start,
            end,
            color,
          }))
        ),
      ],
    });
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

<!--
<style>
  .editor-container {
      height: 300px;
      border: 1px solid #ccc;
      display: flex;
      align-items: flex-start;  /* Ensures alignment to the top */
      justify-content: flex-start; /* Aligns text to the left */
    }

    .container {
      display: flex;
      justify-content: space-between; /* Instead of center */
      align-items: flex-start;
    }  
</style>
-->

<main>
  <div class="language-selector">
    <label for="language-dropdown">Language:</label>
    <select
      id="language-dropdown"
      bind:value={selectedLanguage}
      on:change={(e) => selectLanguage(e.target.value)}
    >
      {#each languages as language}
        <option value={language.value}>{language.label}</option>
      {/each}
    </select>
  </div>
  <div class="container">
    <div class="column">
      <div class="header-container">
        <h2>Input Code</h2>
      </div>
      <!-- New CodeMirror container -->
      <div class="editor-container" bind:this={editorContainer}></div>
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
      <!-- Query Box Section -->
      <div class="query-box" style="margin-top: 20px;">
        <h2>Query</h2>
        <div class="editor-container" bind:this={queryEditorContainer}></div>
      </div>
    </div>
  </div>
</main>
