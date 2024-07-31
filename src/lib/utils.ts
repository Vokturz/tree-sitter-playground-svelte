import type { SyntaxNode } from 'web-tree-sitter';

export type FormatTree = {node: SyntaxNode, prefix: string, name: string, suffix: string}

export function formatTree(node: SyntaxNode, indent: string = ''): Array<FormatTree> {
    let result = [{
      node: node,
      prefix: indent,
      name: node.type,
      suffix: ` [${node.startPosition.row}, ${node.startPosition.column}] - [${node.endPosition.row}, ${node.endPosition.column}]`
    }];
  
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.isNamed) {
        result = result.concat(formatTree(child, indent + '  '));
      }
    }
  
    return result;
  }
  