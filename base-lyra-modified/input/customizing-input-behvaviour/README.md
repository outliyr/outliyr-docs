# Customizing Input Behvaviour

Beyond the basic setup of mapping hardware inputs to actions and abilities, Lyra's input system, leveraging Enhanced Input, provides several ways to customize how raw input is processed and how it feels to the player. This includes applying modifiers to input values, managing sensitivity settings, and allowing users to configure their input preferences.

This page will introduce the key mechanisms for tailoring input behavior in Lyra.

**Core Concepts for Customization:**

1. **Enhanced Input Modifiers:**
   * These are small classes that can be applied to individual input mappings within an `InputMappingContext` or globally to an `UInputAction` asset.
   * Their purpose is to alter the raw input value _before_ it's passed on from the `InputAction`.
   * Examples include scaling, dead zones, inversion, and more complex transformations.
   * Lyra provides several custom modifiers tailored to its settings system.
2. **Data-Driven Settings:**
   * Many of Lyra's input customizations (like sensitivity and dead zones) are driven by values stored in shared user settings objects (e.g., `ULyraSettingsShared`). This allows these behaviors to be easily adjusted by the player through UI menus.

