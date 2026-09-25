# HACKFUSION MULTI-TALENTED AGENT

# UI / UX REQUIREMENTS

## 1. DESIGN REFERENCE

Use the uploaded reference image:

`/mnt/data/06e2c8ae-9ba5-4a8f-8a89-aa34e4ecc891.png`

The UI must visually follow the reference:

* Light theme
* Clean professional SaaS dashboard
* Modern AI product appearance
* Minimal text
* Strong visual hierarchy
* Premium but simple
* White background
* Very subtle glassmorphism
* Soft borders
* Soft shadows
* Rounded cards
* Blue / purple accent gradients
* No dark dashboard
* No heavy visual effects

Do NOT create a traditional left-sidebar dashboard.

---

# 2. CORE DESIGN PRINCIPLE

The application should look like a modern AI platform, not an admin panel.

Use:

* Top navigation
* Large centered workspace
* Card-based sections
* Wide content areas
* Compact controls
* Visual status indicators
* Large whitespace
* Minimal labels
* Clear hierarchy

Avoid:

* Left permanent sidebar
* Excessive text
* Huge paragraphs
* Emoji icons
* Dark theme
* Neon colors
* Heavy gradients
* Excessive borders
* Glassmorphism covering the entire page
* Complex nested menus
* Cluttered dashboards

---

# 3. COLOR SYSTEM

## Background

```text
Primary Background: #F8FAFC
Secondary Background: #FFFFFF
Surface: #FFFFFF
```

## Text

```text
Primary: #0F172A
Secondary: #64748B
Muted: #94A3B8
```

## Accent

```text
Primary Blue: #2563EB
Purple: #7C3AED
Cyan: #06B6D4
Green: #16A34A
Orange: #F59E0B
Red: #DC2626
```

Use gradients only for:

* Primary CTA
* Hero highlights
* Selected states
* Small visual accents

Preferred gradient:

```text
linear-gradient(135deg, #2563EB, #7C3AED)
```

---

# 4. TYPOGRAPHY

Use a modern sans-serif font.

Preferred:

```text
Inter
```

Fallback:

```text
system-ui
```

Typography hierarchy:

```text
Page Title: 32px / 700
Section Title: 20px / 650
Card Title: 15px / 600
Body: 14px / 400
Small: 12px / 400
```

Keep typography compact.

Do not use extremely large headings.

---

# 5. LAYOUT

## Desktop

```text
Top Navigation
        ↓
Hero / Product Introduction
        ↓
Main AI Workspace
        ↓
Model + Activity Sections
        ↓
Footer
```

Maximum content width:

```text
1500px
```

Page horizontal padding:

```text
32px
```

Use responsive containers.

---

# 6. TOP NAVIGATION

Create a horizontal navigation bar.

Do NOT use a left sidebar.

Structure:

```text
[Logo] HACKFUSION
       Multi-Talented Agent

                         Home
                         Model Lab
                         Analytics
                         Settings
                              [Avatar]
```

Navigation:

* Home
* Model Lab
* Analytics
* Settings

Active navigation:

* light blue background
* blue text
* subtle rounded pill

Navigation height:

```text
72px
```

Bottom border:

```text
1px solid #E2E8F0
```

Keep navigation clean and compact.

---

# 7. HERO SECTION

Create a wide horizontal hero card.

Do not make it too tall.

Hero contains:

### Left

Small label:

```text
Welcome to
```

Main heading:

```text
HACKFUSION Multi-Talented Agent
```

One short description only:

```text
Multi-model reasoning, verification and reliability.
```

Statistics:

```text
12 Models
6 Agents
1 Verification Engine
```

### Right

Compact feature card:

```text
Generate
Verify
Correct
```

Primary button:

```text
Try a Demo
```

Secondary button:

```text
View Architecture
```

Keep hero text minimal.

---

# 8. MAIN WORKSPACE

This is the most important section.

Use a large card.

Top tabs:

```text
Ask
Research
Code
Document
Math
```

Only one tab selected at a time.

Each tab must change the input mode.

---

# 9. QUERY INPUT

Large clean input box.

Placeholder:

```text
Ask anything...
```

Do not display long instructional text.

Input should support:

* Text
* File upload
* URL
* Code
* Structured task input

Below input:

```text
Smart Pool
Select Models
Add File
```

Right side:

```text
Run Analysis →
```

Primary CTA must be visually dominant.

---

# 10. MODEL SELECTION

Model selection should be compact.

Dropdown:

```text
Model Pool
```

Options:

```text
Smart Pool
Full Pool
Custom Pool
```

Display selected model count:

```text
12 Models Selected
```

Provide a small advanced selector to manually choose models.

---

# 11. AVAILABLE MODELS

Create a compact model section.

Title:

```text
Available Models
```

Subtitle:

```text
via OpenRouter
```

Display providers in cards.

Initial visual providers:

```text
NVIDIA
InclusionAI
Poolside
Dots Studio
Nexagi
Thinking Machine
Cohere
Qwen
Z.AI
Google
Gemma
Deepgram
```

Use the uploaded reference image for provider-logo visual direction.

Each provider card should contain:

```text
[Logo]
Provider Name
Status
```

Status:

```text
Available
Busy
Unavailable
```

Use tiny status indicators.

Do not create giant provider cards.

---

# 12. AI EXECUTION SCREEN

When user clicks:

```text
Run Analysis
```

navigate to an execution workspace.

Use a horizontal progress flow:

```text
Task Analysis
   ↓
Planning
   ↓
Multi-Model Generation
   ↓
Evidence Retrieval
   ↓
Verification
   ↓
Contradiction Check
   ↓
Self-Correction
   ↓
Final Answer
```

Display live states.

Example:

```text
Generating       ✓
Verifying        ●
Evidence         ✓
Correction       —
Finalization     —
```

Use subtle animated status indicators.

---

# 13. MODEL REASONING VIEW

Show models horizontally.

Example:

```text
NVIDIA        InclusionAI       Qwen        Google
  ✓               ✓              ✓            ✓
```

Clicking a model opens its response.

Do not show all reasoning by default.

Use:

```text
View Response
View Evidence
View Verification
```

Avoid exposing private chain-of-thought.

Show concise:

* Answer summary
* Claims
* Evidence
* Verification result
* Confidence
* Errors found

---

# 14. MODEL COMPARISON

Create a comparison table.

Columns:

```text
Model
Answer
Evidence
Contradictions
Verification
Confidence
Status
```

Example status:

```text
Verified
Needs Evidence
Contradiction
Rejected
```

Use compact rows.

Allow sorting and filtering.

---

# 15. EVIDENCE PANEL

Create a dedicated evidence section.

Display:

```text
Claim
Source
Evidence
Support
Confidence
```

Each source should have:

* Source title
* Domain
* Timestamp
* Relevance
* Support status

Use cards rather than large paragraphs.

---

# 16. CLAIM GRAPH

Create a visual claim relationship graph.

Nodes:

```text
Claim
Evidence
Source
Model
Verification
```

Connections show:

```text
Supports
Contradicts
Derived From
Rejected By
Verified By
```

Keep graph visually simple.

Use zoom and hover interactions.

---

# 17. VERIFICATION PANEL

Create verification cards:

```text
Factual
Logical
Mathematical
Code
API
Safety
Evidence
```

Each shows:

```text
Passed
Failed
Warning
Not Verified
```

Example:

```text
Factual Verification
PASS

Evidence Support
92%

Contradiction Risk
Low
```

Do not use large score dashboards everywhere.

---

# 18. CONTRADICTION VIEW

When models disagree, show:

```text
Model A
Claim X

Model B
Claim Y
```

Then:

```text
Conflict Detected
```

Below:

```text
Evidence Check
Verification Result
Resolution
```

Use a clean split comparison.

---

# 19. SELF-CORRECTION UI

When verification fails:

```text
Issue Detected
```

Then show:

```text
Correction Required
```

Timeline:

```text
Initial Answer
      ↓
Issue Detected
      ↓
Additional Evidence
      ↓
Corrected Answer
      ↓
Re-Verification
```

Show number of correction loops:

```text
2 Correction Loops
```

---

# 20. FINAL ANSWER SCREEN

Final result should be the clearest screen.

Top:

```text
Verified Result
```

Then:

```text
Answer
```

Then compact sections:

```text
Evidence
Verification
Limitations
Models Used
```

Primary visual status:

```text
VERIFIED
```

Other states:

```text
PARTIALLY VERIFIED
NEEDS MORE EVIDENCE
REJECTED
```

Never show:

```text
100% Perfect
Guaranteed Correct
Always Correct
```

---

# 21. RELIABILITY CERTIFICATE

Add a premium visual component:

```text
Verification Certificate
```

Display:

```text
Claims Checked
Evidence Sources
Independent Checks
Contradictions Found
Correction Loops
Final Status
```

This is a major visual feature for the hackathon demo.

---

# 22. CONFIDENCE DESIGN

Use compact confidence badges:

```text
High
Medium
Low
Unknown
```

Do not rely on confidence alone.

Always show supporting verification information.

---

# 23. DEMO SCENARIOS

Home page should contain a compact section:

```text
Try a Scenario
```

Cards:

```text
Hallucination Test
Conflicting Answers
Coding Verification
Ambiguous Question
Misleading Document
Insufficient Evidence
API Verification
Self-Correction
```

Keep each card very small.

Each card:

```text
Title
One line description
→
```

No emojis.

Use simple line icons.

---

# 24. RECENT ACTIVITY

Display a small activity panel.

Each row:

```text
Task Name
Status
Time
Confidence
```

Example:

```text
Database comparison
Verified
2 min ago
92%
```

Allow:

```text
View →
```

---

# 25. MODEL LAB PAGE

Top navigation:

```text
Model Lab
```

Main layout:

```text
Model Pool
```

Show all available models.

Filters:

```text
All
Reasoning
Coding
Research
Math
Long Context
```

Each model card:

```text
Provider
Model
Capabilities
Latency
Availability
Verification Metrics
```

Use compact cards.

---

# 26. ANALYTICS PAGE

Do not create a complicated BI dashboard.

Show only meaningful metrics:

```text
Tasks Verified
Claims Checked
Hallucinations Detected
Contradictions Detected
Corrections Performed
Rejected Answers
```

Use:

* Small KPI cards
* One model comparison chart
* One verification trend chart
* One failure category chart

Keep charts simple.

---

# 27. SETTINGS PAGE

Sections:

```text
Model Configuration
OpenRouter
Verification
Execution
Safety
Appearance
```

OpenRouter:

```text
API Key
Connection Status
Available Models
```

Never display the full API key.

Display:

```text
••••••••••••••
```

---

# 28. ADMIN / DEMO CONTROLS

Provide a small top-right settings/admin access.

Admin can configure:

```text
Models
Agents
Verification Rules
Execution Limits
Demo Scenarios
Evaluation Dataset
```

Do not create a sidebar.

---

# 29. GLASSMORPHISM

Use glassmorphism carefully.

Allowed:

* Hero highlights
* Floating action cards
* Small status panels
* Modal dialogs
* Model status overlays

Do NOT use glassmorphism for:

* Entire page
* Main navigation
* Every card
* Main workspace
* Every button

Use solid white surfaces for most components.

---

# 30. CARD STYLE

All cards:

```text
Background: #FFFFFF
Border: #E2E8F0
Border Radius: 16px
Shadow: very subtle
```

Hover:

```text
translateY(-1px)
slightly stronger shadow
```

Avoid:

```text
large shadows
thick borders
strong blur
```

---

# 31. BUTTON STYLE

Primary:

```text
Blue → Purple gradient
White text
Rounded 10–12px
```

Secondary:

```text
White
Thin border
Dark text
```

Tertiary:

```text
Transparent
Muted text
```

Buttons should be compact.

---

# 32. ICONS

Use a consistent icon library.

Preferred:

```text
Lucide
```

Use icons for:

* Navigation
* Upload
* Search
* Code
* Verification
* Evidence
* Analytics
* Settings
* Arrow
* Status

Do NOT use emoji icons.

---

# 33. MODALS

Use centered modal dialogs.

Examples:

```text
Model Details
Evidence Details
Verification Details
Run Details
Settings
```

Modal width:

```text
500–800px
```

Keep modal text concise.

---

# 34. TOASTS

Use small non-blocking notifications.

Examples:

```text
Analysis started
Evidence found
Verification completed
Correction triggered
Run rejected
```

---

# 35. RESPONSIVE DESIGN

Desktop:

```text
Primary target
```

Tablet:

* Reduce card width
* Wrap model cards
* Preserve top navigation

Mobile:

* Convert navigation to compact top menu
* Stack sections vertically
* Keep input large
* Model cards become 2-column
* Tables become horizontally scrollable

Never introduce a permanent left sidebar on mobile.

---

# 36. MICRO-INTERACTIONS

Use subtle animations:

```text
200–300ms
ease-out
```

Allowed:

* Button hover
* Card hover
* Progress transitions
* Status updates
* Loading indicators
* Tab transitions
* Modal transitions

Do not use:

* Excessive bouncing
* Flashing effects
* Huge animations
* Distracting motion

---

# 37. LOADING STATE

Use skeleton loaders.

Example:

```text
Model Response
████████████
████████
██████████████
```

For live agent execution:

```text
Planning        ✓
Models          ●
Evidence        ●
Verification    ○
Finalization    ○
```

---

# 38. ERROR STATES

Every failure must have a clear message.

Example:

```text
Verification Failed

The available evidence was insufficient.

[Request More Evidence]
```

For model failure:

```text
Model Unavailable

Another available model will be used.
```

Never expose raw backend errors to users.

---

# 39. EMPTY STATES

Examples:

```text
No Runs Yet
Start your first analysis.
```

```text
No Evidence Found
Additional verification may be required.
```

Keep empty states visually simple.

---

# 40. ACCESSIBILITY

Must support:

* Keyboard navigation
* Focus states
* Screen readers
* Proper contrast
* ARIA labels
* Accessible buttons
* Accessible forms

Do not rely only on colors to communicate status.

---

# 41. VISUAL DENSITY

Target:

```text
Low-to-medium density
```

The UI should feel spacious.

Prefer:

```text
Less text
More structure
More whitespace
Better cards
```

Do not fill every empty area.

---

# 42. HOMEPAGE FINAL STRUCTURE

Implement exactly this visual hierarchy:

```text
TOP NAVIGATION

        ↓

COMPACT HERO

        ↓

AI TASK WORKSPACE

        ↓

AVAILABLE MODELS + RECENT ACTIVITY

        ↓

DEMO SCENARIOS

        ↓

MINIMAL FOOTER
```

No left sidebar.

---

# 43. FOOTER

Keep footer minimal.

Left:

```text
HACKFUSION Multi-Talented Agent
```

Right:

```text
Documentation
GitHub
Architecture
```

---

# 44. IMPORTANT UI RULES FOR CODEX

Codex must follow these rules strictly:

1. Do not create a left sidebar.
2. Do not create a dark theme.
3. Do not use emojis.
4. Do not use excessive text.
5. Do not use large paragraphs.
6. Do not make every component glassmorphic.
7. Do not use excessive gradients.
8. Do not create oversized cards.
9. Do not create cluttered dashboards.
10. Do not use random colors.
11. Keep all spacing consistent.
12. Keep the UI professional enough for a hackathon jury demonstration.
13. Reuse components instead of creating inconsistent UI styles.
14. Use the uploaded reference image as the primary visual direction.
15. Preserve the same light, premium, clean visual language across every page.

---

# 45. REQUIRED COMPONENT SYSTEM

Create reusable components:

```text
TopNav
HeroSection
TaskWorkspace
TaskTabs
QueryInput
ModelSelector
ModelGrid
ModelCard
ExecutionTimeline
AgentStatus
EvidenceCard
ClaimCard
VerificationCard
ContradictionPanel
CorrectionTimeline
FinalAnswerCard
ReliabilityCertificate
ScenarioCard
ActivityList
MetricCard
AnalyticsChart
SettingsSection
Modal
Toast
Skeleton
EmptyState
```

---

# 46. DESIGN GOAL

The final application should visually communicate:

```text
Generate with many models.
Verify independently.
Detect contradictions.
Correct failures.
Show evidence.
Return only supported results.
```

The interface must feel:

```text
Clean
Trustworthy
Professional
Modern
Technical
Fast
Minimal
Hackathon-ready
```
