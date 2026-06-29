import { Node, mergeAttributes, CommandProps } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface CollapsibleBlockOptions {
  HTMLAttributes: Record<string, string | number | boolean | null | undefined>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapsibleBlock: {
      /**
       * Toggle a collapsible block
       */
      toggleCollapsibleBlock: () => ReturnType;
    };
  }
}

export const CollapsibleBlock = Node.create<CollapsibleBlockOptions>({
  name: 'collapsibleBlock',
  group: 'block',
  content: 'collapsibleSummary collapsibleContent',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'group my-2',
      },
    };
  },

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (element: HTMLElement) => element.hasAttribute('open'),
        renderHTML: (attributes: Record<string, string | number | boolean | null | undefined>) => {
          if (attributes.open) {
            return { open: '' };
          }
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'details',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string | number | boolean | null | undefined> }) {
    return ['details', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleCollapsibleBlock:
        () =>
        ({ state, chain }: CommandProps) => {
          const { $from } = state.selection;
          
          // Check if selection is already inside a collapsible block
          let isInside = false;
          let depth = $from.depth;
          while (depth > 0) {
            if ($from.node(depth).type.name === 'collapsibleBlock') {
              isInside = true;
              break;
            }
            depth--;
          }

          if (isInside) {
            // Lift nodes out of the details wrapper
            return chain().lift('collapsibleBlock').run();
          }

          // Insert a new collapsible block at the selection
          return chain()
            .insertContent({
              type: this.name,
              content: [
                {
                  type: 'collapsibleSummary',
                  content: [{ type: 'paragraph', content: [] }],
                },
                {
                  type: 'collapsibleContent',
                  content: [{ type: 'paragraph', content: [] }],
                },
              ],
            })
            .focus()
            .run();
        },
    };
  },
});

export const CollapsibleSummary = Node.create({
  name: 'collapsibleSummary',
  group: 'block',
  content: 'paragraph',
  defining: true,
  selectable: false,

  parseHTML() {
    return [
      {
        tag: 'summary',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string | number | boolean | null | undefined> }) {
    return [
      'summary',
      mergeAttributes(HTMLAttributes, {
        class: 'flex items-center gap-2 cursor-pointer font-medium hover:bg-muted/50 px-2 py-1.5 rounded-md transition-colors duration-200 text-foreground list-none font-bengali [&::-webkit-details-marker]:hidden',
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleSummaryView);
  },
});

function CollapsibleSummaryView() {
  return (
    <NodeViewWrapper
      as="summary"
      className="flex items-center gap-2 cursor-pointer font-medium hover:bg-muted/50 px-2 py-1.5 rounded-md transition-colors duration-200 text-foreground list-none font-bengali [&::-webkit-details-marker]:hidden"
    >
      <ChevronRight className="w-4 h-4 transition-transform duration-200 group-open:rotate-90 shrink-0" />
      <NodeViewContent className="inline-block flex-1 focus:outline-none" />
    </NodeViewWrapper>
  );
}

export const CollapsibleContent = Node.create({
  name: 'collapsibleContent',
  group: 'block',
  content: 'block+',
  defining: true,
  selectable: false,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="content"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string | number | boolean | null | undefined> }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'content',
        class: 'border-l-2 border-border/50 ml-[11px] pl-4 mt-1 text-muted-foreground font-bengali',
      }),
      0,
    ];
  },
});
