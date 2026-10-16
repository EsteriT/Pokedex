# Instructions for Codex

- Read README.md and docs/HANDOFF.md first. Use docs/DESIGN.md for current design decisions.
- Authorized frontend scope now includes the landing page, Workspace My binders/My collection, Binder editor, Discover, and the read-only Binder viewer prototypes. Work one page at a time; keep other application pages and backend integration for later requests.
- Preserve the approved appearance and latest interactions unless the user requests changes. This folder contains only the active page files, not earlier drafts.
- Editable HTML entry points are src/index.html, src/workspace.html, and src/editor.html, src/discover.html, and src/viewer.html. Never edit generated preview HTML directly. Build all pages and verify navigation.
- Run npm run build and npm run check after changes. Keep the documents consistent with material design or behavior changes.
- Keep the implementation plain HTML/CSS/JavaScript. Do not introduce a framework or a backend without a user request.
- Keep demo logic flexible and modular; final application functions will be designed independently.
- Visible demos loop independently, stop off-screen, respect reduced motion, and stop on user interaction while preserving choices. Do not restore replay, pause, or resume buttons.
- Exceptions explicitly requested by the user: the landing hero resumes rotation after manual interaction. Customize uses one guided cursor across Design, Merge and Sleeve, starting when the first panel enters view. The shared tour pauses on hover/interaction and resumes after six idle seconds; focused inputs/keyboard focus stay paused, off-screen targets freeze progress without forced scrolling, and reduced motion shows final states. The Artwork box is manual and does not participate in the cursor tour. Other demos retain pause-on-interaction behavior.
- Use stable layout coordinates for visibility. Do not let entrance animations cause layout changes or get cancelled with instructional animations.
- Use consistent even spacing, restrained visual styling, and readable contrast. Keep card artwork unchanged in light and dark themes.
- Distinguish sample functionality from real product functionality. Do not invent live pricing, full-catalog color analysis, printing, private sharing, authentication, or backend persistence.
- Do not deploy or connect the production project until explicitly requested.
- Communicate concisely: lead with the next action, keep steps bounded, and avoid unnecessary confirmations or tangents.
