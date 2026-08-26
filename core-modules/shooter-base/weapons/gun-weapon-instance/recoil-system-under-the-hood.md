# Recoil System: Under The Hood

This document provides a technical deep-dive into the `UGunWeaponInstance` class and its predictive recoil system. It's intended for programmers who need to understand the internal logic, extend its functionality, or integrate it with other systems. It assumes you have read the top-level introduction and understand the system's core philosophy.

### Class Hierarchy and Role

`UGunWeaponInstance` inherits its functionality from a chain of Lyra classes, adding recoil logic at the final step.

```
UObject
└─ ULyraEquipmentInstance // Base for all equipment, handles spawning, attributes.
   └─ ULyraWeaponInstance // Adds weapon-specific logic like animation layers, input device feedback.
      └─ ULyraRangedWeaponInstance // Adds spread/heat mechanics and damage falloff.
         └─ UGunWeaponInstance // Adds the predictive recoil system.
```

The primary role of this class is to manage the state and logic for a client-predicted, pattern-based recoil that feels responsive and skillful.

***

### Configuration Properties

These properties, configured on your `UGunWeaponInstance` Blueprint, are the main knobs for tuning recoil behavior. They are designed to be edited visually using the Recoil Editor.

| Property                       | Type                 | Description                                                                                                                                                                       |
| ------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VerticalRecoilCurve`          | `FRuntimeFloatCurve` | Defines the **vertical** camera rotation (Pitch) applied per shot. The X-axis is the consecutive shot number (1, 2, 3...), and the Y-axis is the kick in degrees (positive = up). |
| `HorizontalRecoilCurve`        | `FRuntimeFloatCurve` | Defines the **horizontal** camera rotation (Yaw) applied per shot. The X-axis is the shot number, and the Y-axis is the kick in degrees (positive = right).                       |
| `RecoilRecoveryDelay`          | `float`              | The time in seconds after the _last shot_ before the recoil recovery process begins.                                                                                              |
| `RecoilRecoverVerticalSpeed`   | `float`              | How quickly (degrees per second) the vertical recoil recovers towards its starting point.                                                                                         |
| `RecoilRecoverHorizontalSpeed` | `float`              | How quickly (degrees per second) the horizontal recoil recovers.                                                                                                                  |
| `RecoilRecoverStepTime`        | `float`              | The tick interval for the recovery `FTimerHandle`. A smaller value results in smoother but more frequent updates.                                                                 |

### **Attribute-Based Modifiers**

The recoil system also integrates with the [tag attribute system](../../../../base-lyra-modified/equipment/equipment-instance.md#managing-runtime-state-tag-attributes-fgameplaytagattributecontainer). This allows recoil to be modified by `GameplayEffects`, such as those from attachments or player buffs. The base values from the curves are multiplied by these attribute values.

* `Lyra.RangeWeapon.Gun.Stat.VerticalRecoil`: A float attribute that acts as a multiplier on all vertical recoil. A value of `0.8` would mean 20% less vertical recoil.
* `Lyra.RangeWeapon.Gun.Stat.HorizontalRecoil`: A float attribute that acts as a multiplier on all horizontal recoil.

***

### Recoil Logic Flow: From Shot to Recovery

Understanding the sequence of function calls is key to debugging or extending the system.

**1. Firing & Initiation (`AddRecoil`)**

When a firing `GameplayAbility` confirms a successful shot, it calls `UGunWeaponInstance::AddRecoil(FireRate)`. This function is the entry point and orchestrates the entire process:

* It immediately calls `StopRecoilRecovery()` to halt any ongoing recovery from a previous burst.
* It calls `TrackPlayerRecoilCompensation()` to log the player's current aim before the kick is applied. This is critical for the smart recovery logic later.
* It calculates `RecoilInterpolationDuration` based on the weapon's fire rate, determining how long the smooth kick will take.
* Finally, it calls `UpdateRecoil()` to begin the process for the new shot.

**2. Calculation & Interpolation (`UpdateRecoil` -> `UpdateRecoilInterpolation`)**

`UpdateRecoil()` is responsible for calculating the kick for the current shot and starting the smooth interpolation:

* It increments `RecoilIntSteps`, which tracks the consecutive shot number in the current burst.
* It calls `CalculateRecoil()`, which evaluates the `VerticalRecoilCurve` and `HorizontalRecoilCurve` at the current `RecoilIntSteps` to get the target kick angles for this shot. It also applies the attribute-based multipliers here.
* It sets up the start and end values for the interpolation (`PreviousVerticalRecoil`, `DesiredVerticalRecoil`, etc.).
* It starts a `FTimerHandle` (`RecoilTimer`) that repeatedly calls `UpdateRecoilInterpolation`.

`UpdateRecoilInterpolation()` executes on each timer tick:

* It uses `FMath::Lerp` to find the current recoil value between the start and end points.
* It calculates the _delta_ (the change since the last tick) and feeds this into `ApplyRecoilToCamera()`.
* It accumulates the total recoil applied into `RecoilRecoverVerticalValue` and `RecoilRecoverHorizontalValue`. These accumulators track the total offset that will need to be recovered later.
* The timer stops once the interpolation is complete.

**3. Recovery (`WaitForRecoilRecoveryDelay` -> `StartRecoilRecovery` -> `UpdateRecoilRecovery`)**

When the firing ability detects that the player has stopped firing, it calls `WaitForRecoilRecoveryDelay()`:

* This starts a short timer. Once it finishes, `StartRecoilRecovery()` is called.
* `StartRecoilRecovery()` performs one final check on player aim compensation and, most importantly, adjusts the total recovery amount based on how much the player has already pulled their aim down.
* It then starts another `FTimerHandle` (`RecoilRecoverTimer`) that repeatedly calls `UpdateRecoilRecovery()`.

`UpdateRecoilRecovery()` runs every tick of the recovery timer:

* It calculates how much recoil to recover in this step based on `RecoilRecover...Speed` and `RecoilRecoverStepTime`.
* It subtracts this step from the accumulated `RecoilRecover...Value` trackers.
* It calls `ApplyRecoilToCamera()` with the _negative_ of the step value, smoothly moving the camera back.
* The timer stops once the accumulated recoil values are near zero, and `ResetRecoilRecoveryValues()` is called to clean up for the next burst.

**4. The "Secret Sauce": Player Compensation (`TrackPlayerRecoilCompensation`)**

This function is the key to making recovery feel natural.

* It's called just before each recoil kick and at the start of the recovery phase.
* It compares the player's current `ControlRotation.Pitch` to the value it stored during the last check.
* The difference is accumulated in `RecoilRecoverVerticalDirection`. This value effectively measures how much the **player has intentionally moved their mouse vertically** during the recoil burst.
* In `StartRecoilRecovery()`, this compensation amount is used to reduce the total vertical recoil that the automatic recovery needs to handle. If the player perfectly pulls down against the recoil, the automatic recovery will do nothing, preventing the system from "over-recovering" and fighting the player's input.

***

### Network Model

The recoil system is designed for maximum player responsiveness.

* **Client-Predicted:** All recoil calculation and camera manipulation via `ApplyRecoilToCamera()` happens on the **owning client** that is firing the weapon.
* **Server-Authoritative Firing:** The server is still in charge. The firing `GameplayAbility` communicates with the server to validate the shot and deal damage. The server does not need to know or replicate the visual recoil state.
* **State Management:** The necessary state, like `RecoilIntSteps`, is implicitly managed on the client by the sequence of firing events. It resets automatically when recovery completes.

### How to Extend

* **Modify Recoil with Gameplay Effects:** This is the easiest method. Create a `GameplayEffect` to grant to the player or weapon. Use a `ModMagnitudeCalculation` to add or multiply the `Lyra.RangeWeapon.Gun.Stat.VerticalRecoil` or `...HorizontalRecoil` attributes. This is perfect for attachments, stances, or temporary buffs.
* **Triggering from Abilities:** Ensure your custom firing abilities call `AddRecoil()` on a successful, client-predicted shot and `WaitForRecoilRecoveryDelay()` when the firing input is released.
* **Custom Recoil Logic:** For radically different recoil styles (e.g., a charge-based recoil), you can create a new C++ class that inherits from `UGunWeaponInstance` and override the key functions like `UpdateRecoil()` and `UpdateRecoilRecovery()` with your own timer and calculation logic.
