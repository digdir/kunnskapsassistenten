// The rule for the secondary panel's tools, kept with the shell that draws them so a host of the
// shell does not take the builder's catalogue along. The builder reads it from here.

/** How the secondary panel offers its tools: a heading for one, tabs for two, a dropdown after. */
export type ToolMode = 'none' | 'heading' | 'tabs' | 'dropdown';

export const toolMode = (count: number): ToolMode =>
  count <= 0 ? 'none' : count === 1 ? 'heading' : count === 2 ? 'tabs' : 'dropdown';
