# Squad Play

Welcome to the documentation for the **SquadPlay Plugin**, a squad survival layer for team modes. It adds a downed state that sits between full health and a real death: a knocked player crawls on a bleeding health pool, a teammate can revive them, and once they die for good a teammate can still redeploy them from a dropped banner. A set of teammate frames keeps the whole squad's health, shields, and downed state on screen.

The plugin is a thin layer over systems that already exist. A downed player is still alive to their health component, so team alive counts and elimination logic are untouched; the difference is a single component that owns the downed state and a death ability that decides whether a lethal blow knocks the player down or kills them outright. Nothing in SquadPlay is a game mode. It is a building block that squad-oriented modes opt into, and a mode that never adds it is completely unaffected.

***

### What You Get

| SquadPlay Plugin     | Description                               |
| -------------------- | ----------------------------------------- |
| Downed State         | A bleeding pool between health and death  |
| Down vs Die Decision | Knock when the squad can save you         |
| Bleed-Out Decay      | Gradual drain that shortens per knock     |
| Revive               | Teammate hold, or self-revive             |
| Redeploy             | Respawn from a dropped banner at a beacon |
| Teammate Frames      | Squad health, shields, and downed state   |

***

### How It Builds on Base Lyra

SquadPlay introduces no new health, damage, team, or interaction concepts. It arranges the ones that already exist so a lethal hit can resolve into a recoverable knockdown.

| Base System                                                                         | How SquadPlay Uses It                                                                                                                                             |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GAS Abilities](../../base-lyra-modified/gas/)                                      | The squad death ability extends the Lyra death ability and, instead of always dying, decides between the downed state and a real death from the same death event  |
| [Damage and Healing](../../base-lyra-modified/gas/damage-and-healing.md)            | The bleed-out drains the real health attribute through a SetByCaller damage effect, so a knocked player is finished by the same damage pipeline as anyone else    |
| [Team](../../base-lyra-modified/team/)                                              | The squad team info extends the team model to track carried banners, and reviving asks the team subsystem whether an able teammate exists                         |
| [Interaction](../../base-lyra-modified/interaction/)                                | Revive, banner pickup, and beacon redeploy are ordinary interactable actors, so they surface through the standard look-at prompt with no special UI               |
| [Experiences](../../base-lyra-modified/gameframework-and-experience/experiences.md) | A mode opts in through an action set that adds the downed component and grants the death, revive, and redeploy abilities; the plugin itself is `ExplicitlyLoaded` |

> [!INFO]
> You should be comfortable with [GAS Abilities](../../base-lyra-modified/gas/), the [Team](../../base-lyra-modified/team/) model, and [Experiences](../../base-lyra-modified/gameframework-and-experience/experiences.md) before diving in. This documentation focuses on what the plugin adds and links to the base docs for shared concepts.

***

### Key Concepts

* **The Downed State** — A knocked player keeps their real health, so they still count as alive, but a component takes over: it restores a fighting pool, watches that pool, and converts the down into a real death when the pool empties. The state is a replicated flag mirrored onto a `Status.Death.Downed` gameplay tag, so abilities and UI can react on both server and clients.
* **Down Versus Die** — The squad death ability runs on the same death event any pawn receives. It knocks the player down only when the squad can still act on it, meaning a teammate is able to revive or the player can self-revive. Otherwise it proceeds straight to a real death, so the last player standing simply dies.
* **Bleed-Out As Decay** — There is no separate kill timer. The restored pool drains gradually over a bleed-out window, so a knocked player grows easier to finish the longer they are down, and enemy damage stacks on top of the drain. Reaching zero, from the drain or a bullet, is the single death path.
* **Revive And Self-Revive** — A living teammate revives a knocked player through a hold interaction that brings them back at a fixed fraction of maximum health. A player granted a self-revive can recover alone, which is also what lets the last member of a squad be knocked rather than killed.
* **Redeploy From A Banner** — A player who dies for good drops a banner. A teammate retrieves it and carries it, team-wide, then redeems it at a respawn beacon. `SquadPlay` announces the redeploy and hands the actual respawn to mode content, so each mode decides how a member returns.
* **Teammate Frames** — A single UI element shows every squad member's tracked resources and their downed or dead state, sampled on the server and replicated as compact snapshots so the whole squad stays visible without each member's pawn being relevant to the viewer.

***

### Documentation Structure

| Section                                             | What It Covers                                                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [**Downed System**](downed-system.md)               | The downed component end to end: the down-versus-die decision, the restored pool, bleed-out decay and the knockdown counter, the invulnerability window, and how a down becomes a death |
| [**Revive**](revive.md)                             | The revive interactable, teammate revive and self-revive, and the health a player returns with                                                                                          |
| [**Redeploy**](redeploy.md)                         | Banners, the respawn beacon, the redeploy request message, and where a mode plugs in its own respawn                                                                                    |
| [**Teammate Frames**](teammate-frames.md)           | The squad frame UI, the tracked-resource snapshot, and downed styling                                                                                                                   |
| [**Setup & Integration**](setup-and-integration.md) | Adding SquadPlay to an experience, the squad hero data, and the content a mode wires up                                                                                                 |
| [**Extending**](extending.md)                       | Swapping the downed health bar, writing a mode's redeploy handler, and the downed content hooks                                                                                         |
