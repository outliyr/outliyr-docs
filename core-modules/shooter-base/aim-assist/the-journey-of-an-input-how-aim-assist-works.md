# The Journey of an Input - How Aim Assist Works

Now that you have a general idea of what the Aim Assist system does, let's dive into the mechanics. This page will walk you through the step-by-step process of how player input is received, how targets are identified and evaluated, and how the final aim assistance is calculated and applied. Think of this as following a single "look" command from the player's controller all the way to the adjusted camera movement on screen.

***

### The Starting Point: Player Input

Everything begins when the player moves their look stick (or mouse, though aim assist is primarily geared towards gamepad input). This raw input is captured by Unreal Engine's **Enhanced Input system**.

The `UAimAssistInputModifier` is registered within an Input Mapping Context, specifically for the look input action. This means that before the raw look input values (typically a 2D vector representing X and Y look-axis deflection) are used to rotate the player's camera, they are first passed to our `UAimAssistInputModifier`.

The key function where the system intercepts this input is `ModifyRaw_Implementation`. This function receives the current raw input value, the time since the last frame (DeltaTime), and a reference to the `UEnhancedPlayerInput` subsystem. From here, the journey to apply aim assistance begins.

***

### Understanding the Player's Perspective: `FAimAssistOwnerViewData`

Before we can even think about targets, the system needs to understand the player's current state and view of the world. This is the job of the `FAimAssistOwnerViewData` struct.

**Why do we need it?**\
To make intelligent decisions about aim assist, we need to know:

* Where is the player looking _from_?
* What is their field of view?
* How can we translate 3D world positions into 2D screen positions (for reticle checks)?
* Is the player moving? How does their movement affect potential target calculations?
* What team is the player on (for friendly fire considerations)?

**What it calculates and stores:**\
On each frame, within `ModifyRaw_Implementation`, `OwnerViewData.UpdateViewData()` is called. This populates the struct with critical information derived from the `APlayerController`:

* `PlayerController` and `LocalPlayer` references.
* View-related matrices: `ProjectionMatrix`, `ViewProjectionMatrix`.
* `ViewRect`: The dimensions of the player's viewport.
* `ViewTransform`: The location and rotation of the player's camera/viewpoint.
* `ViewForward`: The direction the player is currently looking.
* `PlayerTransform`: The player pawn's world location and the controller's rotation (often used as the origin for aim calculations).
* `DeltaMovement`: The change in the player's world position since the last frame.
* `TeamID`: The player's team affiliation, typically sourced from the `ALyraPlayerState`.

**Significance of projection functions:**`FAimAssistOwnerViewData` also provides crucial helper functions like `ProjectReticleToScreen()`, `ProjectBoundsToScreen()`, and `ProjectShapeToScreen()`. These functions use the calculated view and projection matrices to convert 3D world-space coordinates and shapes (like a target's collision box or the aim assist reticles themselves) into 2D screen-space boxes. This is fundamental for determining if a target visually overlaps with the areas where aim assist should be active.

With this comprehensive understanding of the player's perspective, the system is now ready to look for targets.

***

### Finding Potential Targets: The `UAimAssistTargetManagerComponent`

The `UAimAssistTargetManagerComponent` is a game-state component that acts as the central registry and finder for all things that can be targeted by aim assist.

**Role:**\
Its primary responsibility is to efficiently identify actors in the vicinity that _could_ be aim assist targets. It doesn't do the final decision-making yet, but rather provides a list of candidates.

**How it finds targets:**\
The manager uses a broad-phase approach to gather potential targets. Within its `GetVisibleTargets` function (called by the `UAimAssistInputModifier`):

1. **Overlap Query:** It performs a world overlap query (e.g., `World->OverlapMultiByChannel`). This query typically uses a box shape projected in front of the player, based on parameters like `ReticleDepth` and `AssistOuterReticleWidth` from `FAimAssistSettings`.
2. **Collision Channel:** The query specifically looks for actors on a designated collision channel, which you can configure in your project's settings (see `GetAimAssistChannel()`, which often pulls from `UShooterBaseRuntimeSettings`). Actors that you want to be targetable must be set up to overlap with this channel.
3. **`IAimAssistTaget` Interface:** The system then checks if the overlapped actors or their components implement the `IAimAssistTaget` interface. This interface is the contract that an actor uses to declare itself as "aim-assistable."

**`GatherTargetOptions` from `IAimAssistTaget`:**\
If an actor or component implements `IAimAssistTaget`, the manager calls its `GatherTargetOptions(OUT FAimAssistTargetOptions& TargetData)` function. This is where the target actor provides its specific details to the aim assist system:

* `TargetShapeComponent`: A `TWeakObjectPtr<UShapeComponent>` pointing to the specific collision shape (e.g., a capsule, box, or sphere) that represents the target's hitbox for aim assist purposes.
* `AssociatedTags`: A `FGameplayTagContainer` of tags associated with this target. These can be used by the `FAimAssistFilter` to include or exclude targets.
* `bIsActive`: A boolean indicating if this target is currently active and should be considered.

The result of this stage is a raw list of `FAimAssistTargetOptions` for all nearby, self-declared, and potentially active targets.

***

### Qualifying Targets: Filtering and Initial Checks

Having a list of potential targets is one thing; determining if they are _valid_ candidates for the current player is another. This is where filtering and initial culling come into play, still within the `UAimAssistTargetManagerComponent::GetVisibleTargets` logic.

**Applying `FAimAssistFilter`:**\
The `FAimAssistFilter` struct (configured on the `UAimAssistInputModifier`) provides a set of rules to narrow down the target list. The `DoesTargetPassFilter()` function checks each `FAimAssistTargetOptions` against these rules:

* **Basic Validity:** Is the `TargetShapeComponent` valid? Is the target marked `bIsActive`?
* **Self/Instigator Exclusion:** The target actor shouldn't be the player pawn itself or its instigator.
* **Range Checks:** Is the target within the `TargetRange` defined in `FAimAssistSettings` (taking into account FOV scaling)?
* **Team Checks:** If `bIncludeSameFriendlyTargets` in the filter is false, targets on the same team as the player (using `FAimAssistOwnerViewData::TeamID`) are excluded.
* **Health State:** If `bExcludeDeadOrDying` is true, targets whose `ULyraHealthComponent` (or a similar health system component) indicates they are dead or dying are ignored.
* **Class & Tag Exclusion:** Targets whose owning actor class is in the `ExcludedClasses` set or which have any tags present in the `ExclusionGameplayTags` of the filter are discarded.

**Initial Culling:**\
Beyond the explicit filter, a quick check is done to see if the target is generally in front of the player. This is a dot product check between the player's `ViewForward` direction and the direction to the target. If the target is behind the player, it's usually culled early.

This filtering process significantly reduces the number of targets that need more detailed processing.

***

### From Potential to Candidate: `FLyraAimAssistTarget`

Targets that survive the filtering gauntlet are then processed into a more detailed struct: `FLyraAimAssistTarget`. This struct holds all the necessary runtime information for an individual target that the `UAimAssistInputModifier` will use for its calculations.

For each valid `FAimAssistTargetOptions`, a new `FLyraAimAssistTarget` is created and populated:

* **`TargetShapeComponent`:** The weak pointer to the target's shape is carried over.
* **`Location`:** The current world location of the target (often from the `TargetShapeComponent` or its owner).
* **`DeltaMovement`:** Calculated by comparing the current location with the location from the previous frame (if this target was tracked). This is vital for predicting movement and calculating pull.
* **`ScreenBounds`:** This crucial `FBox2D` is calculated by projecting the target's 3D `TargetShapeComponent` (using its `FCollisionShape` and transform) onto the 2D screen using the projection functions from `FAimAssistOwnerViewData`.
* **`ViewDistance`:** The distance from the player's viewpoint to the target.
* **Reticle Intersection Flags:**
  * `bUnderAssistInnerReticle`: True if the target's `ScreenBounds` intersects with the screen-space projection of the "inner" aim assist reticle (defined by `AssistInnerReticleWidth/Height` in `FAimAssistSettings`).
  * `bUnderAssistOuterReticle`: True if the target's `ScreenBounds` intersects with the screen-space projection of the "outer" aim assist reticle (defined by `AssistOuterReticleWidth/Height` in `FAimAssistSettings`).\
    These flags determine which set of strength parameters (inner vs. outer) will be used.

**Caching and Tracking State:**\
The `GetVisibleTargets` function takes `OldTargets` (the list of `FLyraAimAssistTarget` from the previous frame) as input. This allows for:

* Transferring state like `AssistTime` (how long a target has been under the reticle) and `AssistWeight` (a score based on `AssistTime` and a curve).
* Calculating `DeltaMovement` as mentioned above.
* Reusing asynchronous visibility trace handles.

***

### Visibility and Scoring: Prioritizing Targets

Just because a target is in front of the player and within the reticle doesn't mean it's _actually_ visible (it could be occluded) or the _most important_ target.

**Visibility Checks (`DetermineTargetVisibility`):**\
For each `FLyraAimAssistTarget`:

* A line trace (often called a "visibility trace") is performed from the player's viewpoint (`OwnerData.ViewTransform.GetTranslation()`) to a point on the target (e.g., `Actor->GetActorEyesViewPoint()`).
* This trace checks against the `ECC_Visibility` channel to see if any geometry blocks the line of sight.
* **Asynchronous Traces:** The system supports `bEnableAsyncVisibilityTrace` (from `FAimAssistSettings`). If enabled, and if the target was visible last frame, a new async trace is started for the _next_ frame. The result of the _previous_ frame's async trace is queried for the current frame. This can help offload some work from the game thread but introduces a one-frame latency in visibility detection. If async is off, or if it's the first time seeing a target, a synchronous trace is done.
* The `bIsVisible` flag on `FLyraAimAssistTarget` is updated based on the trace result.

**Scoring (`SortScore`):**\
Each `FLyraAimAssistTarget` is given a `SortScore`. This score helps prioritize targets, especially if there are more candidates than the system is configured to handle. The score is typically a combination of:

* **Previous Assist Weight:** Targets that have been continuously tracked and assisted tend to score higher (`TargetScore_AssistWeight` from `FAimAssistSettings`).
* **Angle to Target Center (View Dot):** Targets closer to the center of the player's view score higher (`TargetScore_ViewDot`, `TargetScore_ViewDotOffset`).
* **Distance:** Closer targets might be prioritized, or this could be inverted depending on the desired effect (`TargetScore_ViewDistance`).

**Limiting Targets:**\
After scoring, if the number of visible and qualified targets exceeds `MaxNumberOfTargets` (from `FAimAssistSettings`), the list is sorted by `SortScore` (highest first), and then trimmed to the maximum allowed. This ensures that the system only processes the most relevant targets, which is important for performance.

The `UAimAssistTargetManagerComponent` then passes this refined, scored, and visibility-checked list of `FLyraAimAssistTarget`s back to the `UAimAssistInputModifier`.

***

### Back to the `UAimAssistInputModifier`: Calculating the Assist

With a curated list of active, visible, and scored targets, the `UAimAssistInputModifier` (specifically in its `UpdateTargetData` and then `UpdateRotationalVelocity` functions) can now calculate the actual aim assist.

**Updating Target Weights:**\
First, for each target in the received list:

* `AssistTime` is updated: It increases if the target is visible and under an assist reticle, and decreases otherwise, clamped by a max time derived from `FAimAssistSettings::TargetWeightCurve`.
* `AssistWeight` is calculated: This is typically looked up from the `TargetWeightCurve` using the `AssistTime`. This curve allows for non-linear weighting (e.g., a target becomes "stickier" the longer it's tracked).
* These weights are then often normalized across all active targets.

**Calculating Overall `PullStrength` and `SlowStrength`:**\
The system iterates through the active targets:

* For each target, `CalculateTargetStrengths()` determines its individual contribution to pull and slow based on:
  * Whether it's under the inner or outer reticle (`bUnderAssistInnerReticle`, `bUnderAssistOuterReticle`).
  * Whether the player is Aiming Down Sights (ADS) or hip-firing (determined by the `TargetingType` of the `UAimAssistInputModifier` instance). This selects the appropriate strength values (e.g., `PullInnerStrengthAds` vs. `PullInnerStrengthHip`) from `FAimAssistSettings`.
  * The target's normalized `AssistWeight`.
* These individual contributions are summed up to get a total `PullStrength` and `SlowStrength` for the frame.
* These strengths are then scaled by `FAimAssistSettings::StrengthScale` and a sensitivity scalar (`GetSensitivtyScalar`, which considers `ULyraAimSensitivityData` and `TargetingType`).
* Finally, the strengths are smoothly interpolated from their previous frame's values using `PullLerpInRate`, `PullLerpOutRate`, etc., from `FAimAssistSettings` to prevent jarring changes.

**Calculating `RotationNeeded`:**\
For each target contributing to the pull, `FLyraAimAssistTarget::GetRotationFromMovement()` is called. This function cleverly calculates the rotational adjustment (Yaw and Pitch) needed to keep the reticle on the target, considering both the target's movement (`DeltaMovement`) and the player's own movement (`OwnerViewData.DeltaMovement`) since the last frame. These needed rotations are weighted by each target's `AssistWeight` and summed up.

**Applying Pull:**\
If `FAimAssistSettings::bApplyPull` is true and there's input (or `bRequireInput` is false):

* The `RotationNeeded` is scaled by the calculated `PullStrength`.
* If `FAimAssistSettings::bApplyStrafePullScale` is true and the player isn't actively looking, the pull strength can be scaled by the player's strafe input amount (to reduce yanking when running past targets).
* The pull rotation can be capped by `FAimAssistSettings::PullMaxRotationRate` (scaled by FOV) to prevent excessive camera movement.
* This "pull rotation" is added to the `RotationalVelocity` that will eventually modify the input.

**Applying Slowdown:**\
If `FAimAssistSettings::bApplySlowing` is true and the player is actively looking (or `bRequireInput` is false):

* The player's current look input is scaled down by `(1.0f - SlowStrength)`.
* The `FAimAssistSettings::GetLookRates()` function (factoring in `bUseRadialLookRates`) determines the base look rates, which are then modified by the slowdown.
* If `FAimAssistSettings::bUseDynamicSlow` is true, the slowdown effect can be intelligently counteracted if the player is trying to aim _away_ from the "pull" direction towards the target, allowing them to break off more easily.
* The slowed rotation rate can be floored by `FAimAssistSettings::SlowMinRotationRate` (scaled by FOV) to ensure the aim doesn't become overly sluggish.
* This "slowed input" contributes to the final `RotationalVelocity`.

If no slowdown is applied, the raw look input (scaled by look rates) is used.

***

### The Result: Modified Input

The `UpdateRotationalVelocity` function ultimately returns a `FRotator` representing the desired rotational change for the frame, combining the player's intended input with the calculated pull and slowdown effects.

This `FRotator` (RotationalVelocity) is then converted back into an `FInputActionValue` (a `FVector` for look input). The components of the `RotationalVelocity` (Yaw, Pitch) are divided by the player's current look rates (from `GetLookRates`) to effectively reverse the process of converting stick input to rotation speed. This results in a modified stick input value that, when processed by the standard camera rotation logic, will produce the assisted camera movement.

This final, modified `FInputActionValue` is what `ModifyRaw_Implementation` returns, and it's this value that the Enhanced Input system will then use to update the player's view. The journey is complete, and the player experiences a subtly assisted aiming experience.

***

This is a dense page, but it covers the entire core logic flow! The next page will focus on how developers can configure and customize this system.
