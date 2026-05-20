# Generator Log UI and Sidebar Enhancements Plan

We will align the Generator Log forms, tabs, and sidebar visibility exactly with your instructions.

## User Review Required

> [!IMPORTANT]
> The database migration script is already executed/prepared. The upcoming changes are purely frontend UI improvements in:
> 1. [page.tsx](file:///d:/Power House Bckp/Running Works/05. Personal Projects/CNIT Official Website/cnit-webapp/app/(staff)/infrastructure/generator/page.tsx)
> 2. [app-shell.tsx](file:///d:/Power House Bckp/Running Works/05. Personal Projects/CNIT Official Website/cnit-webapp/components/shell/app-shell.tsx)

## Proposed Changes

### 1. Form Sticky Layout and Middle Scroll (All Forms)
- Refactor `SheetContent` markup in `NewRunSheet`, `NewRefuelSheet`, and `NewMaintenanceSheet` to use a flex container layout:
  - Header and Footer are fixed/sticky.
  - Form fields wrap in a `flex-1 overflow-y-auto` scrollable container.

### 2. Refueling Entry Form
- **Unit Price**: Add numeric input field `unit_price`. Calculate and auto-populate `cost` dynamically: `cost = (Quantity * Unit Price)`.
- **Date & Time Picker**: Implement the Attendance-style calendar picker (`FlatDatePicker`) and native time picker (`Input type="time"`).
- **Currency**: Remove dropdown field (hardcoded to BDT).
- **Purchased By**: Set the select field to take full width of the container.

### 3. Outage Run Entry Form
- **Outage Date**: Swap the standard date input with `<FlatDatePicker>`.
- **On/Off Time Pickers**: Use browser-native beautiful time pickers. Store the formatted 12-hour AM/PM values in the database for clean tables.
- **Operator Dropdown**: Replace manual text input with a `Select` list containing profiles/staff names.
- **Approved Sign**: Remove the `signed_by_name` input completely.

### 4. Service Entry Form
- **Date of Service**: Swap input with `<FlatDatePicker>`.
- **Currency**: Remove dropdown (hardcoded to BDT).

### 5. Tabs Style & Size
- Wrap the tabs menu list in a scrollable horizontal container and style it to match the Attendance tabs:
  ```tsx
  <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
    <TabsList className="inline-flex w-auto md:grid md:w-full md:max-w-[750px] p-1 h-auto bg-muted/50 rounded-xl whitespace-nowrap md:grid-cols-5">
      ...
    </TabsList>
  </div>
  ```

### 6. Sidebar Menu Navigation
- In [app-shell.tsx](file:///d:/Power House Bckp/Running Works/05. Personal Projects/CNIT Official Website/cnit-webapp/components/shell/app-shell.tsx):
  - Under `Infrastructure`, remove `Domain`, `Hosting`, and `Tickets`. Keep only `Generator Logs`.
  - Remove `module: "infrastructure"` check for `Generator Logs` menu item so it is visible to general staff profiles as well.

## Verification Plan

### Manual Verification
- Check dev server console for compilation results.
- Open forms and test Unit Price multiplication, time fields, dropdown selectors, and scroll behaviour.
- Test sidebar rendering with normal staff account logins.
