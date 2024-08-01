import type { SyntaxNode, Point } from 'web-tree-sitter';

export type FormatTree = {id: number, startPosition: Point, endPosition: Point, prefix: string, name: string, suffix: string}

export function formatTree(node: SyntaxNode, indent: string = '', childId = 0): Array<FormatTree> {

    let result = [{
      id: node.id,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      prefix: node.parent?.fieldNameForChild(childId) ? indent + node.parent.fieldNameForChild(childId) + ': ' : indent,
      name: node.type,
      suffix: ` [${node.startPosition.row}, ${node.startPosition.column}] - [${node.endPosition.row}, ${node.endPosition.column}]`
    }];
  
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.isNamed) {
        result = result.concat(formatTree(child, indent + '  ', i));
      }
    }
  
    return result;
  }
  