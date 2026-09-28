// Open questions whose views are sub-branches get a side-by-side comparison page.
import { allNodes, type NodeData } from './data';

export const canCompare = (n: NodeData): boolean => n.type === 'question' && n.children.length >= 2;
export const compareNodes = (): NodeData[] => allNodes.filter(canCompare);
