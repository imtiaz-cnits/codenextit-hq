import Heading, { HeadingOptions } from '@tiptap/extension-heading';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, ReactNodeViewProps } from '@tiptap/react';
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapsibleHeading: {
      /**
       * Toggle collapse state of the heading under the cursor
       */
      toggleHeadingCollapse: () => ReturnType;
    };
  }
}

export const CollapsibleHeading = Heading.extend<HeadingOptions>({
  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes: Record<string, string | number | boolean | null | undefined>) => {
          if (attributes.collapsed) {
            return {
              'data-collapsed': 'true',
              class: 'heading-collapsed',
            };
          }
          return {};
        },
      },
    };
  },

  addCommands() {
    return {
      toggleHeadingCollapse:
        () =>
        ({ state, commands }: any) => {
          const { $from } = state.selection;
          let headingPos = -1;
          
          state.doc.nodesBetween($from.start(), $from.end(), (node: ProseMirrorNode, pos: number) => {
            if (node.type.name === 'heading') {
              headingPos = pos;
              return false;
            }
          });

          if (headingPos !== -1) {
            const node = state.doc.nodeAt(headingPos);
            if (node) {
              return commands.updateAttributes('heading', {
                collapsed: !node.attrs.collapsed,
              });
            }
          }
          return false;
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(HeadingNodeView);
  },

  addProseMirrorPlugins() {
    const collapsiblePluginKey = new PluginKey('collapsibleHeadings');
    
    return [
      new Plugin({
        key: collapsiblePluginKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            let collapseActive = false;
            let collapseLevel = 0;

            state.doc.descendants((node: ProseMirrorNode, pos: number) => {
              if (node.type.name === 'heading') {
                const level = node.attrs.level as number;
                const isCollapsed = node.attrs.collapsed as boolean;

                if (collapseActive && level <= collapseLevel) {
                  collapseActive = false;
                }

                if (collapseActive) {
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: 'hidden-collapsed-node',
                      style: 'display: none !important;',
                    })
                  );
                }

                if (isCollapsed) {
                  collapseActive = true;
                  collapseLevel = level;
                }
              } else if (collapseActive) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'hidden-collapsed-node',
                    style: 'display: none !important;',
                  })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

function HeadingNodeView(props: ReactNodeViewProps) {
  const { node, updateAttributes } = props;
  const level = node.attrs.level as number;
  const isCollapsed = node.attrs.collapsed as boolean;

  const HeadingTag = `h${level}` as React.ElementType;

  const toggleCollapse = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateAttributes({ collapsed: !isCollapsed });
  };

  return (
    <NodeViewWrapper className="group relative flex items-center gap-2 my-1">
      <button
        onClick={toggleCollapse}
        contentEditable={false}
        className="absolute -left-6 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-150 text-muted-foreground z-10 shrink-0"
        title={isCollapsed ? 'Expand section' : 'Collapse section'}
      >
        <ChevronRight className={`w-4 h-4 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`} />
      </button>

      <HeadingTag className="flex-1 focus:outline-none font-sans font-semibold">
        <NodeViewContent className="inline" />
      </HeadingTag>
    </NodeViewWrapper>
  );
}
