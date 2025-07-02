# Gun Weapon Instance

The `UGunWeaponInstance` is the cornerstone of firearm behavior in the `ShooterBase` plugin. It extends Lyra's foundational `ULyraRangedWeaponInstance` to introduce a sophisticated, pattern-based **Predictive Recoil System**, designed to deliver the satisfying and skillful gunplay found in modern shooters.

While you can use Lyra's base classes, `UGunWeaponInstance` is the recommended starting point for any conventional firearm (rifles, pistols, SMGs) in your project. It inherits all the powerful features of its parents—like the dynamic spread/heat system and damage falloff—and builds upon them with a robust recoil model.

> [!info]
> For a refresher on the base weapon functionalities, you can refer to the core documentation for [`ULyraWeaponInstance`](../../../../base-lyra-modified/weapons/weapon-instance.md) and [`ULyraRangedWeaponInstance`](../../../../base-lyra-modified/weapons/range-weapon-instance.md).

<img src=".gitbook/assets/image (4).png" alt="" title="Rifle Gun Instance">

### The Predictive Recoil Philosophy

Recoil in many games can feel random or jarring. This system is built on a different philosophy: recoil should be **predictable, responsive, and skillful**.

The goal is to create recoil patterns that players can learn and master, rewarding muscle memory and control. It achieves this through a client-focused approach, ensuring the visual feedback for the player firing the weapon is immediate and smooth, even under typical network conditions.

At its core, the system works by:

1. **Defining Patterns:** Using simple curves, you can design the exact path the camera will take, defining the vertical and horizontal "kick" for each consecutive shot in a burst.
2. **Interpolating Smoothly:** Instead of instantly snapping the camera, the system smoothly interpolates the camera's movement over a short duration, making recoil feel like a powerful push, not a jarring glitch.
3. **Recovering Naturally:** After firing stops, the camera smoothly returns towards its original position. Crucially, the system intelligently accounts for any adjustments the player made _during_ the recoil burst, so it never "fights" their aim.
4. **Prioritizing the Player:** All visual recoil is driven by the client firing the weapon for maximum responsiveness. The server validates the shot, but the player's experience is paramount.

***

### Key Features at a Glance

`UGunWeaponInstance` adds the following key systems on top of the base Lyra weapon functionality:

* **Curve-Based Recoil Patterns:** Design unique recoil paths for every weapon using `FRuntimeFloatCurve`.
* **Smooth Camera Interpolation:** The camera kick is spread out over the weapon's fire rate for a fluid feel.
* **Intelligent Player Compensation:** The recovery system recognizes and adapts to the player's efforts to counteract recoil.
* **Client-Predicted Visuals:** Guarantees a responsive and satisfying experience for the local player.
* **Integrated with a Visual Editor:** Comes with a **Recoil Editor** tool to make designing and tuning these patterns fast and intuitive.

***

### Getting Started

Now that you understand the purpose of the `UGunWeaponInstance`, you can dive into the specifics. Your next step depends on your role:

* **For Designers, Artists, and anyone wanting to create or tune weapon feel:**
  * Start with the **Recoil Editor Guide**. This guide will walk you through using the visual tool to create and modify recoil and spread patterns without touching any code.
* **For Programmers and developers who need to understand the underlying code:**
  * Proceed to **The Recoil System: Under The Hood**. This document provides a deep dive into the C++ properties, functions, and logic that power the recoil system, and how you can extend it.
