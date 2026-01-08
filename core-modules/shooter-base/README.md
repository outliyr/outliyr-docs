# Shooter Base

The Shooter Base plugin is a cornerstone of this asset, delivering a suite of essential systems meticulously crafted to build compelling modern shooter experiences upon the Lyra framework. While Lyra provides a robust game foundation, Shooter Base injects the specialized gameplay mechanics and features that define contemporary shooter titles.

This plugin bridges the gap by offering a rich feature set designed for performance, extensibility, and immersive gameplay:

* **Advanced Weapon & Shooting Mechanics:**
  * Design sophisticated firearms using a **compositional weapon system** that builds upon Lyra's equipment framework.
  * Implement realistic and responsive shooting with a **predictive recoil system** featuring configurable curve-based patterns and player compensation.
  * Handle diverse projectile behaviors, from **server-validated hitscan** (with optional material penetration) to **client-predicted projectiles** (like grenades or rockets) featuring a "merge point trajectory" to align muzzle fire with camera aim.
  * Manage high volumes of fast-moving projectiles efficiently with the **Projectile Manager**, a multithreaded system for trace-based bullets that minimizes actor overhead.
  * Ensure fair and accurate hit registration in networked environments with a robust **Lag Compensation** system that rewinds authoritative hitboxes for trace validation.
* **Player Targeting Assistance:**&#x20;
  * Includes a highly configurable **Aim Assist system**, an input modifier that subtly helps players (especially with gamepads) keep their reticle on or near targets through gentle pull and aim slowdown mechanics.
* **Intelligent Influence Spawn System:**
  * Move beyond simple spawn points with a dynamic system that analyzes game state—considering teammate presence, enemy proximity, and line-of-sight—to calculate a "Bias Score" and select safer, more strategic spawn locations for players, reducing spawn frustration.
* **Extensible GameState Scoring System:**
  * Utilize a foundational GameState component for tracking team and individual scores, automatically handling common events like eliminations and assists via Gameplay Messages and Tag-based stat tracking. It's designed for easy subclassing to implement unique game mode rules and win conditions.
* **Immersive Spectator & Killcam System:**
  * Offer players a modern **Spectator System** that accurately replicates the viewed player's UI (weapon, ammo, quickbar) and camera perspective, using a data proxy system for efficient replication.
  * Includes a sophisticated **Killcam** feature, allowing players to review their demise from their opponent's viewpoint. This leverages Unreal Engine's Replay System and an **experimental World Duplication** feature for accurate playback (Note: Killcam has specific operational requirements, including Standalone mode).
* **Dynamic Accolade System:**
  * Provide instant, data-driven visual and auditory feedback to players for notable in-game achievements (multi-kills, killstreaks, assists). This system uses Gameplay Messages for event detection, server-side processors for logic, and a flexible UMG host widget for client-side display.

Engineered with modularity and extensibility at its core, the Shooter Base plugin integrates seamlessly with Lyra's Gameplay Ability System (GAS) and Experience framework. This design empowers you to leverage its features directly, customize them to fit your unique vision, or even replace specific systems as your project demands. Each system within Shooter Base is documented in detail, allowing you to understand its inner workings and unlock its full potential.

***

### Dependencies & Prerequisites

This plugin builds directly upon the **Modified Base Lyra Game Core** provided with this asset package. It relies heavily on the core concepts and systems established there, including:

* The [equipment](../../base-lyra-modified/equipment/) and [weapon](../../base-lyra-modified/weapons/) system.
* The [Item Fragment](../../base-lyra-modified/items/items-and-fragments/) system (including Transient Fragments).

**It is highly recommended to have a solid understanding of the concepts mentioned above before diving into the ShooterBase-specific features.** This documentation will assume familiarity with those base systems and will focus primarily on the additions and modifications introduced by the ShooterBase Plugin.

***

### Documentation Structure

The ShooterBase plugin encompasses a diverse range of systems critical for modern shooter development. While interconnected in a live game, their documentation can largely be explored based on your immediate area of interest. Each major system listed below has its own dedicated section, providing an in-depth look at its purpose, core concepts, components, and customization options.

Unlike **TetrisInventory** where a sequential reading is recommended, the systems within Shooter Base are largely independent. You are encouraged to explore the documentation for each system based on your project's current needs or your area of interest.:

* **Accolades:** Learn how to implement a data-driven system for rewarding players with visual and auditory feedback for in-game achievements like multi-kills, streaks, and assists.
* **Aim Assist:** Discover the configurable input modifier system designed to help players (especially with gamepads) keep their reticle on or near targets through subtle pull and slowdown mechanics.
* **GameState Scoring System:** Understand the foundational component for tracking scores (team and individual) and implementing game mode rules based on common events like eliminations and assists.
* **Influence Spawn System:** Explore the intelligent spawning system that considers game state (teammates, enemies, Line of Sight) to provide safer and more strategic spawn locations.
* **Killcam System:** Delve into the system that allows players to witness their elimination from their opponent's perspective, leveraging Unreal Engine's replay and world duplication features.
* **Lag Compensation:** Understand the server-side technique for rewinding world state to accurately validate client-side actions (like hitscan shots) in networked environments, ensuring fair hit registration despite latency.
* **Projectile Manager:** Learn about the high-performance system for simulating large numbers of fast-moving, trace-based projectiles (e.g., bullets) efficiently on a background thread with lag-compensated collision.
* **Spectator System:** Discover how to implement an immersive, first-person spectating experience that mirrors the viewed player's UI and camera state, for both live spectating and killcam playback.
* **Weapons:** Explore the advanced weapon functionalities, including a compositional design, predictive recoil, diverse projectile types (hitscan, simulated bullet drop), and robust hit registration for modern shooter gameplay

While each section is designed to be comprehensive on its own, understanding related systems (e.g., Lag Compensation's role in both Weapons and the Projectile Manager) can provide a more holistic view.
