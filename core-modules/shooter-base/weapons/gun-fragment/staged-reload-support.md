# Staged Reload Support

The **Staged Reload System** is a powerful, opt-in feature that allows for interruptible and resumable reload animations. It brings a higher level of realism and player feedback to your weapons, preventing common exploits like animation canceling while allowing for more dynamic gameplay.

This system is fully supported by the provided reload `GameplayAbilities`:

* `GA_Weapon_Reload_Magazine`: For standard magazine-swap reloads.
* `GA_Weapon_Reload_Shells`: For sequential, shell-by-shell reloads (e.g., shotguns).

If a weapon's reload animation is not set up with stages, it will automatically fall back to a traditional, non-interruptible reload. You only need to engage with this system if you want the advanced functionality.

### The Philosophy: Why Staged Reloads?

In a simple reload system, ammo is granted at the very end of an animation. If a player cancels the animation early (by sprinting or swapping weapons), they get no ammo. This works, but it can feel punishing and lacks nuance.

A staged system breaks the reload into logical phases. For a magazine reload, this might be:

1. Ejecting the old magazine.
2. Inserting the new magazine (**ammo is granted here**).
3. Chambering a round and readying the weapon.

If the player interrupts the animation after step 2, they still have a loaded magazine. This feels fair and responsive. For a shotgun, each shell loaded is its own stage, allowing the player to fire after loading just a few shells. This system provides the framework to build these precise, tactical mechanics.

***

### How It Works: The Event-Driven Flow

The entire system is driven by `AnimNotifies` in your reload `Animation Montage`. It follows this sequence:

1. The player activates a reload `GameplayAbility` (`GA_Weapon_Reload_...`).
2. The ability plays an `Animation Montage`.
3. At key moments in the montage (e.g., when a magazine is inserted), you place a `GameplayEvent` **AnimNotify**.
4. This notify broadcasts a specific `GameplayTag`, like `GameplayEvent.ReloadStage.InsertMagazine`.
5. The active reload ability is listening for these events. When it receives one, it consults a **Tag-to-Section Map** that you configure. This map translates the received tag into an `FName` that matches a section name in your montage.
6. Finally, the ability writes this `FName` to the `CurrentReloadSection` property on the weapon's transient gun fragment (`FTransientFragmentData_Gun`).

This `CurrentReloadSection` property is the weapon's "memory." If the reload is canceled, this value persists. When the reload ability is triggered again, it first checks this property. If it's set, the ability tells the montage to resume playing from that specific section name, allowing the player to pick up where they left off.

***

### Implementing a Staged Reload

To add staged reloading to your weapon, you need to configure three things:

**1. The Animation Montage**

Create your reload montage and add named **Montage Sections** at the beginning of each logical phase (e.g., `Start`, `InsertMag`, `End`).

**2. The AnimNotifies**

At the start of each section (except the very first), add an `AnimNotify` of type `GameplayEvent`. In the details of the notify, set its `GameplayTag` to a descriptive tag that represents that stage, for example: `GameplayEvent.ReloadStage.InsertMagazine`.

**3. The Gameplay Ability**

Open your chosen reload ability (`GA_Weapon_Reload_Magazine` or `GA_Weapon_Reload_Shells`). Find the **Reload Stage to Montage Section** map. Here, you will create the link between the event tag and the montage section.

| Key (Gameplay Tag)                         | Value (FName) |
| ------------------------------------------ | ------------- |
| `GameplayEvent.ReloadStage.InsertMagazine` | `InsertMag`   |
| `GameplayEvent.ReloadStage.ReadyWeapon`    | `End`         |

Now, when the `InsertMagazine` event fires from the animation, the system will know the player has reached the `InsertMag` section of the reload.

***

### The Two Reload Models

This system is flexible enough to handle both common reload types.

**Magazine Reload (`GA_Weapon_Reload_Magazine`)**

This ability is designed for weapons that swap a full magazine at once.

* **Ammo Delivery**: Typically, you will have one key stage (e.g., `InsertMag`) where the full capacity of ammo is added to the weapon.
* **Interruption**: If the player cancels before this stage, the weapon remains empty. If they cancel after, the weapon is fully reloaded, and they only need to resume to finish the "readying" animation.

**Shell Reload (`GA_Weapon_Reload_Shells`)**

This ability is for weapons that load ammunition one unit at a time, like most shotguns or bolt-action rifles.

* **Ammo Delivery**: The montage for this reload is typically a loop. The `InsertShell` stage grants **one** round of ammo and then loops back.
* **Interruption**: The player can interrupt the reload at any time. The weapon will retain however many shells were loaded up to that point. This allows a player to fire in the middle of a long reload sequence, adding significant tactical depth.

***

### Preventing Exploits: The Forced Resume Ability

To prevent players from cleverly swapping weapons to skip the final (and often purely cosmetic) part of a reload animation, a passive, local-only ability is automatically granted when a weapon is equipped.

**How it works:**

* When a weapon is equipped, this ability checks if its `CurrentReloadSection` indicates an incomplete reload.
* If a reload was interrupted and is not currently active, this passive ability will automatically try to reactivate the main reload ability.
* This forces the player to complete the animation, ensuring they can't exploit the system to gain a time advantage.

This behavior ensures fairness while maintaining the flexibility and responsiveness of the staged reload system.
