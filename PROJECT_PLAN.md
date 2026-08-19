# Project: Image Notes Application — Product & Architecture Guidelines

I want to build a web application inspired by **Google Keep**, but adapted specifically for storing and organizing image-heavy notes.

The goal is **not** to clone Google Keep exactly. I particularly like the simplicity, smoothness, visual hierarchy, and organization model of Google Keep, and I want to use those ideas as the foundation for my own application.

## 1. What I like about Google Keep

The application should capture the following aspects of Google Keep's user experience:

### Simple note-based mental model

Each piece of content is a **note**.

A note can contain:

- A title
- A description/body
- One or more images
- Labels
- A background/color
- Later: additional metadata/features

The application should feel like a collection of visual cards rather than a traditional database or document editor.

### Smooth visual browsing

The main screen should feel like a visual wall of notes.

Notes should be displayed prominently and make good use of the available screen.

I particularly like that Google Keep does not make the interface feel cramped or overly administrative.

The user should be able to visually scan many notes quickly.

### Sidebar organization

I like the Google Keep-style left sidebar.

The sidebar should contain things such as:

- All Notes
- Archived notes
- Labels

Labels should be easy to access and should act somewhat like dynamic categories.

Labels should NOT be treated as traditional hierarchical folders.

A note can have multiple labels simultaneously.

For example:

```text
HP ElitePOS

Labels:
HP
POS
Computer
Warehouse

```

Selecting `HP` should show all notes containing the `HP` label.

Selecting `POS` should show all notes containing the `POS` label.

This means labels effectively create different views over the same collection of notes.

---

# 2. Labels and # autocomplete

One of my favorite Google Keep interactions is adding labels using `#`.

I want a similarly natural interaction.

When the user types:

```text
#h

```

the application should suggest existing labels such as:

```text
#HP
#Hardware
#Handheld

```

If no suitable label exists, the interface should offer something similar to:

```text
+ Create "h..."

```

When the user selects an existing label, it should become an actual label associated with the note rather than merely remaining plain text.

Important:

The `#` syntax is an **input mechanism**, not the underlying data model.

Do NOT store labels only by parsing arbitrary text.

Instead, use a proper Label domain model and a relationship between Notes and Labels.

A note should be able to have many labels.

A label should be able to belong to many notes.

Conceptually:

```text
Note
  │
  ├── Label: HP
  ├── Label: POS
  └── Label: Warehouse

```

---

# 3. Images are especially important

Unlike Google Keep, this application is intended to be **image-heavy**.

Images should therefore be more prominent than ordinary text, while still preserving the clean Keep-like appearance.

A note may contain:

```text
1 image
2 images
3 images
5 images
10+ images

```

## Preview behavior

I do NOT want all images displayed when browsing the main note grid.

For example, if a note contains five images:

```text
┌──────────────────────────┐
│                          │
│ IMAGE 1      IMAGE 2     │
│                          │
│                      +3  │
├──────────────────────────┤
│ HP ElitePOS              │
│ POS terminal             │
│                          │
│ [HP] [POS] [Warehouse]   │
└──────────────────────────┘

```

Only two images should initially be visible.

The `+3` indicator should subtly communicate that three additional images exist.

When the note is opened, all images become available.

The number of images shown in the preview must be a configurable application constant/configuration value, rather than being hard-coded throughout the UI.

For example:

```ts
NOTE_PREVIEW_IMAGE_LIMIT = 2

```

This makes it easy to experiment with different layouts later.

## Image ordering

Images must have an explicit order.

Each image should have something conceptually equivalent to:

```text
position

```

or another robust ordering mechanism.

Do not rely on the database's natural row order.

Eventually I want users to be able to drag images and reorder them.

The architecture should therefore make image reordering easy to add later.

---

# 4. Note cards

The main browsing experience should emphasize:

1. Images
2. Title
3. Description
4. Labels

For example:

```text
┌──────────────────────────────┐
│                              │
│ IMAGE 1        IMAGE 2       │
│                              │
│                        +3    │
├──────────────────────────────┤
│ HP ElitePOS                  │
│ POS terminal                 │
│                              │
│ HP    POS    Warehouse       │
└──────────────────────────────┘

```

The card should make the title visible without requiring the note to be opened.

The description should be visible as well, but can be truncated when necessary.

The user should be able to visually scan notes without opening them.

---

# 5. Full note view

Clicking a note should open a more detailed view.

The full note should contain:

- Title
- All images
- Description/body
- Labels
- Background
- Eventually barcode
- Eventually reactions
- Eventually image reordering controls

The full note view can be significantly larger than the preview card.

The preview card and the full note should be treated as different UI responsibilities.

For example:

```text
NoteCard
    → optimized for browsing

NoteViewer / NoteEditor
    → optimized for viewing/editing

```

Do not create one giant component that handles every responsibility.

---

# 6. Backgrounds

I really like Google Keep's ability to give each note a different visual background.

A note should therefore have a background property.

Do not hard-code background behavior throughout individual components.

Use a domain concept such as:

```ts
type NoteBackground =
  | "default"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | ...

```

The exact initial set of backgrounds can be decided later.

The architecture should make it straightforward to add additional backgrounds in the future.

---

# 7. Future features that the architecture must support

I do NOT need these features implemented immediately.

However, the initial architecture should make them easy to add later.

## Barcode generation

Eventually I want to generate a scannable barcode based on the note title or another note identifier.

For example:

```text
Title:
HP ElitePOS

Barcode value:
HP-ELITEPOS

```

The barcode itself should preferably be generated dynamically rather than storing a rendered barcode image unnecessarily.

The architecture should keep barcode generation as its own feature/module rather than putting barcode-specific logic inside `Note`.

The intended library is:

```text
JsBarcode

```

and Code 128 should be supported.

---

## Reactions

Eventually I want users to be able to react to notes using things such as:

```text
👍
❤️
🔥
✅

```

Do NOT put individual reaction counters directly onto the Note model such as:

```ts
note.thumbsUp
note.hearts
note.fire

```

Instead, design reactions as their own domain concept so that adding additional emoji reactions does not require restructuring the Note model.

For example, conceptually:

```text
Reaction
    noteId
    emoji
    count

```

The exact implementation can evolve later.

---

## Image reordering

Eventually users should be able to drag images to change their order.

Use a dedicated image/gallery concern for this.

The intended library is:

```text
dnd-kit

```

The UI and persistence logic should be kept separate.

---

# 8. Recommended technology stack

Use this stack unless there is a strong technical reason to change it:

### Frontend

```text
TypeScript
React
Vite

```

### Styling

Prefer straightforward CSS / CSS Modules or another maintainable styling approach.

Avoid unnecessary complexity.

The UI should feel polished, smooth, spacious and responsive.

### Backend / Database / Storage

```text
Supabase
PostgreSQL
Supabase Storage

```

Supabase can provide:

- Database
- Image/file storage
- Authentication later if needed
- Access control later if needed

### Server data / caching

```text
TanStack Query

```

Use it to keep server state/data fetching concerns separate from local UI state.

### Drag and drop

```text
dnd-kit

```

### Barcode

```text
JsBarcode

```

### Icons

```text
Lucide

```

### Testing

```text
Vitest
React Testing Library

```

---

# 9. Suggested domain model

The initial data model should be conceptually similar to:

```text
Note
├── id
├── title
├── description
├── background
├── createdAt
└── updatedAt

NoteImage
├── id
├── noteId
├── storagePath
├── position
└── createdAt

Label
├── id
└── name

NoteLabel
├── noteId
└── labelId

```

Later we may add:

```text
Reaction
Barcode
User

```

Do not prematurely over-engineer these future features.

The important thing is to avoid an architecture that makes them difficult later.

---

# 10. Database relationship

The expected relationship is:

```text
Note 1 ──────── * NoteImage

Note * ──────── * Label
       through
       NoteLabel

```

A Note can have multiple images.

A Note can have multiple labels.

A Label can belong to many Notes.

The image ordering must be persistent.

---

# 11. Code architecture

Prefer feature-oriented organization.

For example:

```text
src/
│
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx
│
├── features/
│   │
│   ├── notes/
│   │   ├── components/
│   │   │   ├── NoteCard.tsx
│   │   │   ├── NoteGrid.tsx
│   │   │   ├── NoteEditor.tsx
│   │   │   └── NoteViewer.tsx
│   │   ├── noteApi.ts
│   │   ├── noteTypes.ts
│   │   └── noteLogic.ts
│   │
│   ├── images/
│   │   ├── components/
│   │   │   ├── ImageGallery.tsx
│   │   │   ├── ImageThumbnail.tsx
│   │   │   └── SortableImage.tsx
│   │   ├── imageApi.ts
│   │   ├── imageTypes.ts
│   │   └── imageLogic.ts
│   │
│   ├── labels/
│   │   ├── components/
│   │   │   ├── LabelChip.tsx
│   │   │   ├── LabelInput.tsx
│   │   │   └── LabelSidebar.tsx
│   │   ├── labelApi.ts
│   │   ├── labelTypes.ts
│   │   └── labelLogic.ts
│   │
│   ├── reactions/
│   │   ├── ReactionBar.tsx
│   │   ├── reactionApi.ts
│   │   └── reactionTypes.ts
│   │
│   └── barcodes/
│       ├── Barcode.tsx
│       └── barcodeLogic.ts
│
├── components/
│   ├── Button.tsx
│   ├── Modal.tsx
│   └── IconButton.tsx
│
└── lib/
    ├── database.ts
    ├── storage.ts
    └── validation.ts

```

This is an example architecture, not a rigid requirement.

The key principle is:

> Keep features and responsibilities separated.

Avoid:

- God components
- God functions
- Huge files
- Mixing database operations with UI rendering
- Putting business logic directly inside JSX
- Duplicating logic between components
- Making the Note model responsible for unrelated features

Functions/classes should have a single clear responsibility.

Prefer small, testable, understandable pieces.

---

# 12. Separation of concerns

Please preserve these boundaries:

```text
UI
↓
Feature/application logic
↓
Data access
↓
Database/storage

```

For example:

The React component should not directly contain complicated SQL/database logic.

Likewise, database code should not know how a note card is visually rendered.

Barcode generation should not know anything about React note cards.

Image ordering logic should not depend on how the image thumbnails happen to look.

This separation is important because the project will be built incrementally.

---

# 13. Development philosophy

I do NOT want the entire application built at once.

The application should be developed incrementally.

The first objective is to create a **small, polished vertical slice**.

For example:

### Phase 1

Build:

- Application shell
- Left sidebar
- Note grid
- Create note
- Edit title
- Edit description
- Upload images
- Preview image limit
- Note backgrounds
- Basic labels

### Phase 2

Improve:

- Label autocomplete
- `#label` creation
- Label filtering
- Search
- Note opening/editing
- Image gallery

### Phase 3

Add:

- Image reordering
- Barcode generation
- Reactions
- Archive/pinning/favorites if useful

### Phase 4

Consider:

- Authentication
- Multiple users
- Sharing
- Permissions
- More advanced search/filtering

Do not build Phase 3 or Phase 4 merely because they exist in this document.

Build only what the current development step requires.

---

# 14. Important product principle

The application should feel **smooth and obvious**.

I care more about:

- clean interaction
- visual hierarchy
- responsiveness
- intuitive organization
- pleasant animations/transitions
- good spacing
- large visual content
- easy labeling

than about implementing a huge number of features immediately.

The application should feel closer to a polished consumer application than an administrative CRUD dashboard.

Avoid making everything look like:

```text
table
rows
forms
buttons
database fields

```

Instead, think:

```text
visual notes
images
cards
labels
smooth interactions

```

---

# 15. What I want you to do NOW

Do NOT immediately implement the entire application.

First create a project planning/reference document:

```text
PROJECT_PLAN.md

```

This file should become the living project guideline.

Use the requirements above to create a practical development plan.

The plan should include:

1. Product vision
2. Core UX principles
3. Domain model
4. Technology stack
5. Recommended project structure
6. Database schema proposal
7. Initial MVP scope
8. Incremental development phases
9. Future feature considerations
10. Architectural rules
11. Testing strategy
12. Decisions that should be deferred until they are actually needed

Also create, if useful:

```text
ARCHITECTURE.md

```

for more detailed technical architecture.

Do not create a huge amount of boilerplate code yet.

The first goal is to establish a **clear, maintainable foundation and development roadmap**.

After the planning files exist, we can build the application **one small feature at a time**, referring back to these documents rather than trying to implement everything in one pass.

Before making major architectural changes later, review the existing project plan and update it when the design evolves.