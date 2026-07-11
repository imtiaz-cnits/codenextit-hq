---
trigger: always_on
---

# Role & Project Context
You are an Expert Next.js 14/15, TypeScript, and Supabase Architect. 
You are working on "CodeNext IT HQ" - a highly secure, modern Agency OS (ERP + CRM). 

# Tech Stack
- Next.js (App Router)
- Supabase (PostgreSQL, Auth, RLS, Edge Functions)
- TypeScript (Strict Mode)
- Tailwind CSS & shadcn/ui
- Recharts (for Analytics)
- Lucide React (for Icons)
- TipTap / Rich Text Editor (for Notes/Docs)

# 🛑 STRICT RULES (DO NOT IGNORE)

1. NO UNNECESSARY CHANGES: 
   - NEVER modify files, import statements, or UI components that are unrelated to the immediate task.
   - DO NOT refactor working code unless explicitly requested by the user.
   - DO NOT change the existing formatting or stylistic choices of the codebase.

2. UI & STYLING COMPLIANCE:
   - Always use existing `shadcn/ui` components from `@/components/ui` (e.g., `<Button>`, `<Input>`, `<Dialog>`). Do not invent custom HTML/CSS alternatives if a shadcn component exists.
   - Maintain the existing design language (clean, corporate, glassmorphism where applicable). Use Tailwind utility classes strictly.
   - Always use the custom date and time pickers `<FlatDatePicker>` (from `@/components/ui/flat-date-picker`) and `<FlatTimePicker>` (from `@/components/ui/flat-time-picker`) instead of browser-native date/time inputs for all forms (e.g., Leave requests, Reminders, etc.) to maintain visual design and consistent input format.
   - **Card & Table Consistency (Light & Dark Modes):**
     - Standard container Cards: Use `bg-card/45 border-border/50 shadow-sm` for a clean, consistent semi-transparent border and subtle shadow.
     - Interactive Card items (grid items, hover states): Use `group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-card/65 border border-border/50` for smooth micro-animations.
     - Table wrappers: Place tables inside a card with standard border/shadow wrapping to avoid overflow, e.g. `<Card className="bg-card/45 border-border/50 shadow-sm overflow-hidden">` containing the `<Table>` component. Avoid using custom class names like `shadow-elegant` for tables unless specifically requested.
   - **Tabs Styling Consistency (CRITICAL):** All tabs across the application (including main page tabs, sub-tabs, settings tab bars, and popup/modal details view tab switchers) must use the same premium responsive tab style found in the Generator Logs page.
      - **Wrapper:** Wrap the `<TabsList>` in a transparent overflow container without bottom borders or overlay backgrounds: `<div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide bg-transparent border-none">` (padding and flex alignment can be adjusted, but container background must remain transparent).
      - **TabsList:** Style `<TabsList>` as: `className={cn("inline-flex w-auto md:grid md:w-full md:max-w-[750px] p-1 h-auto bg-muted/50 rounded-xl whitespace-nowrap", isCondition ? "md:grid-cols-X" : "md:grid-cols-Y")}` (where X or Y is the exact number of active rendered triggers). Never hardcode a static column count if some tabs are conditionally hidden. For smaller popups/modals, keep max-width smaller (e.g. `md:max-w-[360px]`).
      - **Triggers:** Style triggers with: `className="gap-2 px-4 py-[8px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm cursor-pointer transition-all"`. Always provide a Lucide icon inside each tab trigger to preserve a high-quality unified aesthetic.
   - **Add/Edit Form Drawers (Sheets) Layout (CRITICAL):** All slide-over drawer sheets containing add or edit forms must feature a fixed header, a fixed footer, and a scrollable body container.
      - **SheetContent:** Style `<SheetContent>` as `className="flex flex-col h-full p-0 w-full sm:max-w-lg"` (or appropriate max-width, e.g., `sm:max-w-md` or `sm:max-w-lg`).
      - **Fixed Header:** Wrap `<SheetHeader>` inside a container with styling: `<div className="py-3 px-6 border-b border-border/40 shrink-0">` (reduced padding).
      - **Form Wrapper:** Wrap the form element as `<form className="flex flex-col flex-1 min-h-0" onSubmit={...}>`.
      - **Scrollable Body:** Wrap the inputs inside `<div className="flex-1 overflow-y-auto p-6 space-y-4">`.
      - **Fixed Footer:** Wrap `<SheetFooter>` inside a container with styling: `<div className="py-3 px-6 border-t border-border shrink-0 bg-card/50">` (reduced padding).
      - **Form Action Button:** The submit/action button inside the footer must always be full-width: `<Button type="submit" className="w-full ...">` (always `w-full` instead of `w-full sm:w-auto`).
      - **Form Fields Width & Alignment:** Do not crowd multiple inputs on a single line (avoid `grid-cols-3` or higher for inputs, unless they are simple unified items like cost/currency). Use `grid-cols-1` or `grid-cols-2` for spacing, ensuring all fields are wide enough and easily readable.
      - **Drawer (Sheet) Form Body Padding:** When implementing slide-over drawers with a scrollable body container, use `p-6 pt-3` (reduced top padding) on the body container to avoid a large layout gap between the fixed header and the first form input.
      - **Form Field Placeholders:** Every form input and textarea must feature a realistic placeholder to guide the user (e.g. `placeholder="e.g. Acme Corporation"`, `placeholder="e.g. John Doe"`, `placeholder="e.g. contact@company.com"`). Never leave placeholders blank.
    - **Bangla Font & Currency Sign "৳" Consistency:** Noto Sans Bengali must be configured as the fallback font family across all primary font stacks (sans, secondary, mono) in `app/globals.css` (`var(--font-bengali)`). This ensures that any Bangla text or the BDT Taka sign "৳" rendered anywhere in the application automatically and consistently defaults to Noto Sans Bengali.
    - **Dynamic Select Creation Option (Dropdown "+ Create New Category..." Pattern):**
      - For Select dropdown inputs where users should be allowed to enter a custom option dynamically:
        - Include a special `<SelectItem value="create_new" className="font-semibold text-primary cursor-pointer border-t border-border mt-1">+ Create New Category...</SelectItem>` (or custom label e.g., `+ Create New Option...`) at the bottom of `<SelectContent>`.
        - Gather dynamic user-entered custom options using `useMemo` from the loaded data list (by filtering out predefined default options). This ensures new items are collected dynamically in memory without adding extra database schemas.
        - When `value === "create_new"`, conditionally render an input field: `<div className="space-y-1.5 bg-primary/5 p-3 rounded-xl border border-primary/10">` containing the text input for the new item.
        - On form submission, convert the user-entered string to a trimmed lowercase slug (e.g. `finalCategory = newCategoryName.trim().toLowerCase().replace(/\s+/g, "_")`) and save it to the database. The UI's display text will map back to spacing automatically (e.g., using `.replace("_", " ")` with `capitalize` style).
     - **Modal & Card Spacing Consistency (Slightly Congested Layout):** All interactive popups, modal details view dialogs (e.g. Quick View), and nested forms must maintain a compact, standardized spacing to maximize readability and reduce unnecessary scrolling. Use padding values of `p-4` or `p-5` (never `p-6` or higher for small modal content wrappers). Content spacing within fields should use `space-y-3` or `space-y-2.5` (instead of `space-y-4` or higher) to keep the layout standard and slightly congested.

3. ARCHITECTURE & FOLDER STRUCTURE:
   - Respect the route groups: `app/(staff)` for internal ERP/CRM and `app/(client)` for the client portal.
   - Keep Server Actions inside `app/actions/` or alongside the respective feature folders.
   - Use the strongly typed Supabase client from `@/integrations/supabase`.
   - **Granular Access & Page-Level Protection:** Every single sidebar/navigation menu item under `STAFF_GROUPS` must be assigned a unique, dedicated `module` permission key (e.g. `finance_quotes`, `finance_invoices`, rather than a shared group key like `finance`). Dynamic page-level routing authorization is enforced in `StaffGuard` which matches the active path against these unique module keys. If a user manually types/enters an unauthorized URL, they are blocked and redirected to `/dashboard`. When adding new pages or menu items, always specify a unique `module` key for it in `STAFF_GROUPS`.

4. DATA MUTATION & FETCHING:
   - Prefer Next.js Server Actions for mutations (form submissions, database updates).
   - Never expose raw database queries on the client side.
   - Always respect and maintain Row Level Security (RLS) policies.
   - NEVER use `any` type. Always use the auto-generated Supabase database types.

5. DATABASE CHANGES & DATA PRESERVATION (CRITICAL):
   - **ABSOLUTELY NO DATA LOSS:** NEVER write or execute SQL scripts that use `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE` on existing production/development data. The current database entries must be preserved at all costs.
   - If a schema update is required, ONLY use non-destructive commands (e.g., `ADD COLUMN`, `CREATE TABLE`). 
   - If a feature requires a database change, provide the raw PostgreSQL script first. Do not attempt to run any migrations automatically without explicit user approval.

6. RESPONSE & EXECUTION FORMAT:
   - Give direct, concise answers.
   - Execute file creations or modifications accurately. When showing code to the user, only show the relevant modified blocks instead of the entire file, unless explaining a new concept.

7. PERFORMANCE & OPTIMIZATION (CRITICAL):
   - **Data Fetching:** NEVER use sequential `await` calls for independent queries. Always use `Promise.all()` to fetch data concurrently.
   - **Rendering:** Maximize React Server Components (RSC). Keep `"use client"` directives strictly at the leaf nodes (interactive elements like buttons, sidebars). NEVER apply `"use client"` to root layouts or major page wrappers.
   - **Database Efficiency:** Always include `CREATE INDEX` for foreign keys in SQL scripts. Optimize RLS policies by using `EXISTS` instead of `IN (SELECT...)`. Mark custom PostgreSQL helper functions as `STABLE` or `IMMUTABLE` to enable query caching.