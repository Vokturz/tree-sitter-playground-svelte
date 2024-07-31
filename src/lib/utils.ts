import type { SyntaxNode } from 'web-tree-sitter';

export function formatTree(node: SyntaxNode, indent: string = ''): string {
    let result = `${indent}${node.type} [${node.startPosition.row}, ${node.startPosition.column}] - [${node.endPosition.row}, ${node.endPosition.column}]\n`;
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.isNamed) {
        result += formatTree(child, indent + '  ');
      }
    }
    
    return result;
  }