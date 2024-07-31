export function formatTree(treeString: string) {
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