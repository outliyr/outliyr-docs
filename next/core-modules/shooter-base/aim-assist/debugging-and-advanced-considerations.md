# Debugging & Advanced Considerations

With the Aim Assist system configured and your actors targetable, you might need to troubleshoot issues or explore more advanced topics. This page provides information on debugging tools, performance insights, and ideas for extending the system.

***

### Debugging Tools

When aim assist isn't behaving as expected, or when you're tuning its parameters, the built-in debugging tools can be invaluable.

* **Console Variables:**\
  You can control some debugging features using console variables. Access the console in-editor (usually with the `~` key) or during gameplay.
  * **`lyra.Weapon.EnableAimAssist [0/1]`**
    * Toggles the entire aim assist system on (1) or off (0). Useful for quickly A/B testing the effect of aim assist or isolating issues. (Note: This CVar is from Lyra; ensure your asset uses this exact name or update the documentation if it's different).
  * **`lyra.Weapon.DrawAimAssistDebug [0/1]`**
    * Enables (1) or disables (0) a comprehensive on-screen debug display managed by `UAimAssistInputModifier::AimAssistDebugDraw`. When active, you'll see:
      * **Current Strengths:** `Pull Strength`, `Slow Strength`.
      * **Look Rates:** `Look Rate Yaw`, `Look Rate Pitch`.
      * **Input Values:** The `Baseline Value` (raw input) and `Assisted Value` (output after aim assist).
      * **Reticles:**
        * Visual representation of the `AssistInnerReticleBounds` (often blue).
        * Visual representation of the `AssistOuterReticleBounds` (often a lighter blue/purple).
        * Visual representation of the `TargetingReticleBounds` (often grey).
      * **Target Information:** For each target being processed by `UAimAssistInputModifier`:
        * Their screen bounds (`Target.ScreenBounds`) are drawn.
        * Color-coding often indicates assist weight (e.g., yellow to green).
        * Text overlay showing `Weight`, `Dist` (distance), `Score`, and `Time` (assist time).
    * This display is extremely useful for visualizing which targets are being picked up, how strong their influence is, and whether your reticle size settings are appropriate. It's context-sensitive to the `TargetingType` (Hip/ADS) of the modifier.
  * **`lyra.Weapon.AimAssist.DrawDebugViewfinder [0/1]`**
    * Enables (1) or disables (0) drawing of the 3D world-space box used by `UAimAssistTargetManagerComponent` for its initial overlap query (`OverlapMultiByChannel`).
    * This helps you visualize the volume in front of the player where potential targets are first detected. If targets you expect to be found aren't even making it to the `FAimAssistTargetOptions` stage, this debug draw can help identify if the overlap query volume is misconfigured or not reaching them.
* **Tips for Debugging Common Issues:**
  * **Targets Not Being Picked Up:**
    1. Ensure the target actor has `UAimAssistTargetComponent` or implements `IAimAssistTaget`.
    2. Verify `FAimAssistTargetOptions::TargetShapeComponent` is correctly assigned and the shape component exists and is active on the target.
    3. Check the target actor's collision settings: Does it overlap with the `AimAssistChannel` defined in your project settings?
    4. Use `lyra.Weapon.AimAssist.DrawDebugViewfinder 1` to see if the target is within the initial query volume.
    5. Use `lyra.Weapon.DrawAimAssistDebug 1` to see if the target appears in the processed list. If not, check `FAimAssistFilter` settings – is it being filtered out by class, tag, team, or health state?
    6. Is the target's `FAimAssistTargetOptions::bIsActive` true?
    7. Is the target within `FAimAssistSettings::TargetRange`?
  * **Assist Too Strong/Weak:**
    1. Adjust `FAimAssistSettings`: `PullInner/OuterStrengthHip/Ads`, `SlowInner/OuterStrengthHip/Ads`, and the overall `StrengthScale`.
    2. Examine `FAimAssistSettings::TargetWeightCurve`. A steep curve can make assist ramp up very quickly.
    3. Check `ULyraAimSensitivityData` and player sensitivity settings. The `GetSensitivtyScalar` method scales assist based on these.
    4. Use `lyra.Weapon.DrawAimAssistDebug 1` to observe the `Pull Strength` and `Slow Strength` values in real-time.
  * **Camera Yanks or Unwanted Snapping:**
    1. Lower `PullInner/OuterStrength` values.
    2. Adjust `PullMaxRotationRate` to a lower value to cap the pull speed.
    3. Review `TargetWeightCurve` – if it ramps up too quickly, targets might become overly "sticky."
    4. If `bApplyStrafePullScale` is active, ensure player movement input is as expected.
  * **Aiming Feels Sluggish:**
    1. Lower `SlowInner/OuterStrength` values.
    2. Increase `SlowMinRotationRate` to ensure a minimum turn speed.
    3. If `bUseDynamicSlow` is false, consider enabling it to make breaking away from targets feel more responsive.

***

### Performance Insights

While designed to be efficient, aim assist does involve calculations every frame. Here are some factors that influence its performance:

* **`FAimAssistSettings::MaxNumberOfTargets`:**
  * This directly limits how many targets undergo detailed processing (visibility traces, scoring, strength calculations) per frame. Keeping this number reasonably low (e.g., 3-6) is crucial for performance, especially in scenarios with many potential targets.
* **`FAimAssistSettings::bEnableAsyncVisibilityTrace`:**
  * **Pros:** Offloads visibility line traces from the game thread, potentially reducing hitches and improving main thread frame rate.
  * **Cons:** Introduces a one-frame latency in visibility detection. This means a target might be occluded, but aim assist could still apply for one frame, or vice-versa.
  * **Trade-off:** Choose based on your game's performance characteristics and tolerance for slight visual/gameplay discrepancies.
* **Overlap Query Frequency & Scope:**
  * The initial overlap query in `UAimAssistTargetManagerComponent` runs every frame that `ModifyRaw_Implementation` is called (which is every frame with input).
  * The size of this query volume (defined by `ReticleDepth` and `AssistOuterReticleWidth/Height`) affects how many actors are initially checked. While usually not a major bottleneck, overly large query volumes in dense environments could contribute to overhead.
* **Complexity of `TargetShapeComponent`:**
  * The projection of target shapes to screen space involves transforming their vertices. Simpler shapes (spheres, capsules, boxes) are generally efficient. Highly complex shapes used as `TargetShapeComponent` (though not typical) could be marginally slower.
* **Number of Potential Targets in Scene:**
  * Even before `MaxNumberOfTargets` culling, the initial overlap query and filtering will iterate over all actors returned by the overlap. In scenes with hundreds of targetable entities within the query range, this initial pass can have a cost.

**Profiling:**\
If you suspect aim assist is a performance bottleneck, use Unreal Engine's profiling tools (Unreal Insights, Stat GPU, Stat Game) to examine the time spent in `UAimAssistInputModifier::ModifyRaw_Implementation` and `UAimAssistTargetManagerComponent::GetVisibleTargets`.

***

### Extending the System (Ideas for Developers)

This aim assist system provides a solid foundation. Here are some ideas for how you might extend or adapt it for more specialized needs:

* **Weapon-Specific Aim Assist Profiles:**
  * Currently, differentiation is mainly Hip/ADS. You could create a system (e.g., a data table or component on weapons) that provides a complete `FAimAssistSettings` struct. When a weapon is equipped, its specific aim assist settings could be applied to the `UAimAssistInputModifier`.
* **Body Part Targeting / Weak Spot Prioritization:**
  * Allow `IAimAssistTaget` to provide multiple `FAimAssistTargetOptions`, each with a different `TargetShapeComponent` (e.g., head, torso) and associated tags or priority scores.
  * Modify the scoring logic to favor certain body parts based on game rules or weapon types.
* **Dynamic Adjustment of Settings:**
  * Change aim assist strength or behavior based on:
    * Player skill (e.g., reduce assist for more experienced players).
    * Target's remaining health (e.g., stronger assist on low-health targets).
    * Game mode or difficulty level.
* **More Sophisticated Target Scoring:**
  * Incorporate factors like target threat level, whether a target is attacking the player, or its velocity vector relative to the player's aim.
* **"Look-At" Assist for Interactables:**
  * Adapt parts of the system to help players aim at interactive objects in the environment, not just enemy targets. This would likely involve different filtering and reticle settings.
* **Custom Reticle Shapes:**
  * The current system uses rectangular reticles for screen-space checks. You could extend it to support circular or other custom reticle shapes for more precise targeting zones, though this would require more complex intersection math.

By understanding the core components and data flow, you are well-equipped to debug, tune, and even expand upon this Aim Assist system to create the ideal aiming experience for your game.

***
