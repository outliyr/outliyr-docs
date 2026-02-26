# Core Concept

The defining characteristic and core strength of the Lyra Game Phase System lies in its use of **hierarchical Gameplay Tags**. The structure you create with these tags dictates how different phases relate to each other and, most importantly, how the system automatically manages transitions by ending conflicting phases.

### Gameplay Tag Structure: Parent.Child

The system relies on the standard Gameplay Tag convention where tags are structured using dots (`.`) to denote parent-child relationships.

* **Example Hierarchy:**
  * `GamePhase.Warmup`
  * `GamePhase.Playing`
  * `GamePhase.Playing.Warmup`
  * `GamePhase.Playing.Standard`
  * `GamePhase.Playing.SuddenDeath`
  * `GamePhase.PostGame`
  * `GamePhase.PostGame.Scoreboard`
  * `GamePhase.PostGame.Exfiltration` _(Example for an extraction mode)_
* **Terminology:**
  * **Parent:** A tag that contains child tags (e.g., `GamePhase.Playing` is the parent of `GamePhase.Playing.Warmup`).
  * **Child:** A tag nested under a parent (e.g., `GamePhase.Playing.Standard` is a child of `GamePhase.Playing`).
  * **Sibling:** Tags sharing the same immediate parent (e.g., `GamePhase.Playing.Warmup` and `GamePhase.Playing.Standard` are siblings). `GamePhase.Setup`, `GamePhase.Playing`, and `GamePhase.PostGame` are also siblings (under the implicit `GamePhase` parent).
  * **Ancestor:** A tag that is a parent, grandparent, etc., of another tag (e.g., `GamePhase.Playing` is an ancestor of `GamePhase.Playing.SuddenDeath`). A tag is also considered an ancestor of itself for matching purposes in some contexts, but the cancellation logic specifically looks for _strict_ ancestors (parents/grandparents).

You define these tags in the Project Settings under **Project -> Gameplay Tags**. Careful planning of your game's phase hierarchy using this tag structure is crucial for the system to behave as intended.

### Activation & Cancellation Logic (The Core Rule)

The `ULyraGamePhaseSubsystem` enforces a specific rule when a new `ULyraGamePhaseAbility` is activated via `StartPhase`:

**Rule:** _When a new phase ability (let's call its tag `NewPhaseTag`) is activated, the subsystem iterates through all currently active phase abilities. For each active phase ability (with tag `ActivePhaseTag`), it checks if `ActivePhaseTag` is an **ancestor** of `NewPhaseTag`. If `ActivePhaseTag` is **NOT** an ancestor of `NewPhaseTag`, the ability corresponding to `ActivePhaseTag` is **cancelled and ended**._

**In simpler terms:** Starting a new phase automatically cleans up any active phases that aren't its direct parents or grandparents in the tag hierarchy. Siblings and unrelated branches will end; ancestors will remain active.

### Examples of the Rule in Action

Let's trace the rule using the example hierarchy above:

1. **Initial State:** No phases active.
   * **Action:** `StartPhase(GamePhase.Warmup)`
   * **Result:** `GamePhase.Warmup` becomes active. (No active phases to check against).
2. **State:** `GamePhase.Warmup` is active.
   * **Action:** `StartPhase(GamePhase.Playing)`
   * **Check:** Is `GamePhase.Warmup` an ancestor of `GamePhase.Playing`? **No.**
   * **Result:** The `GamePhase.Warmup` ability is cancelled. `GamePhase.Playing` becomes active.
3. **State:** `GamePhase.Playing` is active.
   * **Action:** `StartPhase(GamePhase.Playing.Warmup)`
   * **Check:** Is `GamePhase.Playing` an ancestor of `GamePhase.Playing.Warmup`? **Yes.**
   * **Result:** `GamePhase.Playing` remains active. `GamePhase.Playing.Warmup` also becomes active. (We now have two active phases: the parent and the child).
4. **State:** `GamePhase.Playing` and `GamePhase.Playing.Warmup` are active.
   * **Action:** `StartPhase(GamePhase.Playing.Standard)`
   * **Check 1:** Is `GamePhase.Playing` an ancestor of `GamePhase.Playing.Standard`? **Yes.** -> `GamePhase.Playing` remains active.
   * **Check 2:** Is `GamePhase.Playing.Warmup` an ancestor of `GamePhase.Playing.Standard`? **No.** (They are siblings under `GamePhase.Playing`). -> `GamePhase.Playing.Warmup` is cancelled.
   * **Result:** `GamePhase.Playing` remains active. `GamePhase.Playing.Standard` becomes active.
5. **State:** `GamePhase.Playing` and `GamePhase.Playing.Standard` are active.
   * **Action:** `StartPhase(GamePhase.PostGame)`
   * **Check 1:** Is `GamePhase.Playing` an ancestor of `GamePhase.PostGame`? **No.** -> `GamePhase.Playing` is cancelled.
   * **Check 2:** Is `GamePhase.Playing.Standard` an ancestor of `GamePhase.PostGame`? **No.** -> `GamePhase.Playing.Standard` is cancelled.
   * **Result:** `GamePhase.PostGame` becomes active.
6. **State:** `GamePhase.PostGame` is active.
   * **Action:** `StartPhase(GamePhase.PostGame.Scoreboard)`
   * **Check:** Is `GamePhase.PostGame` an ancestor of `GamePhase.PostGame.Scoreboard`? **Yes.** -> `GamePhase.PostGame` remains active.
   * **Result:** `GamePhase.PostGame` and `GamePhase.PostGame.Scoreboard` are both active.

### Visual Diagram

Imagine the tags forming a tree structure:

```
GamePhase
  ├── Warmup
  ├── Playing
  │    ├── warmup
  │    ├── Standard
  │    └── SuddenDeath
  └── PostGame
       ├── Scoreboard
       └── Exfiltration
```

When you start a phase, follow the line _up_ towards the root (`GamePhase`). Any active phase that isn't on that direct path upwards will be ended.

Understanding this hierarchical tag structure and the associated cancellation rule is fundamental to effectively using the Lyra Game Phase System to manage your game's flow. The next section will detail the specific C++ components involved.

***
